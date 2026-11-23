// Changing the room, a port of the original editor's selecting and editing: clicking, shift clicking
// and dragging a box to select; moving, duplicating, resizing by the corners and turning by dragging;
// the key and wheel commands on the selection; cutting, copying and pasting; placing what the picker
// holds and wiping it out again with the right button; and undoing and redoing all of it. Every
// change first keeps the whole room as it would be saved, so undoing puts back exactly that.

// how many changes can be undone
const ED_UNDO_MAX = 100;
// two presses this close are a double press, in ms
const ED_EDIT_DOUBLE_MS = 300;
// the selection's box, the box being dragged out, and the corner grabbers, as the original drew them
const ED_SEL_BOX_COLOR = "#ffffff";
const ED_SEL_BOX_ALPHA = 0.2;
const ED_BOX_SELECT_COLOR = "#ffccff";
const ED_BOX_SELECT_ALPHA = 0.5;
const ED_GRAB_SPRITE = "sle_GrapEdge";
const ED_GRAB_ALPHA = 0.5;
const ED_GRAB_HOT_ALPHA = 1;
// how far a grabber reaches from its point either way, in its sprite's pixels, as its mask
const ED_GRAB_REACH = 2;
// the four grabbers: which side of the box each sits on, as the original's offsets
const ED_GRABBERS = [{ xo: -1, yo: -1 }, { xo: 0, yo: -1 }, { xo: -1, yo: 0 }, { xo: 0, yo: 0 }];
// dragging near the screen's edge scrolls: how near, in overlay pixels, and how far each step goes,
// in room pixels
const ED_EDGE_ZONE = 10;
const ED_EDGE_SCROLL = 3;
// how far jittering shakes each entry, and with shift
const ED_JITTER = 1;
const ED_JITTER_SHIFT = 3;
// the grid doubles each step, and past the largest falls back by this much
const ED_GRID_MAX = 64;
const ED_GRID_FALL = 8;
// new names are the world's next number in this many hex digits at least
const ED_UID_DIGITS = 5;

