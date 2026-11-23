// The settings panel, the original editor's right click panel and setup block box as one page
// panel by the mouse. Its top half has the values every entry shares, as plain typed fields; its
// bottom half has the entry's setup block as a table of keys and values, or as its whole text.
// With several entries selected a value they differ in shows blank, and only what is actually
// changed goes to every one of them, block keys one by one. Every change is one undo step, after
// which the entries show, hit and link as their new settings say. A block the panel changes is
// written anew from no indent and moved in to its place when saved; any other keeps its text.

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
const ED_PANEL_LABEL_COLOR = "#8888a0";
const ED_PANEL_READ_COLOR = "#aaaabb";
const ED_PANEL_LINE_COLOR = "#2e2e42";
const ED_PANEL_FOCUS_COLOR = "#ffff33";
const ED_PANEL_FOCUS_BACK = "#000000";
const ED_PANEL_MIXED_COLOR = "#666680";
const ED_PANEL_SPECIAL_COLOR = "#ffaa55";
const ED_PANEL_ERROR_COLOR = "#ff6666";
// what a value the selected entries differ in shows
const ED_PANEL_MIXED_TEXT = "mixed";

// The shared values, in the original's order: what each is called, how it is typed, and how it is
// read from and put on an entry. The spot is the entry's own, not its picture's.
const ED_PANEL_FIELDS = [
	{ key: "name", label: "name", kind: "name", get: (r) => r.name, set: (r, v) => { r.name = v; } },
	{ key: "type", label: "type", kind: "read", get: (r) => (r.isobj !== undefined ? r.isobj + " : " + r.spi : r.spi) },
	{ key: "x", label: "x", kind: "num", get: (r) => r.x - r.exoffx, set: (r, v) => { r.x = v + r.exoffx; } },
	{ key: "y", label: "y", kind: "num", get: (r) => r.y - r.exoffy, set: (r, v) => { r.y = v + r.exoffy; } },
	{ key: "tiledx", label: "tile x", kind: "check", get: (r) => (r.tiledx ? 1 : 0), set: (r, v) => { r.tiledx = v; } },
	{ key: "tiledy", label: "tile y", kind: "check", get: (r) => (r.tiledy ? 1 : 0), set: (r, v) => { r.tiledy = v; } },
	{ key: "x_sc", label: "x scale", kind: "num", get: (r) => r.x_sc, set: (r, v) => { r.x_sc = v; } },
	{ key: "y_sc", label: "y scale", kind: "num", get: (r) => r.y_sc, set: (r, v) => { r.y_sc = v; } },
	{ key: "size", label: "size", kind: "read", get: (r) => {
		const sr = Sprites.get(r.spi);
		return EdFile.number(sr.w * r.x_sc) + " x " + EdFile.number(sr.h * r.y_sc);
	} },
	{ key: "col", label: "blend", kind: "color", get: (r) => r.col.replace("#", "").toUpperCase(), set: (r, v) => { r.col = "#" + v; } },
	{ key: "alpha", label: "alpha", kind: "num", get: (r) => r.alpha, set: (r, v) => { r.alpha = v; } },
	{ key: "ang", label: "angle", kind: "num", get: (r) => r.ang, set: (r, v) => { r.ang = v; } },
	{ key: "start_ifr", label: "start frame", kind: "num", get: (r) => r.start_ifr, set: (r, v) => { r.start_ifr = v; r.ifr = v; } },
	{ key: "spd", label: "image speed", kind: "num", get: (r) => r.spd, set: (r, v) => { r.spd = v; } }
];

// block keys the player treats on their own, with what they do
const ED_PANEL_SPECIAL_KEYS = {
	objtype: "special: plays as this object type instead",
	mainchar: "special: becomes the player"
};

// Fields every object has that only its running uses, never offered as block keys. The placed
// sprite fields are left out as well, the shared values above among them.
const ED_PANEL_INTERNAL_KEYS = ["mask", "dmi", "persistent", "active", "timers", "xspd", "yspd", "rspd", "zspd", "z",
	"rz", "moving", "inFallWall", "jumped", "cur_stayin", "facingy"];

