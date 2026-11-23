// The picker along the bottom of the overlay, a port of the original editor's: Tab steps between
// pointing, sprites and objects; in the two picking modes a filter field narrows the list by name, a
// name field tells what is under the mouse or picked, and the matching items fill the bar in cells
// sized by how many there are. Each mode remembers its own pick and filter. There is no scrolling
// panel: the wheel over the bar turns a page of cells, so every item can be reached, and an item
// can be dragged out of the bar into the room as well as picked and then clicked down.

// the list of every object the game knows, with each one's own sprite, made by a tool
const ED_OBJECT_LIST_FILE = "assets/editor_objects.json";
// The fields, measured up from the overlay's bottom as the original's sat on its 400 high overlay,
// and the bar of cells under them, as tall as the bottom bar.
const ED_PICK_FILTER_X = 2;
const ED_PICK_FILTER_DY = 50;
const ED_PICK_NAME_X = 2;
const ED_PICK_NAME_DY = 40;
const ED_PICK_CELLS_DY = 29;
const ED_PICK_FILTER_COLOR = "#ffff99";
const ED_PICK_FILTER_MIN_W = 50;
const ED_PICK_NAME_COLOR = "#99aacc";
// cells are big for a few items, middling up to the second count, small past it
const ED_PICK_FEW = 21;
const ED_PICK_SOME = 84;
const ED_PICK_BIG = 28;
const ED_PICK_MID = 14;
const ED_PICK_SMALL = 9;
// the cell under the mouse as the original outlined it, and the picked one, which it left unmarked
const ED_PICK_HOVER_COLOR = "#ff9900";
const ED_PICK_CUR_COLOR = "#ffffff";
const ED_PICK_CUR_ALPHA = 0.5;
// what the name field shows with nothing under the mouse, and with no items at all
const ED_PICK_NO_HOVER = "--";
const ED_PICK_NO_ITEMS = "XXX";
// the status line's name for each mode
const ED_PICK_MODE_NAMES = ["Ptr", "Spr", "Obj"];