const EdEdit = {
	// the selected entries, in the order they were selected, and the box round them in view space
	selects: [],
	box: { x1: 0, y1: 0, x2: 0, y2: 0 },
	// Room snapshots to step back and forward through, and which change the room is at. The change
	// last saved tells whether there is anything unsaved.
	undos: [],
	redos: [],
	rev: 0,
	revCount: 0,
	savedRev: 0,
	// what was last copied: the entries as saved, where the selection's box sat and whether it was cut
	clip: null,
	// what a held left button is doing: moving, possibly about to copy first, resizing or turning by
	// a grabber, dragging out a selection box, or placing from the picker
	moving: false,
	movePrimed: false,
	copyPrimed: false,
	resizing: false,
	resizePrimed: false,
	rotating: false,
	rotateStAng: 0,
	grab: null,
	grabX: 0,
	grabY: 0,
	boxSelect: false,
	placing: false,
	lastPlaced: [],
	placeX: 0,
	placeY: 0,
	erasing: false,
	// where the left button went down, in view space, and whether that was in the room itself
	downX: 0,
	downY: 0,
	fromRoom: false,
	// whether the wheel picked through the stack since the mouse last moved
	hoverWheeled: false,
	lastPress: 0,

	// A room just opened or read again: nothing selected, held or to undo.
	reset() {
		this.selects = [];
		this.undos = [];
		this.redos = [];
		this.rev = ++this.revCount;
		this.savedRev = this.rev;
		this.moving = this.resizing = this.rotating = this.boxSelect = this.placing = this.erasing = false;
		this.movePrimed = this.copyPrimed = this.resizePrimed = false;
		this.grab = null;
		this.lastPlaced = [];
	},

	dirty() {
		return this.rev !== this.savedRev;
	},

	// Keeps the room as it is now so the change about to happen can be undone.
	push() {
		this.undos.push(this.snapshot());
		if (this.undos.length > ED_UNDO_MAX) this.undos.shift();
		this.redos.length = 0;
		this.rev = ++this.revCount;
	},

	// Marks a change that is saved with the room but not worth an undo step of its own.
	touch() {
		this.rev = ++this.revCount;
	},

	snapshot() {
		const room = Editor.room;
		const names = (pick) => {
			const out = [];
			for (const lyr of room.layers) for (const rec of lyr.lsprites) if (pick(rec)) out.push(rec.name);
			return out;
		};
		return {
			text: EdFile.roomText(room, Editor.fileState()),
			rev: this.rev,
			selected: names((rec) => rec.selected),
			hidden: names((rec) => rec.hidden)
		};
	},

	// Steps back or forward: the room now goes on the other stack and the kept one is built again.
	undo(back) {
		const from = back ? this.undos : this.redos;
		const to = back ? this.redos : this.undos;
		if (from.length === 0) return;
		to.push(this.snapshot());
		const s = from.pop();
		this.restore(s);
		this.rev = s.rev;
	},

	// Builds the room again from a snapshot, with what was selected and hidden in the editor then.
	restore(s) {
		const ed = Editor;
		ed.adoptRoom(EdRoom.build(ed.room.index, s.text));
		this.selects = [];
		const sel = new Set(s.selected);
		const hid = new Set(s.hidden);
		for (const lyr of ed.room.layers) {
			for (const rec of lyr.lsprites) {
				if (hid.has(rec.name)) rec.hidden = 1;
				if (sel.has(rec.name)) {
					rec.selected = true;
					this.selects.push(rec);
				}
			}
		}
		this.updateBox();
	},

	// Adds an entry to the selection as the original did: its offsets from the mouse kept for moving,
	// its group unfolded and its layer made current, and with a group asked for, the rest of the last
	// group it belongs to.
	select(rec, andgroup) {
		const ed = Editor;
		const room = ed.room;
		if (!this.selects.includes(rec)) this.selects.push(rec);
		rec.selected = true;
		const ml = EdView.mouseOn(rec.mylayer);
		rec.mox = ml.x - (rec.x - rec.exoffx);
		rec.moy = ml.y - (rec.y - rec.exoffy);
		rec.ofx = ml.x - rec.exoffx;
		rec.ofy = ml.y - rec.exoffy;
		const lg = rec.mylayer.group !== undefined ? room.lgroups[rec.mylayer.group] : undefined;
		if (lg !== undefined && lg.folded) EdGui.fold(lg.col_head_lyr, false);
		EdGui.selectLayer(room.layers.indexOf(rec.mylayer));
		this.updateBox();
		if (andgroup && rec.groups !== null && rec.groups.length > 0) {
			for (const member of room.objGroups[rec.groups[rec.groups.length - 1]]) this.select(member, false);
		}
	},

	clear() {
		for (const rec of this.selects) rec.selected = false;
		this.selects = [];
	},

	// The box round the selection in view space, from every picture's corners, stretched but not
	// turned, as the original measured it.
	updateBox() {
		if (this.selects.length === 0) return;
		const b = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
		for (const rec of this.selects) {
			const sr = Sprites.get(rec.spi);
			const l = rec.x - rec.exoffx + rec.loopdx - sr.ox * rec.x_sc;
			const t = rec.y - rec.exoffy + rec.loopdy - sr.oy * rec.y_sc;
			const p = EdView.toView(rec.mylayer, l, t);
			const q = EdView.toView(rec.mylayer, l + sr.w * rec.x_sc, t + sr.h * rec.y_sc);
			b.x1 = Math.min(b.x1, p.x, q.x);
			b.y1 = Math.min(b.y1, p.y, q.y);
			b.x2 = Math.max(b.x2, p.x, q.x);
			b.y2 = Math.max(b.y2, p.y, q.y);
		}
		this.box = b;
	},

	// The grabber a screen spot is on, or none. Grabbers sit just outside the box's corners at the
	// scale the view draws them, growing with the zoom.
	grabberAt(devx, devy) {
		const z = EdView.z;
		const cam = Editor.cam;
		const gs = EdView.markScale(z);
		for (const g of ED_GRABBERS) {
			const gx = ((g.xo < 0 ? this.box.x1 : this.box.x2) - cam.x) * z + g.xo * gs;
			const gy = ((g.yo < 0 ? this.box.y1 : this.box.y2) - cam.y) * z + g.yo * gs;
			const lx = (devx - gx) / gs * (g.xo < 0 ? 1 : -1);
			const ly = (devy - gy) / gs * (g.yo < 0 ? 1 : -1);
			if (lx >= -ED_GRAB_REACH && lx < ED_GRAB_REACH && ly >= -ED_GRAB_REACH && ly < ED_GRAB_REACH) return g;
		}
		return null;
	},

	// The room's next name number, as the original's: the world's counter moved on, in hex.
	newUid() {
		const w = Editor.world;
		w.curuid++;
		return w.curuid.toString(16).toUpperCase().padStart(ED_UID_DIGITS, "0");
	},

	// A name nothing in the taken set has yet, as the original made them: a taken plain hex number
	// gets a new number, a taken name ending in an underscore and digits counts on from them, any
	// other taken name gets an underscore and a count.
	unique(name, taken) {
		if (name === "") return this.newUid();
		if (!taken.has(name)) return name;
		let dec = 0;
		for (const ch of name.toUpperCase()) dec = dec * 16 + Math.max(0, "0123456789ABCDEF".indexOf(ch));
		if (dec.toString(16).toUpperCase() === name) return this.newUid();
		let base = name;
		let tries = 0;
		const us = name.lastIndexOf("_");
		if (us >= 0 && /^\d*$/.test(name.substring(us + 1))) {
			base = name.substring(0, us);
			tries = Number(name.substring(us + 1)) || 0;
		}
		for (;;) {
			tries++;
			if (!taken.has(base + "_" + tries)) return base + "_" + tries;
		}
	},

	// every entry name in the room
	names() {
		const taken = new Set();
		for (const lyr of Editor.room.layers) for (const rec of lyr.lsprites) taken.add(rec.name);
		return taken;
	},

	// Copies the selection as it would be saved, with where its box sits; cutting also deletes it.
	copy(cut) {
		this.clip = {
			items: this.selects.map((rec) => ({ map: EdFile.entryTree(rec), lyr: rec.mylayer })),
			x: this.box.x1,
			y: this.box.y1,
			cut: cut
		};
		if (cut) this.remove();
	},

	// Pastes the copied entries moved by an offset in view space, into the current layer or back into
	// the layers they came from, as the new selection. Names are made unique, and every group the
	// entries were in becomes a new group of their own, as the original's paste did.
	paste(xo, yo, keepLayer) {
		const ed = Editor;
		const room = ed.room;
		if (this.clip === null) return;
		this.clear();
		const cur = room.layers[ed.curlayeri];
		const taken = this.names();
		const groupsTaken = new Set(Object.keys(room.objGroups));
		const renamed = new Map();
		const added = [];
		for (const item of this.clip.items) {
			const lyr = keepLayer && room.layers.includes(item.lyr) ? item.lyr : cur;
			const rec = EdRoom.record(item.map, lyr);
			rec.name = this.unique(rec.name, taken);
			taken.add(rec.name);
			const k = lyr.lens.s / EdView.z;
			rec.x += xo / k;
			rec.y += yo / k;
			if (rec.groups !== null) {
				rec.groups = rec.groups.map((gname) => {
					if (!renamed.has(gname)) {
						const nn = this.unique(gname, groupsTaken);
						groupsTaken.add(nn);
						renamed.set(gname, nn);
					}
					return renamed.get(gname);
				});
			}
			EdRoom.refresh(rec);
			lyr.lsprites.push(rec);
			added.push(rec);
		}
		EdRoom.relink(room);
		for (const rec of added) this.select(rec, false);
	},

	// Deletes the selection.
	remove() {
		const ed = Editor;
		for (const rec of this.selects) {
			const list = rec.mylayer.lsprites;
			list.splice(list.indexOf(rec), 1);
		}
		this.selects = [];
		ed.hovers = [];
		ed.curhoveri = 0;
		ed.rehover = true;
		EdRoom.relink(ed.room);
	},

	// Places one of the picker's items in the current layer at a spot in that layer, named with the
	// next number. Its animation starts in step with the editor's, or with control from its first
	// frame at this moment, as the original placed them.
	add(item, x, y, startoff) {
		const ed = Editor;
		const lyr = ed.room.layers[ed.curlayeri];
		const map = { name: this.unique(this.newUid(), this.names()), spi: item.spi, x: x, y: y };
		if (item.isobj !== undefined) map.isobj = item.isobj;
		const rec = EdRoom.record(map, lyr);
		rec.saved = null;
		const sr = Sprites.get(rec.spi);
		const n = sr.frameCount;
		const nowii = n > 0 ? (ed.frames * sr.imageSpeed) % n : 0;
		if (startoff && n > 0) {
			rec.start_ifr = (n - nowii) % n;
			rec.ifr = 0;
		} else {
			rec.ifr = nowii;
		}
		lyr.lsprites.push(rec);
		EdRoom.relink(ed.room);
		return rec;
	},

	// Takes the selection out of its layers in drawing order and puts it back together at the spot
	// the pick gives once they are out, as the original's restacking did.
	restack(pick) {
		const room = Editor.room;
		this.push();
		const order = (rec) => room.layers.indexOf(rec.mylayer) * 1e6 + rec.mylayer.lsprites.indexOf(rec);
		const sorted = this.selects.slice().sort((a, b) => order(a) - order(b));
		for (const rec of sorted) rec.mylayer.lsprites.splice(rec.mylayer.lsprites.indexOf(rec), 1);
		const spot = pick(sorted);
		spot.lyr.lsprites.splice(spot.at, 0, ...sorted);
		for (const rec of sorted) rec.mylayer = spot.lyr;
		this.selects = sorted;
		EdRoom.relink(room);
		this.updateBox();
	},

	// The keys that work over the room in any mode, in the original's order.
	keys() {
		const ed = Editor;
		const inp = ed.inp;
		const room = ed.room;
		const hit = (code) => inp.keysPressed.has(code);
		const held = (code) => inp.keysDown.has(code);

		if (hit("KeyQ")) {
			if (inp.ctrl) {
				room.grid_size *= 2;
				if (room.grid_size > ED_GRID_MAX) room.grid_size /= ED_GRID_FALL;
			} else {
				room.grid_lock = room.grid_lock ? 0 : 1;
			}
			this.touch();
		}
		if (inp.ctrl && hit("KeyC") && this.selects.length > 0) this.copy(false);
		if (inp.ctrl && hit("KeyX") && this.selects.length > 0) {
			this.push();
			this.copy(true);
		}
		if (inp.ctrl && hit("KeyV") && this.clip !== null) {
			// a cut with nothing selected pastes back where it was, otherwise at the mouse
			const pastelast = this.selects.length === 0 && this.clip.cut && !inp.down.left;
			const g = room.grid_lock && !inp.alt ? room.grid_size : 0;
			const gx = g ? ed.mouse.wx - Math.sign(ed.mouse.wx) * (Math.abs(ed.mouse.wx) % g) : ed.mouse.wx;
			const gy = g ? ed.mouse.wy - Math.sign(ed.mouse.wy) * (Math.abs(ed.mouse.wy) % g) : ed.mouse.wy;
			this.push();
			this.paste(pastelast ? 0 : gx - this.clip.x, pastelast ? 0 : gy - this.clip.y, false);
		}
		if (inp.ctrl && !inp.shift && hit("KeyH")) {
			for (const rec of this.selects) rec.hidden = 1;
			this.clear();
		}
		if ((inp.ctrl && inp.shift && hit("KeyH")) || (inp.pressed.right && held("KeyH"))) {
			for (const lyr of room.layers) for (const rec of lyr.lsprites) rec.hidden = 0;
			return false;
		}
		if (inp.ctrl && ((hit("KeyZ") && !inp.shift))) this.undo(true);
		if (inp.ctrl && (hit("KeyY") || (hit("KeyZ") && inp.shift))) this.undo(false);
		if (inp.ctrl && hit("KeyA")) {
			this.clear();
			room.layers.forEach((lyr, li) => {
				if ((inp.shift || li === ed.curlayeri) && EdView.pickable(lyr, li, false)) {
					for (const rec of lyr.lsprites) this.select(rec, false);
				}
			});
		}
		if (inp.ctrl && hit("KeyJ") && this.selects.length > 0) {
			const amt = inp.shift ? ED_JITTER_SHIFT : ED_JITTER;
			this.push();
			for (const rec of this.selects) {
				rec.x += Math.floor(Math.random() * (amt * 2 + 1)) - amt;
				rec.y += Math.floor(Math.random() * (amt * 2 + 1)) - amt;
				EdRoom.refresh(rec);
			}
			this.updateBox();
		}
		if (hit("Escape")) this.clear();
		if (hit("Delete") && !held("KeyO") && this.selects.length > 0) {
			this.push();
			this.remove();
		}
		return true;
	},

	// Scrolls the view while a drag that began in the room nears the screen's edge.
	edgeScroll() {
		const ed = Editor;
		if (!ed.inp.down.left || !this.fromRoom) return;
		const m = ed.mouse;
		const gw = ed.canvas.width / EdGui.scale;
		const gh = ed.canvas.height / EdGui.scale;
		const step = ED_EDGE_SCROLL * ed.steps;
		if (m.gx < ED_EDGE_ZONE) ed.cam.x -= step;
		else if (gw - m.gx < ED_EDGE_ZONE) ed.cam.x += step;
		if (m.gy < ED_EDGE_ZONE) ed.cam.y -= step;
		else if (gh - m.gy < ED_EDGE_ZONE) ed.cam.y += step;
	},

	// The mouse over the room, the wheel, and the keys on the selection: placing in the picker's
	// modes, else pointing, selecting and editing, in the original's order.
	mouse(mmoved, wh) {
		const ed = Editor;
		const inp = ed.inp;
		const room = ed.room;
		const mouse = ed.mouse;
		const held = (code) => inp.keysDown.has(code);
		const hit = (code) => inp.keysPressed.has(code);
		const g = room.grid_lock && !inp.alt ? room.grid_size : 0;
		const snap = (v) => (g ? v - Math.sign(v) * (Math.abs(v) % g) : v);
		const now = currentTime();
		if (inp.pressed.left || inp.pressed.right || inp.pressed.middle) {
			this.dbl = now - this.lastPress < ED_EDIT_DOUBLE_MS;
			this.lastPress = now;
		}
		if (inp.pressed.left) {
			this.downX = mouse.wx;
			this.downY = mouse.wy;
		}

		if (EdPicker.mode !== 0) {
			const item = EdPicker.current();
			if (wh !== 0 && !inp.shift && !inp.ctrl && !inp.alt) EdPicker.cycle(wh);
			const lyr = room.layers[ed.curlayeri];
			const ml = EdView.mouseOn(lyr);
			const gx = snap(ml.x);
			const gy = snap(ml.y);
			if (item !== null && inp.pressed.left) {
				this.push();
				const rec = this.add(item, gx, gy, inp.ctrl);
				this.placeX = gx;
				this.placeY = gy;
				this.lastPlaced = [rec];
				this.clear();
				this.select(rec, false);
				this.placing = true;
			}
			if (this.placing && item !== null && inp.down.left && mmoved) {
				const sr = Sprites.get(item.spi);
				if (inp.shift) {
					// scattering: another copy once the mouse has gone half a picture from the last
					if (Math.abs(this.placeX - gx) > sr.w / 2 || Math.abs(this.placeY - gy) > sr.h / 2) {
						const rec = this.add(item, gx, gy, inp.ctrl);
						this.placeX = gx;
						this.placeY = gy;
						this.lastPlaced.push(rec);
						this.select(rec, false);
					}
				} else if (!this.lastPlaced.some((rec) => {
					const s = maskShape(rec, rec.x - rec.exoffx, rec.y - rec.exoffy);
					return s && pointInShape(s, gx, gy);
				})) {
					// Filling: copies laid on a grid the first copy's size in whole pixels, never less
					// than one, starting from the first, so each butts right against the one before.
					const lp = this.lastPlaced[0];
					const lr = Sprites.get(lp.spi);
					const w = (Math.sign(lp.x_sc) || 1) * Math.max(1, Math.round(Math.abs(lr.w * lp.x_sc)));
					const h = (Math.sign(lp.y_sc) || 1) * Math.max(1, Math.round(Math.abs(lr.h * lp.y_sc)));
					const rec = this.add(item, this.placeX + Math.floor((gx - this.placeX + lr.ox) / w) * w,
						this.placeY + Math.floor((gy - this.placeY + lr.oy) / h) * h, inp.ctrl);
					this.lastPlaced.push(rec);
					this.select(rec, false);
				}
			}
			// an item dragged out of the picker bar lands where it is let go, as one undoable copy
			if (inp.released.left && EdPicker.dragging && !this.placing && item !== null) {
				this.push();
				const rec = this.add(item, gx, gy, inp.ctrl);
				this.clear();
				this.select(rec, false);
			}
			if (inp.released.left) {
				this.placing = false;
				this.lastPlaced = [];
			}
			// The right button wipes out entries of the current layer under the mouse that show the
			// picker's sprite, objects of any kind included, as the original's did.
			if (inp.down.right && item !== null) {
				const mx = Math.floor(ml.x);
				const my = Math.floor(ml.y);
				const gone = lyr.lsprites.filter((rec) => {
					if (rec.spi !== item.spi) return false;
					const s = maskShape(rec, rec.x - rec.exoffx + rec.loopdx, rec.y - rec.exoffy + rec.loopdy);
					return s && pointInShape(s, mx, my);
				});
				if (gone.length > 0) {
					if (!this.erasing) this.push();
					this.erasing = true;
					for (const rec of gone) {
						lyr.lsprites.splice(lyr.lsprites.indexOf(rec), 1);
						rec.selected = false;
						const si = this.selects.indexOf(rec);
						if (si >= 0) this.selects.splice(si, 1);
					}
					EdRoom.relink(room);
				}
			}
			if (inp.released.right) this.erasing = false;
			return;
		}

		const hovers = ed.hovers;
		if (inp.pressed.left) {
			if (this.grab !== null) {
				this.resizing = true;
				this.resizePrimed = true;
				this.rotating = inp.alt;
				const s0 = this.selects[0];
				const p = EdView.toView(s0.mylayer, s0.x - s0.exoffx + s0.loopdx, s0.y - s0.exoffy + s0.loopdy);
				this.rotateStAng = (s0.ang - Math.round(pointDirection(p.x, p.y, mouse.wx, mouse.wy)) + 720) % 360;
			} else if (hovers.length > 0) {
				const hover = hovers[ed.curhoveri];
				const seldown = this.hoverWheeled ? undefined : hovers.find((h) => h.selected);
				if (seldown !== undefined) {
					if (held("KeyA")) {
						this.push();
						seldown.spd = seldown.spd > 0 ? 0 : 1;
					} else if (held("KeyT")) {
						this.push();
						const t = seldown.tiledx ? 0 : 1;
						seldown.tiledx = t;
						seldown.tiledy = t;
						seldown.tile_loop = t && inp.shift ? 1 : 0;
						EdRoom.refresh(seldown);
					} else if (held("KeyF") || held("KeyG") || held("KeyP") || held("KeyB")) {
						// finding, groups, paths and area backdrops come in a later phase
					} else if (held("KeyH")) {
						seldown.hidden = 1;
						this.clear();
					} else if (inp.shift) {
						seldown.selected = false;
						this.selects.splice(this.selects.indexOf(seldown), 1);
					}
				} else if (held("KeyH")) {
					hover.hidden = 1;
				} else if (this.selects.length > 0 && held("KeyS")) {
					this.push();
					for (const rec of this.selects) {
						rec.spi = hover.spi;
						EdRoom.refresh(rec);
					}
				} else if (this.selects.length > 0 && held("KeyO") && hover.isobj !== undefined) {
					this.push();
					for (const rec of this.selects) {
						rec.isobj = hover.isobj;
						EdRoom.refresh(rec);
					}
					EdRoom.relink(room);
				} else {
					if (!inp.shift) this.clear();
					this.select(hover, !inp.alt);
				}
				// selecting again keeps every entry's offset from where the mouse went down
				for (const rec of this.selects.slice()) this.select(rec, false);
				this.moving = true;
				this.movePrimed = true;
				this.copyPrimed = inp.ctrl;
			} else {
				if (!inp.shift) this.clear();
				this.boxSelect = true;
			}
		}

		// Dragging out a box selects whatever it touches on the layers that can be picked from. With
		// shift what it touched stays selected, as in the original.
		if (this.boxSelect && inp.down.left && mmoved) {
			if (!inp.shift) this.clear();
			const x1 = Math.min(this.downX, mouse.wx);
			const y1 = Math.min(this.downY, mouse.wy);
			const x2 = Math.max(this.downX, mouse.wx);
			const y2 = Math.max(this.downY, mouse.wy);
			room.layers.forEach((lyr, li) => {
				if (!EdView.pickable(lyr, li, false)) return;
				const a = EdView.toLayer(lyr, x1, y1);
				const b = EdView.toLayer(lyr, x2, y2);
				const rect = { l: a.x, t: a.y, r: b.x, b: b.y };
				for (const rec of lyr.lsprites) {
					if (rec.hidden || rec.selected) continue;
					const s = maskShape(rec, rec.x - rec.exoffx + rec.loopdx, rec.y - rec.exoffy + rec.loopdy);
					if (s && shapesOverlap(s, rect)) {
						rec.selected = true;
						this.selects.push(rec);
					}
				}
			});
			for (const rec of this.selects.slice()) this.select(rec, false);
		}

		// Moving, copying first with control. Shift keeps to the axis moved along most, the grid
		// snaps each picture, and holding O moves the footprint instead, the picture staying put.
		if (this.moving && inp.down.left && mmoved) {
			if (this.movePrimed) {
				this.movePrimed = false;
				this.push();
			}
			if (this.copyPrimed) {
				this.copyPrimed = false;
				this.copy(false);
				this.paste(0, 0, true);
			}
			const xdif = Math.abs(mouse.wx - this.downX);
			const ydif = Math.abs(mouse.wy - this.downY);
			const movex = !inp.shift || xdif >= ydif;
			const movey = !inp.shift || ydif > xdif;
			for (const rec of this.selects) {
				const ml = EdView.mouseOn(rec.mylayer);
				const px = rec.x - rec.exoffx;
				const py = rec.y - rec.exoffy;
				if (held("KeyO")) {
					rec.exoffx = ml.x - rec.ofx;
					rec.exoffy = ml.y - rec.ofy;
					rec.x = px + rec.exoffx;
					rec.y = py + rec.exoffy;
				} else {
					rec.x = snap(movex ? ml.x - rec.mox : px) + rec.exoffx;
					rec.y = snap(movey ? ml.y - rec.moy : py) + rec.exoffy;
				}
				EdRoom.refresh(rec);
			}
		}

		// Resizing by a grabber, or turning with alt. The box's grabbed corner follows the mouse,
		// snapped to the grid, or the arrows nudge it; every entry scales from the box's far corner,
		// tiled ones counting their tiles instead. Control keeps the shape. Turning points each
		// entry at the mouse, keeping the angle it had when grabbed.
		const arrows = hit("ArrowLeft") || hit("ArrowRight") || hit("ArrowUp") || hit("ArrowDown");
		if (this.resizing && inp.down.left && (mmoved || arrows)) {
			if (this.resizePrimed) {
				this.resizePrimed = false;
				this.grabX = this.grab.xo < 0 ? this.box.x1 : this.box.x2;
				this.grabY = this.grab.yo < 0 ? this.box.y1 : this.box.y2;
				this.push();
			}
			if (!this.rotating) {
				const b = this.box;
				const o = { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 };
				const mxd = Math.abs(mouse.wx - this.downX);
				const myd = Math.abs(mouse.wy - this.downY);
				const mxk = inp.shift && myd > mxd;
				const myk = inp.shift && mxd >= myd;
				const newx = snap(this.grabX + mouse.wx - this.downX);
				const newy = snap(this.grabY + mouse.wy - this.downY);
				if (arrows) {
					const adjx = ((hit("ArrowLeft") ? -1 : 0) + (hit("ArrowRight") ? 1 : 0)) * Math.sign(this.grab.xo + 0.5);
					const adjy = ((hit("ArrowUp") ? -1 : 0) + (hit("ArrowDown") ? 1 : 0)) * Math.sign(this.grab.yo + 0.5);
					b.x1 += this.grab.xo * adjx;
					b.y1 += this.grab.yo * adjy;
					b.x2 += (this.grab.xo + 1) * adjx;
					b.y2 += (this.grab.yo + 1) * adjy;
				} else {
					if (this.grab.xo < 0) b.x1 = mxk ? this.grabX : newx;
					else b.x2 = mxk ? this.grabX : newx;
					if (this.grab.yo < 0) b.y1 = myk ? this.grabY : newy;
					else b.y2 = myk ? this.grabY : newy;
				}
				const nw = b.x2 - b.x1;
				const nh = b.y2 - b.y1;
				let wsc = nw / (o.x2 - o.x1);
				let hsc = nh / (o.y2 - o.y1);
				if (!(wsc !== 0 && isFinite(wsc))) {
					wsc = 1;
					b.x1 = o.x1;
					b.x2 = o.x2;
				}
				if (!(hsc !== 0 && isFinite(hsc))) {
					hsc = 1;
					b.y1 = o.y1;
					b.y2 = o.y2;
				}
				if (inp.ctrl) {
					wsc = Math.sign(wsc) * Math.abs(wsc + hsc) / 2;
					hsc = wsc;
				}
				for (const rec of this.selects) {
					const lyr = rec.mylayer;
					const k = lyr.lens.s / EdView.z;
					const sr = Sprites.get(rec.spi);
					const p = EdView.toView(lyr, rec.x - rec.exoffx + rec.loopdx, rec.y - rec.exoffy + rec.loopdy);
					const q = EdView.toLayer(lyr, b.x1 + (p.x - o.x1) * wsc, b.y1 + (p.y - o.y1) * hsc);
					rec.x = q.x - rec.loopdx + rec.exoffx;
					rec.y = q.y - rec.loopdy + rec.exoffy;
					// tiled sides count whole tiles across the box, the others stretch
					if (rec.tiledx) rec.x_sc = (Math.sign(rec.x_sc) || 1) * Math.max(1, Math.round(Math.abs(nw) / (sr.w * k)));
					else rec.x_sc *= wsc;
					if (rec.tiledy) rec.y_sc = (Math.sign(rec.y_sc) || 1) * Math.max(1, Math.round(Math.abs(nh) / (sr.h * k)));
					else rec.y_sc *= hsc;
					EdRoom.refresh(rec);
				}
			} else {
				for (const rec of this.selects) {
					const p = EdView.toView(rec.mylayer, rec.x - rec.exoffx + rec.loopdx, rec.y - rec.exoffy + rec.loopdy);
					rec.ang = (this.rotateStAng + Math.round(pointDirection(p.x, p.y, mouse.wx, mouse.wy)) + 720) % 360;
					EdRoom.refresh(rec);
				}
			}
		}

		if (inp.released.left) {
			this.updateBox();
			this.moving = this.resizing = this.rotating = this.boxSelect = this.copyPrimed = false;
			ed.rehover = true;
		}

		const sel = this.selects;
		// A and the wheel steps the frame the selection starts on
		if (sel.length > 0 && held("KeyA") && wh !== 0) {
			this.push();
			for (const rec of sel) {
				const n = Sprites.get(rec.spi).frameCount;
				rec.start_ifr = ((rec.start_ifr - wh) % n + n) % n;
				rec.ifr = rec.start_ifr;
			}
		}
		// O and delete makes objects plain sprites again
		if (sel.length > 0 && held("KeyO") && hit("Delete")) {
			this.push();
			for (const rec of sel) {
				rec.isobj = undefined;
				EdRoom.refresh(rec);
			}
			EdRoom.relink(room);
		}
		// Numpad minus flips, sideways or with shift upright; alt also mirrors the spots within the
		// selection's box. Numpad plus turns a quarter, clockwise or with shift the other way.
		if (sel.length > 0 && hit("NumpadSubtract")) {
			this.push();
			for (const rec of sel) {
				const p = EdView.toView(rec.mylayer, rec.x - rec.exoffx + rec.loopdx, rec.y - rec.exoffy + rec.loopdy);
				if (inp.shift) {
					rec.y_sc *= -1;
					if (inp.alt) p.y = this.box.y2 - (p.y - this.box.y1);
				} else {
					rec.x_sc *= -1;
					if (inp.alt) p.x = this.box.x2 - (p.x - this.box.x1);
				}
				const q = EdView.toLayer(rec.mylayer, p.x, p.y);
				rec.x = q.x - rec.loopdx + rec.exoffx;
				rec.y = q.y - rec.loopdy + rec.exoffy;
				EdRoom.refresh(rec);
			}
			this.updateBox();
		}
		if (sel.length > 0 && hit("NumpadAdd")) {
			this.push();
			for (const rec of sel) {
				rec.ang = (rec.ang + (inp.shift ? 90 : 270)) % 360;
				EdRoom.refresh(rec);
			}
		}
		// The arrows nudge by a pixel, with shift by the grid, landing on whole pixels. With alt they
		// would align, which comes in a later phase.
		if (sel.length > 0 && arrows && !this.resizing && !inp.alt) {
			this.push();
			const xsh = (hit("ArrowLeft") ? -1 : 0) + (hit("ArrowRight") ? 1 : 0);
			const ysh = (hit("ArrowUp") ? -1 : 0) + (hit("ArrowDown") ? 1 : 0);
			const d = inp.shift ? room.grid_size : 1;
			for (const rec of sel) {
				rec.x = Math.round(rec.x - rec.exoffx + xsh * d) + rec.exoffx;
				rec.y = Math.round(rec.y - rec.exoffy + ysh * d) + rec.exoffy;
				EdRoom.refresh(rec);
			}
			this.updateBox();
		}

		// Shift and the wheel moves the selection past the entries of its layer it overlaps, up with
		// the wheel up; with control too, to the very top or bottom of the layer.
		if (sel.length > 0 && inp.shift && !inp.alt && wh !== 0) {
			const lyr0 = sel[0].mylayer;
			const a = EdView.toLayer(lyr0, this.box.x1, this.box.y1);
			const b = EdView.toLayer(lyr0, this.box.x2, this.box.y2);
			const rect = { l: a.x, t: a.y, r: b.x, b: b.y };
			const overlaps = lyr0.lsprites.filter((rec) => {
				if (rec.hidden) return false;
				const s = maskShape(rec, rec.x - rec.exoffx + rec.loopdx, rec.y - rec.exoffy + rec.loopdy);
				return s && shapesOverlap(s, rect);
			});
			if (overlaps.length > sel.length) {
				this.restack((sorted) => {
					let isp;
					let insi;
					if (inp.ctrl) {
						isp = wh < 0 ? overlaps[0] : overlaps[overlaps.length - 1];
						insi = wh < 0 ? isp.mylayer.lsprites.length - 1 : 0;
					} else {
						const ssp = wh < 0 ? sorted[sorted.length - 1] : sorted[0];
						isp = overlaps[clamp(overlaps.indexOf(ssp) - wh, 0, overlaps.length - 1)];
						insi = isp === ssp ? (wh < 0 ? isp.mylayer.lsprites.length - 1 : 0) : isp.mylayer.lsprites.indexOf(isp);
					}
					return { lyr: isp.mylayer, at: clamp(wh < 0 ? insi + 1 : insi, 0, isp.mylayer.lsprites.length) };
				});
			}
		}
		// alt home and end to the top or bottom of the layer, alt page up and down into the next layer
		if (sel.length > 0 && inp.alt && (hit("Home") || hit("End"))) {
			const homed = hit("Home");
			this.restack((sorted) => {
				const lyr = sorted[homed ? sorted.length - 1 : 0].mylayer;
				return { lyr: lyr, at: homed ? lyr.lsprites.length : 0 };
			});
		}
		if (sel.length > 0 && inp.alt && (hit("PageUp") || hit("PageDown"))) {
			const upped = hit("PageUp");
			let li = 0;
			this.restack((sorted) => {
				const isp = sorted[upped ? sorted.length - 1 : 0];
				li = clamp(room.layers.indexOf(isp.mylayer) + (upped ? 1 : -1), 0, room.layers.length - 1);
				return { lyr: room.layers[li], at: upped ? 0 : room.layers[li].lsprites.length };
			});
			EdGui.selectLayer(li);
		}

		// the plain wheel picks through a stack of hovers, and zooms when there is no stack
		if (wh !== 0 && !inp.ctrl && !inp.shift && !inp.alt && !held("KeyA")) {
			const n = hovers.length;
			if (n > 1) {
				ed.curhoveri = (ed.curhoveri - wh + n) % n;
				ed.markHover();
				this.hoverWheeled = true;
			} else {
				EdView.zoom(wh);
			}
		}

		// Letting go of the right button over an entry selects it and opens the settings panel next
		// to the mouse; over nothing it clears the selection. Let go over the panel it does neither.
		if (inp.released.right && ed.mouseIn) {
			if (hovers.length > 0) {
				const rec = hovers[ed.curhoveri];
				if (!rec.selected) {
					this.clear();
					this.select(rec, false);
				}
				EdPanel.open(rec, mouse.devx / ed.dpr, mouse.devy / ed.dpr);
			} else {
				this.clear();
			}
		}

		// the grabber under the mouse, unless something is held or alt picks small entries instead
		if (!this.resizing && !this.moving && !inp.alt) {
			this.grab = sel.length > 0 ? this.grabberAt(mouse.devx, mouse.devy) : null;
		}
	}
};
