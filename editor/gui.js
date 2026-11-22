// The editor's canvas overlay, a port of the original editor's: the room header and its room list,
// the layer list down the upper left, and the status line, bars and help over everything. It is drawn
// on the same canvas as the room, laid out on the original's 640 wide overlay grid scaled up by a
// whole number, and takes the mouse and wheel in the same world as the room, so nothing traps them.
// The layer list keeps the original's rows, prefixes, colours, paging and clicks. Phase one only
// changes what is held in memory: nothing here edits or saves the room.

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

// The room list under the header: its spot, its width before padding, row height, text inset,
// and colours.
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

// the original's help text, word for word
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
	+ "CTRL ALT B - create lyr_bounds layer\n";

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

	// Moves the current layer by wheel steps, wrapping round and passing over folded groups.
	rotate(wh) {
		const ed = Editor;
		const layers = ed.room.layers;
		const ls = layers.length;
		let movei = ed.curlayeri;
		let ok = false;
		do {
			movei = (movei + wh + ls) % ls;
			const grp = layers[movei].group !== undefined ? ed.room.lgroups[layers[movei].group] : undefined;
			ok = grp === undefined || !grp.folded;
		} while (!ok && movei !== ed.curlayeri);
		if (movei === ed.curlayeri) return;
		this.selectLayer(movei);
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
		Draw.setFont(ED_GUI_FONT);
		const arrows = Math.floor(currentTime() / ED_BLINK_MS) % 2 === 0 ? "< " : " <";
		const add = (kind, lyr, x, y, text, color) => {
			const hot = this.hot.kind === kind && this.hot.lyr === lyr;
			const full = (text + (hot ? arrows : "")).replace(/\t/g, "  ");
			list.push({
				kind: kind, lyr: lyr, x: x, y: y, text: full, color: color, hot: hot,
				w: Math.max(Draw.stringWidth(full), ED_FIELD_MIN_W) + ED_FIELD_PAD_W,
				h: Math.max(Draw.stringHeight(full), ED_FIELD_MIN_H) - ED_FIELD_TRIM_H
			});
		};
		add("header", null, ED_ROOM_X, ED_ROOM_Y, room.name, ED_ROOM_COLOR);
		room.layers.forEach((lyr, li) => {
			if (!lyr.txt.shown) return;
			add("row", lyr, ED_ROOM_X + ED_ROW_DX, lyr.txt.y, lyr.txt.pretext + lyr.txt.text,
				li === ed.curlayeri ? ED_ROW_CUR_COLOR : (lyr.txt.disabled ? ED_ROW_HIDDEN_COLOR : ED_ROW_COLOR));
		});
		add("add", null, ED_ADD_X, this.addY, this.addPretext + " +", ED_ADD_COLOR);
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

		if (this.listOpen) {
			const n = game.rooms.length;
			const inside = mx >= ED_LIST_X && mx < ED_LIST_X + ED_LIST_W + ED_LIST_PAD_W
				&& my >= ED_LIST_Y && my < ED_LIST_Y + n * ED_LIST_ROW_H + ED_LIST_PAD_H;
			this.listHover = inside ? Math.min(Math.floor((my - ED_LIST_Y) / ED_LIST_ROW_H), n - 1) : -1;
			if (inside && inp.pressed.left) {
				this.listOpen = false;
				ed.openRoom(this.listHover);
			} else if (inp.pressed.right || inp.keysPressed.has("Escape")) {
				this.listOpen = false;
			}
			return true;
		}

		// the overlay is hidden while showing as the player, and takes nothing then
		this.hot = { kind: null, lyr: null };
		if (ed.showAsPlayer) return false;
		let hit = null;
		for (const f of this.fields()) {
			if (mx >= f.x && mx < f.x + f.w && my >= f.y && my < f.y + f.h) hit = f;
		}
		if (hit === null) return false;
		this.hot = { kind: hit.kind, lyr: hit.lyr };

		const now = currentTime();
		const pressed = inp.pressed.left || inp.pressed.right || inp.pressed.middle;
		if (hit.kind === "header") {
			if (inp.pressed.right) {
				this.listOpen = true;
				this.listHover = -1;
			}
			if (pressed) this.headerLastPress = now;
			return true;
		}
		// adding a layer comes with editing
		if (hit.kind === "add") return true;

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
			}
			if (wh !== 0) this.rotate(wh);
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
		// Z, D and shift clicks toggle sorting, toggle disabled and open the layer settings, which come
		// with editing; a plain click makes the layer current
		if (inp.pressed.left && !inp.ctrl && !inp.keysDown.has("KeyZ") && !inp.keysDown.has("KeyD") && !inp.shift) {
			this.selectLayer(li);
		}
		// Right clicks toggle the layer's visibility in the editor, or its lock with control; with shift
		// every layer follows, with alt every layer of its group. The lock is only held in memory.
		if (inp.pressed.right) {
			const field = inp.ctrl ? "locked" : "visible";
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
		// the wheel moves the current layer; with shift it would move the layer itself, which comes
		// with editing
		if (wh !== 0 && !inp.shift) this.rotate(wh);
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
		let txt = pad4(ed.fpsHist) + " M:Ptr "
			+ " Ln:" + (lyr ? lyr.lsprites.length : 0) + "/" + EdView.totSpriteCnt
			+ " Hn:" + ed.curhoveri + "/" + ed.hovers.length
			+ (ed.pan ? " Pn" : "")
			+ "  Cm:" + Math.round(cam.x) + "," + Math.round(cam.y)
			+ "  Cs:" + Math.round(cam.w) + "," + Math.round(EdView.camH())
			+ "  M:" + pad4(ed.mouse.wx) + "," + pad4(ed.mouse.wy)
			+ "  wM:" + pad4(ed.mouse.gx) + "," + pad4(ed.mouse.gy)
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
			for (const f of this.fields()) {
				Draw.color = ED_FIELD_BACK_COLOR;
				Draw.alpha = ED_FIELD_BACK_ALPHA;
				Draw.rectangle(f.x, f.y, f.x + f.w - 1, f.y + f.h - 1, false);
				Draw.guiText(f.x + ED_FIELD_TEXT_DX, f.y + ED_FIELD_TEXT_DY, f.text, f.color, f.hot ? ED_FIELD_HOT_ALPHA : ED_FIELD_ALPHA, ED_GUI_FONT);
			}
		}

		// the room list draws its names plainly, with no shadow
		if (this.listOpen) {
			const n = game.rooms.length;
			Draw.color = ED_FIELD_BACK_COLOR;
			Draw.alpha = ED_FIELD_BACK_ALPHA;
			Draw.rectangle(ED_LIST_X, ED_LIST_Y, ED_LIST_X + ED_LIST_W + ED_LIST_PAD_W - 1, ED_LIST_Y + n * ED_LIST_ROW_H + ED_LIST_PAD_H - 1, false);
			Draw.setFont(ED_GUI_FONT);
			Draw.alpha = 1;
			game.rooms.forEach((rm, i) => {
				Draw.color = i === this.listHover ? ED_LIST_HOVER_COLOR : ED_LIST_COLOR;
				Draw.textRaw(ED_LIST_X + ED_LIST_TEXT_DX, ED_LIST_Y + i * ED_LIST_ROW_H + ED_LIST_TEXT_DY, rm.name, -1, -1, 1, 1, 0);
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
