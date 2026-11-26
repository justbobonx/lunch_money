// Changing the room, a port of the original editor's selecting and editing: clicking, shift clicking
// and dragging a box to select; moving, duplicating, resizing by the corners and turning by dragging;
// the key and wheel commands on the selection; cutting, copying and pasting; placing what the picker
// holds and wiping it out again with the right button; and undoing and redoing all of it.
// Undoing works as the original's did, never building the room again: every change first keeps the
// fields it is about to change on the very things it changes, entries, layers, their entry lists,
// the room's layer list and its groups, and undoing puts those values back on the same things, after
// keeping the values they had then for redoing. Entries deleted and layers taken out stay whole in
// those kept lists, so they come back as the same entries at the same places in the same order.

// how many changes can be undone
const ED_UNDO_MAX = 500;
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
// the object marking the player start, which control F finds
const ED_PLAYER_START_OBJECT = "oGuyPlacer";
// the script actions that name an entry group, whose names follow a group renamed
const ED_GROUP_SCRIPT_OPS = ["groupViz", "copyGroup"];
// a new path's name is this and a number, and a point put after a path's last goes this far below it
const ED_PATH_PREFIX = "p";
const ED_PATH_DROP = 10;
// Area bounds, as the original's bounds layer made them: the group and its two layers, the play
// bounds and the view bounds, what each bounds entry's name starts with, the grid each area's box is
// widened out to, how far the view bounds reach past it across and down, and the sprite for each kind
// of area's play bounds and for view bounds.
const ED_BOUNDS_GROUP = "_lyr_bs";
const ED_BOUNDS_PLAY_LAYER = "_lyr_bs.boundsp";
const ED_BOUNDS_VIEW_LAYER = "_lyr_bs.boundsv";
const ED_BOUNDS_PLAY_PREFIX = "lyr_pbounds_";
const ED_BOUNDS_VIEW_PREFIX = "lyr_vbounds_";
const ED_BOUNDS_GRID = 32;
const ED_BOUNDS_PAD_X = 170;
const ED_BOUNDS_PAD_Y = 100;
const ED_BOUNDS_SPRITE = "sBlankOr";
const ED_BOUNDS_POPUP_SPRITE = "sBlankPr";
const ED_BOUNDS_EDGE_SPRITE = "sBlankGn";
const ED_BOUNDS_VIEW_SPRITE = "sBlankYl";

