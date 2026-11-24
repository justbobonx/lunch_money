// Reading and writing room and world files exactly as the original editor wrote them. Reading keeps
// each object's key order, the number text as written and which values were raw setup blocks, so a
// room saved without changes comes back byte for byte. Writing builds the same compact text the
// original encoder made and lays it out with the original's own pretty printer, quirks included.

// The order the original's hash maps gave each kind of map, found from every saved file. A key a map
// gains takes its place from this; keys a file already has keep the order the file gave them.
const ED_KEY_ORDERS = {
	room: ["layer_groups", "camy", "camw", "roomw", "bd_color", "roomh", "camh", "grid_lock", "layers", "grid_size",
		"curlyri", "last_ob_flt", "last_sp_flt", "autogen_boundry_layers", "room_init", "camx"],
	layer: ["disabled", "group", "locked", "wd", "loop_x", "plx_y", "visible", "zsort", "spriteList", "loop_y", "plx_x",
		"name", "gui"],
	entry: ["ang", "exoffx", "spd", "objinit", "ifr", "alpha", "tiledx", "x", "tile_loop", "col", "groups", "y_sc",
		"exoffy", "x_sc", "isobj", "y", "spi", "paths", "name", "tiledy"],
	group: ["bd_sprite", "bgcolor", "folded", "grp_init", "loop_x", "bd_sprite_i", "size", "visible", "pre_grp_vis",
		"type", "loop_y", "name", "colheaderi"],
	world: ["curuid", "object_folders", "rooms", "camy", "camw", "curroomi", "camh", "startroomi", "camx"],
	worldRoom: ["name", "index"]
};

// the original editor's view shape, which its saved camera height follows
const ED_FILE_VIEW_W = 640;
const ED_FILE_VIEW_H = 400;
// the room setup block a room without one gets
const ED_EMPTY_BLOCK = "{}";
// the picker filters a room without saved ones starts with, as the original's
const ED_DEFAULT_SPRITE_FILTER = "s";
const ED_DEFAULT_OBJECT_FILTER = "o";
// the grid a room without one has
const ED_FILE_DEFAULT_GRID = 8;
// marks a setup block written fresh by the editor, so the printer indents it to where it sits
const ED_FRESH_BLOCK_MARK = "\u0001";

