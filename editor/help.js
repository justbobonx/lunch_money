// The help, a page overlay that F1 opens and F1 or escape closes, never shown while showing as the
// player. It lists every key and click the editor takes, by area in three columns, in the settings
// panel's font and look. It fits the window's width, its lines wrapping, and scrolls down when it
// runs over, the wheel scrolling it wherever the mouse is while it is open.

// margins from the window's edges, gaps, and the space between a key and what it does, in font pixels
const ED_HELP_MARGIN = 8;
const ED_HELP_PAD = 6;
const ED_HELP_COL_GAP = 16;
const ED_HELP_KEY_GAP = 6;
const ED_HELP_GROUP_GAP = 8;
// colours: the area headings, the keys and what they do
const ED_HELP_HEAD_COLOR = "#ffff33";
const ED_HELP_KEY_COLOR = "#ccccdd";
const ED_HELP_TEXT_COLOR = "#8888a0";
const ED_HELP_LATER_COLOR = "#666680";
const ED_HELP_HOVER_TEXT_COLOR = "#e8e8f0";
const ED_HELP_HOVER_BACK_COLOR = "#2a2a3c";

// the areas, column by column, each a heading and its keys with what they do
const ED_HELP_COLUMNS = [
	[
		["room and selection", [
			["click", "select, with its group"],
			["ALT click", "select without its group"],
			["SHIFT click", "add to or take from the selection"],
			["drag on nothing", "box select, SHIFT keeps what it had"],
			["ALT", "hovers from any visible layer, no grabber corners"],
			["wheel", "next of the entries stacked under the mouse"],
			["CTRL A", "select all in the current layer"],
			["CTRL SHIFT A", "select all in visible unlocked layers"],
			["ESC", "clear the selection"],
			["H click", "hide the entry under the mouse"],
			["CTRL H", "hide the selection"],
			["CTRL SHIFT H, H right click", "show every hidden entry"],
			["CTRL C / CTRL X", "copy / cut the selection"],
			["CTRL V", "paste at the mouse; a cut with nothing selected goes back"],
			["CTRL ALT V", "paste off the grid"],
			["DEL", "delete the selection"],
			["Q", "grid lock on / off"],
			["CTRL Q", "bigger grid, wrapping round"]
		]],
		["transforms", [
			["drag", "move, SHIFT along one axis"],
			["CTRL drag entry", "move a copy"],
			["drag corner", "resize, CTRL keeps the shape"],
			["ALT drag corner", "turn"],
			["arrows", "nudge a pixel, SHIFT by the grid"],
			["arrows while resizing", "nudge the corner"],
			["numpad -", "flip sideways, SHIFT upright, ALT also mirrors spots"],
			["numpad +", "quarter turn, SHIFT the other way"],
			["T click", "tiling on / off, SHIFT T also loops"],
			["A click", "animation stop / start"],
			["A wheel", "animation start frame"],
			["S click", "the selection takes the sprite under the mouse"],
			["O click", "the selection takes the object type under the mouse"],
			["O drag", "move the picture's offset"],
			["O DEL", "objects back to plain sprites"],
			["CTRL J", "jitter the selection, SHIFT more"],
			["SHIFT wheel", "z order past overlapping entries"],
			["CTRL SHIFT wheel", "z order to the top / bottom of the layer"],
			["ALT Home / End", "to the top / bottom of the layer"],
			["ALT Pg Up / Pg Dn", "up / down a layer"]
		]]
	],
	[
		["picker", [
			["TAB", "pointer / sprite / object"],
			["click in room", "place, dragging fills edge to edge"],
			["SHIFT drag", "scatter"],
			["CTRL place", "animation from its first frame"],
			["ALT place", "off the grid"],
			["right drag", "erase the picked sprite in the current layer"],
			["wheel in room", "next / last item"],
			["wheel over bar", "next / last page"],
			["drag item into room", "place it there"],
			["S click item", "the selection takes its sprite or object type"]
		]],
		["layer list", [
			["click", "make current"],
			["double click", "centre on its entries"],
			["Z click / D click", "sorted / disabled"],
			["right click", "show / hide"],
			["CTRL right click", "lock / unlock"],
			["SHIFT / ALT right click", "the same for every layer / its group"],
			["double right click", "fold the group"],
			["SHIFT click folded", "unfold"],
			["double click folded", "focus on the area"],
			["wheel", "change layer, SHIFT moves the layer"],
			["ENTER", "rename, a cleared name deletes"],
			["+ row", "add a layer after the current one"],
			["Pg Up / Pg Dn", "page the list"],
			["CTRL SHIFT < / >", "fold / unfold every group"]
		]],
		["header and fields", [
			["right click header", "room list, ESC closes"],
			["ENTER on header", "name a room not saved yet"],
			["CTRL click field", "copy its text"],
			["click filter", "edit the filter"],
			["double right click filter", "clear it"],
			["right click editing", "cancel"]
		]]
	],
	[
		["view", [
			["wheel, nothing under", "zoom"],
			["CTRL wheel", "zoom"],
			["middle drag", "pan"],
			["CTRL middle click", "centre on the click"],
			["ALT middle click", "whole room / a room pixel a pixel"],
			["double middle click", "whole room"],
			["ALT wheel", "change layer"],
			["ALT SHIFT wheel", "move the current layer"],
			["SPACE", "show as the player, held only while held"],
			["CTRL F12", "area backdrops on / off"],
			["F1", "this help, F1 or ESC closes"]
		]],
		["find", [
			["F click", "every entry of its type"],
			["CTRL F click", "of its type and sprite"],
			["ALT F click", "locked layers and folded groups too"],
			["F click item", "the picker item's type or sprite"],
			["CTRL F, nothing under", "every player start"],
			["F TAB / SHIFT F TAB", "centre on the next / last found"]
		]],
		["panels", [
			["right click entry", "entry panel"],
			["SHIFT click layer", "layer panel, again closes"],
			["ALT SHIFT click layer", "panel for its whole group"],
			["SHIFT click room name", "room panel"],
			["ENTER", "puts a field on, CTRL ENTER the text view"],
			["ESC", "close, dropping what is typed"]
		]],
		["file and undo", [
			["CTRL S", "save"],
			["CTRL R", "save and read again"],
			["CTRL L", "read again"],
			["CTRL Z", "undo"],
			["CTRL Y, CTRL SHIFT Z", "redo"]
		]],
		["players", [
			["click players", "list the open player tabs, ESC closes"],
			["click a player", "on / off; on ones in the saved room reload in place on save"],
			["CTRL P", "save, then show the tab it opened, or open one here from the room's start"],
			["CTRL SHIFT P", "the same, the player dropped on the current layer at the mouse"]
		]]
	]
];
const ED_HELP_LATER = "not yet: align, groups, bounds";

