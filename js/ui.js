// On screen interface drawn in overlay pixels over the game. For now only the room picker:
// a list of every room in the world that pauses play, to go to any of them.
// Keys: the open key toggles it, up and down or the mouse wheel move, page keys and home and end
// jump, enter or a click goes to the room, escape closes. The open key is not one the
// controller reads, so it never clashes with play.

// the key that opens and closes the picker
const ROOM_PICKER_KEY = "Backquote";

// room list size, in overlay pixels
const PICKER_WIDTH = 300;
const PICKER_MAX_ROWS = 17;
const PICKER_ROW_H = 14;
const PICKER_PAD = 8;
const PICKER_TITLE_H = 22;
const PICKER_FOOTER_H = 30;
// where the room number and the room name start within a row
const PICKER_NUMBER_X = 6;
const PICKER_NAME_X = 36;

// how far the page keys move
const PICKER_PAGE_STEP = 10;

// colors and fades
const PICKER_SHADE_COLOR = "#000000";
const PICKER_SHADE_ALPHA = 0.7;
const PICKER_PANEL_COLOR = "#101828";
const PICKER_BORDER_COLOR = "#6688cc";
const PICKER_SELECT_COLOR = "#335599";
const PICKER_TEXT_COLOR = "#ffffff";
const PICKER_DIM_COLOR = "#7788aa";
const PICKER_HERE_COLOR = "#ffdd66";
const PICKER_ERROR_COLOR = "#ff6666";

// A pop up list of rooms. The shell asks it every frame whether play may run, and has it
// draw after the game. Going to a room waits for that room's pictures first.
class RoomPicker {
	constructor() {
		this.open = false;
		// true while a chosen room is being got ready, play stays paused
		this.busy = false;
		this.selected = 0;
		// first visible row
		this.top = 0;
		// a line of news shown under the list, such as a room that would not load
		this.message = "";
		this.messageIsError = false;
		// mouse happenings kept until the next frame, in overlay pixels
		this.pending = [];
		this.canvas = null;
	}

	// Listens to the wheel, the mouse and clicks on the game's canvas.
	attach(canvas) {
		this.canvas = canvas;
		const toOverlay = (e) => {
			const r = canvas.getBoundingClientRect();
			return { x: (e.clientX - r.left) / r.width * GUI_W, y: (e.clientY - r.top) / r.height * GUI_H };
		};
		canvas.addEventListener("wheel", (e) => {
			if (!this.open) return;
			e.preventDefault();
			this.pending.push({ kind: "wheel", dir: Math.sign(e.deltaY) });
		}, { passive: false });
		canvas.addEventListener("mousemove", (e) => {
			if (this.open) this.pending.push(Object.assign({ kind: "move" }, toOverlay(e)));
		});
		canvas.addEventListener("click", (e) => {
			if (this.open) this.pending.push(Object.assign({ kind: "click" }, toOverlay(e)));
		});
	}

	// Called once a frame before the game's step. Gives back whether the game may step.
	// While the picker is up the frame's key presses are used up here so play never sees them.
	update() {
		if (!this.open) {
			if (!Input.keyPressed(ROOM_PICKER_KEY)) return true;
			this.show();
			Input.endFrame();
			return false;
		}
		const events = this.pending;
		this.pending = [];
		if (!this.busy) this.handle(events);
		Input.endFrame();
		return false;
	}

	show() {
		this.open = true;
		this.message = "";
		this.messageIsError = false;
		this.pending = [];
		this.selected = Math.max(0, game.curroomi);
		this.scrollToSelected();
	}

	close() {
		this.open = false;
	}

	// Acts on this frame's keys and mouse, one thing at a time in the order they came.
	handle(events) {
		const count = game.rooms.length;
		if (Input.keyPressed("Escape") || Input.keyPressed(ROOM_PICKER_KEY)) {
			this.close();
			return;
		}
		if (Input.keyPressed("ArrowUp")) this.move(-1);
		if (Input.keyPressed("ArrowDown")) this.move(1);
		if (Input.keyPressed("PageUp")) this.move(-PICKER_PAGE_STEP);
		if (Input.keyPressed("PageDown")) this.move(PICKER_PAGE_STEP);
		if (Input.keyPressed("Home")) this.move(-count);
		if (Input.keyPressed("End")) this.move(count);
		if (Input.keyPressed("Enter") || Input.keyPressed("NumpadEnter")) {
			this.pick(this.selected);
			return;
		}
		for (const ev of events) {
			if (ev.kind === "wheel") {
				this.move(ev.dir);
			} else {
				const row = this.rowAt(ev.x, ev.y);
				if (row < 0) continue;
				this.selected = row;
				if (ev.kind === "click") {
					this.pick(row);
					return;
				}
			}
		}
	}

	// Moves the selection, stopping at the ends.
	move(by) {
		const count = game.rooms.length;
		if (count === 0) return;
		this.selected = Math.max(0, Math.min(count - 1, this.selected + by));
		this.scrollToSelected();
	}

	visibleRows() {
		return Math.min(game.rooms.length, PICKER_MAX_ROWS);
	}

	scrollToSelected() {
		const rows = this.visibleRows();
		if (this.selected < this.top) this.top = this.selected;
		if (this.selected >= this.top + rows) this.top = this.selected - rows + 1;
		this.top = Math.max(0, Math.min(this.top, game.rooms.length - rows));
	}

