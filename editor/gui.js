// The editor's canvas overlay, a port of the original editor's: the room header and its room list,
// the layer list down the upper left, the picker's fields and bar along the bottom, and the status
// line, bars and help over everything. It is drawn on the same canvas as the room, laid out on the
// original's 640 wide overlay grid scaled up by a whole number, and takes the mouse and wheel in the
// same world as the room, so nothing traps them. The layer list keeps the original's rows, prefixes,
// colours, paging and clicks, and its rows edit as the original's text fields did: adding, renaming,
// deleting by clearing the name, moving, and the sorting, disabled and locked switches.

// the overlay grid's width; the scale is the whole number nearest to fitting it across the screen
const ED_GUI_W = 640;
const ED_GUI_FONT = "ftSmall";

// The room header field, and the layer rows under it: their indent from the header, the gap below
// it, the row spacing, and how many rows a page holds. The add button sits a little further in.
const ED_ROOM_X = 2;
const ED_ROOM_Y = 12;
const ED_ROW_DX = 3;
const ED_ROWS_DY = 12;
const ED_ROW_H = 11;
const ED_ROWS_PER_PAGE = 27;
const ED_ADD_X = 8;

// A text field: its backing box is the text's size plus this much wider and less this much tall,
// never smaller than these, and its text sits this far in and up. Fully opaque when hovered.
const ED_FIELD_PAD_W = 8;
const ED_FIELD_TRIM_H = 3;
const ED_FIELD_MIN_W = 2;
const ED_FIELD_MIN_H = 13;
const ED_FIELD_TEXT_DX = 3;
const ED_FIELD_TEXT_DY = -2;
const ED_FIELD_BACK_COLOR = "#000000";
const ED_FIELD_BACK_ALPHA = 0.8;
const ED_FIELD_ALPHA = 0.7;
const ED_FIELD_HOT_ALPHA = 1;
// how quickly the hover arrows blink, and how close two presses count as a double press, in ms
const ED_BLINK_MS = 400;
const ED_DOUBLE_MS = 300;

// field colours: room header, add button, a layer row, the current layer, a layer hidden in the editor
const ED_ROOM_COLOR = "#aaffcc";
const ED_ADD_COLOR = "#aaeecc";
const ED_ROW_COLOR = "#99aacc";
const ED_ROW_CUR_COLOR = "#ffff33";
const ED_ROW_HIDDEN_COLOR = "#886f6f";
// a field being edited, with its blinking cursor or the ends of its marked part
const ED_EDIT_COLOR = "#eeaaaa";
const ED_EDIT_BLINK_MS = 350;
// the unsaved mark after the room's name and in the status line
const ED_DIRTY_MARK = " *";

// The room list under the header: its spot, its width before padding, row height, text inset,
// colours, and the last row's text, which adds a room.
const ED_LIST_X = 4;
const ED_LIST_Y = 25;
const ED_LIST_W = 100;
const ED_LIST_PAD_W = 3;
const ED_LIST_PAD_H = 2;
const ED_LIST_ROW_H = 12;
const ED_LIST_TEXT_DX = 2;
const ED_LIST_TEXT_DY = -1;
const ED_LIST_COLOR = "#aaaabb";
const ED_LIST_HOVER_COLOR = "#ffff00";
const ED_LIST_ADD_TEXT = " +room...";

// The status line along the top and the bars above and below the room.
const ED_HUD_X = 2;
const ED_HUD_Y = -3;
const ED_HUD_COLOR = "#cccccc";
const ED_HUD_ALPHA = 0.7;
const ED_HUD_BAR_COLOR = "#000000";
const ED_HUD_BAR_ALPHA = 0.35;
const ED_HUD_TOP_H = 10;
const ED_HUD_BOTTOM_H = 30;
// the grid tag at the top right
const ED_HUD_TAG_DX = 20;
// the help box's margins from the overlay's edges, its two columns, and its look
const ED_HELP_MARGIN_X = 30;
const ED_HELP_MARGIN_Y = 20;
const ED_HELP_COL1_X = 40;
const ED_HELP_COL2_X = 330;
const ED_HELP_TEXT_Y = 22;
const ED_HELP_BACK_ALPHA = 0.8;
const ED_HELP_ALPHA = 1;

// the original's help text, word for word, then the keys this editor adds and what is still to come
const ED_HELP_LEFT = "SPACE - hide / show guis\n"
	+ "TAB - toggle pointer / sprite / object\n"
	+ "CTRL S / L / R - save / load / save + reload\n"
	+ "\n"
	+ "shift click - add / remove from selection group\n"
	+ "ALT - hovers from any vizible layer\n"
	+ "    - ignores grabber corners\n"
	+ "H click - hide hovered object\n"
	+ "CTRL A - select all in current layer\n"
	+ "CTRL shift A - select all in all visible/unlocked layers\n"
	+ "\n"
	+ "CTRL drag - lock aspect ratio\n"
	+ "ALT drag - rotates\n"
	+ "\n"
	+ "ALT ^ v < > - align top, bottom, left, right\n"
	+ "ALT (<|>) + v - align horz center\n"
	+ "ALT (^|v) + (<|>) - align vert middle\n"
	+ "ALT < + > - align spread horz\n"
	+ "ALT ^ + V - align spread vert\n"
	+ "\n"
	+ "S click - change sprite\n"
	+ "A click - stop/start animation\n"
	+ "A wheel - changes ani frame\n"
	+ "\n";
