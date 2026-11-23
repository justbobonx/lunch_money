// The settings panel, a page panel by the mouse that edits the values of whatever it is opened on:
// entries (the original editor's right click panel and setup block box), layers with their group,
// or the room. Its top half has the plain values as typed fields; its bottom half has the setup
// block of what it is open on as a table of keys and values, or as its whole text. With several
// things open a value they differ in shows blank, and only what is actually changed goes to every
// one of them, block keys one by one. Every change is one undo step, after which the room shows,
// hits and links as the new settings say. A block the panel changes is written anew from no
// indent and moved in to its place when saved; any other keeps its text.

// the panel's font, at its own size of one font pixel to a page pixel, times a whole number
const ED_PANEL_FONT_FILE = "assets/fonts/m5x7.ttf";
const ED_PANEL_FONT_NAME = "m5x7";
const ED_PANEL_FONT_PX = 16;
const ED_PANEL_FONT_SCALE = 1;
// where the panel opens from the mouse, in page pixels, as the original's
const ED_PANEL_OFFSET_X = 6;
const ED_PANEL_OFFSET_Y = -15;
// sizes, in font pixels
const ED_PANEL_PAD = 4;
const ED_PANEL_LINE_H = 12;
const ED_PANEL_GAP = 4;
const ED_PANEL_INPUT_W = 72;
const ED_PANEL_KEY_W = 64;
const ED_PANEL_VALUE_W = 110;
const ED_PANEL_CHECK_SIZE = 7;
const ED_PANEL_SWATCH_W = 14;
const ED_PANEL_RAW_W = 200;
const ED_PANEL_RAW_ROWS = 14;
// colours, and how see through the panel's back is
const ED_PANEL_BACK_COLOR = "#12121a";
const ED_PANEL_BACK_ALPHA = 0.85;
const ED_PANEL_BORDER_COLOR = "#5a5a78";
const ED_PANEL_TEXT_COLOR = "#ccccdd";
const ED_PANEL_TITLE_COLOR = "#ffff33";
const ED_PANEL_LABEL_COLOR = "#8888a0";
const ED_PANEL_READ_COLOR = "#aaaabb";
const ED_PANEL_LINE_COLOR = "#2e2e42";
const ED_PANEL_FOCUS_COLOR = "#ffff33";
const ED_PANEL_FOCUS_BACK = "#000000";
const ED_PANEL_MIXED_COLOR = "#666680";
const ED_PANEL_SPECIAL_COLOR = "#ffaa55";
const ED_PANEL_ERROR_COLOR = "#ff6666";
// what a value the open things differ in shows
const ED_PANEL_MIXED_TEXT = "mixed";

// the kinds of layer group, as the player knows them
const ED_PANEL_GROUP_TYPES = [
	{ v: LGT_NON, label: "none" },
	{ v: LGT_CONNECTED, label: "connected" },
	{ v: LGT_POPUP, label: "popup" },
	{ v: LGT_EDGE, label: "edge" }
];

// entry block keys the player treats on their own, with what they do
const ED_PANEL_SPECIAL_KEYS = {
	objtype: "special: plays as this object type instead",
	mainchar: "special: becomes the player"
};

// Fields every object has that only its running uses, never offered as block keys. The placed
// sprite fields are left out as well, the shared values among them.
const ED_PANEL_INTERNAL_KEYS = ["mask", "dmi", "persistent", "active", "timers", "xspd", "yspd", "rspd", "zspd", "z",
	"rz", "moving", "inFallWall", "jumped", "cur_stayin", "facingy"];

