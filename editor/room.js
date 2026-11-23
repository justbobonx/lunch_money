// A room as the editor holds it, built from the room file. The parsed file is kept whole, and every
// layer and entry keeps the part of it it came from, so the room saves back as it was read, with
// only what was changed written anew. Setup blocks stay as their raw text.
// Layers are the player's own layer records with a few editor fields added. Entries are inert
// placed sprites, the player's own placed sprite record with editor fields on top, much like the
// original editor's sprite holders: they never run, they only draw and animate.

// what an object with no sprite of its own shows, as the original editor did
const ED_BLANK_SPRITE = "sBlankGr";

// Object classes whose own drawing takes its shape and size from their settings: stretched ground,
// sign text, sprite tilers and tiled ground. Their entries draw through that drawing; every other
// entry draws as the plain picture it saved.
const ED_SHAPED_DRAWS = ["oText", "oFloor", "oSpriteTiler", "oSolidGr"];

// the grid size when the room file gives none, as the original editor's default
const ED_DEFAULT_GRID = 8;

// the room camera when the file gives none, the original editor's starting view
const ED_DEFAULT_CAM_W = 640;

const EdRoom = {
	// Builds the editor's room from a room file's text: its layers in file order, every entry as an
	// inert record, then the groups, masks and area bounds tying them together.
	build(rmi, text) {
		const smap = EdFile.parse(text);
		const roomw = smap.roomw !== undefined ? smap.roomw : DEFAULT_ROOM_W;
		const room = {
			index: rmi,
			name: game.rooms[rmi].name,
			data: smap,
			roomw: roomw,
			roomh: roomw * 9 / 16,
			camx: smap.camx !== undefined ? smap.camx : 0,
			camy: smap.camy !== undefined ? smap.camy : 0,
			camw: smap.camw !== undefined ? smap.camw : ED_DEFAULT_CAM_W,
			curlyri: smap.curlyri !== undefined ? Number(smap.curlyri) : 0,
			grid_lock: smap.grid_lock ? 1 : 0,
			grid_size: smap.grid_size !== undefined ? smap.grid_size : ED_DEFAULT_GRID,
			last_sp_flt: smap.last_sp_flt !== undefined ? smap.last_sp_flt : ED_DEFAULT_SPRITE_FILTER,
			last_ob_flt: smap.last_ob_flt !== undefined ? smap.last_ob_flt : ED_DEFAULT_OBJECT_FILTER,
			// the backdrop colour as hex digits, and the room's setup block as its raw text, with
			// whether the panel wrote that block and it waits to be laid out in its place
			bd_color: smap.bd_color,
			room_init: smap.room_init,
			initFresh: false,
			layers: [],
			lgroups: {},
			objGroups: {},
			count: 0
		};

		for (const laymap of smap.layers) {
			const lyr = this.layer(laymap, laymap.name);
			room.layers.push(lyr);
			for (const spri of laymap.spriteList) lyr.lsprites.push(this.record(spri, lyr));
		}

		// The saved groups; the linking below adds the ones layer names need and drops unused ones.
		// The backdrop sprite is kept by name as saved, and drawn only when the game has it.
		const saved = smap.layer_groups || {};
		for (const key of Object.keys(saved)) {
			const g = saved[key];
			room.lgroups[key] = {
				saved: g, name: g.name !== undefined ? g.name : key,
				folded: g.folded ? 1 : 0, visible: g.visible ? 1 : 0, pre_grp_vis: g.pre_grp_vis ? 1 : 0,
				type: g.type !== undefined ? g.type : LGT_CONNECTED,
				bd_sprite: g.bd_sprite !== undefined && Sprites.exists(g.bd_sprite) ? g.bd_sprite : null,
				bdName: g.bd_sprite,
				bgcolor: g.bgcolor !== undefined ? g.bgcolor : "",
				grp_init: g.grp_init,
				initFresh: false,
				size: 0, col_head_lyr: null, colheaderi: -1, layers: [], bounds: null
			};
		}
		this.relink(room);
		return room;
	},

	// A layer record from its saved map, or a fresh empty layer of the room's width when there is
	// none, as the original's new layer.
	layer(laymap, name) {
		const lyr = new Layer(name);
		const m = laymap || {};
		lyr.saved = laymap;
		lyr.visible = m.visible !== undefined ? m.visible : 1;
		lyr.disabled = m.disabled ? 1 : 0;
		lyr.locked = m.locked ? 1 : 0;
		lyr.plx_x = m.plx_x !== undefined ? m.plx_x : 1;
		lyr.plx_y = m.plx_y !== undefined ? m.plx_y : 1;
		lyr.loop_x = m.loop_x !== undefined ? m.loop_x : 0;
		lyr.loop_y = m.loop_y !== undefined ? m.loop_y : 0;
		lyr.zsort = m.zsort ? 1 : 0;
		lyr.wd = m.wd !== undefined ? m.wd : DEFAULT_LAYER_W;
		lyr.ht = lyr.wd * 9 / 16;
		lyr.gui = m.gui !== undefined ? m.gui : 0;
		lyr.host = lyr;
		// the layer list row, as the original's text field for the layer
		lyr.txt = { shown: true, y: 0, pretext: "", text: lyr.name, disabled: !lyr.visible, lastpress: 0 };
		// how the layer maps onto the screen this frame, set by the view
		lyr.lens = null;
		return lyr;
	},

	// An entry record from a saved entry map: the same config the player builds, the colour marked,
	// the speed made a number and the spot moved to the footprint, so the picture draws back where
	// it was placed. Pasting and placing make their entries through here too.
	record(spri, lyr) {
		const cfg = { name: spri.name };
		for (const k of LP_SAVED_FIELDS) if (spri[k] !== undefined) cfg[k] = spri[k];
		if (spri.col !== undefined) cfg.col = "#" + spri.col;
		if (spri.spd !== undefined) cfg.spd = Number(spri.spd);
		cfg.x = (spri.x !== undefined ? spri.x : 0) + (spri.exoffx !== undefined ? spri.exoffx : 0);
		cfg.y = (spri.y !== undefined ? spri.y : 0) + (spri.exoffy !== undefined ? spri.exoffy : 0);
		const cls = spri.isobj !== undefined ? objectType(spri.isobj) : undefined;
		// a saved sprite always wins, it may override the object's own
		if (spri.spi === undefined) cfg.spi = cls !== undefined && cls.defaultSprite !== undefined ? cls.defaultSprite : ED_BLANK_SPRITE;

		const rec = new lpSprite(cfg);
		rec.saved = spri;
		rec.isobj = spri.isobj;
		rec.objinit = spri.objinit;
		// set while a setup block written by the panel waits to be laid out in its place
		rec.initFresh = false;
		rec.initText = undefined;
		rec.init = null;
		rec.start_ifr = rec.ifr;
		rec.groups = Array.isArray(spri.groups) ? spri.groups.slice() : null;
		rec.paths = spri.paths;
		rec.mylayer = lyr;
		rec.hidden = 0;
		rec.selected = false;
		rec.hover = false;
		// whether it was inside the view when last drawn, and the loop shift it drew with
		rec._in_frame = false;
		rec.loopdx = 0;
		rec.loopdy = 0;
		this.refresh(rec);
		return rec;
	},

	// Works out everything an entry shows from its own settings: its sprite's layout, its object
	// class and setup, the stand in shaped objects draw through, the letters of a blank marker and
	// the box used for culling. Run after anything about the entry changes.
	refresh(rec) {
		Draw.setSprite(rec, rec.spi);
		const cls = rec.isobj !== undefined ? objectType(rec.isobj) : undefined;
		rec.cls = cls;
		if (rec.objinit !== rec.initText) {
			rec.initText = rec.objinit;
			rec.init = rec.objinit !== undefined ? game.parseHandWritten(rec.objinit, rec.name) : null;
		}
		const init = rec.init;

		// Shaped objects draw through a stand in of their own class, made and configured the way the
		// world makes them but never set up, added anywhere or run.
		rec.look = null;
		if (cls !== undefined && ED_SHAPED_DRAWS.some((n) => loadedObjectClass(n) !== undefined && loadedObjectClass(n).prototype.draw === cls.prototype.draw)) {
			const cfg = { name: rec.name };
			for (const k of LP_SAVED_FIELDS) cfg[k] = rec[k];
			rec.look = new cls();
			rec.look.configure(init ? Object.assign(cfg, init) : cfg);
			// the tiler measures its tile in its own setup
			if (cls.prototype.draw === oSpriteTiler.prototype.draw) oSpriteTiler.prototype.init.call(rec.look);
		}

		// Objects with no sprite and sprites the game lacks get two letters of their name over their
		// marker, as the original editor's picker did.
		const sr = Sprites.get(rec.spi);
		rec.blank = rec.spi === ED_BLANK_SPRITE || sr.guessed ? (rec.isobj !== undefined ? rec.isobj : rec.spi).substring(1, 3) : "";

		// The box around the picture, from its origin, stretched and turned. Signs add the box of
		// their text.
		const xs = rec.x_sc;
		const ys = rec.y_sc;
		const c = Math.cos(degToRad(rec.ang));
		const s = Math.sin(degToRad(rec.ang));
		const bbox = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
		for (const cx of [-sr.ox * xs, (sr.w - sr.ox) * xs]) {
			for (const cy of [-sr.oy * ys, (sr.h - sr.oy) * ys]) {
				const px = cx * c + cy * s;
				const py = -cx * s + cy * c;
				bbox.l = Math.min(bbox.l, px);
				bbox.r = Math.max(bbox.r, px);
				bbox.t = Math.min(bbox.t, py);
				bbox.b = Math.max(bbox.b, py);
			}
		}
		if (rec.look !== null && cls.prototype.draw === oText.prototype.draw) {
			const look = rec.look;
			Draw.setFont(look.font);
			const tw = Draw.stringWidthExt(look.text, look.linesep, look.twidth);
			const th = Draw.stringHeightExt(look.text, look.linesep, look.twidth);
			const xo = look.xoffset === "c" ? -Math.floor(tw) / 2 : (look.xoffset < 0 ? -tw : look.xoffset);
			bbox.l = Math.min(bbox.l, xo);
			bbox.r = Math.max(bbox.r, xo + tw);
			bbox.t = Math.min(bbox.t, look.yoffset);
			bbox.b = Math.max(bbox.b, look.yoffset + th);
		}
		rec.bbox = bbox;
	},

	// Ties the room together again after layers or entries come or go: which layer each entry and
	// caret layer belongs to, the object groups, the masks and the layer groups with their headers,
	// as the original's group update, and the group area bounds. An entry group the editor is
	// working inside is left once no entry is in it.
	relink(room) {
		room.objGroups = {};
		room.count = 0;
		const masks = [];
		const boundsOf = {};
		let host = null;
		for (const lyr of room.layers) {
			// In play a caret name adds its entries to the layer before it, so it draws with that
			// layer's settings; the editor still lists it as a layer of its own, as the original did.
			if (lyr.name.charAt(0) !== "^" || host === null) host = lyr;
			lyr.host = host;
			lyr.mask_list.length = 0;
			for (const rec of lyr.lsprites) {
				rec.mylayer = lyr;
				room.count++;
				if (rec.groups !== null) {
					for (const gname of rec.groups) {
						if (room.objGroups[gname] === undefined) room.objGroups[gname] = [];
						room.objGroups[gname].push(rec);
					}
				}
				const cls = rec.cls;
				const init = rec.init;
				if (cls !== undefined && (cls === oLayerMask || cls.prototype instanceof oLayerMask)
					&& init && Array.isArray(init.layer_list)) masks.push(rec);
				if (cls === oGroupBounds && init && init.group !== undefined) boundsOf[init.group] = rec;
			}
		}

		if (EdEdit.inGroup !== null && room.objGroups[EdEdit.inGroup] === undefined) EdEdit.inGroup = null;

		// Masks cut the layers they name, as in play. A starred name is skipped, as the player does.
		for (const mrec of masks) {
			for (const lname of mrec.init.layer_list) {
				const lyr = room.layers.find((l) => l.name === lname);
				if (lyr !== undefined) lyr.mask_list.push(mrec);
			}
		}

		for (const key of Object.keys(room.lgroups)) {
			const lg = room.lgroups[key];
			lg.size = 0;
			lg.layers = [];
			lg.bounds = null;
		}
		room.layers.forEach((lyr, li) => {
			if (lyr.group === undefined) return;
			let lg = room.lgroups[lyr.group];
			if (lg === undefined) {
				lg = room.lgroups[lyr.group] = {
					saved: null, name: lyr.group, folded: 0, visible: 0, pre_grp_vis: 0, type: LGT_CONNECTED,
					bd_sprite: null, bdName: undefined, bgcolor: "", grp_init: undefined, initFresh: false, size: 0, col_head_lyr: null, colheaderi: -1, layers: [], bounds: null
				};
			}
			lg.size++;
			lg.layers.push(lyr);
			if (lg.size === 1) {
				lg.col_head_lyr = lyr;
				lg.pre_grp_vis = lyr.visible;
				lg.colheaderi = li;
			}
		});
		for (const key of Object.keys(room.lgroups)) {
			if (room.lgroups[key].size === 0) delete room.lgroups[key];
		}
		for (const key of Object.keys(boundsOf)) {
			if (room.lgroups[key] !== undefined) room.lgroups[key].bounds = boundsOf[key];
		}
	}
};