const ED_HELP_RIGHT = "CTRL wheel click - center on click\n"
	+ "ALT wheel click - reset zoom\n"
	+ "double wheel click - reset center/zoom\n"
	+ "\n"
	+ "CTRL (shift) G - (un)group\n"
	+ "G click or double click - enter group\n"
	+ "right click empty - exit group\n"
	+ "\n"
	+ "ALT wheel - change layer\n"
	+ "ALT shift - move layer up/down\n"
	+ "ALT Home / End - sprite to top/bottom of layer\n"
	+ "ALT Pg Up / Pg Down - sprite up/down a layer\n"
	+ "SHIFT wheel - sprite zorder\n"
	+ "\n"
	+ "CTRL F - find all guy\n"
	+ "F click - find all clicked object\n"
	+ "SHIFT F click - find all clicked object even locked\n"
	+ "F TAB - center on next hilited object\n"
	+ "\n"
	+ "Pg Up / Pg Dn - page layer list\n"
	+ "\n"
	+ "CTRL ALT B - create lyr_bounds layer\n"
	+ "\n"
	+ "CTRL Z - undo   CTRL Y / CTRL shift Z - redo\n"
	+ "wheel over picker - next / last page of items\n"
	+ "drag picker item into room - place it\n"
	+ "not yet: align, groups, find, bounds, settings panels\n";

// sublayers that focusing on an area leaves hidden
const ED_FOCUS_HIDDEN_SUBNAMES = ["w", "m"];