// The kinds of thing the panel opens on. Each gives its title; its fields; what holds its setup
// block, how that block is read and written, the fields an undo step keeps for it, and what its
// rows are called; the lists of keys its suggestions come from, the classes whose starting fields
// are offered too and the keys marked special; whether the things are still there; and what is
// worked out again after a field changes.
// A field has a label and a type: read only, text, number (one above zero when it must be),
// box, colour (may be left empty when allowed), sprite name or a choice. It reads and writes each
// thing open, or with the holder mark the things holding the block, as a layer's group. Its undo
// step keeps the field of its key on each thing, or the fields it lists when it sets more than that
// one. A field with its own put does its own checking and undo step, and tells why it refused, if it
// did.
const ED_PANEL_KINDS = {
	entry: {
		title: (ts) => (ts.length > 1 ? ts.length + " entries" : "entry " + ts[0].name),
		blockLabel: "setup block",
		// the shared values, in the original's order; the spot is the entry's own, not its picture's
		fields: [
			{ key: "name", label: "name", type: "text", get: (r) => r.name, put: (ts, v) => {
				const taken = EdEdit.names();
				for (const r of ts) taken.delete(r.name);
				if (v === "") return "a name can't be empty";
				if (ts.length > 1) return "several entries can't share one name";
				if (taken.has(v)) return "the name " + v + " is taken in this room";
				if (v === ts[0].name) return "";
				EdEdit.push(ts[0], ["name"]);
				ts[0].name = v;
				return "";
			} },
			{ key: "type", label: "type", type: "read", get: (r) => (r.isobj !== undefined ? r.isobj + " : " + r.spi : r.spi) },
			{ key: "x", label: "x", type: "num", get: (r) => r.x - r.exoffx, set: (r, v) => { r.x = v + r.exoffx; } },
			{ key: "y", label: "y", type: "num", get: (r) => r.y - r.exoffy, set: (r, v) => { r.y = v + r.exoffy; } },
			{ key: "tiledx", label: "tile x", type: "check", get: (r) => (r.tiledx ? 1 : 0), set: (r, v) => { r.tiledx = v; } },
			{ key: "tiledy", label: "tile y", type: "check", get: (r) => (r.tiledy ? 1 : 0), set: (r, v) => { r.tiledy = v; } },
			{ key: "x_sc", label: "x scale", type: "num", get: (r) => r.x_sc, set: (r, v) => { r.x_sc = v; } },
			{ key: "y_sc", label: "y scale", type: "num", get: (r) => r.y_sc, set: (r, v) => { r.y_sc = v; } },
			{ key: "size", label: "size", type: "read", get: (r) => {
				const sr = Sprites.get(r.spi);
				return EdFile.number(sr.w * r.x_sc) + " x " + EdFile.number(sr.h * r.y_sc);
			} },
			{ key: "col", label: "blend", type: "color", get: (r) => r.col.replace("#", "").toUpperCase(), set: (r, v) => { r.col = "#" + v; } },
			{ key: "alpha", label: "alpha", type: "num", get: (r) => r.alpha, set: (r, v) => { r.alpha = v; } },
			{ key: "ang", label: "angle", type: "num", get: (r) => r.ang, set: (r, v) => { r.ang = v; } },
			{ key: "start_ifr", label: "start frame", type: "num", keeps: ["start_ifr", "ifr"], get: (r) => r.start_ifr, set: (r, v) => { r.start_ifr = v; r.ifr = v; } },
			{ key: "spd", label: "image speed", type: "num", get: (r) => r.spd, set: (r, v) => { r.spd = v; } }
		],
		holders: (ts, primary) => [primary].concat(ts.filter((r) => r !== primary)),
		getBlock: (r) => r.objinit,
		blockKeeps: ["objinit", "initFresh"],
		setBlock: (r, text) => {
			r.objinit = text;
			r.initFresh = text !== undefined;
		},
		lists: (ts) => ts.map((r) => "entry " + (r.isobj !== undefined ? r.isobj : "")),
		classes: (ts) => ts.filter((r) => r.isobj !== undefined).map((r) => objectType(r.isobj)),
		special: ED_PANEL_SPECIAL_KEYS,
		alive: (ts) => EdEdit.selects.length === ts.length && ts.every((r) => EdEdit.selects.includes(r)),
		after: (ts, room) => {
			for (const r of ts) EdRoom.refresh(r);
			EdRoom.relink(room);
		}
	},
	layer: {
		title: (ts) => (ts.length > 1 ? ts.length + " layers of group " + ts[0].group : "layer " + ts[0].name),
		blockLabel: "group setup block",
		fields: [
			{ key: "name", label: "name", type: "text", get: (l) => l.name, put: (ts, v) => {
				if (ts.length > 1) return "several layers can't share one name";
				EdGui.renameLayer(ts[0], v, false);
				return "";
			} },
			{ key: "group", label: "group", type: "read", get: (l) => (l.group !== undefined ? l.group : "none") },
			{ key: "plx_x", label: "parallax x", type: "num", get: (l) => l.plx_x, set: (l, v) => { l.plx_x = v; } },
			{ key: "plx_y", label: "parallax y", type: "num", get: (l) => l.plx_y, set: (l, v) => { l.plx_y = v; } },
			{ key: "loop_x", label: "loop x", type: "num", get: (l) => l.loop_x, set: (l, v) => { l.loop_x = v; } },
			{ key: "loop_y", label: "loop y", type: "num", get: (l) => l.loop_y, set: (l, v) => { l.loop_y = v; } },
			{ key: "wd", label: "width", type: "num", positive: true, keeps: ["wd", "ht"], get: (l) => l.wd, set: (l, v) => {
				l.wd = v;
				l.ht = v * 9 / 16;
			} },
			{ key: "ht", label: "height", type: "read", get: (l) => EdFile.number(l.ht) },
			{ key: "zsort", label: "sorted", type: "check", get: (l) => (l.zsort ? 1 : 0), set: (l, v) => { l.zsort = v; } },
			{ key: "disabled", label: "disabled", type: "check", get: (l) => (l.disabled ? 1 : 0), set: (l, v) => { l.disabled = v; } },
			{ key: "visible", label: "visible", type: "check", get: (l) => (l.visible ? 1 : 0), set: (l, v) => { l.visible = v; } },
			{ key: "locked", label: "locked", type: "check", get: (l) => (l.locked ? 1 : 0), set: (l, v) => { l.locked = v; } },
			{ key: "gui", label: "gui", type: "check", get: (l) => (l.gui ? 1 : 0), set: (l, v) => { l.gui = v; } },
			{ key: "count", label: "entries", type: "read", get: (l) => l.lsprites.length },
			{ key: "type", label: "group type", type: "choice", holder: true, options: ED_PANEL_GROUP_TYPES,
				get: (g) => g.type, set: (g, v) => { g.type = v; } },
			{ key: "bgcolor", label: "group colour", type: "color", empty: true, holder: true,
				get: (g) => String(g.bgcolor).toUpperCase(), set: (g, v) => { g.bgcolor = v; } },
			{ key: "bd_sprite", label: "backdrop", type: "sprite", holder: true, keeps: ["bdName", "bd_sprite"],
				get: (g) => (g.bdName !== undefined ? g.bdName : ""), set: (g, v) => {
					g.bdName = v === "" ? undefined : v;
					g.bd_sprite = v !== "" && Sprites.exists(v) ? v : null;
				} }
		],
		// the group every open layer is in, when they all are in one
		holders: (ts) => {
			const room = Editor.room;
			if (!ts.every((l) => l.group !== undefined && room.lgroups[l.group] !== undefined)) return [];
			return [...new Set(ts.map((l) => room.lgroups[l.group]))];
		},
		getBlock: (g) => g.grp_init,
		blockKeeps: ["grp_init", "initFresh"],
		setBlock: (g, text) => {
			g.grp_init = text;
			g.initFresh = text !== undefined;
		},
		lists: () => ["group"],
		classes: () => [],
		special: {},
		alive: (ts) => ts.every((l) => Editor.room.layers.includes(l)),
		// a folded group's header row keeps the fold's own look
		after: (ts, room) => {
			for (const l of ts) {
				const lg = l.group !== undefined ? room.lgroups[l.group] : undefined;
				if (lg === undefined || !lg.folded || lg.col_head_lyr !== l) EdGui.pretext(l);
				l.txt.disabled = !l.visible;
			}
			EdRoom.relink(room);
			EdGui.needLyrGuiReset = true;
		}
	},
	room: {
		title: (ts) => "room " + ts[0].name,
		blockLabel: "room setup block",
		fields: [
			// a saved room keeps its name, which its file carries
			{ key: "name", label: "name", type: "text", readOnly: (ts) => Editor.world.savedRooms.includes(ts[0].name),
				get: (r) => r.name, put: (ts, v) => EdGui.renameRoom(v) },
			// every layer keeps its scale to the room, the entries staying where they are
			{ key: "roomw", label: "width", type: "num", positive: true, get: (r) => r.roomw, put: (ts, v) => {
				const room = ts[0];
				if (v === room.roomw) return "";
				EdEdit.push(room, ["roomw", "roomh"]);
				EdEdit.keep(room.layers, ["wd", "ht"]);
				const k = v / room.roomw;
				for (const l of room.layers) {
					l.wd *= k;
					l.ht = l.wd * 9 / 16;
				}
				room.roomw = v;
				room.roomh = v * 9 / 16;
				return "";
			} },
			{ key: "roomh", label: "height", type: "read", get: (r) => EdFile.number(r.roomh) },
			// six hex digits as the room file holds them; the screen clears to it, empty leaves it out
			{ key: "bd_color", label: "backdrop colour", type: "color", empty: true,
				get: (r) => (r.bd_color !== undefined ? String(r.bd_color).toUpperCase() : ""), set: (r, v) => { r.bd_color = v === "" ? undefined : v; } },
			{ key: "grid_size", label: "grid size", type: "num", positive: true, get: (r) => r.grid_size, set: (r, v) => { r.grid_size = v; } },
			{ key: "grid_lock", label: "grid lock", type: "check", get: (r) => (r.grid_lock ? 1 : 0), set: (r, v) => { r.grid_lock = v; } },
			{ key: "autogen", label: "auto bounds", type: "read", get: (r) => (r.data.autogen_boundry_layers ? "on" : "off") }
		],
		holders: (ts) => ts,
		getBlock: (r) => r.room_init,
		blockKeeps: ["room_init", "initFresh"],
		setBlock: (r, text) => {
			r.room_init = text;
			r.initFresh = text !== undefined;
		},
		lists: () => ["room"],
		classes: () => [],
		special: {},
		alive: (ts) => Editor.room === ts[0],
		after: (ts, room) => {
			EdRoom.relink(room);
		}
	}
};