const EdPicker = {
	// pointing, sprites or objects
	mode: 0,
	// the pick and filter each picking mode had when left
	spriteSpi: 0,
	spriteFilter: ED_DEFAULT_SPRITE_FILTER,
	objectSpi: 0,
	objectFilter: ED_DEFAULT_OBJECT_FILTER,
	// the filter field's text and its prefix, which in pointing mode only points at itself
	filter: { pretext: "", text: " <- ", noedit: true },
	// the names that pass the filter, which one is picked, and which cell the mouse is on
	items: [],
	curspi: 0,
	hoverCell: -1,
	// every object's own sprite from the list, and the sprites in name order
	objects: {},
	spriteNames: [],
	// an item pressed in the bar and maybe being dragged into the room
	dragging: false,

	// The object list and the sprite names, once the world and its sprites are loaded.
	load(list) {
		this.objects = list && list.objects ? list.objects : {};
		this.spriteNames = Object.keys(Sprites.records).filter((n) => !Sprites.records[n].guessed && n !== "sNoMask")
			.sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1);
	},

	// A room's own saved filters, its mode kept.
	roomLoaded(room) {
		this.spriteFilter = room.last_sp_flt;
		this.objectFilter = room.last_ob_flt;
		if (this.mode === 1) this.filter.text = this.spriteFilter;
		if (this.mode === 2) this.filter.text = this.objectFilter;
		this.refilter();
	},

	// The filters as the room saves them, the one being used read from its field.
	filters() {
		return {
			sprite: this.mode === 1 ? this.filter.text : this.spriteFilter,
			object: this.mode === 2 ? this.filter.text : this.objectFilter
		};
	},

	// Switches mode, keeping the pick and filter of the mode left and taking up the new one's.
	setMode(m) {
		if (this.mode === 1) {
			this.spriteSpi = this.curspi;
			this.spriteFilter = this.filter.text;
		}
		if (this.mode === 2) {
			this.objectSpi = this.curspi;
			this.objectFilter = this.filter.text;
		}
		this.mode = m;
		if (m === 1) {
			this.curspi = this.spriteSpi;
			this.filter = { pretext: "s:", text: this.spriteFilter, noedit: false };
		} else if (m === 2) {
			this.curspi = this.objectSpi;
			this.filter = { pretext: "o:", text: this.objectFilter, noedit: false };
		} else {
			this.filter = { pretext: "", text: " <- ", noedit: true };
		}
		this.refilter();
		Editor.hovers = [];
		Editor.markHover();
	},

	// the names passing the filter, any part of the name matching, case aside
	refilter() {
		const f = this.filter.text.toLowerCase();
		const all = this.mode === 1 ? this.spriteNames : (this.mode === 2 ? Object.keys(this.objects).sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1) : []);
		this.items = all.filter((n) => f === "" || n.toLowerCase().includes(f));
		this.curspi = clamp(this.curspi, 0, Math.max(0, this.items.length - 1));
	},

	// An item by its spot in the list: its name, the sprite it places with, and for an object its
	// name to save. An object's sprite is its ported class's own, else the original's, else the blank.
	item(i) {
		const name = this.items[i];
		if (name === undefined) return null;
		if (this.mode === 1) return { name: name, spi: name, isobj: undefined };
		const cls = loadedObjectClass(name);
		const spi = cls !== undefined && cls.defaultSprite !== undefined ? cls.defaultSprite : (this.objects[name] || ED_BLANK_SPRITE);
		return { name: name, spi: spi, isobj: name };
	},

	current() {
		return this.mode === 0 ? null : this.item(this.curspi);
	},

	cycle(wh) {
		const n = this.items.length;
		if (n > 0) this.curspi = (this.curspi + wh + n) % n;
	},

	// The bar's cells for the overlay's size: their size, how many to a row and a page, and the
	// first item on the page holding the pick.
	layout(gw, gh) {
		const n = this.items.length;
		const isize = n > ED_PICK_SOME ? ED_PICK_SMALL : (n > ED_PICK_FEW ? ED_PICK_MID : ED_PICK_BIG);
		const ipw = Math.max(1, Math.floor(gw / isize));
		const cap = ipw * Math.max(1, Math.floor(ED_PICK_CELLS_DY / isize));
		return { isize: isize, ipw: ipw, cap: cap, first: Math.floor(this.curspi / cap) * cap, top: gh - ED_PICK_CELLS_DY };
	},

	// The two fields for the overlay to show: the filter, and the name of what is under the mouse,
	// in pointing mode the entry and its object or sprite.
	fields(gh) {
		let name;
		if (this.mode === 0) {
			const h = Editor.hovers[Editor.curhoveri];
			name = h !== undefined ? h.name + " : " + (h.isobj !== undefined ? h.isobj : h.spi) : ED_PICK_NO_HOVER;
		} else if (this.items.length === 0) {
			name = ED_PICK_NO_ITEMS;
		} else {
			name = this.items[this.hoverCell >= 0 ? this.hoverCell : this.curspi];
		}
		return [
			{ kind: "filter", x: ED_PICK_FILTER_X, y: gh - ED_PICK_FILTER_DY, pretext: this.filter.pretext, text: this.filter.text,
				color: ED_PICK_FILTER_COLOR, minw: ED_PICK_FILTER_MIN_W },
			{ kind: "name", x: ED_PICK_NAME_X, y: gh - ED_PICK_NAME_DY, pretext: "", text: name, color: ED_PICK_NAME_COLOR, minw: 0 }
		];
	},

	// The bar's share of a step in the picking modes: the cell under the mouse, a press picking it
	// or, with S, giving its sprite or object to the selection, and the wheel turning pages. Tells
	// whether the mouse is on the bar.
	step() {
		const ed = Editor;
		const inp = ed.inp;
		const gs = EdGui.scale;
		const gw = ed.canvas.width / gs;
		const gh = ed.canvas.height / gs;
		this.hoverCell = -1;
		if (this.mode === 0 || ed.showAsPlayer || ed.mouse.gy < gh - ED_HUD_BOTTOM_H) return false;
		const L = this.layout(gw, gh);
		const lx = Math.floor(ed.mouse.gx / L.isize);
		const ly = Math.floor((ed.mouse.gy - L.top) / L.isize);
		const i = L.first + ly * L.ipw + lx;
		if (ed.mouse.gy >= L.top && lx < L.ipw && i < Math.min(this.items.length, L.first + L.cap)) this.hoverCell = i;
		if (inp.pressed.left && this.hoverCell >= 0) {
			const it = this.item(this.hoverCell);
			if (inp.keysDown.has("KeyF")) {
				// finding every entry of an item comes in a later phase
			} else if (EdEdit.selects.length > 0 && inp.keysDown.has("KeyS")) {
				EdEdit.push();
				for (const rec of EdEdit.selects) {
					// an object takes the new object and its look, a sprite only the new look
					if (it.isobj !== undefined) rec.isobj = it.isobj;
					rec.spi = it.spi;
					EdRoom.refresh(rec);
				}
				EdRoom.relink(ed.room);
			} else {
				this.curspi = this.hoverCell;
				this.dragging = true;
			}
		}
		const wh = Math.sign(inp.wheel);
		if (wh !== 0 && this.items.length > 0) {
			const pages = Math.ceil(this.items.length / L.cap);
			const p = (Math.floor(this.curspi / L.cap) + wh + pages) % pages;
			this.curspi = Math.min(p * L.cap + this.curspi % L.cap, this.items.length - 1);
		}
		return true;
	},

	// The cells, each item's first frame stretched to fill its cell, blanks with two letters, the
	// pick and the cell under the mouse outlined.
	draw(gw, gh) {
		if (this.mode === 0) return;
		const L = this.layout(gw, gh);
		const last = Math.min(this.items.length, L.first + L.cap);
		for (let i = L.first; i < last; i++) {
			const it = this.item(i);
			const cx = ((i - L.first) % L.ipw) * L.isize;
			const cy = L.top + Math.floor((i - L.first) / L.ipw) * L.isize;
			// a sprite the room does not use yet has its picture fetched once it shows here
			Sprites.fetchLoose(it.spi).catch(() => {});
			const sr = Sprites.get(it.spi);
			const xs = L.isize / sr.w;
			const ys = L.isize / sr.h;
			Draw.spriteRaw(it.spi, 0, cx + sr.ox * xs, cy + sr.oy * ys, xs, ys, 0, NO_TINT, 1);
			if (it.spi === ED_BLANK_SPRITE || sr.guessed) Draw.guiText(cx, cy + ED_LABEL_DY, it.name.substring(1, 3), ED_LABEL_COLOR, ED_LABEL_ALPHA, ED_LABEL_FONT);
			if (i === this.curspi || i === this.hoverCell) {
				Draw.color = i === this.hoverCell ? ED_PICK_HOVER_COLOR : ED_PICK_CUR_COLOR;
				Draw.alpha = i === this.hoverCell ? 1 : ED_PICK_CUR_ALPHA;
				Draw.rectangle(cx - 1, cy - 1, cx + L.isize, cy + L.isize, true);
			}
		}
		Draw.alpha = 1;
	}
};