const EdFile = {
	// For every object read or built: its keys in order, the number text each key was written with,
	// and the keys holding raw setup blocks. A built object can also note the blocks written fresh,
	// laid out from no indent, which the printer moves in to their place.
	meta: new WeakMap(),

	// Reads a whole file. Objects and arrays come back as plain values, setup blocks as their raw text.
	parse(text) {
		let i = 0;
		const meta = this.meta;
		const space = () => {
			while (i < text.length && (text[i] === " " || text[i] === "\t" || text[i] === "\n" || text[i] === "\r")) i++;
		};
		const str = () => {
			let j = i + 1;
			while (text[j] !== "\"") j += text[j] === "\\" ? 2 : 1;
			const s = JSON.parse(text.slice(i, j + 1));
			i = j + 1;
			return s;
		};
		// one value, noting into the holder's record how a number or block was written
		const value = (m, key) => {
			space();
			const c = text[i];
			if (c === "{") {
				i++;
				const o = {};
				const om = { keys: [], raw: new Map(), blocks: new Set() };
				meta.set(o, om);
				space();
				if (text[i] === "}") { i++; return o; }
				for (;;) {
					space();
					const k = str();
					space();
					i++;
					om.keys.push(k);
					o[k] = value(om, k);
					space();
					if (text[i++] === ",") continue;
					return o;
				}
			}
			if (c === "[") {
				i++;
				const a = [];
				const am = { keys: null, raw: new Map(), blocks: new Set() };
				meta.set(a, am);
				space();
				if (text[i] === "]") { i++; return a; }
				for (;;) {
					a.push(value(am, a.length));
					space();
					if (text[i++] === ",") continue;
					return a;
				}
			}
			if (c === "\"") return str();
			if (c === "»") {
				const e = text.indexOf("«", i);
				const body = text.slice(i + 1, e);
				i = e + 1;
				m.blocks.add(key);
				return body;
			}
			let j = i;
			while (j < text.length && ",]} \t\n\r".indexOf(text[j]) < 0) j++;
			const tok = text.slice(i, j);
			i = j;
			if (tok === "null") return null;
			if (m) m.raw.set(key, tok);
			if (tok === "true") return true;
			if (tok === "false") return false;
			return Number(tok);
		};
		return value(null, null);
	},

	// A new map of the given kind made from the one it was read as. Fields name the values the
	// original editor wrote: a value equal to what the file held keeps the file's own text; one at the
	// default the original left out is left out, unless the file held it; an always written field the
	// file never had stays out while it holds what the editor assumed for it. Keys the editor does not
	// know are kept as read. New keys take their place from the original's order. A fresh block is noted
	// so the printer indents it.
	shape(kind, base, fields) {
		const bm = base ? this.meta.get(base) : undefined;
		const out = {};
		const om = { keys: [], raw: new Map(), blocks: new Set() };
		this.meta.set(out, om);
		const keep = (k) => {
			out[k] = base[k];
			om.keys.push(k);
			if (bm && bm.raw.has(k)) om.raw.set(k, bm.raw.get(k));
			if (bm && bm.blocks.has(k)) om.blocks.add(k);
		};
		const same = (a, b) => {
			if (typeof b === "number") return a !== null && a !== "" && typeof a !== "object" && Number(a) === b;
			if (typeof b === "object" && b !== null) return JSON.stringify(a) === JSON.stringify(b);
			return a === b;
		};
		const has = (k) => base !== null && base !== undefined && Object.prototype.hasOwnProperty.call(base, k);
		const wanted = (k) => {
			const f = fields[k];
			if (has(k) && same(base[k], f.v)) return "keep";
			if (f.v === undefined) return "";
			if (Object.prototype.hasOwnProperty.call(f, "dflt") && same(f.dflt, f.v)) return "";
			if (!has(k) && Object.prototype.hasOwnProperty.call(f, "assumed") && same(f.assumed, f.v)) return "";
			return "new";
		};
		const order = ED_KEY_ORDERS[kind];
		const place = (k) => {
			const f = fields[k];
			const r = order.indexOf(k);
			let at = om.keys.length;
			if (r >= 0) {
				for (let n = 0; n < om.keys.length; n++) {
					if (order.indexOf(om.keys[n]) > r) { at = n; break; }
				}
			}
			om.keys.splice(at, 0, k);
			out[k] = f.v;
			if (f.block) om.blocks.add(k);
			if (f.fresh) (om.fresh = om.fresh || new Set()).add(k);
		};
		if (base) {
			for (const k of bm ? bm.keys : Object.keys(base)) {
				if (!Object.prototype.hasOwnProperty.call(fields, k)) { keep(k); continue; }
				const w = wanted(k);
				if (w === "keep") keep(k);
				else if (w === "new") {
					om.keys.push(k);
					out[k] = fields[k].v;
					if (fields[k].block) om.blocks.add(k);
					if (fields[k].fresh) (om.fresh = om.fresh || new Set()).add(k);
				}
			}
		}
		for (const k of Object.keys(fields)) {
			if (has(k)) continue;
			if (wanted(k) === "new") place(k);
		}
		return out;
	},

	// A list whose items were built fresh keeps the number text the old list had where the item at
	// the same spot is unchanged.
	list(items, base) {
		const bm = base ? this.meta.get(base) : undefined;
		const lm = { keys: null, raw: new Map(), blocks: new Set() };
		this.meta.set(items, lm);
		if (bm) {
			items.forEach((v, n) => {
				if (typeof v === "number" && bm.raw.has(n) && Number(bm.raw.get(n)) === v) lm.raw.set(n, bm.raw.get(n));
				if (typeof v === "string" && bm.blocks.has(n) && base[n] === v) lm.blocks.add(n);
			});
		}
		return items;
	},

	// Numbers as the original wrote them: six places, then trailing zeros and a bare point dropped.
	number(v) {
		let s = v.toFixed(6);
		s = s.replace(/0+$/, "").replace(/\.$/, "");
		return s === "-0" ? "0" : s;
	},

	// The whole file text for a value: the compact text the original's encoder made, then its pretty
	// printer. Setup blocks go in raw, as their text already carries the indent they sit at, except
	// fresh ones, whose every line the printer moves in to the depth of the key holding them.
	write(tree) {
		const meta = this.meta;
		const enc = (v, m, key) => {
			if (v === null || v === undefined) return "null";
			if (typeof v === "boolean") {
				const raw = m ? m.raw.get(key) : undefined;
				return raw !== undefined ? raw : (v ? "1" : "0");
			}
			if (typeof v === "number") {
				const raw = m ? m.raw.get(key) : undefined;
				return raw !== undefined && Number(raw) === v ? raw : this.number(v);
			}
			if (typeof v === "string") {
				if (!m || !m.blocks.has(key)) return JSON.stringify(v);
				return "»" + (m.fresh && m.fresh.has(key) ? ED_FRESH_BLOCK_MARK : "") + v + "«";
			}
			const vm = meta.get(v);
			if (Array.isArray(v)) return "[" + v.map((x, n) => enc(x, vm, n)).join(",") + "]";
			const keys = vm && vm.keys ? vm.keys : Object.keys(v);
			return "{" + keys.map((k) => JSON.stringify(k) + ":" + enc(v[k], vm, k)).join(",") + "}";
		};
		const src = enc(tree, null, null);

		// The original printer: a new line and the indent after every opening, comma and closing,
		// except inside the innermost arrays, which stay on one line. Its innermost test looks ahead to
		// the next bracket anywhere, even in strings and blocks, and a map inside such an array pauses
		// it until the first closing brace, as the original did.
		let out = "";
		let lvl = 0;
		let lowest = 0;
		const truthy = (x) => x > 0.5;
		const tabs = () => "\n" + "\t".repeat(lvl);
		let pos = 0;
		while (pos < src.length) {
			const c = src[pos++];
			if (c === "{" || c === "}" || c === "," || c === "[" || c === "]") {
				if (c === "[") {
					for (let n = pos; n < src.length; n++) {
						if (src[n] === "[") { lowest = 0; break; }
						if (src[n] === "]") { lowest = 1; break; }
					}
				}
				const on = c === "{" || (c === "[" && !truthy(lowest));
				const off = c === "}" || (c === "]" && !truthy(lowest));
				if (c === "{" && truthy(lowest)) lowest = -1;
				if (c === "}" && lowest === -1) lowest = 1;
				if (on) lvl++;
				if (off) {
					lvl--;
					out += tabs();
				}
				out += c;
				if (on || (!off && !truthy(lowest))) out += tabs();
				if (c === "]") lowest = 0;
			} else if (c === "\"") {
				let n = pos;
				while (src[n] !== "\"") n += src[n] === "\\" ? 2 : 1;
				out += src.slice(pos - 1, n + 1);
				pos = n + 1;
			} else if (c === "»") {
				const n = src.indexOf("«", pos);
				out += src[pos] === ED_FRESH_BLOCK_MARK ? "»" + src.slice(pos + 1, n).split("\n").join(tabs()) + "«" : src.slice(pos - 1, n + 1);
				pos = n + 1;
			} else {
				out += c;
			}
		}
		return out;
	},

	// The save map for one entry, as the original wrote its sprite holders: the picture's spot, the
	// settings that differ from a plain sprite, its object and setup, its groups and paths.
	entryTree(rec) {
		const col = rec.col.replace("#", "").toUpperCase();
		return this.shape("entry", rec.saved, {
			name: { v: rec.name },
			spi: { v: rec.spi },
			x: { v: rec.x - rec.exoffx },
			y: { v: rec.y - rec.exoffy },
			exoffx: { v: rec.exoffx, dflt: 0 },
			exoffy: { v: rec.exoffy, dflt: 0 },
			x_sc: { v: rec.x_sc, dflt: 1 },
			y_sc: { v: rec.y_sc, dflt: 1 },
			tiledx: { v: rec.tiledx ? 1 : 0, dflt: 0 },
			tiledy: { v: rec.tiledy ? 1 : 0, dflt: 0 },
			tile_loop: { v: rec.tile_loop ? 1 : 0, dflt: 0 },
			ang: { v: rec.ang, dflt: 0 },
			col: { v: col, dflt: "FFFFFF" },
			alpha: { v: rec.alpha, dflt: 1 },
			spd: { v: rec.spd === 0 ? "0" : rec.spd, dflt: 1 },
			ifr: { v: rec.start_ifr, dflt: 0 },
			isobj: { v: rec.isobj },
			objinit: { v: rec.objinit, block: true, fresh: rec.initFresh },
			groups: { v: rec.groups && rec.groups.length > 0 ? this.list(rec.groups.slice(), rec.saved ? rec.saved.groups : null) : undefined },
			paths: { v: rec.paths }
		});
	},

	// The whole room file. The state gives what the editor holds outside the room: its camera as the
	// original's view, the current layer and the picker filters.
	roomText(room, state) {
		const base = room.data;
		const groups = {};
		const gm = { keys: [], raw: new Map(), blocks: new Set() };
		this.meta.set(groups, gm);
		const savedGroups = base.layer_groups;
		const gorder = savedGroups ? this.meta.get(savedGroups).keys.filter((k) => room.lgroups[k] !== undefined) : [];
		for (const k of Object.keys(room.lgroups)) if (!gorder.includes(k)) gorder.push(k);
		for (const k of gorder) {
			const g = room.lgroups[k];
			gm.keys.push(k);
			groups[k] = this.shape("group", g.saved, {
				name: { v: g.name },
				folded: { v: g.folded ? 1 : 0 },
				visible: { v: g.visible ? 1 : 0 },
				size: { v: g.size },
				type: { v: g.type },
				bgcolor: { v: g.bgcolor },
				bd_sprite: { v: g.bdName },
				grp_init: { v: g.grp_init, block: true, fresh: g.initFresh },
				pre_grp_vis: { v: g.pre_grp_vis ? 1 : 0 },
				colheaderi: { v: g.colheaderi }
			});
		}

		const layers = this.list(room.layers.map((lyr) => this.shape("layer", lyr.saved, {
			name: { v: lyr.name },
			group: { v: lyr.group },
			spriteList: { v: this.list(lyr.lsprites.map((rec) => this.entryTree(rec)), lyr.saved ? lyr.saved.spriteList : null) },
			plx_x: { v: lyr.plx_x, dflt: 1 },
			plx_y: { v: lyr.plx_y, dflt: 1 },
			loop_x: { v: lyr.loop_x > 1 ? lyr.loop_x : undefined },
			loop_y: { v: lyr.loop_y > 1 ? lyr.loop_y : undefined },
			visible: { v: lyr.visible ? 1 : 0 },
			disabled: { v: lyr.disabled ? 1 : 0, dflt: 0 },
			locked: { v: lyr.locked ? 1 : 0, dflt: 0 },
			zsort: { v: lyr.zsort ? 1 : 0, dflt: 0 },
			wd: { v: lyr.wd },
			gui: { v: lyr.gui ? 1 : 0, dflt: 0 }
		})), base.layers);

		const camh = state.camw * ED_FILE_VIEW_H / ED_FILE_VIEW_W;
		const tree = this.shape("room", base, {
			layer_groups: { v: groups },
			layers: { v: layers },
			curlyri: { v: String(state.curlyri) },
			camw: { v: state.camw },
			camh: { v: camh },
			camx: { v: state.camx },
			camy: { v: state.camy },
			roomw: { v: room.roomw },
			roomh: { v: room.roomh },
			last_sp_flt: { v: state.last_sp_flt, assumed: ED_DEFAULT_SPRITE_FILTER },
			last_ob_flt: { v: state.last_ob_flt, assumed: ED_DEFAULT_OBJECT_FILTER },
			grid_lock: { v: room.grid_lock ? 1 : 0, assumed: 0 },
			grid_size: { v: room.grid_size, assumed: ED_FILE_DEFAULT_GRID },
			bd_color: { v: room.bd_color },
			autogen_boundry_layers: { v: room.autogen },
			room_init: { v: room.room_init !== undefined ? room.room_init : ED_EMPTY_BLOCK, block: true, assumed: ED_EMPTY_BLOCK, fresh: room.initFresh }
		});
		return this.write(tree);
	},

	// The world file, as the original's world save: the room list, the next name number, the room
	// open and its camera. Keys the original no longer wrote are kept as read.
	worldText(world, state) {
		const base = world.data;
		const oldRooms = base.rooms || [];
		const rooms = this.list(game.rooms.map((rm, li) => this.shape("worldRoom", oldRooms.find((r) => r.name === rm.name), {
			name: { v: rm.name },
			index: { v: li }
		})), oldRooms);
		return this.write(this.shape("world", base, {
			rooms: { v: rooms },
			curuid: { v: world.curuid.toString(16).toUpperCase() },
			curroomi: { v: state.curroomi },
			camw: { v: state.camw },
			camh: { v: state.camw * ED_FILE_VIEW_H / ED_FILE_VIEW_W },
			camx: { v: state.camx },
			camy: { v: state.camy }
		}));
	}
};