const EdPanel = {
	el: null,
	isOpen: false,
	// what it is open on: the kind, the things, the one clicked, the room they are in, the change
	// last shown, and the frame it opened in, whose press opened it rather than closing it
	kind: null,
	targets: [],
	primary: null,
	room: null,
	rev: -1,
	openedFrame: -1,
	// whether the block shows as its whole text, and whether a field is being let go by closing
	raw: false,
	closing: false,
	// the keys used in setup blocks across the room files, by list, each with a value seen
	used: null,
	// the title, the value fields with their inputs by key, the block's heading and its switch to
	// the whole text, the block half, the note line, and the sprite names offered
	title: null,
	grid: null,
	inputs: {},
	head: null,
	rawButton: null,
	block: null,
	msg: null,
	spriteList: null,
	// the names of the holders the fields were laid out for, so a rename into or out of a group
	// lays them out again
	builtFor: "",

	// Makes the panel, hidden, with its look and font, and the closing by escape.
	install() {
		const p = "var(--p)";
		const px = (n) => "calc(var(--p) * " + n + ")";
		const n = parseInt(ED_PANEL_BACK_COLOR.slice(1), 16);
		const back = "rgba(" + (n >> 16) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", " + ED_PANEL_BACK_ALPHA + ")";
		const style = document.createElement("style");
		style.textContent = "@font-face { font-family: \"" + ED_PANEL_FONT_NAME + "\"; src: url(\"" + ED_PANEL_FONT_FILE + "\"); }\n"
			+ "#ed_panel { position: fixed; display: none; box-sizing: border-box; max-height: 100vh; overflow: auto;"
			+ " background: " + back + "; border: " + p + " solid " + ED_PANEL_BORDER_COLOR + "; border-radius: 0; box-shadow: none;"
			+ " padding: " + px(ED_PANEL_PAD) + "; color: " + ED_PANEL_TEXT_COLOR + ";"
			+ " font-family: \"" + ED_PANEL_FONT_NAME + "\", monospace; font-size: " + px(ED_PANEL_FONT_PX) + "; line-height: " + px(ED_PANEL_LINE_H) + ";"
			+ " -webkit-font-smoothing: none; -moz-osx-font-smoothing: grayscale; font-smooth: never; text-rendering: optimizeSpeed; }\n"
			+ "#ed_panel .title { color: " + ED_PANEL_TITLE_COLOR + "; white-space: nowrap; margin-bottom: " + px(ED_PANEL_GAP / 2) + "; }\n"
			+ "#ed_panel .grid { display: grid; grid-template-columns: auto auto auto; column-gap: " + px(ED_PANEL_GAP) + "; align-items: center; }\n"
			+ "#ed_panel .label { color: " + ED_PANEL_LABEL_COLOR + "; white-space: nowrap; }\n"
			+ "#ed_panel .read { color: " + ED_PANEL_READ_COLOR + "; white-space: nowrap; }\n"
			+ "#ed_panel .special { color: " + ED_PANEL_SPECIAL_COLOR + "; }\n"
			+ "#ed_panel .msg { color: " + ED_PANEL_ERROR_COLOR + "; white-space: pre-line; }\n"
			+ "#ed_panel .note { color: " + ED_PANEL_LABEL_COLOR + "; white-space: pre-line; }\n"
			+ "#ed_panel .section { grid-column: 1 / -1; color: " + ED_PANEL_LABEL_COLOR + "; margin-top: " + px(ED_PANEL_GAP) + ";"
			+ " padding-top: " + px(ED_PANEL_GAP / 2) + "; border-top: " + p + " solid " + ED_PANEL_LINE_COLOR + "; }\n"
			+ "#ed_panel .head { display: flex; justify-content: space-between; margin-top: " + px(ED_PANEL_GAP) + ";"
			+ " padding-top: " + px(ED_PANEL_GAP / 2) + "; border-top: " + p + " solid " + ED_PANEL_LINE_COLOR + "; }\n"
			+ "#ed_panel input, #ed_panel textarea, #ed_panel button, #ed_panel select { font: inherit; color: inherit; background: transparent; margin: 0;"
			+ " border: 0; border-bottom: " + p + " solid " + ED_PANEL_LINE_COLOR + "; border-radius: 0; box-shadow: none; outline: none;"
			+ " padding: 0 " + p + "; box-sizing: border-box; }\n"
			+ "#ed_panel select { appearance: none; width: " + px(ED_PANEL_INPUT_W) + "; cursor: pointer; }\n"
			+ "#ed_panel option { background: " + ED_PANEL_FOCUS_BACK + "; }\n"
			+ "#ed_panel input[type=text] { width: " + px(ED_PANEL_INPUT_W) + "; }\n"
			+ "#ed_panel input.key { width: " + px(ED_PANEL_KEY_W) + "; }\n"
			+ "#ed_panel input.value { width: " + px(ED_PANEL_VALUE_W) + "; }\n"
			+ "#ed_panel input:focus, #ed_panel textarea:focus, #ed_panel select:focus { border-bottom-color: " + ED_PANEL_FOCUS_COLOR + "; background: " + ED_PANEL_FOCUS_BACK + "; }\n"
			+ "#ed_panel ::placeholder { color: " + ED_PANEL_MIXED_COLOR + "; opacity: 1; }\n"
			+ "#ed_panel input[type=checkbox] { appearance: none; width: " + px(ED_PANEL_CHECK_SIZE) + "; height: " + px(ED_PANEL_CHECK_SIZE) + ";"
			+ " padding: 0; border: " + p + " solid " + ED_PANEL_BORDER_COLOR + "; vertical-align: middle; }\n"
			+ "#ed_panel input[type=checkbox]:checked { background: " + ED_PANEL_TEXT_COLOR + "; }\n"
			+ "#ed_panel input[type=checkbox]:indeterminate { background: " + ED_PANEL_MIXED_COLOR + "; }\n"
			+ "#ed_panel input[type=checkbox]:focus { border-color: " + ED_PANEL_FOCUS_COLOR + "; }\n"
			+ "#ed_panel input[type=color] { appearance: none; width: " + px(ED_PANEL_SWATCH_W) + "; height: " + px(ED_PANEL_CHECK_SIZE + 2) + ";"
			+ " padding: 0; border: " + p + " solid " + ED_PANEL_BORDER_COLOR + "; vertical-align: middle; cursor: pointer; }\n"
			+ "#ed_panel input[type=color]::-webkit-color-swatch-wrapper { padding: 0; }\n"
			+ "#ed_panel input[type=color]::-webkit-color-swatch { border: 0; border-radius: 0; }\n"
			+ "#ed_panel input[type=color]::-moz-color-swatch { border: 0; border-radius: 0; }\n"
			+ "#ed_panel button { border: " + p + " solid " + ED_PANEL_LINE_COLOR + "; padding: 0 " + px(2) + "; cursor: pointer; }\n"
			+ "#ed_panel button:hover, #ed_panel button:focus { color: " + ED_PANEL_FOCUS_COLOR + "; border-color: " + ED_PANEL_FOCUS_COLOR + "; }\n"
			+ "#ed_panel textarea { display: block; width: " + px(ED_PANEL_RAW_W) + "; resize: both; white-space: pre; tab-size: 4; }\n";
		document.head.appendChild(style);

		const el = this.el = document.createElement("div");
		el.id = "ed_panel";
		el.addEventListener("contextmenu", (e) => e.stopPropagation());
		const part = (tag, cls) => {
			const d = document.createElement(tag);
			if (cls !== "") d.className = cls;
			el.appendChild(d);
			return d;
		};
		this.title = part("div", "title");
		this.grid = part("div", "grid");
		this.head = part("div", "head");
		const label = document.createElement("span");
		label.className = "label";
		this.head.appendChild(label);
		this.rawButton = document.createElement("button");
		this.rawButton.addEventListener("click", () => {
			this.raw = !this.raw;
			this.table(null);
		});
		this.head.appendChild(this.rawButton);
		this.block = part("div", "");
		this.msg = part("div", "msg");
		this.spriteList = part("datalist", "");
		this.spriteList.id = "ed_panel_sprites";
		document.body.appendChild(el);

		// escape closes, dropping a change still being typed
		window.addEventListener("keydown", (e) => {
			if (!this.isOpen || e.key !== "Escape") return;
			e.preventDefault();
			e.stopImmediatePropagation();
			this.close(false);
		}, true);
	},

	// Opens on things of a kind by a page spot, the one clicked first among them, sized so each font
	// pixel is a whole number of screen pixels. Opening again on the same thing closes it instead.
	open(kind, targets, primary, x, y) {
		if (this.isOpen && this.kind === kind && this.primary === primary) {
			this.close(true);
			return;
		}
		this.close(true);
		const el = this.el;
		const dpr = window.devicePixelRatio || 1;
		el.style.setProperty("--p", ED_PANEL_FONT_SCALE * Math.max(1, Math.round(dpr)) / dpr + "px");
		this.kind = kind;
		this.targets = targets.slice();
		this.primary = primary;
		this.room = Editor.room;
		this.raw = false;
		this.openedFrame = Editor.frames;
		this.msg.textContent = "";
		if (this.spriteList.children.length === 0) {
			for (const name of EdPicker.spriteNames) {
				const o = document.createElement("option");
				o.value = name;
				this.spriteList.appendChild(o);
			}
		}
		this.build();
		this.isOpen = true;
		el.style.display = "block";
		this.fill();
		this.table(null);
		el.style.left = "0px";
		el.style.top = "0px";
		const w = el.offsetWidth;
		const h = el.offsetHeight;
		el.style.left = Math.max(0, Math.min(x + ED_PANEL_OFFSET_X, window.innerWidth - w)) + "px";
		el.style.top = Math.max(0, Math.min(y + ED_PANEL_OFFSET_Y, window.innerHeight - h)) + "px";
	},

	// Closes, putting on or dropping a change still being typed.
	close(keep) {
		if (!this.isOpen) return;
		const act = document.activeElement;
		if (this.el.contains(act)) {
			this.closing = !keep;
			act.blur();
			this.closing = false;
		}
		this.isOpen = false;
		this.el.style.display = "none";
		this.targets = [];
		this.primary = null;
	},

	// At the end of each step: a press on the room or the overlay closes the panel, unless that press
	// opened it, putting on what was being typed; it also closes when what it is open on went, as
	// undoing or selecting other entries does; and it shows changes made other ways, as nudging does.
	step() {
		if (!this.isOpen) return;
		const inp = Editor.inp;
		if ((inp.pressed.left || inp.pressed.right || inp.pressed.middle) && this.openedFrame !== Editor.frames) {
			this.close(true);
			return;
		}
		if (Editor.room !== this.room || !ED_PANEL_KINDS[this.kind].alive(this.targets)) {
			this.close(false);
			return;
		}
		if (EdEdit.rev !== this.rev) {
			this.fill();
			if (!this.block.contains(document.activeElement)) this.table(null);
		}
	},

	say(text) {
		this.msg.textContent = text;
	},

	// Lays out the value fields of the kind open: a label and an input each, colours with a swatch,
	// and the holder's fields under a heading of their own, shown only when there is a holder.
	// Typing marks a field changed; enter or leaving it puts the change on. Boxes, choices and the
	// swatch put theirs on at once.
	build() {
		const kind = ED_PANEL_KINDS[this.kind];
		const grid = this.grid;
		grid.textContent = "";
		this.inputs = {};
		const holders = kind.holders(this.targets, this.primary);
		this.builtFor = holders.map((h) => h.name).join("\n");
		let section = false;
		for (const f of kind.fields) {
			if (f.holder && holders.length === 0) continue;
			if (f.holder && !section) {
				section = true;
				const s = document.createElement("div");
				s.className = "section";
				s.textContent = "group " + holders[0].name;
				grid.appendChild(s);
			}
			const label = document.createElement("span");
			label.className = "label";
			label.textContent = f.label;
			grid.appendChild(label);
			const box = { input: null, swatch: null, read: f.type === "read" || (f.readOnly !== undefined && f.readOnly(this.targets)) };
			if (box.read) {
				box.input = document.createElement("span");
				box.input.className = "read";
			} else if (f.type === "choice") {
				box.input = document.createElement("select");
				for (const o of [{ v: "", label: ED_PANEL_MIXED_TEXT }].concat(f.options)) {
					const opt = document.createElement("option");
					opt.value = String(o.v);
					opt.textContent = o.label;
					box.input.appendChild(opt);
				}
				box.input.addEventListener("change", () => {
					box.input.dataset.dirty = "1";
					this.commitField(f);
				});
			} else {
				box.input = document.createElement("input");
				box.input.type = f.type === "check" ? "checkbox" : "text";
				box.input.spellcheck = false;
				if (f.type === "sprite") box.input.setAttribute("list", this.spriteList.id);
				if (f.type === "check") {
					box.input.addEventListener("change", () => {
						box.input.dataset.dirty = "1";
						this.commitField(f);
					});
				} else {
					box.input.addEventListener("input", () => { box.input.dataset.dirty = "1"; });
					box.input.addEventListener("keydown", (e) => {
						if (e.key === "Enter") this.commitField(f);
					});
					box.input.addEventListener("blur", () => {
						if (!this.closing) this.commitField(f);
					});
				}
			}
			grid.appendChild(box.input);
			if (f.type === "color" && !box.read) {
				box.swatch = document.createElement("input");
				box.swatch.type = "color";
				box.swatch.addEventListener("change", () => {
					box.input.value = box.swatch.value.slice(1).toUpperCase();
					box.input.dataset.dirty = "1";
					this.commitField(f);
				});
				grid.appendChild(box.swatch);
			} else {
				grid.appendChild(document.createElement("span"));
			}
			this.inputs[f.key] = box;
		}
	},

	// what a field reads and writes: the things open, or the things holding their block
	of(f) {
		const kind = ED_PANEL_KINDS[this.kind];
		return f.holder ? kind.holders(this.targets, this.primary) : this.targets;
	},

	// Shows the values: each the things agree on, blank where they differ. A field being typed in
	// keeps what is typed. When the holders changed, as renaming a layer into a group does, the
	// fields are laid out again first.
	fill() {
		const kind = ED_PANEL_KINDS[this.kind];
		this.rev = EdEdit.rev;
		this.title.textContent = kind.title(this.targets);
		if (kind.holders(this.targets, this.primary).map((h) => h.name).join("\n") !== this.builtFor) this.build();
		for (const f of kind.fields) {
			const box = this.inputs[f.key];
			if (box === undefined) continue;
			const vals = this.of(f).map((t) => {
				const v = f.get(t);
				return f.type === "num" ? EdFile.number(v) : String(v);
			});
			const same = vals.every((v) => v === vals[0]);
			if (box.read) {
				box.input.textContent = same ? vals[0] : ED_PANEL_MIXED_TEXT;
				continue;
			}
			if (f.type === "check") {
				box.input.checked = same && vals[0] === "1";
				box.input.indeterminate = !same;
				continue;
			}
			if (f.type === "choice") {
				box.input.value = same ? vals[0] : "";
				continue;
			}
			if (document.activeElement === box.input && box.input.dataset.dirty) continue;
			delete box.input.dataset.dirty;
			box.input.value = same ? vals[0] : "";
			box.input.placeholder = same ? "" : ED_PANEL_MIXED_TEXT;
			if (box.swatch !== null) box.swatch.value = "#" + (same && vals[0] !== "" ? vals[0] : "000000").toLowerCase();
		}
	},

	// Puts a changed field on every thing it is for, as one undo step, or refuses it with a note and
	// shows the values again. Afterwards the room's mapping, the selection's box and what is under
	// the mouse are worked out again.
	commitField(f) {
		const kind = ED_PANEL_KINDS[this.kind];
		const input = this.inputs[f.key].input;
		if (!input.dataset.dirty) return;
		delete input.dataset.dirty;
		const t = input.value.trim();
		const refuse = (why) => {
			this.say(why);
			this.fill();
		};
		let v = t;
		if (f.type === "check") v = input.checked ? 1 : 0;
		if (f.type === "choice") {
			if (t === "") return;
			v = Number(t);
		}
		if (f.type === "num") {
			v = Number(t);
			if (t === "" || !Number.isFinite(v)) return refuse(f.label + ": \"" + t + "\" is not a number");
			if (f.positive && !(v > 0)) return refuse(f.label + " must be above zero");
		}
		if (f.type === "color" && !(f.empty && t === "")) {
			const m = /^#?([0-9a-f]{6})$/i.exec(t);
			if (m === null) return refuse(f.label + ": give six hex digits, as FFFFFF" + (f.empty ? ", or nothing" : ""));
			v = m[1].toUpperCase();
		}
		const things = this.of(f);
		if (f.put !== undefined) {
			const why = f.put(things, v);
			if (why !== "") return refuse(why);
		} else {
			if (things.every((x) => String(f.get(x)) === String(v))) return refuse("");
			EdEdit.push(things, f.keeps !== undefined ? f.keeps : [f.key]);
			for (const x of things) f.set(x, v);
		}
		const room = Editor.room;
		if (kind.alive(this.targets)) kind.after(this.targets, room);
		EdView.lenses();
		EdEdit.updateBox();
		Editor.rehover = true;
		this.say("");
		this.fill();
	},

	// A block's text with the indent its lines share taken off, so it reads from the left.
	rebase(text) {
		const lines = text.split("\n");
		let cut = Infinity;
		for (const line of lines.slice(1)) {
			if (line.trim() !== "") cut = Math.min(cut, line.length - line.trimStart().length);
		}
		if (cut === Infinity) return text;
		return [lines[0]].concat(lines.slice(1).map((line) => line.slice(Math.min(cut, line.length - line.trimStart().length)))).join("\n");
	},

	// A block's text read the way the player reads it: nothing for no block, the map it holds, or
	// null when it can't be read as a map.
	read(text) {
		if (text === undefined) return undefined;
		const v = game.parseHandWritten(text, "setup block");
		return v !== null && typeof v === "object" && !Array.isArray(v) ? v : null;
	},

	// Builds the block half again: the table of every key the holders' blocks hold, with the line
	// to add one, or the first holder's whole block text. With no holder it is left out. A field that
	// had the focus before gets it back.
	table(slot) {
		const kind = ED_PANEL_KINDS[this.kind];
		const block = this.block;
		block.textContent = "";
		const holders = kind.holders(this.targets, this.primary);
		this.head.style.display = holders.length > 0 ? "" : "none";
		if (holders.length === 0) return;
		this.head.firstChild.textContent = kind.blockLabel;
		this.rawButton.textContent = this.raw ? "table" : "text";
		const first = holders[0];
		const name = (h) => (h.name !== undefined ? h.name : kind.title([h]));
		// Every field of the block half: typing marks it changed, enter or leaving it puts the change
		// on, through the given commit. A refused one stays as typed.
		const field = (tag, cls, slotName, text, mixed, commit) => {
			const input = document.createElement(tag);
			if (tag === "input") input.type = "text";
			input.className = cls;
			input.spellcheck = false;
			input.value = text;
			input.placeholder = mixed ? ED_PANEL_MIXED_TEXT : "";
			input.dataset.slot = slotName;
			input.addEventListener("input", () => { input.dataset.dirty = "1"; });
			const go = (next) => {
				if (!input.dataset.dirty) return;
				delete input.dataset.dirty;
				commit(input.value, next && next.dataset ? next.dataset.slot : null);
			};
			input.addEventListener("keydown", (e) => {
				if (e.key === "Enter" && (tag === "input" || e.ctrlKey || e.metaKey)) {
					e.preventDefault();
					go(input);
				}
			});
			input.addEventListener("blur", (e) => {
				if (!this.closing) go(e.relatedTarget);
			});
			return input;
		};
		const note = (text, cls) => {
			const d = document.createElement("div");
			d.className = cls;
			d.textContent = text;
			block.appendChild(d);
		};
		const inits = new Map(holders.map((h) => [h, this.read(kind.getBlock(h))]));
		const unread = holders.filter((h) => inits.get(h) === null);

		if (this.raw) {
			if (holders.length > 1) note("the text of " + name(first) + "; changed keys go to all " + holders.length, "note");
			const text = kind.getBlock(first);
			const shown = text !== undefined ? this.rebase(text) : "";
			const ta = field("textarea", "", "raw", shown, false, (typed, next) => {
				const t = this.rebase(typed);
				if (t === shown) return;
				if (t.trim() === "") {
					this.applyBlock(null, undefined, next);
					return;
				}
				const parsed = this.read(t);
				if (parsed === null) {
					this.say("the block must be a map of keys and values in braces");
					ta.dataset.dirty = "1";
					return;
				}
				const old = inits.get(first) || {};
				const changes = [];
				for (const k of Object.keys(parsed)) {
					if (!Object.prototype.hasOwnProperty.call(old, k) || JSON.stringify(old[k]) !== JSON.stringify(parsed[k])) changes.push({ key: k, value: parsed[k] });
				}
				for (const k of Object.keys(old)) if (!Object.prototype.hasOwnProperty.call(parsed, k)) changes.push({ key: k, remove: true });
				this.applyBlock(changes, t, next);
			});
			ta.rows = ED_PANEL_RAW_ROWS;
			block.appendChild(ta);
			note("control enter or leaving puts it on; empty removes the block", "note");
		} else {
			if (unread.length > 0) note("can't read the block of " + unread.map(name).join(", ") + "; left alone, see its text", "msg");
			const readable = holders.filter((h) => !unread.includes(h));
			const keys = [];
			for (const h of readable) {
				const init = inits.get(h);
				if (init) for (const k of Object.keys(init)) if (!keys.includes(k)) keys.push(k);
			}
			const grid = document.createElement("div");
			grid.className = "grid";
			block.appendChild(grid);
			for (const key of keys) {
				const have = readable.filter((h) => inits.get(h) && Object.prototype.hasOwnProperty.call(inits.get(h), key));
				const v0 = inits.get(have[0])[key];
				const same = have.length === readable.length && have.every((h) => JSON.stringify(inits.get(h)[key]) === JSON.stringify(v0));
				const type = typeof v0 === "boolean" ? "bool" : typeof v0 === "number" ? "num" : typeof v0 === "string" ? "str" : "json";
				const label = document.createElement("span");
				const special = kind.special[key];
				label.className = special !== undefined ? "special" : "label";
				label.textContent = key;
				label.title = special !== undefined ? special : type;
				grid.appendChild(label);
				let input;
				if (type === "bool") {
					input = document.createElement("input");
					input.type = "checkbox";
					input.checked = same && v0;
					input.indeterminate = !same;
					input.dataset.slot = "v:" + key;
					input.addEventListener("change", () => this.applyBlock([{ key: key, value: input.checked }], undefined, "v:" + key));
				} else {
					const shown = !same ? "" : type === "json" ? JSON.stringify(v0) : String(v0);
					input = field("input", "value", "v:" + key, shown, !same, (text, next) => {
						let v = text;
						if (type === "num") {
							v = Number(text.trim());
							if (text.trim() === "" || !Number.isFinite(v)) {
								this.say(key + " holds a number; \"" + text + "\" is not one");
								input.dataset.dirty = "1";
								return;
							}
						}
						if (type === "json") {
							v = text.trim() === "" ? null : game.parseHandWritten(text, key);
							if (v === null || typeof v !== "object" || Array.isArray(v) !== Array.isArray(v0)) {
								this.say(key + " holds " + (Array.isArray(v0) ? "a list in brackets" : "a map in braces") + "; that text isn't one");
								input.dataset.dirty = "1";
								return;
							}
						}
						this.applyBlock([{ key: key, value: v }], undefined, next);
					});
				}
				grid.appendChild(input);
				const rm = document.createElement("button");
				rm.textContent = "x";
				rm.title = "remove " + key;
				rm.addEventListener("click", () => this.applyBlock([{ key: key, remove: true }], undefined, "add:key"));
				grid.appendChild(rm);
			}

			// The line adding a key, offering the keys the open things' lists hold across the room
			// files and those their classes start with. A value reads as a number, true, false, a list
			// or a map when it is one, and as text otherwise. Adding waits for enter or the button, so
			// moving from the key to its value does not add.
			const offered = this.suggestions();
			const list = document.createElement("datalist");
			list.id = "ed_panel_keys";
			for (const [k, v] of offered) {
				if (keys.includes(k)) continue;
				const o = document.createElement("option");
				o.value = k;
				o.label = kind.special[k] !== undefined ? kind.special[k] : "as " + JSON.stringify(v);
				list.appendChild(o);
			}
			block.appendChild(list);
			const keyIn = field("input", "key", "add:key", "", false, () => {});
			keyIn.setAttribute("list", list.id);
			keyIn.placeholder = "+ key";
			const valIn = field("input", "value", "add:val", "", false, () => {});
			valIn.placeholder = "value";
			const add = () => {
				const key = keyIn.value.trim();
				const vt = valIn.value.trim();
				if (key === "" || vt === "") {
					this.say("a new key needs a name and a value");
					return;
				}
				let v = vt;
				if (vt[0] === "[" || vt[0] === "{") {
					v = game.parseHandWritten(vt, key);
					if (v === null) {
						this.say("can't read the value of " + key);
						return;
					}
				} else {
					try {
						v = JSON.parse(vt);
					} catch (e) {
						v = vt;
					}
				}
				this.applyBlock([{ key: key, value: v }], undefined, "add:key");
			};
			for (const input of [keyIn, valIn]) {
				input.addEventListener("keydown", (e) => {
					if (e.key === "Enter") add();
				});
			}
			keyIn.addEventListener("input", () => {
				const hit = offered.get(keyIn.value.trim());
				valIn.placeholder = hit !== undefined ? JSON.stringify(hit) : "value";
			});
			const plus = document.createElement("button");
			plus.textContent = "+";
			plus.title = "add the key to every block shown";
			plus.addEventListener("click", add);
			grid.appendChild(keyIn);
			grid.appendChild(valIn);
			grid.appendChild(plus);
		}
		if (slot !== null) {
			const back = block.querySelector("[data-slot=\"" + CSS.escape(slot) + "\"]");
			if (back !== null) back.focus();
		}
	},

	// The keys offered for adding, with a value to show: those the open things' lists hold across
	// the room files, entry blocks by object type, group blocks and room blocks, then those their
	// classes start with, less fields only running uses and values that are empty or not plain data.
	suggestions() {
		const kind = ED_PANEL_KINDS[this.kind];
		if (this.used === null) {
			this.used = new Map();
			const keep = (list, text) => {
				if (typeof text !== "string") return;
				const init = this.read(text);
				if (!init) return;
				if (!this.used.has(list)) this.used.set(list, new Map());
				const m = this.used.get(list);
				for (const k of Object.keys(init)) if (!m.has(k)) m.set(k, init[k]);
			};
			for (const rm of game.rooms) {
				if (!rm.text) continue;
				let smap;
				try {
					smap = game.parseRoom(rm.text);
				} catch (e) {
					continue;
				}
				keep("room", smap.room_init);
				for (const g of Object.values(smap.layer_groups || {})) keep("group", g.grp_init);
				for (const lyr of smap.layers || []) {
					for (const spri of lyr.spriteList || []) keep("entry " + (spri.isobj !== undefined ? spri.isobj : ""), spri.objinit);
				}
			}
		}
		const out = new Map();
		for (const list of kind.lists(this.targets)) {
			const m = this.used.get(list);
			if (m !== undefined) for (const [k, v] of m) if (!out.has(k)) out.set(k, v);
		}
		for (const cls of kind.classes(this.targets)) {
			if (cls === undefined) continue;
			let inst;
			try {
				inst = new cls();
			} catch (e) {
				continue;
			}
			for (const k of Object.keys(inst)) {
				const v = inst[k];
				if (out.has(k) || k in LP_SPRITE_DEFAULTS || ED_PANEL_INTERNAL_KEYS.includes(k) || k[0] === "_") continue;
				if (v === null || v === undefined || typeof v === "function") continue;
				if (typeof v === "object" && (!(Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype) || Object.keys(v).length === 0)) continue;
				out.set(k, v);
			}
		}
		return out;
	},

	// Puts block changes on every holder, key by key, or with no changes given removes every block.
	// The first holder can take a whole text instead. Holders whose block can't be read, and those
	// the changes leave as they were, are left alone. Changed blocks are written anew from no
	// indent, laid out at their depth when the room is saved, as one undo step. The field to give
	// the focus back to is named.
	applyBlock(changes, firstText, slot) {
		const kind = ED_PANEL_KINDS[this.kind];
		// a value laid out as the room files lay blocks out: maps a key a line, lists of plain values
		// on one line, other lists an item a line
		const layout = (v, depth) => {
			const ind = "\t".repeat(depth);
			if (Array.isArray(v)) {
				if (v.length === 0) return "[]";
				if (v.every((x) => x === null || typeof x !== "object")) return "[ " + v.map((x) => JSON.stringify(x)).join(", ") + " ]";
				return "[\n" + v.map((x) => ind + "\t" + layout(x, depth + 1)).join(",\n") + "\n" + ind + "]";
			}
			if (v !== null && typeof v === "object") {
				const keys = Object.keys(v);
				if (keys.length === 0) return "{}";
				return "{\n" + keys.map((k) => ind + "\t" + JSON.stringify(k) + ": " + layout(v[k], depth + 1)).join(",\n") + "\n" + ind + "}";
			}
			return JSON.stringify(v);
		};
		const holders = kind.holders(this.targets, this.primary);
		const plan = [];
		for (const h of holders) {
			const was = kind.getBlock(h);
			let next;
			if (changes === null) {
				next = undefined;
			} else if (firstText !== undefined && h === holders[0]) {
				next = firstText;
			} else {
				const before = this.read(was);
				if (before === null) continue;
				const obj = Object.assign({}, before || {});
				for (const c of changes) {
					if (c.remove) delete obj[c.key];
					else obj[c.key] = c.value;
				}
				if (JSON.stringify(obj) === JSON.stringify(before || {})) continue;
				next = Object.keys(obj).length > 0 ? layout(obj, 0) : undefined;
			}
			if (next !== was) plan.push({ holder: h, text: next });
		}
		// the room file marks a block's ends with these two, so a block can't hold them
		if (plan.some((p) => p.text !== undefined && /[»«]/.test(p.text))) {
			this.say("a setup block can't hold the marks » or «");
			return;
		}
		this.say("");
		if (plan.length === 0) {
			this.table(slot);
			return;
		}
		EdEdit.push(plan.map((p) => p.holder), kind.blockKeeps);
		for (const p of plan) kind.setBlock(p.holder, p.text);
		kind.after(this.targets, Editor.room);
		EdView.lenses();
		EdEdit.updateBox();
		Editor.rehover = true;
		this.fill();
		this.table(slot);
	}
};