const EdGui = {
	// screen pixels per overlay pixel
	scale: 1,
	// first row of the layer list's page, and the add button's row and its page marker
	liststart: 0,
	addY: 0,
	addPretext: "",
	// the field under the mouse: its kind, header, row or add, and the row's layer
	hot: { kind: null, lyr: null },
	headerLastPress: 0,
	// the room list, open or not, and its row under the mouse
	listOpen: false,
	listHover: -1,
	// set when folding changed which rows show, the next step pages again
	needLyrGuiReset: false,
	// an area to focus on at the end of the step, from a double click on its folded header
	focuson: null,
	// The field being edited, or none: which field, its text, the cursor, the other end of a marked
	// part, the text before editing, whether any character may be typed, whether a press outside
	// commits rather than cancels, and what committing and cancelling do. A right press time for
	// the double right press that clears it.
	edit: null,
	lastRightPress: 0,

	// A fresh room: every row's prefix, its folded groups folded again keeping their visibility, and
	// the layer it was left on made current.
	roomLoaded() {
		const room = Editor.room;
		this.liststart = 0;
		this.hot = { kind: null, lyr: null };
		this.listOpen = false;
		this.focuson = null;
		for (const lyr of room.layers) this.pretext(lyr);
		for (const key of Object.keys(room.lgroups)) {
			const grp = room.lgroups[key];
			if (!grp.folded) continue;
			grp.folded = 0;
			this.fold(grp.col_head_lyr, true, true);
		}
		Editor.curlayeri = clamp(room.curlyri, 0, room.layers.length - 1);
		this.selectLayer(room.curlyri);
		this.page();
	},

	// A row's three state letters, disabled, sorted and locked, one space wider when there are none.
	pretext(lyr) {
		const t = (lyr.disabled ? "d" : " ") + (lyr.zsort ? "z" : " ") + (lyr.locked ? "#" : " ");
		lyr.txt.pretext = t === "   " ? t + " " : t;
	},

	// Pages the layer list: rows of folded groups other than their header are left out, then either the
	// page moves by the asked number of pages, or, with none asked, the page moves to hold the current
	// layer when it is off it. Rows on the page are laid out one under another, the add button after,
	// and with more than one page its marker shows which page this is.
	page(pageinc) {
		const ed = Editor;
		const room = ed.room;
		let totact = 0;
		for (const lyr of room.layers) {
			const grp = lyr.group !== undefined ? room.lgroups[lyr.group] : undefined;
			lyr.txt.shown = grp === undefined || !grp.folded || lyr === grp.col_head_lyr;
			if (lyr.txt.shown) totact++;
		}
		if (pageinc !== undefined && pageinc !== 0) {
			this.liststart += ED_ROWS_PER_PAGE * pageinc;
		} else if (ed.curlayeri < this.liststart || ed.curlayeri > this.liststart + ED_ROWS_PER_PAGE) {
			this.liststart = Math.floor(ed.curlayeri - ED_ROWS_PER_PAGE / 2);
		}
		this.liststart = Math.max(0, Math.min(this.liststart, totact - ED_ROWS_PER_PAGE));

		let curacti = 0;
		let cursti = this.liststart;
		room.layers.forEach((lyr, i) => {
			if (!lyr.txt.shown) {
				if (i < cursti) cursti++;
				return;
			}
			if (i < cursti || curacti >= ED_ROWS_PER_PAGE) {
				lyr.txt.shown = false;
				return;
			}
			lyr.txt.y = ED_ROOM_Y + ED_ROWS_DY + curacti * ED_ROW_H;
			curacti++;
		});
		this.addY = ED_ROOM_Y + ED_ROWS_DY + curacti * ED_ROW_H;
		const numpages = Math.ceil(totact / ED_ROWS_PER_PAGE);
		if (numpages > 1) {
			const marks = "_".repeat(numpages - 1);
			const curpage = 1 + Math.floor((cursti + ED_ROWS_PER_PAGE - 1) / ED_ROWS_PER_PAGE);
			this.addPretext = "." + marks.substring(0, curpage - 1) + curpage + marks.substring(curpage - 1) + ".";
		} else {
			this.addPretext = "";
		}
	},

	selectLayer(newi) {
		if (newi < 0 || newi > Editor.room.layers.length - 1) return;
		Editor.curlayeri = newi;
		this.page();
	},

	// Folds a layer's group to its header row, or unfolds it from its header. Folding remembers the
	// header's visibility and hides the group unless asked to keep it; folding an already folded group
	// only does the hiding. Unfolding gives the header its remembered visibility back.
	fold(mylyr, folding, keepVis) {
		if (mylyr.group === undefined) return;
		// folding is saved with the room; only the room's own refolding on load leaves it unchanged
		if (!keepVis) EdEdit.touch();
		const grp = mylyr.group;
		const lgroup = Editor.room.lgroups[grp];
		const head = lgroup.col_head_lyr;
		if (folding) {
			if (lgroup.folded) {
				lgroup.visible = keepVis ? lgroup.visible : 0;
				head.visible = lgroup.visible;
				head.txt.disabled = !head.visible;
				return;
			}
			lgroup.folded = 1;
			lgroup.pre_grp_vis = head.visible;
			lgroup.visible = keepVis ? lgroup.visible : 0;
			head.visible = lgroup.visible;
			head.txt.disabled = !head.visible;
			head.txt.text = grp;
			head.txt.pretext = "-[";
		} else {
			if (!lgroup.folded || head !== mylyr) return;
			lgroup.folded = 0;
			lgroup.visible = head.visible;
			head.visible = lgroup.pre_grp_vis;
			head.txt.text = head.name;
			head.txt.disabled = !head.visible;
			this.pretext(mylyr);
		}
		this.needLyrGuiReset = true;
	},

	// Moves the current layer by wheel steps, down the list with the wheel down, wrapping round and
	// passing over folded groups. Swapping moves the layer itself instead, as far as the next layer
	// that is not folded away, without wrapping round.
	rotate(wh, swap) {
		const ed = Editor;
		const room = ed.room;
		const layers = room.layers;
		const ls = layers.length;
		const curi = ed.curlayeri;
		let movei = curi;
		let ok = false;
		do {
			movei = (movei + wh + ls) % ls;
			const grp = layers[movei].group !== undefined ? room.lgroups[layers[movei].group] : undefined;
			ok = grp === undefined || !grp.folded;
		} while (!ok && movei !== curi);
		if (movei === curi) return;
		if (!swap) {
			this.selectLayer(movei);
			return;
		}
		if (Math.sign(movei - curi) !== wh) return;
		if (Math.abs(movei - curi) > 1) movei -= wh;
		EdEdit.push();
		const lyr = layers.splice(curi, 1)[0];
		layers.splice(movei, 0, lyr);
		EdRoom.relink(room);
		this.selectLayer(movei);
		this.needLyrGuiReset = true;
	},

	// Adds an empty layer the room's width just after the current one and starts naming it, as the
	// original's add button did; the current layer stays as it was.
	addLayer() {
		const ed = Editor;
		const room = ed.room;
		EdEdit.push();
		const lyr = EdRoom.layer(null, "");
		lyr.wd = room.roomw;
		lyr.ht = room.roomh;
		room.layers.splice(ed.curlayeri + 1, 0, lyr);
		EdRoom.relink(room);
		this.pretext(lyr);
		this.page();
		this.startEdit("row", lyr, "", true, false, true);
	},

	// A layer's new name from its row. A cleared name deletes the layer and its entries, asking first
	// when it has any; the last layer left is only renamed. A name that moves the layer to a group
	// the room lacks starts that group as a copy of the layer's old one, as the original did.
	renameLayer(lyr, text, fresh) {
		const ed = Editor;
		const room = ed.room;
		if (text === "") {
			if (room.layers.length === 1) text = "layer";
			else if (fresh) {
				EdEdit.undo(true);
				EdEdit.redos.length = 0;
				return;
			} else if (lyr.lsprites.length === 0) {
				EdEdit.push();
				this.deleteLayer(lyr);
				return;
			} else {
				ed.ask("Delete layer \"" + lyr.name + "\" and its " + lyr.lsprites.length + " entries? Undo brings them back.",
					["Delete", "Cancel"]).then((answer) => {
					if (answer !== "Delete" || !room.layers.includes(lyr) || ed.room !== room) return;
					EdEdit.push();
					this.deleteLayer(lyr);
				});
				return;
			}
		}
		if (text === lyr.name) return;
		if (!fresh) EdEdit.push();
		const oldgroup = lyr.group;
		lyr.set_name(text);
		lyr.txt.text = text;
		const newgroup = lyr.group;
		if (oldgroup !== undefined && newgroup !== undefined && oldgroup !== newgroup && room.lgroups[newgroup] === undefined && room.lgroups[oldgroup] !== undefined) {
			room.lgroups[newgroup] = Object.assign({}, room.lgroups[oldgroup], { name: newgroup });
		}
		EdRoom.relink(room);
		this.needLyrGuiReset = true;
	},

	// Takes a layer and its entries out of the room, the current layer moving to its neighbour first.
	deleteLayer(lyr) {
		const ed = Editor;
		const room = ed.room;
		const li = room.layers.indexOf(lyr);
		if (li === ed.curlayeri) ed.curlayeri = li < room.layers.length - 1 ? li + 1 : li - 1;
		EdEdit.selects = EdEdit.selects.filter((rec) => rec.mylayer !== lyr);
		room.layers.splice(li, 1);
		if (ed.curlayeri > li) ed.curlayeri--;
		ed.hovers = [];
		ed.rehover = true;
		EdRoom.relink(room);
		this.page();
	},

	// Starts editing a field with the cursor at its end.
	startEdit(kind, lyr, text, alltext, outpressgood, fresh) {
		this.edit = { kind: kind, lyr: lyr, text: text, pos: text.length, copypos: -1, pre: text,
			alltext: alltext, outpressgood: outpressgood, fresh: fresh };
	},

	// Ends editing. Committing a layer row renames it; the filter keeps its text either way, but
	// cancelling puts back what it had. The header names a room not saved yet: cancelling keeps the
	// name it has, and a name left empty or another room's, in any letter case, is refused and the
	// editing goes on, since the name is also its file's.
	endEdit(commit) {
		const e = this.edit;
		this.edit = null;
		if (e.kind === "header") {
			const room = Editor.room;
			if (!commit || e.text === room.name) return;
			const lower = e.text.toLowerCase();
			if (e.text === "" || game.rooms.some((rm, i) => i !== room.index && rm.name.toLowerCase() === lower)) {
				Editor.debugtxt = e.text === "" ? " a room needs a name" : " a room is already named " + e.text;
				this.edit = e;
				return;
			}
			delete game.roombyname[room.name];
			game.rooms[room.index].name = e.text;
			game.roombyname[e.text] = room.index;
			room.name = e.text;
			Editor.debugtxt = "";
			localStorage.setItem(ED_LAST_ROOM_KEY, e.text);
			EdEdit.touch();
		} else if (e.kind === "filter") {
			EdPicker.filter.text = commit ? e.text : e.pre;
			EdPicker.refilter();
		} else if (commit) {
			this.renameLayer(e.lyr, e.text, e.fresh);
		} else if (e.fresh) {
			this.renameLayer(e.lyr, "", true);
		}
	},

	// The field being edited takes the step's keys, each in turn as the original's text field took
	// them, and the mouse: a press on it commits, a right press cancels and a quick second one
	// clears it, a press elsewhere cancels or, for the filter, commits.
	editStep(hit) {
		const ed = Editor;
		const inp = ed.inp;
		const e = this.edit;
		const before = e.text;
		const onIt = hit !== null && hit.kind === e.kind && hit.lyr === e.lyr;
		const now = currentTime();
		const pressed = inp.pressed.left || inp.pressed.right || inp.pressed.middle;
		const doubleRight = inp.pressed.right && onIt && now - this.lastRightPress < ED_DOUBLE_MS;
		if (inp.pressed.right) this.lastRightPress = now;
		if (doubleRight) {
			e.text = "";
			e.pos = 0;
		} else if ((inp.pressed.right && onIt) || (pressed && !onIt && !e.outpressgood)) {
			this.endEdit(false);
			return;
		} else if ((inp.pressed.left && onIt) || (pressed && !onIt && e.outpressgood)) {
			this.endEdit(true);
			return;
		}
		// holding control marks from where the cursor was, and letting it go puts the cursor back there
		if (inp.keysPressed.has("ControlLeft") || inp.keysPressed.has("ControlRight")) e.copypos = e.pos;
		else if (e.copypos >= 0 && (inp.keysReleased.has("ControlLeft") || inp.keysReleased.has("ControlRight"))) {
			e.pos = e.copypos;
			e.copypos = -1;
		}
		for (const k of inp.typed) {
			const cs = Math.min(e.pos, e.copypos);
			const ce = Math.max(e.pos, e.copypos);
			if (k.code === "Escape") {
				this.endEdit(false);
				return;
			}
			if (k.code === "Enter" || k.code === "NumpadEnter") {
				this.endEdit(true);
				return;
			}
			if (k.code === "Backspace" && k.shift) {
				e.text = "";
				e.pos = 0;
			} else if (k.ctrl && (k.code === "KeyC" || k.code === "KeyX" || k.code === "Delete")) {
				if (e.copypos < 0) continue;
				if (k.code !== "Delete") navigator.clipboard.writeText(e.text.substring(cs, ce)).catch(() => {});
				if (k.code !== "KeyC") {
					e.text = e.text.substring(0, cs) + e.text.substring(ce);
					e.pos -= e.pos > e.copypos ? ce - cs : 0;
				}
				e.copypos = -1;
			} else if (k.ctrl && k.code === "KeyV") {
				// the clipboard arrives a moment later, without tabs, a last line break or Windows breaks
				navigator.clipboard.readText().then((cbt) => {
					if (this.edit !== e) return;
					cbt = cbt.replace(/\r\n/g, "\n").replace(/\t/g, "").replace(/\n$/, "");
					e.text = e.text.substring(0, e.pos) + cbt + e.text.substring(e.pos);
					e.pos += cbt.length;
					e.copypos = -1;
					if (e.kind === "filter") {
						EdPicker.filter.text = e.text;
						EdPicker.refilter();
					}
				}).catch(() => {});
			} else if (k.code === "ArrowLeft") {
				e.pos = Math.max(e.pos - 1, 0);
			} else if (k.code === "ArrowRight") {
				e.pos = Math.min(e.pos + 1, e.text.length);
			} else if (k.code === "Backspace") {
				if (e.pos > 0) e.text = e.text.substring(0, e.pos - 1) + e.text.substring(e.pos);
				e.pos = Math.max(e.pos - 1, 0);
			} else if (k.code === "Delete") {
				e.text = e.text.substring(0, e.pos) + e.text.substring(e.pos + 1);
			} else if (k.code === "Tab") {
				e.text = e.text.substring(0, e.pos) + "\t" + e.text.substring(e.pos);
				e.pos++;
			} else if (k.code === "Home") {
				e.pos = 0;
			} else if (k.code === "End") {
				e.pos = e.text.length;
			} else if (k.key.length === 1 && !k.ctrl) {
				// names keep to letters, digits and a few marks, a space becoming an underscore
				let ch = k.key;
				if (!e.alltext && !/^[A-Za-z0-9]$/.test(ch)) ch = ".^_".includes(ch) ? ch : (ch === " " ? "_" : "");
				if (ch !== "") {
					e.text = e.text.substring(0, e.pos) + ch + e.text.substring(e.pos);
					e.pos++;
				}
			}
		}
		if (e.kind === "filter" && e.text !== before) {
			EdPicker.filter.text = e.text;
			EdPicker.refilter();
		}
	},

	// Focuses on an area: unfolds it, shows its layers but the hidden sublayers, centres on its bounds
	// and makes its main layer current. Groups of no area kind are not centred on.
	focus(name) {
		const room = Editor.room;
		const lgroup = room.lgroups[name];
		if (lgroup === undefined) return;
		this.fold(lgroup.col_head_lyr, false);
		for (const glyr of lgroup.layers) {
			glyr.visible = ED_FOCUS_HIDDEN_SUBNAMES.includes(glyr.subname) ? 0 : 1;
			glyr.txt.disabled = !glyr.visible;
		}
		if (lgroup.type === LGT_NON) return;
		if (lgroup.bounds !== null) {
			const b = maskShape(lgroup.bounds, lgroup.bounds.x, lgroup.bounds.y);
			if (b) EdView.centerOn((b.l + b.r) / 2, (b.t + b.b) / 2);
		}
		this.selectLayer(room.layers.findIndex((l) => l.name === name + "."));
		this.needLyrGuiReset = true;
	},

	// The overlay's fields as they show now: the room header, the rows on the page, and the add button,
	// each with its text, colour, backing box, and whether the mouse is over it. A hovered field
	// blinks arrows after its text, which widens its box as in the original.
	fields() {
		const ed = Editor;
		const room = ed.room;
		const list = [];
		const now = currentTime();
		Draw.setFont(ED_GUI_FONT);
		const arrows = Math.floor(now / ED_BLINK_MS) % 2 === 0 ? "< " : " <";
		const on = Math.floor(now / ED_EDIT_BLINK_MS) % 2 === 0;
		const add = (kind, lyr, x, y, pretext, text, color, minw) => {
			const hot = this.hot.kind === kind && this.hot.lyr === lyr;
			const e = this.edit !== null && this.edit.kind === kind && this.edit.lyr === lyr ? this.edit : null;
			let shown = pretext + text + (hot && e === null ? arrows : "");
			if (e !== null) {
				const cs = Math.min(e.pos, e.copypos);
				const ce = Math.max(e.pos, e.copypos);
				shown = pretext + (e.copypos >= 0
					? e.text.substring(0, cs) + (on ? "<" : "{") + e.text.substring(cs, ce) + (on ? ">" : "}") + e.text.substring(ce)
					: e.text.substring(0, e.pos) + (on ? "|" : "\u00b7") + e.text.substring(e.pos));
			}
			const full = shown.replace(/\t/g, "  ");
			list.push({
				kind: kind, lyr: lyr, x: x, y: y, text: full, color: e !== null ? ED_EDIT_COLOR : color, hot: hot || e !== null,
				w: Math.max(Draw.stringWidth(full), ED_FIELD_MIN_W, minw) + ED_FIELD_PAD_W,
				h: Math.max(Draw.stringHeight(full), ED_FIELD_MIN_H) - ED_FIELD_TRIM_H
			});
		};
		add("header", null, ED_ROOM_X, ED_ROOM_Y, "", room.name + (EdEdit.dirty() ? ED_DIRTY_MARK : ""), ED_ROOM_COLOR, 0);
		room.layers.forEach((lyr, li) => {
			if (!lyr.txt.shown) return;
			add("row", lyr, ED_ROOM_X + ED_ROW_DX, lyr.txt.y, lyr.txt.pretext, lyr.txt.text,
				li === ed.curlayeri ? ED_ROW_CUR_COLOR : (lyr.txt.disabled ? ED_ROW_HIDDEN_COLOR : ED_ROW_COLOR), 0);
		});
		add("add", null, ED_ADD_X, this.addY, this.addPretext, " +", ED_ADD_COLOR, 0);
		for (const f of EdPicker.fields(ed.canvas.height / this.scale)) add(f.kind, null, f.x, f.y, f.pretext, f.text, f.color, f.minw);
		return list;
	},

	// The overlay's share of a step: the room list while it is open, else the field under the mouse
	// and what its clicks and wheel do. Tells whether the mouse is on the overlay, so the room
	// underneath leaves the input alone.
	step() {
		const ed = Editor;
		const inp = ed.inp;
		const room = ed.room;
		const mx = ed.mouse.gx;
		const my = ed.mouse.gy;
		const wh = Math.sign(inp.wheel);

		// the room list's rows are the rooms and then the add row
		if (this.listOpen) {
			const n = game.rooms.length + 1;
			const inside = mx >= ED_LIST_X && mx < ED_LIST_X + ED_LIST_W + ED_LIST_PAD_W
				&& my >= ED_LIST_Y && my < ED_LIST_Y + n * ED_LIST_ROW_H + ED_LIST_PAD_H;
			this.listHover = inside ? Math.min(Math.floor((my - ED_LIST_Y) / ED_LIST_ROW_H), n - 1) : -1;
			if (inside && inp.pressed.left) {
				this.listOpen = false;
				if (this.listHover === n - 1) ed.addRoom();
				else ed.openRoom(this.listHover);
			} else if (inp.pressed.right || inp.keysPressed.has("Escape")) {
				this.listOpen = false;
			}
			return true;
		}

		// the overlay is hidden while showing as the player, and takes nothing then
		this.hot = { kind: null, lyr: null };
		if (ed.showAsPlayer && this.edit === null) return false;
		let hit = null;
		for (const f of this.fields()) {
			if (mx >= f.x && mx < f.x + f.w && my >= f.y && my < f.y + f.h) hit = f;
		}
		// a field being edited holds every key and click until it is done
		if (this.edit !== null) {
			this.editStep(hit);
			return true;
		}
		if (EdPicker.step()) return true;
		if (hit === null) return false;
		this.hot = { kind: hit.kind, lyr: hit.lyr };
		// control and a left click copies a field's text, as the original's fields did
		if (inp.pressed.left && inp.ctrl && hit.kind !== "add") {
			navigator.clipboard.writeText(hit.kind === "row" ? hit.lyr.name : (hit.kind === "header" ? room.name : hit.text)).catch(() => {});
			return true;
		}
		// The filter switches pointing to sprites and starts editing at any press; the name field
		// only shows.
		if (hit.kind === "filter") {
			if (inp.pressed.left || inp.pressed.right) {
				if (EdPicker.mode === 0) EdPicker.setMode(1);
				this.startEdit("filter", null, EdPicker.filter.text, false, true, false);
			}
			return true;
		}
		if (hit.kind === "name") return true;

		const now = currentTime();
		const pressed = inp.pressed.left || inp.pressed.right || inp.pressed.middle;
		if (hit.kind === "header") {
			if (inp.pressed.right) {
				this.listOpen = true;
				this.listHover = -1;
			}
			if (pressed) this.headerLastPress = now;
			// enter renames a room not saved yet; a saved one keeps its name, which its file carries
			if (inp.keysPressed.has("Enter") && !ed.world.savedRooms.includes(room.name)) this.startEdit("header", null, room.name, false, false, false);
			return true;
		}
		// the add button adds on letting go, so the press does not end the new name's editing
		if (hit.kind === "add") {
			if (inp.released.left) this.addLayer();
			return true;
		}

		const lyr = hit.lyr;
		const li = room.layers.indexOf(lyr);
		const dbl = pressed && now - lyr.txt.lastpress < ED_DOUBLE_MS;
		if (pressed) lyr.txt.lastpress = now;
		const lgroup = lyr.group !== undefined ? room.lgroups[lyr.group] : undefined;

		// a folded group's header only shows and hides its group, unfolds, or focuses on it
		if (lgroup !== undefined && lgroup.folded) {
			if (inp.pressed.right) {
				lyr.visible = lyr.visible ? 0 : 1;
				lyr.txt.disabled = !lyr.visible;
				lgroup.visible = lyr.visible;
				EdEdit.touch();
			}
			if (wh !== 0) this.rotate(wh, false);
			if (inp.pressed.left && inp.shift) this.fold(lyr, false);
			if (inp.pressed.left && dbl && this.focuson === null) this.focuson = lyr.group;
			return true;
		}

		// a double left click centres on the middle of the layer's entries
		if (inp.pressed.left && dbl && lyr.lsprites.length > 0) {
			let cx = 0;
			let cy = 0;
			for (const rec of lyr.lsprites) {
				cx += rec.x - rec.exoffx;
				cy += rec.y - rec.exoffy;
			}
			EdView.centerOn(cx / lyr.lsprites.length, cy / lyr.lsprites.length);
		}
		// enter starts renaming the row
		if (inp.keysPressed.has("Enter")) this.startEdit("row", lyr, lyr.txt.text, true, false, false);
		// Z and D clicks toggle sorting and disabled; a shift click opens the layer settings, which
		// come in a later phase; a plain click makes the layer current.
		if (inp.pressed.left && !inp.ctrl) {
			if (inp.keysDown.has("KeyZ") || inp.keysDown.has("KeyD")) {
				EdEdit.push();
				const field = inp.keysDown.has("KeyZ") ? "zsort" : "disabled";
				lyr[field] = lyr[field] ? 0 : 1;
				this.pretext(lyr);
			} else if (!inp.shift) {
				this.selectLayer(li);
			}
		}
		// Right clicks toggle the layer's visibility, or its lock with control; with shift every layer
		// follows, with alt every layer of its group. Both are saved with the room; the lock can be
		// undone.
		if (inp.pressed.right) {
			const field = inp.ctrl ? "locked" : "visible";
			if (inp.ctrl) EdEdit.push();
			else EdEdit.touch();
			lyr[field] = lyr[field] ? 0 : 1;
			if (!inp.ctrl) lyr.txt.disabled = !lyr.visible;
			if (inp.shift || inp.alt) {
				for (const l of room.layers) {
					if (inp.alt && (lyr.group === undefined || lyr.group !== l.group)) continue;
					l[field] = lyr[field];
					if (inp.ctrl) this.pretext(l);
					else l.txt.disabled = !l.visible;
				}
			}
			if (inp.ctrl) this.pretext(lyr);
		}
		// a double right click folds the group, after its two clicks put the visibility back
		if (inp.pressed.right && dbl) this.fold(lyr, true);
		// the wheel moves the current layer, with shift the layer itself
		if (wh !== 0) this.rotate(wh, inp.shift);
		return true;
	},

	// The overlay: the status line and bars, the fields, the room list, and the help on top while held.
	draw() {
		const ed = Editor;
		const room = ed.room;
		if (room === null) return;
		const ctx = ed.ctx;
		const gs = this.scale;
		const gw = ed.canvas.width / gs;
		const gh = ed.canvas.height / gs;
		Draw.ctx = ctx;
		Draw.targetScale = 1;
		Draw.base = { sx: gs, sy: gs, ox: 0, oy: 0 };
		Draw.curdrawoffx = 0;
		Draw.curdrawoffy = 0;
		Draw.halign = "left";
		Draw.valign = "top";
		ctx.imageSmoothingEnabled = false;
		ctx.globalCompositeOperation = "source-over";

		const pad4 = (v) => String(Math.round(v)).padStart(4);
		const cam = ed.cam;
		const lyr = room.layers[ed.curlayeri];
		const edit = EdEdit;
		let txt = pad4(ed.fpsHist) + " M:" + ED_PICK_MODE_NAMES[EdPicker.mode] + " "
			+ " Ln:" + (lyr ? lyr.lsprites.length : 0) + "/" + EdView.totSpriteCnt
			+ " Hn:" + ed.curhoveri + "/" + ed.hovers.length
			+ " Sn:" + edit.selects.length
			+ (edit.moving ? " Mv" : "")
			+ (ed.pan ? " Pn" : "")
			+ (edit.copyPrimed ? " Cp" : "")
			+ (edit.boxSelect ? " Bx" : "")
			+ (edit.resizing ? " RS" : "")
			+ (edit.rotating ? " Ro" : "")
			+ (edit.placing ? " Pl" : "")
			+ "  Cm:" + Math.round(cam.x) + "," + Math.round(cam.y)
			+ "  Cs:" + Math.round(cam.w) + "," + Math.round(EdView.camH())
			+ "  M:" + pad4(ed.mouse.wx) + "," + pad4(ed.mouse.wy)
			+ "  wM:" + pad4(ed.mouse.gx) + "," + pad4(ed.mouse.gy)
			+ "  Us:" + edit.undos.length + (edit.dirty() ? ED_DIRTY_MARK : "")
			+ " Hv:[ ";
		for (const h of ed.hovers) txt += (h.isobj || h.spi) + (h.hover ? "<" : "") + " ";
		txt += "]" + ed.debugtxt;

		if (!ed.showAsPlayer) {
			Draw.color = ED_HUD_BAR_COLOR;
			Draw.alpha = ED_HUD_BAR_ALPHA;
			Draw.rectangle(0, 0, gw, ED_HUD_TOP_H, false);
			Draw.rectangle(0, gh - ED_HUD_BOTTOM_H, gw, gh, false);
		}
		Draw.guiText(ED_HUD_X, ED_HUD_Y, txt, ED_HUD_COLOR, ED_HUD_ALPHA, ED_GUI_FONT);
		if (room.grid_lock) Draw.guiText(gw - ED_HUD_TAG_DX, ED_HUD_Y, "GR" + room.grid_size, ED_HUD_COLOR, ED_HUD_ALPHA, ED_GUI_FONT);

		if (!ed.showAsPlayer) {
			EdPicker.draw(gw, gh);
			Draw.base = { sx: gs, sy: gs, ox: 0, oy: 0 };
			for (const f of this.fields()) {
				Draw.color = ED_FIELD_BACK_COLOR;
				Draw.alpha = ED_FIELD_BACK_ALPHA;
				Draw.rectangle(f.x, f.y, f.x + f.w - 1, f.y + f.h - 1, false);
				Draw.guiText(f.x + ED_FIELD_TEXT_DX, f.y + ED_FIELD_TEXT_DY, f.text, f.color, f.hot ? ED_FIELD_HOT_ALPHA : ED_FIELD_ALPHA, ED_GUI_FONT);
			}
		}

		// the room list draws its names and the add row plainly, with no shadow
		if (this.listOpen) {
			const rows = game.rooms.map((rm) => rm.name).concat(ED_LIST_ADD_TEXT);
			Draw.color = ED_FIELD_BACK_COLOR;
			Draw.alpha = ED_FIELD_BACK_ALPHA;
			Draw.rectangle(ED_LIST_X, ED_LIST_Y, ED_LIST_X + ED_LIST_W + ED_LIST_PAD_W - 1, ED_LIST_Y + rows.length * ED_LIST_ROW_H + ED_LIST_PAD_H - 1, false);
			Draw.setFont(ED_GUI_FONT);
			Draw.alpha = 1;
			rows.forEach((text, i) => {
				Draw.color = i === this.listHover ? ED_LIST_HOVER_COLOR : ED_LIST_COLOR;
				Draw.textRaw(ED_LIST_X + ED_LIST_TEXT_DX, ED_LIST_Y + i * ED_LIST_ROW_H + ED_LIST_TEXT_DY, text, -1, -1, 1, 1, 0);
			});
		}

		// the help while held, over everything else
		if (!ed.showAsPlayer && ed.inp.keysDown.has("F1")) {
			Draw.color = ED_FIELD_BACK_COLOR;
			Draw.alpha = ED_HELP_BACK_ALPHA;
			Draw.rectangle(ED_HELP_MARGIN_X, ED_HELP_MARGIN_Y, gw - ED_HELP_MARGIN_X, gh - ED_HELP_MARGIN_Y, false);
			Draw.guiText(ED_HELP_COL1_X, ED_HELP_TEXT_Y, ED_HELP_LEFT, ED_HUD_COLOR, ED_HELP_ALPHA, ED_GUI_FONT);
			Draw.guiText(ED_HELP_COL2_X, ED_HELP_TEXT_Y, ED_HELP_RIGHT, ED_HUD_COLOR, ED_HELP_ALPHA, ED_GUI_FONT);
		}
		Draw.color = "#ffffff";
		Draw.alpha = 1;
	}
};
