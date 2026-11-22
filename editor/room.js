// A room as the editor holds it, built from the room file without changing anything in it.
// The parsed file is kept whole, and every layer and entry keeps the part of it it came from, so a
// later phase can save the room back as it was read. Setup blocks stay as their raw text.
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
	// inert record, the layer groups, the masks and the area bounds. Groups follow the original
	// editor: one for every group a layer name gives, its header the first of its layers.
	build(rmi, text) {
		const smap = game.parseRoom(text);
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
			layers: [],
			lgroups: {},
			objGroups: {},
			count: 0
		};

		const shaped = ED_SHAPED_DRAWS.map((n) => loadedObjectClass(n)).filter((c) => c !== undefined).map((c) => c.prototype.draw);
		const masks = [];
		const boundsOf = {};
		let host = null;

		for (const laymap of smap.layers) {
			const lyr = new Layer(laymap.name);
			lyr.saved = laymap;
			lyr.visible = laymap.visible !== undefined ? laymap.visible : 1;
			lyr.disabled = laymap.disabled ? 1 : 0;
			lyr.locked = laymap.locked ? 1 : 0;
			lyr.plx_x = laymap.plx_x !== undefined ? laymap.plx_x : 1;
			lyr.plx_y = laymap.plx_y !== undefined ? laymap.plx_y : 1;
			lyr.loop_x = laymap.loop_x !== undefined ? laymap.loop_x : 0;
			lyr.loop_y = laymap.loop_y !== undefined ? laymap.loop_y : 0;
			lyr.zsort = laymap.zsort ? 1 : 0;
			lyr.wd = laymap.wd !== undefined ? laymap.wd : DEFAULT_LAYER_W;
			lyr.ht = lyr.wd * 9 / 16;
			lyr.gui = laymap.gui !== undefined ? laymap.gui : 0;
			// In play a caret name adds its entries to the layer before it, so it draws with that
			// layer's settings; the editor still lists it as a layer of its own, as the original did.
			if (laymap.name.charAt(0) !== "^" || host === null) host = lyr;
			lyr.host = host;
			// the layer list row, as the original's text field for the layer
			lyr.txt = { shown: true, y: 0, pretext: "", text: lyr.name, disabled: !lyr.visible, lastpress: 0 };
			// how the layer maps onto the screen this frame, set by the view
			lyr.lens = null;
			room.layers.push(lyr);

			for (const spri of laymap.spriteList) {
				// The same config the player builds: what the entry saved, the colour marked, the speed
				// made a number, and the spot moved to the footprint so the picture draws back where it
				// was placed. Setup blocks are read on the side and never laid on the record.
				const cfg = { name: spri.name };
				for (const k of LP_SAVED_FIELDS) if (spri[k] !== undefined) cfg[k] = spri[k];
				if (spri.col !== undefined) cfg.col = "#" + spri.col;
				if (spri.spd !== undefined) cfg.spd = Number(spri.spd);
				cfg.x = (spri.x !== undefined ? spri.x : 0) + (spri.exoffx !== undefined ? spri.exoffx : 0);
				cfg.y = (spri.y !== undefined ? spri.y : 0) + (spri.exoffy !== undefined ? spri.exoffy : 0);
				const cls = spri.isobj !== undefined ? objectType(spri.isobj) : undefined;
				// a saved sprite always wins, it may override the object's own
				const ownSprite = spri.spi !== undefined || (cls !== undefined && cls.defaultSprite !== undefined);
				if (spri.spi === undefined) cfg.spi = ownSprite ? cls.defaultSprite : ED_BLANK_SPRITE;
				const init = spri.objinit !== undefined ? game.parseHandWritten(spri.objinit, spri.name) : null;

				const rec = new lpSprite(cfg);
				rec.saved = spri;
				rec.isobj = spri.isobj;
				rec.objinit = spri.objinit;
				rec.init = init;
				rec.cls = cls;
				rec.start_ifr = rec.ifr;
				rec.groups = Array.isArray(spri.groups) ? spri.groups : null;
				rec.paths = spri.paths;
				rec.mylayer = lyr;
				rec.hidden = 0;
				rec.selected = false;
				rec.hover = false;
				// whether it was inside the view when last drawn, and the loop shift it drew with
				rec._in_frame = false;
				rec.loopdx = 0;
				rec.loopdy = 0;

				// Shaped objects draw through a stand in of their own class, made and configured the way
				// the world makes them but never set up, added anywhere or run.
				rec.look = null;
				if (cls !== undefined && shaped.includes(cls.prototype.draw)) {
					rec.look = new cls();
					rec.look.configure(init ? Object.assign({}, cfg, init) : cfg);
					// the tiler measures its tile in its own setup
					if (cls.prototype.draw === oSpriteTiler.prototype.draw) oSpriteTiler.prototype.init.call(rec.look);
				}

				// Objects with no sprite and sprites the game lacks get two letters of their name over
				// their marker, as the original editor's picker did.
				const sr = Sprites.get(rec.spi);
				rec.blank = !ownSprite || sr.guessed ? (rec.isobj !== undefined ? rec.isobj : rec.spi).substring(1, 3) : "";

				// The box around the picture, from its origin, stretched and turned, for culling.
				// Signs add the box of their text.
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

				if (rec.groups !== null) {
					for (const gname of rec.groups) {
						if (room.objGroups[gname] === undefined) room.objGroups[gname] = [];
						room.objGroups[gname].push(rec);
					}
				}
				if (cls !== undefined && (cls === oLayerMask || cls.prototype instanceof oLayerMask)
					&& init && Array.isArray(init.layer_list)) masks.push(rec);
				if (cls === oGroupBounds && init && init.group !== undefined) boundsOf[init.group] = rec;

				lyr.lsprites.push(rec);
				room.count++;
			}
		}

		// Masks cut the layers they name, as in play. A starred name is skipped, as the player does.
		for (const mrec of masks) {
			for (const lname of mrec.init.layer_list) {
				const lyr = room.layers.find((l) => l.name === lname);
				if (lyr !== undefined) lyr.mask_list.push(mrec);
			}
		}

		// The saved groups, then one for every group a layer names that has none, headed by its first
		// layer, whose visibility the group remembers. Saved groups no layer uses are left out here
		// but stay in the file data.
		const saved = smap.layer_groups || {};
		for (const key of Object.keys(saved)) {
			const g = saved[key];
			room.lgroups[key] = {
				saved: g, name: g.name !== undefined ? g.name : key,
				folded: g.folded ? 1 : 0, visible: g.visible ? 1 : 0, pre_grp_vis: g.pre_grp_vis ? 1 : 0,
				type: g.type !== undefined ? g.type : LGT_CONNECTED,
				bd_sprite: g.bd_sprite !== undefined && Sprites.exists(g.bd_sprite) ? g.bd_sprite : null,
				size: 0, col_head_lyr: null, colheaderi: -1, layers: [], bounds: null
			};
		}
		room.layers.forEach((lyr, li) => {
			if (lyr.group === undefined) return;
			let lg = room.lgroups[lyr.group];
			if (lg === undefined) {
				lg = room.lgroups[lyr.group] = {
					saved: null, name: lyr.group, folded: 0, visible: 0, pre_grp_vis: 0, type: LGT_CONNECTED,
					bd_sprite: null, size: 0, col_head_lyr: null, colheaderi: -1, layers: [], bounds: null
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
		return room;
	}
};