const EdHelp = {
	el: null,
	shown: false,

	// Makes the overlay, hidden, after the settings panel, whose font it uses.
	install() {
		const p = "var(--p)";
		const px = (n) => "calc(var(--p) * " + n + ")";
		const n = parseInt(ED_PANEL_BACK_COLOR.slice(1), 16);
		const back = "rgba(" + (n >> 16) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", " + ED_PANEL_BACK_ALPHA + ")";
		const style = document.createElement("style");
		style.textContent = "#ed_help { position: fixed; display: none; box-sizing: border-box; overflow-x: hidden; overflow-y: auto; z-index: 1;"
			+ " left: " + px(ED_HELP_MARGIN) + "; top: " + px(ED_HELP_MARGIN) + ";"
			+ " max-width: calc(100vw - " + px(ED_HELP_MARGIN * 2) + "); max-height: calc(100vh - " + px(ED_HELP_MARGIN * 2) + ");"
			+ " background: " + back + "; border: " + p + " solid " + ED_PANEL_BORDER_COLOR + "; border-radius: 0; box-shadow: none;"
			+ " padding: " + px(ED_HELP_PAD) + "; color: " + ED_HELP_TEXT_COLOR + ";"
			+ " font-family: \"" + ED_PANEL_FONT_NAME + "\", monospace; font-size: " + px(ED_PANEL_FONT_PX) + "; line-height: " + px(ED_PANEL_LINE_H) + ";"
			+ " -webkit-font-smoothing: none; -moz-osx-font-smoothing: grayscale; font-smooth: never; text-rendering: optimizeSpeed; }\n"
			+ "#ed_help .cols { display: flex; align-items: flex-start; column-gap: " + px(ED_HELP_COL_GAP) + "; }\n"
			+ "#ed_help .cols > div { flex: 1 1 auto; min-width: 0; }\n"
			+ "#ed_help .area { display: grid; grid-template-columns: fit-content(50%) minmax(0, 1fr);"
			+ " margin-bottom: " + px(ED_HELP_GROUP_GAP) + "; }\n"
			+ "#ed_help .head { grid-column: 1 / -1; color: " + ED_HELP_HEAD_COLOR + "; }\n"
			+ "#ed_help .row { display: contents; }\n"
			+ "#ed_help .row:hover > div { background: " + ED_HELP_HOVER_BACK_COLOR + "; }\n"
			+ "#ed_help .row:hover .does { color: " + ED_HELP_HOVER_TEXT_COLOR + "; }\n"
			+ "#ed_help .key { color: " + ED_HELP_KEY_COLOR + "; overflow-wrap: anywhere; padding-right: " + px(ED_HELP_KEY_GAP) + "; }\n"
			+ "#ed_help .does { overflow-wrap: anywhere; }\n"
			+ "#ed_help .later { color: " + ED_HELP_LATER_COLOR + "; }\n";
		document.head.appendChild(style);

		const el = this.el = document.createElement("div");
		el.id = "ed_help";
		const add = (parent, cls, text) => {
			const d = document.createElement("div");
			d.className = cls;
			d.textContent = text;
			parent.appendChild(d);
			return d;
		};
		const cols = add(el, "cols", "");
		for (const column of ED_HELP_COLUMNS) {
			const col = add(cols, "", "");
			for (const [heading, rows] of column) {
				const area = add(col, "area", "");
				add(area, "head", heading);
				// each key and what it does share one row, laid out as the area's two cells, so pointing at either
				// lights up the line; the gap is the key's own padding so the band has no hole
				for (const [key, does] of rows) {
					const row = add(area, "row", "");
					add(row, "key", key);
					add(row, "does", does);
				}
			}
		}
		add(el, "later", ED_HELP_LATER);
		document.body.appendChild(el);

		// F1 opens and closes it, escape closes it, and neither reaches the editor or the browser
		window.addEventListener("keydown", (e) => {
			if (e.code !== "F1" && !(this.shown && e.code === "Escape")) return;
			e.preventDefault();
			e.stopImmediatePropagation();
			if (!e.repeat) this.show(!this.shown && !Editor.showAsPlayer);
		}, true);
		// while open the wheel scrolls it, wherever the mouse is, and never reaches the room
		window.addEventListener("wheel", (e) => {
			if (!this.shown || el.contains(e.target)) return;
			e.preventDefault();
			e.stopImmediatePropagation();
			el.scrollTop += e.deltaY;
		}, { capture: true, passive: false });
	},

	// Shows or hides it; on showing, each font pixel is sized to a whole number of screen pixels and
	// it starts scrolled to the top.
	show(on) {
		if (on === this.shown) return;
		this.shown = on;
		if (on) {
			const dpr = window.devicePixelRatio || 1;
			this.el.style.setProperty("--p", ED_PANEL_FONT_SCALE * Math.max(1, Math.round(dpr)) / dpr + "px");
			this.el.scrollTop = 0;
		}
		this.el.style.display = on ? "block" : "none";
	}
};