const EdPanel = {
	el: null,
	isOpen: false,
	// the entries shown, the one right clicked, the room they are in and the change last shown
	recs: [],
	primary: null,
	room: null,
	rev: -1,
	// whether the block shows as its whole text, and whether a field is being let go by closing
	raw: false,
	closing: false,
	// the keys used in setup blocks across the room files, by object type, with a value seen
	used: null,
	// the shared value fields, by key, the switch to the block's text, the block half and the note line
	inputs: {},
	rawButton: null,
	block: null,
	msg: null,

	// Makes the panel, hidden, with its look and font, and the closing by escape or a press
	// anywhere else.
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
			+ "#ed_panel .grid { display: grid; grid-template-columns: auto auto auto; column-gap: " + px(ED_PANEL_GAP) + "; align-items: center; }\n"
			+ "#ed_panel .label { color: " + ED_PANEL_LABEL_COLOR + "; white-space: nowrap; }\n"
			+ "#ed_panel .read { color: " + ED_PANEL_READ_COLOR + "; white-space: nowrap; }\n"
			+ "#ed_panel .special { color: " + ED_PANEL_SPECIAL_COLOR + "; }\n"
			+ "#ed_panel .msg { color: " + ED_PANEL_ERROR_COLOR + "; white-space: pre-line; }\n"
			+ "#ed_panel .note { color: " + ED_PANEL_LABEL_COLOR + "; white-space: pre-line; }\n"
			+ "#ed_panel .head { display: flex; justify-content: space-between; margin-top: " + px(ED_PANEL_GAP) + ";"
			+ " padding-top: " + px(ED_PANEL_GAP / 2) + "; border-top: " + p + " solid " + ED_PANEL_LINE_COLOR + "; }\n"
			+ "#ed_panel input, #ed_panel textarea, #ed_panel button { font: inherit; color: inherit; background: transparent; margin: 0;"
			+ " border: 0; border-bottom: " + p + " solid " + ED_PANEL_LINE_COLOR + "; border-radius: 0; box-shadow: none; outline: none;"
			+ " padding: 0 " + p + "; box-sizing: border-box; }\n"
			+ "#ed_panel input[type=text] { width: " + px(ED_PANEL_INPUT_W) + "; }\n"
			+ "#ed_panel input.key { width: " + px(ED_PANEL_KEY_W) + "; }\n"
			+ "#ed_panel input.value { width: " + px(ED_PANEL_VALUE_W) + "; }\n"
			+ "#ed_panel input:focus, #ed_panel textarea:focus { border-bottom-color: " + ED_PANEL_FOCUS_COLOR + "; background: " + ED_PANEL_FOCUS_BACK + "; }\n"
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
		const grid = document.createElement("div");
		grid.className = "grid";
		el.appendChild(grid);

		// The shared fields. Typing marks a field changed; enter or leaving it puts the change on
		// the entries. Boxes and the colour swatch put theirs on at once.
		for (const f of ED_PANEL_FIELDS) {
			const label = document.createElement("span");
			label.className = "label";
			label.textContent = f.label;
			grid.appendChild(label);
			const box = { input: null, swatch: null };
			if (f.kind === "read") {
				box.input = document.createElement("span");
				box.input.className = "read";
			} else {
				box.input = document.createElement("input");
				box.input.type = f.kind === "check" ? "checkbox" : "text";
				box.input.spellcheck = false;
				if (f.kind === "check") {
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
			if (f.kind === "color") {
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

		// the block's heading, with the switch between the table and the whole text
		const head = document.createElement("div");
		head.className = "head";
		const title = document.createElement("span");
		title.className = "label";
		title.textContent = "setup block";
		head.appendChild(title);
		this.rawButton = document.createElement("button");
		this.rawButton.addEventListener("click", () => {
			this.raw = !this.raw;
			this.table(null);
		});
		head.appendChild(this.rawButton);
		el.appendChild(head);
		this.block = document.createElement("div");
		el.appendChild(this.block);
		this.msg = document.createElement("div");
		this.msg.className = "msg";
		el.appendChild(this.msg);
		document.body.appendChild(el);

		// Escape closes, dropping a change still being typed. A press anywhere else closes too,
		// first putting on what was typed, and still does what it does there.
		window.addEventListener("keydown", (e) => {
			if (!this.isOpen || e.key !== "Escape") return;
			e.preventDefault();
			e.stopImmediatePropagation();
			this.close(false);
		}, true);
		window.addEventListener("mousedown", (e) => {
			if (this.isOpen && !el.contains(e.target)) this.close(true);
		}, true);
	},

	// Opens on the selection by a page spot, the entry right clicked first among them, sized so
	// each font pixel is a whole number of screen pixels.
	open(rec, x, y) {
		const el = this.el;
		const dpr = window.devicePixelRatio || 1;
		el.style.setProperty("--p", ED_PANEL_FONT_SCALE * Math.max(1, Math.round(dpr)) / dpr + "px");
		this.recs = EdEdit.selects.slice();
		this.primary = rec;
		this.room = Editor.room;
		this.raw = false;
		this.msg.textContent = "";
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
		this.recs = [];
		this.primary = null;
	},

	// Each step: closes when the room or the selection changed under the panel, as undoing or
	// selecting with the keys does, and shows changes made other ways, as nudging does.
	step() {
		if (!this.isOpen) return;
		const sel = EdEdit.selects;
		if (Editor.room !== this.room || sel.length !== this.recs.length || this.recs.some((r) => !sel.includes(r))) {
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

	// Shows the shared values: each the entries agree on, blank where they differ. A field being
	// typed in keeps what is typed.
	fill() {
		this.rev = EdEdit.rev;
		for (const f of ED_PANEL_FIELDS) {
			const box = this.inputs[f.key];
			const vals = this.recs.map((r) => {
				const v = f.get(r);
				return f.kind === "num" ? EdFile.number(v) : String(v);
			});
			const same = vals.every((v) => v === vals[0]);
			if (f.kind === "read") {
				box.input.textContent = same ? vals[0] : ED_PANEL_MIXED_TEXT;
				continue;
			}
			if (f.kind === "check") {
				box.input.checked = same && vals[0] === "1";
				box.input.indeterminate = !same;
				continue;
			}
			if (document.activeElement === box.input && box.input.dataset.dirty) continue;
			delete box.input.dataset.dirty;
			box.input.value = same ? vals[0] : "";
			box.input.placeholder = same ? "" : ED_PANEL_MIXED_TEXT;
			if (box.swatch !== null) box.swatch.value = "#" + (same ? vals[0] : "000000").toLowerCase();
		}
	},

	// Puts a changed shared field on every shown entry, as one undo step, or refuses it with a
	// note and shows the values again. Names must stay unique in the room.
	commitField(f) {
		const input = this.inputs[f.key].input;
		if (!input.dataset.dirty) return;
		delete input.dataset.dirty;
		const t = input.value.trim();
		let v = t;
		if (f.kind === "check") v = input.checked ? 1 : 0;
		if (f.kind === "num") {
			v = Number(t);
			if (t === "" || !Number.isFinite(v)) {
				this.say(f.label + ": \"" + t + "\" is not a number");
				this.fill();
				return;
			}
		}
		if (f.kind === "color") {
			const m = /^#?([0-9a-f]{6})$/i.exec(t);
			if (m === null) {
				this.say(f.label + ": give six hex digits, as FFFFFF");
				this.fill();
				return;
			}
			v = m[1].toUpperCase();
		}
		if (f.kind === "name") {
			const taken = EdEdit.names();
			for (const r of this.recs) taken.delete(r.name);
			const why = t === "" ? "a name can't be empty"
				: this.recs.length > 1 ? "several entries can't share one name"
				: taken.has(t) ? "the name " + t + " is taken in this room" : "";
			if (why !== "") {
				this.say(why);
				this.fill();
				return;
			}
		}
		if (this.recs.every((r) => String(f.get(r)) === String(v))) {
			this.fill();
			return;
		}
		EdEdit.push();
		for (const r of this.recs) {
			f.set(r, v);
			EdRoom.refresh(r);
		}
		EdRoom.relink(this.room);
		EdEdit.updateBox();
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

	// Builds the block half again: the table of every key the shown entries' blocks hold, with the
	// line to add one, or the right clicked entry's whole block text. A field that had the focus
	// before gets it back.
	table(slot) {
		const block = this.block;
		block.textContent = "";
		this.rawButton.textContent = this.raw ? "table" : "text";
		const recs = this.recs;
		const primary = this.primary;
		// Every field of the block half: typing marks it changed, enter or leaving it puts the change
		// on, through the given commit, which tells whether it was taken. A refused one stays.
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
		const unread = recs.filter((r) => r.objinit !== undefined && r.init === null);

		if (this.raw) {
			if (recs.length > 1) note("the text of " + primary.name + "; changed keys go to all " + recs.length, "note");
			const shown = primary.objinit !== undefined ? this.rebase(primary.objinit) : "";
			const ta = field("textarea", "", "raw", shown, false, (text, next) => {
				const t = this.rebase(text);
				if (t === shown) return;
				if (t.trim() === "") {
					this.applyBlock(null, undefined, next);
					return;
				}
				const parsed = game.parseHandWritten(t, primary.name);
				if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
					this.say("the block must be a map of keys and values in braces");
					ta.dataset.dirty = "1";
					return;
				}
				const old = primary.init || {};
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
			if (unread.length > 0) note("can't read the block of " + unread.map((r) => r.name).join(", ") + "; left alone, see its text", "msg");
			const readable = recs.filter((r) => !unread.includes(r));
			const keys = [];
			for (const r of [primary].concat(readable)) {
				if (r.init) for (const k of Object.keys(r.init)) if (!keys.includes(k)) keys.push(k);
			}
			const grid = document.createElement("div");
			grid.className = "grid";
			block.appendChild(grid);
			for (const key of keys) {
				const holders = readable.filter((r) => r.init && Object.prototype.hasOwnProperty.call(r.init, key));
				if (holders.length === 0) continue;
				const v0 = holders[0].init[key];
				const same = holders.length === readable.length && holders.every((r) => JSON.stringify(r.init[key]) === JSON.stringify(v0));
				const kind = typeof v0 === "boolean" ? "bool" : typeof v0 === "number" ? "num" : typeof v0 === "string" ? "str" : "json";
				const label = document.createElement("span");
				label.className = ED_PANEL_SPECIAL_KEYS[key] !== undefined ? "special" : "label";
				label.textContent = key;
				label.title = ED_PANEL_SPECIAL_KEYS[key] !== undefined ? ED_PANEL_SPECIAL_KEYS[key] : kind;
				grid.appendChild(label);
				let input;
				if (kind === "bool") {
					input = document.createElement("input");
					input.type = "checkbox";
					input.checked = same && v0;
					input.indeterminate = !same;
					input.dataset.slot = "v:" + key;
					input.addEventListener("change", () => this.applyBlock([{ key: key, value: input.checked }], undefined, "v:" + key));
				} else {
					const shown = !same ? "" : kind === "json" ? JSON.stringify(v0) : String(v0);
					input = field("input", "value", "v:" + key, shown, !same, (text, next) => {
						let v = text;
						if (kind === "num") {
							v = Number(text.trim());
							if (text.trim() === "" || !Number.isFinite(v)) {
								this.say(key + " holds a number; \"" + text + "\" is not one");
								input.dataset.dirty = "1";
								return;
							}
						}
						if (kind === "json") {
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

			// The line adding a key, offering the keys the shown types use in the room files and
			// their classes start with. A value reads as a number, true, false, a list or a map when
			// it is one, and as text otherwise.
			const list = document.createElement("datalist");
			list.id = "ed_panel_keys";
			for (const [k, v] of this.suggestions()) {
				if (keys.includes(k)) continue;
				const o = document.createElement("option");
				o.value = k;
				o.label = ED_PANEL_SPECIAL_KEYS[k] !== undefined ? ED_PANEL_SPECIAL_KEYS[k] : "as " + JSON.stringify(v);
				list.appendChild(o);
			}
			block.appendChild(list);
			const add = (keyText, valueText, next) => {
				const key = keyText.trim();
				const vt = valueText.trim();
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
				this.applyBlock([{ key: key, value: v }], undefined, next);
			};
			const keyIn = field("input", "key", "add:key", "", false, () => {});
			keyIn.setAttribute("list", list.id);
			keyIn.placeholder = "+ key";
			const valIn = field("input", "value", "add:val", "", false, () => {});
			valIn.placeholder = "value";
			// adding waits for enter or the button, so moving from the key to its value does not add
			const go = () => add(keyIn.value, valIn.value, "add:key");
			for (const input of [keyIn, valIn]) {
				input.addEventListener("keydown", (e) => {
					if (e.key === "Enter") go();
				});
			}
			keyIn.addEventListener("input", () => {
				const k = keyIn.value.trim();
				const hit = this.suggestions().get(k);
				valIn.placeholder = hit !== undefined ? JSON.stringify(hit) : "value";
			});
			const plus = document.createElement("button");
			plus.textContent = "+";
			plus.title = "add the key to every selected entry";
			plus.addEventListener("click", go);
			grid.appendChild(keyIn);
			grid.appendChild(valIn);
			grid.appendChild(plus);
		}
		if (slot !== null) {
			const back = block.querySelector("[data-slot=\"" + CSS.escape(slot) + "\"]");
			if (back !== null) back.focus();
		}
	},

	// The keys offered for adding, with a value to show: those the shown entries' types use in the
	// room files, then those their classes start with, less fields only running uses and values
	// that are empty or not plain data.
	suggestions() {
		if (this.used === null) {
			this.used = new Map();
			for (const rm of game.rooms) {
				if (!rm.text) continue;
				let smap;
				try {
					smap = game.parseRoom(rm.text);
				} catch (e) {
					continue;
				}
				for (const lyr of smap.layers || []) {
					for (const spri of lyr.spriteList || []) {
						if (typeof spri.objinit !== "string") continue;
						const init = game.parseHandWritten(spri.objinit, spri.name);
						if (init === null || typeof init !== "object" || Array.isArray(init)) continue;
						const type = spri.isobj !== undefined ? spri.isobj : "";
						if (!this.used.has(type)) this.used.set(type, new Map());
						const m = this.used.get(type);
						for (const k of Object.keys(init)) if (!m.has(k)) m.set(k, init[k]);
					}
				}
			}
		}
		const out = new Map();
		for (const r of this.recs) {
			const type = r.isobj !== undefined ? r.isobj : "";
			const m = this.used.get(type);
			if (m !== undefined) for (const [k, v] of m) if (!out.has(k)) out.set(k, v);
		}
		for (const r of this.recs) {
			const cls = r.isobj !== undefined ? objectType(r.isobj) : undefined;
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

	// Puts block changes on every shown entry, key by key, or with no changes given removes every
	// block. The right clicked entry can take a whole text instead. Entries whose block can't be
	// read, and those the changes leave as they were, are left alone. Changed blocks are written
	// anew from no indent, then the room is built again from its own text so they sit at their
	// depth, as one undo step. The field to give the focus back to is named.
	applyBlock(changes, primaryText, slot) {
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
		const plan = [];
		for (const r of this.recs) {
			let next;
			if (changes === null) {
				next = undefined;
			} else if (primaryText !== undefined && r === this.primary) {
				next = primaryText;
			} else {
				if (r.objinit !== undefined && r.init === null) continue;
				const before = r.init || {};
				const obj = Object.assign({}, before);
				for (const c of changes) {
					if (c.remove) delete obj[c.key];
					else obj[c.key] = c.value;
				}
				if (JSON.stringify(obj) === JSON.stringify(before)) continue;
				next = Object.keys(obj).length > 0 ? layout(obj, 0) : undefined;
			}
			if (next !== r.objinit) plan.push({ rec: r, text: next });
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
		EdEdit.push();
		for (const p of plan) {
			p.rec.objinit = p.text;
			p.rec.initFresh = p.text !== undefined;
		}
		const primaryName = this.primary.name;
		EdEdit.restore(EdEdit.snapshot());
		this.room = Editor.room;
		this.recs = EdEdit.selects.slice();
		this.primary = this.recs.find((r) => r.name === primaryName) || this.recs[0];
		this.fill();
		this.table(slot);
	}
};