const EdEdit = {
	// the selected entries, in the order they were selected, and the box round them in view space
	selects: [],
	box: { x1: 0, y1: 0, x2: 0, y2: 0 },
	// The steps to go back and forward through, and which change the room is at. Each step holds the
	// values to put back, each with the thing they go on, the selection to bring back, and which
	// change the room was at. The change last saved tells whether there is anything unsaved.
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
	// which selected entry finding last centred on
	foundi: 0,
	lastPress: 0,
	// the undo step of the last lining up to one side by an alt arrow, so centring or spreading
	// right after can take it back
	alignStep: null,
	// The entry group being worked inside, by name, or none. Only its entries hover, select and
	// take new entries, and clicking picks the groups one level inside it. Not an undo step.
	inGroup: null,
	// The path point under the mouse, among the paths shown, as its entry, its path's name and its
	// number along the path, or none; and the point being dragged, with where the mouse holds it
	// from and whether its undo step is still to start.
	pathHot: null,
	pathDrag: null,

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
		this.alignStep = null;
		this.inGroup = null;
		this.pathHot = null;
		this.pathDrag = null;
	},

	dirty() {
		return this.rev !== this.savedRev;
	},

	// Starts an undo step for the change about to happen, keeping the selection as it is now, and
	// when given, the fields named on the things given, as the next call does.
	push(things, fields) {
		this.undos.push({ keeps: [], sel: this.selects.slice(), rev: this.rev });
		if (this.undos.length > ED_UNDO_MAX) this.undos.shift();
		this.redos.length = 0;
		this.rev = ++this.revCount;
		if (things !== undefined) this.keep(things, fields);
	},

	// Keeps in the step just started the fields named on each thing given, as they are now, so undoing
	// puts them back; a field already kept on a thing in this step keeps its first value.
	keep(things, fields) {
		const step = this.undos[this.undos.length - 1];
		for (const obj of Array.isArray(things) ? things : [things]) {
			const vals = {};
			let any = false;
			for (const f of fields) {
				if (step.keeps.some((k) => k.obj === obj && f in k.vals)) continue;
				vals[f] = this.kept(f, obj[f]);
				any = true;
			}
			if (any) step.keeps.push({ obj: obj, vals: vals });
		}
	},

	// A field's value as kept and as put back. Lists, and the room's table of groups by name, are
	// copied, since they change in place; anything else is taken as it is, since every change gives a
	// field a new value rather than changing the old one.
	kept(f, v) {
		return Array.isArray(v) ? v.slice() : (f === "lgroups" ? Object.assign({}, v) : v);
	},

	// Marks a change that is saved with the room but not worth an undo step of its own.
	touch() {
		this.rev = ++this.revCount;
	},

	// Steps back or forward. The step's kept values go back on their things, the latest kept first,
	// each first kept again as it is now for the step the other way, which also keeps the selection
	// as it is now. Then everything the values feed is worked out again: each entry changed, the room
	// tied together, the layer list's rows, the current layer, the selection that was, and the box.
	undo(back) {
		const ed = Editor;
		const room = ed.room;
		const from = back ? this.undos : this.redos;
		const to = back ? this.redos : this.undos;
		if (from.length === 0) return;
		const step = from.pop();
		const other = { keeps: [], sel: this.selects.slice(), rev: this.rev };
		for (let i = step.keeps.length - 1; i >= 0; i--) {
			const k = step.keeps[i];
			const now = {};
			for (const f of Object.keys(k.vals)) {
				now[f] = this.kept(f, k.obj[f]);
				k.obj[f] = this.kept(f, k.vals[f]);
			}
			other.keeps.push({ obj: k.obj, vals: now });
			if (k.obj instanceof lpSprite) EdRoom.refresh(k.obj);
		}
		to.push(other);
		this.rev = step.rev;

		EdRoom.relink(room);
		for (const lyr of room.layers) {
			const lg = lyr.group !== undefined ? room.lgroups[lyr.group] : undefined;
			if (lg !== undefined && lg.folded && lg.col_head_lyr === lyr) {
				lyr.txt.text = lyr.group;
				lyr.txt.pretext = "-[";
			} else {
				lyr.txt.text = lyr.name;
				EdGui.pretext(lyr);
			}
			lyr.txt.disabled = !lyr.visible;
		}
		ed.curlayeri = clamp(ed.curlayeri, 0, room.layers.length - 1);
		EdGui.needLyrGuiReset = true;
		EdView.lenses();
		this.clear();
		for (const rec of step.sel) {
			if (!room.layers.includes(rec.mylayer) || !rec.mylayer.lsprites.includes(rec)) continue;
			rec.selected = true;
			this.selects.push(rec);
		}
		this.updateBox();
		ed.hovers = [];
		ed.curhoveri = 0;
		ed.rehover = true;
		this.pathHot = null;
		this.pathDrag = null;
	},

	// Adds an entry to the selection as the original did: its offsets from the mouse kept for moving,
	// its group unfolded and its layer made current, and with a group asked for, the rest of its
	// next group.
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
		const gname = andgroup ? this.nextGroup(rec) : null;
		if (gname !== null) for (const member of room.objGroups[gname]) this.select(member, false);
	},

	// An entry's next group, the one clicking it picks: outside every group its outermost, inside
	// one the group just inside that, or none. Groups nest strictly, an entry's list running from
	// its innermost group out.
	nextGroup(rec) {
		if (rec.groups === null || rec.groups.length === 0) return null;
		if (this.inGroup === null) return rec.groups[rec.groups.length - 1];
		const i = rec.groups.indexOf(this.inGroup);
		return i > 0 ? rec.groups[i - 1] : null;
	},

	// Whether an entry is in the group being worked inside, which every entry is when there is none.
	inside(rec) {
		return this.inGroup === null || (rec.groups !== null && rec.groups.includes(this.inGroup));
	},

	// The groups an entry placed or pasted now goes in: the group being worked inside and the groups
	// round it, or none.
	chain() {
		if (this.inGroup === null) return null;
		const g = Editor.room.objGroups[this.inGroup][0].groups;
		return g.slice(g.indexOf(this.inGroup));
	},

	// Renames the group being worked inside, as one undo step: every entry's list of groups, and the
	// room's scripts that show, hide or copy the group by name. A name left empty or already a
	// group's is refused; tells why, or gives nothing.
	renameGroup(text) {
		const room = Editor.room;
		const old = this.inGroup;
		if (text === old) return "";
		if (text === "") return "a group needs a name";
		if (room.objGroups[text] !== undefined) return "a group is already named " + text;
		const named = new RegExp("(\\[\\s*\"(?:" + ED_GROUP_SCRIPT_OPS.join("|") + ")\"\\s*,\\s*)\"" + old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\"", "g");
		const swap = (v) => (typeof v === "string" ? v.replace(named, (m, head) => head + JSON.stringify(text)) : v);
		const members = room.objGroups[old];
		this.push(members, ["groups"]);
		for (const rec of members) rec.groups = rec.groups.map((g) => (g === old ? text : g));
		let scripts = 0;
		const blocks = [];
		for (const lyr of room.layers) for (const rec of lyr.lsprites) blocks.push({ obj: rec, f: "objinit" });
		for (const lg of Object.values(room.lgroups)) blocks.push({ obj: lg, f: "grp_init" });
		blocks.push({ obj: room, f: "room_init" });
		for (const b of blocks) {
			const v = swap(b.obj[b.f]);
			if (v === b.obj[b.f]) continue;
			this.keep(b.obj, [b.f]);
			b.obj[b.f] = v;
			if (b.obj instanceof lpSprite) EdRoom.refresh(b.obj);
			scripts++;
		}
		this.inGroup = text;
		EdRoom.relink(room);
		Editor.debugtxt = " renamed " + old + " to " + text + (scripts > 0 ? ", " + scripts + " scripts changed" : "");
		Editor.rehover = true;
		return "";
	},

	// An entry's current path, the one its points were last clicked on or added to, while it still
	// has it, else its last, or none.
	curPath(rec) {
		if (rec.paths === undefined || rec.paths === null) return null;
		if (rec.curPath !== undefined && Object.prototype.hasOwnProperty.call(rec.paths, rec.curPath)) return rec.curPath;
		const names = Object.keys(rec.paths);
		return names.length > 0 ? names[names.length - 1] : null;
	},

	// An entry's paths after a change, as a new map, the old one left whole for undoing. The change
	// gets the paths in order, each its name, its points as a flat list of spots and whether it loops,
	// and may change, add, rename or drop them. A path left as it was keeps its saved list, a changed
	// one the number text of its unchanged spots, so the file changes only where the paths did. With
	// no paths left the entry has none.
	pathsWith(paths, change) {
		const list = paths === undefined || paths === null ? [] : Object.keys(paths).map((name) => {
			const a = paths[name];
			return { name: name, pts: a.slice(0, Math.max(0, a.length - 1)), loop: a.length > 0 ? a[a.length - 1] : 0, was: a };
		});
		change(list);
		if (list.length === 0) return undefined;
		const out = {};
		EdFile.meta.set(out, { keys: list.map((p) => p.name), raw: new Map(), blocks: new Set() });
		for (const p of list) {
			const a = p.pts.concat([p.loop]);
			out[p.name] = p.was !== undefined && JSON.stringify(a) === JSON.stringify(p.was) ? p.was : EdFile.list(a, p.was);
		}
		return out;
	},

	// Renames the selected entry's current path, as one undo step, keeping its place among the
	// entry's paths. A name left empty or already one of the entry's paths is refused; tells why, or
	// gives nothing.
	renamePath(text) {
		const rec = this.selects[0];
		const old = this.curPath(rec);
		if (text === old) return "";
		if (text === "") return "a path needs a name";
		if (Object.prototype.hasOwnProperty.call(rec.paths, text)) return "this entry already has a path named " + text;
		this.push(rec, ["paths"]);
		rec.paths = this.pathsWith(rec.paths, (list) => { list.find((p) => p.name === old).name = text; });
		rec.curPath = text;
		Editor.debugtxt = " renamed path " + old + " to " + text;
		return "";
	},

	clear() {
		for (const rec of this.selects) rec.selected = false;
		this.selects = [];
	},

	// Finding, as the original's: selects every entry of an object type, also of one sprite when
	// given, or every plain sprite entry of a sprite, on every layer that can be picked from, alt
	// letting locked layers and visible folded groups through, and leaving out hidden entries. They
	// are selected in layer order, then list order, and the view centres on the first.
	find(match, alt) {
		const room = Editor.room;
		const found = [];
		room.layers.forEach((lyr, li) => {
			if (!EdView.pickable(lyr, li, alt)) return;
			for (const rec of lyr.lsprites) {
				if (rec.hidden) continue;
				const hit = match.isobj !== undefined ? rec.isobj === match.isobj && (match.spi === undefined || rec.spi === match.spi)
					: rec.isobj === undefined && rec.spi === match.spi;
				if (hit) found.push(rec);
			}
		});
		this.clear();
		for (const rec of found) this.select(rec, false);
		this.foundi = 0;
		this.showFound(0);
	},

	// Centres the view on a selected entry, stepping from the last one centred on by the given
	// count and wrapping round, makes its layer current, and tells in the status line which of
	// how many it is.
	showFound(step) {
		const ed = Editor;
		const n = this.selects.length;
		if (n === 0) {
			ed.debugtxt = " none found";
			return;
		}
		this.foundi = (((this.foundi + step) % n) + n) % n;
		const rec = this.selects[this.foundi];
		const p = EdView.spot(rec);
		const v = EdView.toView(rec.mylayer, p.x, p.y);
		EdView.centerOn(v.x, v.y);
		EdGui.selectLayer(ed.room.layers.indexOf(rec.mylayer));
		ed.debugtxt = " found " + (this.foundi + 1) + "/" + n;
	},

	// The box round the selection in view space, from every picture's corners about its spot,
	// stretched but not turned, as the original measured it. On a layer drawn on whole pixels the
	// corners round to the pixels the picture covers.
	updateBox() {
		if (this.selects.length === 0) return;
		const b = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
		for (const rec of this.selects) {
			const sr = Sprites.get(rec.spi);
			const o = EdView.spot(rec);
			const whole = rec.mylayer.lens.parax ? (v) => v : Math.round;
			const l = o.x - sr.ox * rec.x_sc;
			const t = o.y - sr.oy * rec.y_sc;
			const p = EdView.toView(rec.mylayer, whole(l), whole(t));
			const q = EdView.toView(rec.mylayer, whole(l + sr.w * rec.x_sc), whole(t + sr.h * rec.y_sc));
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

	// Copies the selection as it would be saved, with where its box sits and the group it was copied
	// inside; cutting also deletes it, as an undo step of its own. A cut has not been pasted yet.
	copy(cut) {
		this.clip = {
			items: this.selects.map((rec) => ({ map: EdFile.entryTree(rec), lyr: rec.mylayer })),
			x: this.box.x1,
			y: this.box.y1,
			inGroup: this.inGroup,
			cut: cut,
			pasted: false,
			// a cut only pastes back where it was in the room it came from
			room: Editor.room
		};
		if (cut) this.remove();
	},

	// Pastes the copied entries moved by an offset in view space, at the end of the current layer or
	// of the layers they came from, as the new selection, keeping the lists they go into in the undo
	// step already started. Each keeps only the groups inside the one it was copied inside, then
	// goes in the group being worked inside and those round it. The first paste of a cut is the cut
	// entries moved: each keeps its name, unless this room already has it, and its groups. Any other
	// paste is a copy: names are made unique, and every group kept becomes a new group of its own,
	// as the original's paste did.
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
		const moving = this.clip.cut && !this.clip.pasted;
		const chain = this.chain();
		this.clip.pasted = true;
		for (const item of this.clip.items) {
			const lyr = keepLayer && room.layers.includes(item.lyr) ? item.lyr : cur;
			this.keep(lyr, ["lsprites"]);
			const rec = EdRoom.record(item.map, lyr);
			rec.name = this.unique(rec.name, taken);
			taken.add(rec.name);
			const k = lyr.lens.s / EdView.z;
			const wasx = rec.x;
			const wasy = rec.y;
			rec.x += xo / k;
			rec.y += yo / k;
			// its paths come along, moved as far as it went, into whatever room
			const dx = rec.x - wasx;
			const dy = rec.y - wasy;
			if (rec.paths !== undefined && (dx !== 0 || dy !== 0)) {
				rec.paths = this.pathsWith(rec.paths, (list) => {
					for (const p of list) p.pts = p.pts.map((v, n) => v + (n % 2 === 0 ? dx : dy));
				});
			}
			const from = rec.groups !== null ? rec.groups : [];
			const upto = this.clip.inGroup !== null && from.includes(this.clip.inGroup) ? from.indexOf(this.clip.inGroup) : from.length;
			const groups = from.slice(0, upto).map((gname) => {
				if (moving) return gname;
				if (!renamed.has(gname)) {
					const nn = this.unique(gname, groupsTaken);
					groupsTaken.add(nn);
					renamed.set(gname, nn);
				}
				return renamed.get(gname);
			}).concat(chain !== null ? chain : []);
			rec.groups = groups.length > 0 ? groups : null;
			EdRoom.refresh(rec);
			lyr.lsprites.push(rec);
			added.push(rec);
		}
		EdRoom.relink(room);
		for (const rec of added) this.select(rec, false);
	},

	// Deletes the selection as an undo step, keeping the lists it leaves, so undoing puts the very
	// same entries back where they were.
	remove() {
		const ed = Editor;
		this.push([...new Set(this.selects.map((rec) => rec.mylayer))], ["lsprites"]);
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
	// next number, in the group being worked inside and those round it, keeping the layer's list in
	// the undo step already started. Its animation starts in step with the editor's, or with
	// control from its first frame at this moment, as the original placed them.
	add(item, x, y, startoff) {
		const ed = Editor;
		const lyr = ed.room.layers[ed.curlayeri];
		this.keep(lyr, ["lsprites"]);
		const map = { name: this.unique(this.newUid(), this.names()), spi: item.spi, x: x, y: y };
		if (item.isobj !== undefined) map.isobj = item.isobj;
		const rec = EdRoom.record(map, lyr);
		rec.saved = null;
		rec.groups = this.chain();
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
	// the pick gives once they are out, as the original's restacking did, as an undo step keeping
	// every list it changes.
	restack(pick) {
		const room = Editor.room;
		this.push([...new Set(this.selects.map((rec) => rec.mylayer))], ["lsprites"]);
		const order = (rec) => room.layers.indexOf(rec.mylayer) * 1e6 + rec.mylayer.lsprites.indexOf(rec);
		const sorted = this.selects.slice().sort((a, b) => order(a) - order(b));
		for (const rec of sorted) rec.mylayer.lsprites.splice(rec.mylayer.lsprites.indexOf(rec), 1);
		const spot = pick(sorted);
		this.keep(spot.lyr, ["lsprites"]);
		spot.lyr.lsprites.splice(spot.at, 0, ...sorted);
		for (const rec of sorted) rec.mylayer = spot.lyr;
		this.selects = sorted;
		EdRoom.relink(room);
		this.updateBox();
	},

	// Makes the area bounds again as the original's bounds layer did, as one undo step, telling
	// whether anything changed. Every area but plain groups gets a box round the pictures on its
	// layers that neither scroll apart nor loop, widened out to the bounds grid, or an empty box at
	// the room's corner when there are none. That box is its play bounds, the kind and sprite its
	// type takes, and unless it is a popup the box padded is its view bounds, so the area shows
	// before it is reached. They go in the two bounds layers, added hidden and locked at the end when
	// missing. Bounds already there are only moved and stretched, so a room whose areas have not
	// changed saves back as it was; bounds of areas that are gone go.
	rebuildBounds() {
		const ed = Editor;
		const room = ed.room;
		const grid = ED_BOUNDS_GRID;
		const boxes = new Map();
		for (const key of Object.keys(room.lgroups)) {
			const area = room.lgroups[key];
			if (area.type === LGT_NON || area.name === ED_BOUNDS_GROUP) continue;
			let l = Infinity;
			let t = Infinity;
			let r = -Infinity;
			let b = -Infinity;
			for (const lyr of area.layers) {
				if (lyr.plx_x !== 1 || lyr.plx_y !== 1 || lyr.loop_x > 0 || lyr.loop_y > 0) continue;
				for (const rec of lyr.lsprites) {
					const px = rec.x - rec.exoffx;
					const py = rec.y - rec.exoffy;
					l = Math.min(l, px + rec.bbox.l);
					t = Math.min(t, py + rec.bbox.t);
					// the right and bottom are the last pixel in, as the original measured them
					r = Math.max(r, px + rec.bbox.r - 1);
					b = Math.max(b, py + rec.bbox.b - 1);
				}
			}
			const box = l === Infinity ? { l: 0, t: 0, r: 0, b: 0 } : {
				l: l - (((l % grid) + grid) % grid),
				t: t - (((t % grid) + grid) % grid),
				r: r + grid - (((r % grid) + grid) % grid),
				b: b + grid - (((b % grid) + grid) % grid)
			};
			boxes.set(area.name, { area: area, box: box });
		}

		// what has to change, done only once the undo step is started
		const changes = [];
		const blyrs = [];
		for (const view of [true, false]) {
			const lname = view ? ED_BOUNDS_VIEW_LAYER : ED_BOUNDS_PLAY_LAYER;
			const prefix = view ? ED_BOUNDS_VIEW_PREFIX : ED_BOUNDS_PLAY_PREFIX;
			let lyr = room.layers.find((x) => x.name === lname);
			if (lyr === undefined) {
				lyr = EdRoom.layer(null, lname);
				lyr.wd = room.roomw;
				lyr.ht = room.roomh;
				lyr.visible = 0;
				lyr.locked = 1;
				lyr.txt.disabled = true;
				const made = lyr;
				changes.push(() => room.layers.push(made));
			}
			blyrs.push(lyr);
			const wanted = new Set();
			for (const { area, box } of boxes.values()) {
				if (view && area.type === LGT_POPUP) continue;
				const name = prefix + area.name;
				wanted.add(name);
				const sprite = view ? ED_BOUNDS_VIEW_SPRITE
					: (area.type === LGT_EDGE ? ED_BOUNDS_EDGE_SPRITE : (area.type === LGT_POPUP ? ED_BOUNDS_POPUP_SPRITE : ED_BOUNDS_SPRITE));
				const sr = Sprites.get(sprite);
				const x = view ? box.l - ED_BOUNDS_PAD_X : box.l;
				const y = view ? box.t - ED_BOUNDS_PAD_Y : box.t;
				const xs = (box.r - box.l + (view ? ED_BOUNDS_PAD_X * 2 : 0)) / sr.w;
				const ys = (box.b - box.t + (view ? ED_BOUNDS_PAD_Y * 2 : 0)) / sr.h;
				const rec = lyr.lsprites.find((x2) => x2.name === name);
				if (rec === undefined) {
					const into = lyr;
					changes.push(() => {
						const made = EdRoom.record({
							name: name, spi: sprite, x: x, y: y, x_sc: xs, y_sc: ys,
							isobj: view ? "oVisBounds" : (area.type === LGT_EDGE ? "oEdgeGroup" : "oGroupBounds"),
							objinit: "{\"group\": \"" + area.name + "\"}"
						}, into);
						made.saved = null;
						into.lsprites.push(made);
					});
				} else if (rec.x - rec.exoffx !== x || rec.y - rec.exoffy !== y || rec.x_sc !== xs || rec.y_sc !== ys) {
					changes.push(() => {
						this.keep(rec, ["x", "y", "x_sc", "y_sc"]);
						rec.x = x + rec.exoffx;
						rec.y = y + rec.exoffy;
						rec.x_sc = xs;
						rec.y_sc = ys;
						EdRoom.refresh(rec);
					});
				}
			}
			for (const rec of lyr.lsprites) {
				if (rec.name.startsWith(prefix) && !wanted.has(rec.name)) {
					const from = lyr;
					changes.push(() => from.lsprites.splice(from.lsprites.indexOf(rec), 1));
				}
			}
		}
		if (changes.length === 0) return false;

		this.push(room, ["layers", "lgroups"]);
		this.keep(blyrs, ["lsprites"]);
		for (const change of changes) change();
		EdRoom.relink(room);
		// a bounds group made here is a plain group, as the original set it
		const bgrp = room.lgroups[ED_BOUNDS_GROUP];
		if (bgrp.saved === null) bgrp.type = LGT_NON;
		for (const lyr of blyrs) EdGui.pretext(lyr);
		EdGui.needLyrGuiReset = true;
		EdView.lenses();
		ed.rehover = true;
		ed.debugtxt = " area bounds made again";
		return true;
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
		if (inp.ctrl && inp.alt && hit("KeyB") && !this.rebuildBounds()) ed.debugtxt = " area bounds already up to date";
		if (inp.ctrl && hit("KeyC") && this.selects.length > 0) this.copy(false);
		if (inp.ctrl && hit("KeyX") && this.selects.length > 0) this.copy(true);
		if (inp.ctrl && hit("KeyV") && this.clip !== null) {
			// a cut with nothing selected pastes back where it was in its own room, otherwise at the mouse
			const pastelast = this.selects.length === 0 && this.clip.cut && this.clip.room === room && !inp.down.left;
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
		// control A selects the current layer, with shift every layer, and inside a group all of it
		if (inp.ctrl && hit("KeyA")) {
			this.clear();
			room.layers.forEach((lyr, li) => {
				if ((inp.shift || li === ed.curlayeri || this.inGroup !== null) && EdView.pickable(lyr, li, false)) {
					for (const rec of lyr.lsprites) if (this.inside(rec)) this.select(rec, false);
				}
			});
		}
		// Control G groups the selection under a new name, just inside the group being worked inside,
		// keeping it selected. A group only part selected is refused, so groups always nest.
		if (inp.ctrl && !inp.shift && hit("KeyG") && this.selects.length > 0) {
			const sel = this.selects;
			const part = sel.some((rec) => {
				const gname = this.nextGroup(rec);
				return !this.inside(rec) || (gname !== null && room.objGroups[gname].some((m) => !m.selected));
			});
			if (part) {
				ed.debugtxt = " can't group part of a group, or what is outside the group worked in";
			} else {
				const name = this.unique(this.newUid(), new Set(Object.keys(room.objGroups)));
				this.push(sel, ["groups"]);
				for (const rec of sel) {
					const g = rec.groups !== null ? rec.groups.slice() : [];
					g.splice(this.inGroup !== null ? g.indexOf(this.inGroup) : g.length, 0, name);
					rec.groups = g;
				}
				EdRoom.relink(room);
				ed.debugtxt = " grouped as " + name;
				ed.rehover = true;
			}
		}
		// control shift G ungroups every next group of the selection, keeping it selected
		if (inp.ctrl && inp.shift && hit("KeyG")) {
			const gone = new Set();
			for (const rec of this.selects) {
				const gname = this.nextGroup(rec);
				if (gname !== null) gone.add(gname);
			}
			if (gone.size > 0) {
				const members = [...new Set([...gone].flatMap((gname) => room.objGroups[gname]))];
				this.push(members, ["groups"]);
				for (const rec of members) {
					const g = rec.groups.filter((gname) => !gone.has(gname));
					rec.groups = g.length > 0 ? g : null;
				}
				EdRoom.relink(room);
				ed.debugtxt = " ungrouped " + [...gone].join(" ");
				ed.rehover = true;
			}
		}
		if (inp.ctrl && hit("KeyJ") && this.selects.length > 0) {
			const amt = inp.shift ? ED_JITTER_SHIFT : ED_JITTER;
			this.push(this.selects, ["x", "y"]);
			for (const rec of this.selects) {
				rec.x += Math.floor(Math.random() * (amt * 2 + 1)) - amt;
				rec.y += Math.floor(Math.random() * (amt * 2 + 1)) - amt;
				EdRoom.refresh(rec);
			}
			this.updateBox();
		}
		// control F with nothing under the mouse finds the player start
		if (inp.ctrl && hit("KeyF") && ed.hovers.length === 0) this.find({ isobj: ED_PLAYER_START_OBJECT }, inp.alt);
		if (hit("Escape")) this.clear();
		if (hit("Delete") && !held("KeyO") && this.selects.length > 0) this.remove();
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
			if (item !== null && inp.pressed.left && held("KeyE")) {
				// an E click on an entry opens its sprite and never places
				if (ed.hovers.length > 0) EdSpriteLink.open(ed.hovers[ed.curhoveri].spi);
			} else if (item !== null && inp.pressed.left) {
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
					const p = EdView.spot(rec);
					return pointInShape(EdView.frameShape(rec, p.x, p.y), gx, gy);
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
					const p = EdView.spot(rec);
					return pointInShape(EdView.frameShape(rec, p.x, p.y), mx, my);
				});
				if (gone.length > 0) {
					if (!this.erasing) this.push();
					this.erasing = true;
					this.keep(lyr, ["lsprites"]);
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
			if (held("KeyE")) {
				// an E click on an entry opens its sprite and never selects or starts a box
				if (hovers.length > 0) EdSpriteLink.open(hovers[ed.curhoveri].spi);
			} else {
			// a G click on an entry, or a double click on the selection, goes inside its next group
			const into = hovers.length === 0 ? null : (held("KeyG") ? this.nextGroup(hovers[ed.curhoveri])
				: (this.dbl && !inp.shift && !this.hoverWheeled && hovers.some((h) => h.selected) ? this.nextGroup(hovers.find((h) => h.selected)) : null));
			if (this.grab !== null) {
				this.resizing = true;
				this.resizePrimed = true;
				this.rotating = inp.alt;
				const s0 = this.selects[0];
				const p = EdView.toView(s0.mylayer, s0.x - s0.exoffx + s0.loopdx, s0.y - s0.exoffy + s0.loopdy);
				this.rotateStAng = (s0.ang - Math.round(pointDirection(p.x, p.y, mouse.wx, mouse.wy)) + 720) % 360;
			} else if (this.pathHot !== null) {
				// A press on a path point makes its path the entry's current one, then with L turns its
				// looping on or off, with control puts a new point halfway to the next one, or below the
				// last, and otherwise starts dragging it.
				const hp = this.pathHot;
				const rec = hp.rec;
				rec.curPath = hp.name;
				if (held("KeyL") || inp.ctrl) {
					this.push(rec, ["paths"]);
					rec.paths = this.pathsWith(rec.paths, (list) => {
						const p = list.find((q) => q.name === hp.name);
						const i = hp.i * 2;
						if (held("KeyL")) p.loop = p.loop ? 0 : 1;
						else if (i + 2 < p.pts.length) p.pts.splice(i + 2, 0, Math.floor((p.pts[i] + p.pts[i + 2]) / 2), Math.floor((p.pts[i + 1] + p.pts[i + 3]) / 2));
						else p.pts.push(p.pts[i], p.pts[i + 1] + ED_PATH_DROP);
					});
					ed.rehover = true;
				} else {
					const ml = EdView.mouseOn(rec.mylayer);
					const a = rec.paths[hp.name];
					this.pathDrag = { rec: rec, name: hp.name, i: hp.i, mox: ml.x - a[hp.i * 2], moy: ml.y - a[hp.i * 2 + 1], primed: true };
				}
			} else if (held("KeyP")) {
				// P adds a point at the mouse, on the grid, to the one selected entry's current path,
				// starting a path when it has none; with shift it starts a new path first
				if (this.selects.length !== 1) {
					ed.debugtxt = " a P click needs exactly one entry selected";
				} else {
					const rec = this.selects[0];
					const ml = EdView.mouseOn(rec.mylayer);
					let name = this.curPath(rec);
					this.push(rec, ["paths"]);
					rec.paths = this.pathsWith(rec.paths, (list) => {
						if (name === null || inp.shift) {
							let n = list.length + 1;
							while (list.some((p) => p.name === ED_PATH_PREFIX + n)) n++;
							name = ED_PATH_PREFIX + n;
							list.push({ name: name, pts: [], loop: 0, was: undefined });
						}
						list.find((p) => p.name === name).pts.push(snap(ml.x), snap(ml.y));
					});
					rec.curPath = name;
					ed.rehover = true;
				}
			} else if (into !== null) {
				this.inGroup = into;
				this.clear();
				ed.rehover = true;
			} else if (hovers.length > 0 && held("KeyF")) {
				// F finds the type of the entry clicked; with control an object also of its sprite
				const hover = hovers[ed.curhoveri];
				this.find(hover.isobj !== undefined ? { isobj: hover.isobj, spi: inp.ctrl ? hover.spi : undefined } : { spi: hover.spi }, inp.alt);
			} else if (hovers.length > 0) {
				const hover = hovers[ed.curhoveri];
				const seldown = this.hoverWheeled ? undefined : hovers.find((h) => h.selected);
				if (seldown !== undefined) {
					if (held("KeyA")) {
						this.push(seldown, ["spd"]);
						seldown.spd = seldown.spd > 0 ? 0 : 1;
					} else if (held("KeyT")) {
						this.push(seldown, ["tiledx", "tiledy", "tile_loop"]);
						const t = seldown.tiledx ? 0 : 1;
						seldown.tiledx = t;
						seldown.tiledy = t;
						seldown.tile_loop = t && inp.shift ? 1 : 0;
						EdRoom.refresh(seldown);
					} else if (held("KeyB")) {
						// its area takes its sprite as the backdrop, as the original's did
						const lg = seldown.mylayer.group !== undefined ? room.lgroups[seldown.mylayer.group] : undefined;
						if (lg === undefined) {
							ed.debugtxt = " a B click needs an entry in an area";
						} else {
							this.push(lg, ["bdName", "bd_sprite"]);
							lg.bdName = seldown.spi;
							lg.bd_sprite = Sprites.exists(seldown.spi) ? seldown.spi : null;
							ed.debugtxt = " " + lg.name + " backdrop " + seldown.spi;
						}
					} else if (held("KeyH")) {
						seldown.hidden = 1;
						this.clear();
					} else if (inp.shift) {
						// shift takes its whole next group out of the selection, with alt only it
						const gname = inp.alt ? null : this.nextGroup(seldown);
						for (const rec of gname !== null ? room.objGroups[gname] : [seldown]) {
							rec.selected = false;
							if (this.selects.includes(rec)) this.selects.splice(this.selects.indexOf(rec), 1);
						}
					}
				} else if (held("KeyH")) {
					hover.hidden = 1;
				} else if (this.selects.length > 0 && held("KeyS")) {
					this.push(this.selects, ["spi"]);
					for (const rec of this.selects) {
						rec.spi = hover.spi;
						EdRoom.refresh(rec);
					}
				} else if (this.selects.length > 0 && held("KeyO") && hover.isobj !== undefined) {
					this.push(this.selects, ["isobj"]);
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
				// On nothing a press clears the selection, unless with shift, and starts a box. The
				// second press of a double one also steps out of the group being worked inside to the
				// one round it, if any, or with control out of every group.
				if (!inp.shift) this.clear();
				this.boxSelect = true;
				if (this.dbl && this.inGroup !== null) {
					const g = room.objGroups[this.inGroup][0].groups;
					const up = g.indexOf(this.inGroup) + 1;
					this.inGroup = up < g.length && !inp.ctrl ? g[up] : null;
					ed.rehover = true;
				}
			}
			}
		}

		// Dragging out a box selects whatever it touches on the layers that can be picked from, inside a
		// group only its entries. With shift what it touched stays selected, as in the original.
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
					if (rec.hidden || rec.selected || !this.inside(rec)) continue;
					const p = EdView.spot(rec);
					if (shapesOverlap(EdView.frameShape(rec, p.x, p.y), rect)) {
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
			this.keep(this.selects, ["x", "y", "exoffx", "exoffy"]);
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

		// Dragging a path point, on the grid, as one undo step. The entry's paths stay put when the
		// entry itself moves, as in the original.
		if (this.pathDrag !== null && inp.down.left && mmoved) {
			const pd = this.pathDrag;
			if (pd.primed) {
				pd.primed = false;
				this.push(pd.rec, ["paths"]);
			}
			const ml = EdView.mouseOn(pd.rec.mylayer);
			pd.rec.paths = this.pathsWith(pd.rec.paths, (list) => {
				const pts = list.find((p) => p.name === pd.name).pts;
				pts[pd.i * 2] = snap(ml.x - pd.mox);
				pts[pd.i * 2 + 1] = snap(ml.y - pd.moy);
			});
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
				this.push(this.selects, ["x", "y", "x_sc", "y_sc", "ang"]);
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
			this.pathDrag = null;
			ed.rehover = true;
		}

		const sel = this.selects;
		// A and the wheel steps the frame the selection starts on
		if (sel.length > 0 && held("KeyA") && wh !== 0) {
			this.push(sel, ["start_ifr", "ifr"]);
			for (const rec of sel) {
				const n = Sprites.get(rec.spi).frameCount;
				rec.start_ifr = ((rec.start_ifr - wh) % n + n) % n;
				rec.ifr = rec.start_ifr;
			}
		}
		// O and delete makes objects plain sprites again
		if (sel.length > 0 && held("KeyO") && hit("Delete")) {
			this.push(sel, ["isobj"]);
			for (const rec of sel) {
				rec.isobj = undefined;
				EdRoom.refresh(rec);
			}
			EdRoom.relink(room);
		}
		// Numpad minus flips, sideways or with shift upright; alt also mirrors the spots within the
		// selection's box. Numpad plus turns a quarter, clockwise or with shift the other way.
		if (sel.length > 0 && hit("NumpadSubtract")) {
			this.push(sel, ["x", "y", "x_sc", "y_sc"]);
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
			this.push(sel, ["ang"]);
			for (const rec of sel) {
				rec.ang = (rec.ang + (inp.shift ? 90 : 270)) % 360;
				EdRoom.refresh(rec);
			}
		}
		// The arrows nudge by a pixel, with shift by the grid, landing on whole pixels. With alt they
		// align instead, below.
		if (sel.length > 0 && arrows && !this.resizing && !inp.alt) {
			this.push(sel, ["x", "y"]);
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

		// With alt the arrows align, as the original's did, by each entry's whole picture frame,
		// turned ones by the upright box round them, against the box round all of them, positions
		// taken as each layer keeps them whatever its parallax. An arrow alone lines every entry's
		// matching side up with that side of the box. With left or right held, up or down centres them
		// across the box's middle; with up or down held, left or right centres them down it. With left
		// held, right spreads them from the box's left side to its right in order from the left with
		// equal gaps between, and the same for up and down. The held arrow's own press already lined
		// them up, so centring and spreading first undo that while it is still the last step, leaving
		// one step to undo. Lining up and centring need two entries, spreading three. Entries on layers
		// drawn one to one land on whole pixels, the others where the sums put them.
		if (sel.length > 1 && arrows && !this.resizing && inp.alt) {
			const lf = hit("ArrowLeft");
			const rt = hit("ArrowRight");
			const up = hit("ArrowUp");
			const dn = hit("ArrowDown");
			const centerx = (held("ArrowLeft") || held("ArrowRight")) && (up || dn);
			const centery = !centerx && (held("ArrowUp") || held("ArrowDown")) && (lf || rt);
			const spreadx = !centerx && !centery && ((lf && held("ArrowRight")) || (rt && held("ArrowLeft")));
			const spready = !centerx && !centery && !spreadx && ((up && held("ArrowDown")) || (dn && held("ArrowUp")));
			const side = !centerx && !centery && !spreadx && !spready;
			if (!((spreadx || spready) && sel.length < 3)) {
				if (!side && this.alignStep !== null && this.undos[this.undos.length - 1] === this.alignStep) this.undo(true);
				const recs = this.selects;
				this.push(recs, ["x", "y"]);
				this.alignStep = side ? this.undos[this.undos.length - 1] : null;
				const items = recs.map((rec) => {
					const px = rec.x - rec.exoffx;
					const py = rec.y - rec.exoffy;
					const f = EdView.frameShape(rec, px, py);
					return { rec: rec, px: px, py: py, l: f.l, t: f.t, r: f.r + 1, b: f.b + 1 };
				});
				const box = {
					l: Math.min(...items.map((it) => it.l)), t: Math.min(...items.map((it) => it.t)),
					r: Math.max(...items.map((it) => it.r)), b: Math.max(...items.map((it) => it.b))
				};
				// where each entry's frame's left or top side goes
				const tox = new Map();
				const toy = new Map();
				if (spreadx || spready) {
					const lo = spreadx ? (it) => it.l : (it) => it.t;
					const size = spreadx ? (it) => it.r - it.l : (it) => it.b - it.t;
					const sorted = items.slice().sort((a, b) => lo(a) - lo(b));
					const span = spreadx ? box.r - box.l : box.b - box.t;
					const gap = (span - sorted.reduce((sum, it) => sum + size(it), 0)) / (sorted.length - 1);
					let at = spreadx ? box.l : box.t;
					for (const it of sorted) {
						(spreadx ? tox : toy).set(it, at);
						at += size(it) + gap;
					}
				} else {
					for (const it of items) {
						if (centerx) tox.set(it, (box.l + box.r) / 2 - (it.r - it.l) / 2);
						else if (centery) toy.set(it, (box.t + box.b) / 2 - (it.b - it.t) / 2);
						else if (lf) tox.set(it, box.l);
						else if (rt) tox.set(it, box.r - (it.r - it.l));
						else if (up) toy.set(it, box.t);
						else toy.set(it, box.b - (it.b - it.t));
					}
				}
				for (const it of items) {
					const rec = it.rec;
					const whole = !rec.mylayer.lens.parax && rec.mylayer.host.wd === room.roomw ? Math.round : (v) => v;
					if (tox.has(it)) rec.x = whole(it.px + tox.get(it) - it.l) + rec.exoffx;
					if (toy.has(it)) rec.y = whole(it.py + toy.get(it) - it.t) + rec.exoffy;
					EdRoom.refresh(rec);
				}
				this.updateBox();
			}
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
				const p = EdView.spot(rec);
				return shapesOverlap(EdView.frameShape(rec, p.x, p.y), rect);
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

		// Letting go of the right button over a path point deletes the point, with shift its whole
		// path, and a path left with no points goes too. Over an entry it selects it and opens the
		// settings panel next to the mouse; over nothing it clears the selection. Let go over the
		// panel it does none of these.
		if (inp.released.right && ed.mouseIn) {
			if (this.pathHot !== null) {
				const hp = this.pathHot;
				this.push(hp.rec, ["paths"]);
				hp.rec.paths = this.pathsWith(hp.rec.paths, (list) => {
					const at = list.findIndex((p) => p.name === hp.name);
					list[at].pts.splice(hp.i * 2, 2);
					if (inp.shift || list[at].pts.length === 0) list.splice(at, 1);
				});
				this.pathHot = null;
				ed.rehover = true;
			} else if (hovers.length > 0) {
				const rec = hovers[ed.curhoveri];
				if (!rec.selected) {
					this.clear();
					this.select(rec, false);
				}
				EdPanel.open("entry", this.selects.slice(), rec, mouse.devx / ed.dpr, mouse.devy / ed.dpr);
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