	// where the panel and its list sit in overlay pixels
	layout() {
		const rows = this.visibleRows();
		const h = PICKER_TITLE_H + rows * PICKER_ROW_H + PICKER_FOOTER_H + PICKER_PAD;
		const x = Math.floor((GUI_W - PICKER_WIDTH) / 2);
		const y = Math.floor((GUI_H - h) / 2);
		return { x: x, y: y, w: PICKER_WIDTH, h: h, listTop: y + PICKER_TITLE_H, rows: rows };
	}

	// the room number under a spot, or minus one when the spot is not on a row
	rowAt(px, py) {
		const L = this.layout();
		if (px < L.x + PICKER_PAD || px > L.x + L.w - PICKER_PAD) return -1;
		if (py < L.listTop || py >= L.listTop + L.rows * PICKER_ROW_H) return -1;
		return this.top + Math.floor((py - L.listTop) / PICKER_ROW_H);
	}

	// Goes to a room once its pictures are in. Gives back whether it got there; when it did the
	// picker closes and play carries on in the room. Play stays paused while it waits.
	async pick(rmi) {
		const rm = game.rooms[rmi];
		if (!rm) return false;
		if (rm.text === null) {
			this.message = "there is no file for " + rm.name;
			this.messageIsError = true;
			return false;
		}
		this.busy = true;
		this.message = "loading " + rm.name + " ...";
		this.messageIsError = false;
		let ok = false;
		try {
			await Sprites.ensure(game.roomSpriteNames(rmi));
			ok = game.enterRoom(rmi);
			if (!ok) this.message = rm.name + " would not load";
		} catch (e) {
			console.error("room " + rm.name + " failed to load", e);
			this.message = rm.name + " failed: " + e.message;
		}
		this.busy = false;
		this.messageIsError = !ok;
		if (ok) {
			this.message = "";
			this.close();
		}
		return ok;
	}

	// The list over a shaded game, in the overlay's own pixels with the small font.
	draw() {
		if (!this.open) return;
		const L = this.layout();
		Draw.base = { sx: DISPLAY_W / GUI_W, sy: DISPLAY_H / GUI_H, ox: 0, oy: 0 };
		Draw.curdrawoffx = 0;
		Draw.curdrawoffy = 0;
		Draw.halign = "left";
		Draw.valign = "top";

		Draw.color = PICKER_SHADE_COLOR;
		Draw.alpha = PICKER_SHADE_ALPHA;
		Draw.rectangle(0, 0, GUI_W - 1, GUI_H - 1, false);
		Draw.alpha = 1;
		Draw.color = PICKER_PANEL_COLOR;
		Draw.rectangle(L.x, L.y, L.x + L.w - 1, L.y + L.h - 1, false);
		Draw.color = PICKER_BORDER_COLOR;
		Draw.rectangle(L.x, L.y, L.x + L.w - 1, L.y + L.h - 1, true);

		Draw.guiText(L.x + PICKER_PAD, L.y + PICKER_PAD / 2, "Rooms", PICKER_TEXT_COLOR);
		const countText = (this.selected + 1) + " / " + game.rooms.length;
		Draw.halign = "right";
		Draw.guiText(L.x + L.w - PICKER_PAD, L.y + PICKER_PAD / 2, countText, PICKER_DIM_COLOR);
		Draw.halign = "left";

		for (let i = 0; i < L.rows; i++) {
			const idx = this.top + i;
			const rm = game.rooms[idx];
			const ry = L.listTop + i * PICKER_ROW_H;
			if (idx === this.selected) {
				Draw.color = PICKER_SELECT_COLOR;
				Draw.rectangle(L.x + PICKER_PAD, ry, L.x + L.w - PICKER_PAD - 1, ry + PICKER_ROW_H - 1, false);
			}
			const missing = rm.text === null;
			const color = missing ? PICKER_DIM_COLOR : (idx === game.curroomi ? PICKER_HERE_COLOR : PICKER_TEXT_COLOR);
			Draw.guiText(L.x + PICKER_PAD + PICKER_NUMBER_X, ry, String(idx), PICKER_DIM_COLOR);
			Draw.guiText(L.x + PICKER_PAD + PICKER_NAME_X, ry, rm.name + (missing ? "  (no file)" : ""), color);
			if (idx === game.curroomi) {
				Draw.halign = "right";
				Draw.guiText(L.x + L.w - PICKER_PAD - PICKER_NUMBER_X, ry, "here", PICKER_HERE_COLOR);
				Draw.halign = "left";
			}
		}

		const footY = L.listTop + L.rows * PICKER_ROW_H + 2;
		if (this.message !== "") {
			Draw.guiText(L.x + PICKER_PAD, footY, this.message, this.messageIsError ? PICKER_ERROR_COLOR : PICKER_TEXT_COLOR);
		} else {
			Draw.guiText(L.x + PICKER_PAD, footY, "up down wheel: choose   enter or click: go", PICKER_DIM_COLOR);
		}
		Draw.guiText(L.x + PICKER_PAD, footY + PICKER_ROW_H, "esc or the open key: close", PICKER_DIM_COLOR);

		Draw.color = "#ffffff";
		Draw.alpha = 1;
	}
}

const roomPicker = new RoomPicker();
