// On screen interface drawn in overlay pixels over the game.
// The room picker: a list of every room in the world that pauses play, to go to any of them.
// Keys: the open key toggles it, up and down or the mouse wheel move, page keys and home and end
// jump, enter or a click goes to the room, escape closes. The open key is not one the
// controller reads, so it never clashes with play.
// The screens over play: the full inventory screen and the ship console's screen. Play keeps
// running under them, only the player's controls are off while one is up, and they read the menu
// controller instead.

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

// The inventory screen: one panel per inventory, stacked and centred, each a backing box with the
// owner's box on the left and a grid of cells on the right, as the original laid them out.
// The panel's border, the owner box's size, the size its picture is fitted to, the step from it to
// the cells and the strip left on the right, where the owner's name sits, the cell size and step,
// how far in an item sits and its size, the fewest rows a panel is tall so the owner box fits,
// and the gap between panels, all in overlay pixels.
const INVSCR_PAD = 2;
const INVSCR_OWNER_W = 42;
const INVSCR_OWNER_H = 32;
const INVSCR_OWNER_FIT = 28;
const INVSCR_OWNER_STEP = 44;
const INVSCR_SIDE_STRIP = 6;
const INVSCR_OWNER_NAME_Y = 30;
const INVSCR_CELL = 20;
const INVSCR_PITCH = 22;
const INVSCR_ITEM_INSET = 2;
const INVSCR_ITEM_SIZE = 16;
const INVSCR_MIN_ROWS = 2;
const INVSCR_PANEL_GAP = 4;
// the in hand marker's place in a cell, and how long each frame of the cursor and selection shows
const INVSCR_HELD_X = -1;
const INVSCR_HELD_Y = 14;
const INVSCR_BLINK_MS = 250;
// its sprites, and the ending of an item's own inventory picture
const INVSCR_OWNER_BOX = "s_igg_bg_square_box_lk";
const INVSCR_CELL_BOX = "s_igg_bg_square_box";
const INVSCR_CURSOR = "s_igg_bg_square_hl";
const INVSCR_SELECTION = "s_igg_bg_square_sel";
const INVSCR_HELD_ICON = "s_icon_btn_x";
const INVSCR_ITEM_SPRITE_END = "_inv";
// the owner's name, and the highlighted item's name under the panels with its gap below them
const INVSCR_OWNER_FONT = "ftTiny";
const INVSCR_OWNER_COLOR = "#ffffff";
const INVSCR_ITEM_FONT = "ftSmall";
const INVSCR_ITEM_COLOR = "#ccccee";
const INVSCR_ITEM_GAP = 4;

// The console screen: the close up picture, its spot and stretch, the text's spot, wrap width, font,
// colour and line spacing as a share of the font's height, the header over every text, and the
// text a console shows when its room gives none.
const CONSOLE_PICTURE = "s_ship_small_console_closeup";
const CONSOLE_PICTURE_X = 320;
const CONSOLE_PICTURE_Y = 160;
const CONSOLE_PICTURE_SCALE = 2;
const CONSOLE_TEXT_X = 88;
const CONSOLE_TEXT_Y = 57;
const CONSOLE_WRAP = 380;
const CONSOLE_FONT = "ftConsole";
const CONSOLE_COLOR = "#00ff00";
const CONSOLE_LINE_SHARE = 1.5;
const CONSOLE_HEADER = "=================== Star Ventures Unlimited ===================\n";
const CONSOLE_DEFAULT_TEXT = "\n\nSystem check...\nAll systems currently nominal\n";

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

// ---------------------------------------------------------------- screens over play

// The one screen over play at a time. Putting one up switches the player's controls off and taking
// it down puts them back as they were. The world runs it each update, ahead of everyone, with the
// menu controller, and the frame draws it under the debug overlay, in overlay pixels.
const Screens = {
	current: null,
	conwasoff: false,

	// Gives back whether it went up, which it does not while another is up.
	open(screen) {
		if (this.current !== null) return false;
		this.current = screen;
		this.conwasoff = game.controller.conOff;
		game.controller.conOff = true;
		return true;
	},

	close() {
		this.current = null;
		game.controller.conOff = this.conwasoff;
	},

	// dropped with the world, which puts the controls back itself
	forget() {
		this.current = null;
	},

	update() {
		if (this.current !== null) this.current.update(game.uiController);
	},

	draw() {
		if (this.current === null) return;
		Draw.base = { sx: DISPLAY_W / GUI_W, sy: DISPLAY_H / GUI_H, ox: 0, oy: 0 };
		Draw.curdrawoffx = 0;
		Draw.curdrawoffy = 0;
		Draw.halign = "left";
		Draw.valign = "top";
		Draw.color = "#ffffff";
		Draw.alpha = 1;
		this.current.draw();
		Draw.color = "#ffffff";
		Draw.alpha = 1;
		Draw.halign = "left";
	}
};

// The full inventory screen over one or more inventories. Each panel keeps a grid of the items
// themselves, placed where they sat last time, and items that change panel change inventory there
// and then, so the hands are always right. Closing writes each inventory's list back in grid order.
// Keys: arrows move, up and down crossing panels. A picks an item, A on another cell swaps the two,
// A on the picked one takes it into a hand. Y sends the item to the next panel's first free cell.
// X takes it into a hand or puts it back in the bag. B closes, as does the button it was opened
// with when one is given.
// Only a bag can refuse an item, and a screen has at most one bag, the player's, so a swap moves the
// item going into the bag first and a refusal leaves both where they were.
class InventoryScreen {
	constructor(invs, closeButton) {
		this.closeButton = closeButton === undefined ? null : closeButton;
		// the highlighted panel and cell, and the picked ones, the cell minus one for none
		this.curp = 0;
		this.hli = 0;
		this.selp = 0;
		this.seli = -1;

		// Items go back to their cell from last time when it is free, else to the first free one.
		// Ones that find no cell stay in the list, unseen, after the rest. The owner's picture and
		// frame are taken now and stay as they are.
		this.panels = invs.map((inv) => {
			const grid = new Array(inv.size).fill(null);
			const overflow = [];
			for (const item of inv.inv_list) {
				let pos = item._inv_pos;
				if (!(pos >= 0 && pos < inv.size) || grid[pos] !== null) pos = grid.indexOf(null);
				if (pos < 0) overflow.push(item);
				else grid[pos] = item;
			}
			return {
				inv: inv, grid: grid, overflow: overflow,
				w: INVSCR_PAD + inv.w * INVSCR_PITCH + INVSCR_OWNER_STEP + INVSCR_SIDE_STRIP,
				h: INVSCR_PAD + Math.max(Math.ceil(inv.size / inv.w), INVSCR_MIN_ROWS) * INVSCR_PITCH,
				spi: inv.owner.spi, ifr: inv.owner.ifr,
				name: inv.name !== undefined ? inv.name : inv.owner.name
			};
		});

		// lined up on the left and stacked by their own heights, the whole stack centred
		const totw = Math.max(...this.panels.map((p) => p.w));
		const toth = this.panels.reduce((sum, p) => sum + p.h, 0) + INVSCR_PANEL_GAP * (this.panels.length - 1);
		let y = Math.floor((GUI_H - toth) / 2);
		for (const p of this.panels) {
			p.x = Math.floor((GUI_W - totw) / 2);
			p.y = y;
			y += p.h + INVSCR_PANEL_GAP;
		}
		this.bottom = y - INVSCR_PANEL_GAP;
	}

	update(con) {
		if (con.iBtnB || (this.closeButton !== null && con[this.closeButton])) {
			this.close();
			return;
		}
		// anything used up meanwhile, like a blown up stick of dynamite, is gone from the grid
		for (const p of this.panels) {
			for (let i = 0; i < p.grid.length; i++) {
				if (p.grid[i] !== null && p.grid[i].destroyed) p.grid[i] = null;
			}
		}

		let p = this.panels[this.curp];
		if (con.iBtnX && p.grid[this.hli] !== null) {
			if (p.grid[this.hli] === p.inv.owner.carrying) p.inv.switch_held(-1);
			else this.hold(this.curp, this.hli);
		}
		if (con.iBtnA) {
			if (this.seli === this.hli && this.selp === this.curp) {
				this.hold(this.curp, this.hli);
				this.seli = -1;
			} else if (this.seli >= 0) {
				this.swap();
				this.seli = -1;
			} else if (p.grid[this.hli] !== null) {
				this.seli = this.hli;
				this.selp = this.curp;
			}
		}
		if (con.iBtnY && p.grid[this.hli] !== null && this.panels.length > 1) {
			const next = this.panels[(this.curp + 1) % this.panels.length];
			const to = next.grid.indexOf(null);
			const item = p.grid[this.hli];
			if (to >= 0 && this.move(item, p, next)) {
				p.grid[this.hli] = null;
				next.grid[to] = item;
				this.seli = -1;
			}
		}

		// left and right stay in the row, up and down go row by row and on into the next panel,
		// keeping the column where it fits
		const w = p.inv.w;
		const last = p.inv.size - 1;
		if (con.iRightP && this.hli % w < w - 1 && this.hli < last) this.hli++;
		if (con.iLeftP && this.hli % w > 0) this.hli--;
		if (con.iUpP) {
			if (this.hli >= w) {
				this.hli -= w;
			} else if (this.curp > 0) {
				p = this.panels[--this.curp];
				this.hli = Math.min(Math.floor((p.inv.size - 1) / p.inv.w) * p.inv.w + Math.min(this.hli % w, p.inv.w - 1), p.inv.size - 1);
			}
		} else if (con.iDownP) {
			if (Math.floor(this.hli / w) < Math.floor(last / w)) {
				this.hli = Math.min(this.hli + w, last);
			} else if (this.curp < this.panels.length - 1) {
				p = this.panels[++this.curp];
				this.hli = Math.min(this.hli % w, p.inv.w - 1, p.inv.size - 1);
			}
		}
	}

	// Moves an item out of one panel's inventory into another's: let go of, then taken in. A bag
	// that will not take it gives it back to where it came from. Gives back whether it moved. The
	// grids are left to the caller.
	move(item, from, to) {
		from.inv.release(item);
		if (to.inv.pickup(item, undefined, true) !== undefined) return true;
		from.inv.pickup(item, undefined, true);
		return false;
	}

	// Takes an item out into a hand. An item in a locker has no hand to go to, so it moves to the
	// first free cell of the panel with a hand first, and stays put when there is no room.
	hold(pi, cell) {
		let p = this.panels[pi];
		const item = p.grid[cell];
		if (p.inv.stows) {
			const hp = this.panels.find((q) => !q.inv.stows);
			const to = hp !== undefined ? hp.grid.indexOf(null) : -1;
			if (to < 0 || !this.move(item, p, hp)) return;
			p.grid[cell] = null;
			hp.grid[to] = item;
			p = hp;
		}
		p.inv.switch_held(p.inv.inv_list.indexOf(item));
	}

	// Swaps the picked cell with the highlighted one, either of them maybe empty.
	swap() {
		const sp = this.panels[this.selp];
		const cp = this.panels[this.curp];
		const a = sp.grid[this.seli];
		const b = cp.grid[this.hli];
		if (sp !== cp) {
			if (!cp.inv.stows || b === null) {
				if (!this.move(a, sp, cp)) return;
				if (b !== null) this.move(b, cp, sp);
			} else {
				if (!this.move(b, cp, sp)) return;
				this.move(a, sp, cp);
			}
		}
		sp.grid[this.seli] = b;
		cp.grid[this.hli] = a;
	}

	// Writes each list back in grid order, each item keeping its cell for next time, with the hand
	// and the one before it found again by the item, then lets the first owner know.
	close() {
		for (const p of this.panels) {
			const inv = p.inv;
			const before = inv.last_held_i >= 0 ? inv.inv_list[inv.last_held_i] : undefined;
			inv.inv_list.length = 0;
			p.grid.forEach((item, gi) => {
				if (item === null) return;
				item._inv_pos = gi;
				inv.inv_list.push(item);
			});
			for (const item of p.overflow) inv.inv_list.push(item);
			inv.cur_held_i = inv.inv_list.indexOf(inv.owner.carrying);
			inv.last_held_i = before === undefined ? -1 : inv.inv_list.indexOf(before);
		}
		Screens.close();
		this.panels[0].inv.owner.inv_done();
	}

	// A sprite scaled so its longer side is a given size, centred in a box by its own size and
	// origin, as the original showed owners and items with no inventory picture.
	drawFitted(spi, ifr, x, y, boxw, boxh, fit) {
		const rec = Sprites.peek(spi);
		if (!rec) return;
		const sc = fit / Math.max(rec.w, rec.h);
		Draw.spriteExt(spi, ifr, x + Math.floor((boxw - rec.w * sc) / 2 + rec.ox * sc),
			y + Math.floor((boxh - rec.h * sc) / 2 + rec.oy * sc), sc, sc, 0, NO_TINT, 1);
	}

	// Each panel: its backing, the owner's box with their picture and name, then a cell for each
	// place the inventory has, with its item, the in hand marker, the selection and the cursor.
	// Under them all, the highlighted item's name.
	draw() {
		const blink = Math.floor(currentTime() / INVSCR_BLINK_MS);
		this.panels.forEach((p, pi) => {
			Draw.bgSquare(p.x, p.y, p.w, p.h, p.inv.bg);
			const ox = p.x + INVSCR_PAD;
			const oy = p.y + INVSCR_PAD;
			Draw.bgSquare(ox, oy, INVSCR_OWNER_W, INVSCR_OWNER_H, INVSCR_OWNER_BOX);
			this.drawFitted(p.spi, p.ifr, ox, oy, INVSCR_OWNER_W, INVSCR_OWNER_H, INVSCR_OWNER_FIT);
			Draw.setFont(INVSCR_OWNER_FONT);
			Draw.color = INVSCR_OWNER_COLOR;
			Draw.text(Math.floor(ox + (INVSCR_OWNER_W - Draw.stringWidth(p.name)) / 2), oy + INVSCR_OWNER_NAME_Y, p.name);
			Draw.color = "#ffffff";

			for (let i = 0; i < p.inv.size; i++) {
				const bx = ox + INVSCR_OWNER_STEP + (i % p.inv.w) * INVSCR_PITCH;
				const by = oy + Math.floor(i / p.inv.w) * INVSCR_PITCH;
				Draw.bgSquare(bx, by, INVSCR_CELL, INVSCR_CELL, INVSCR_CELL_BOX);
				const item = p.grid[i];
				if (item !== null) {
					if (Sprites.exists(item.spi + INVSCR_ITEM_SPRITE_END)) {
						Draw.spriteExt(item.spi + INVSCR_ITEM_SPRITE_END, 0, bx + INVSCR_ITEM_INSET, by + INVSCR_ITEM_INSET, 1, 1, 0, NO_TINT, 1);
					} else {
						this.drawFitted(item.spi, 0, bx + INVSCR_ITEM_INSET, by + INVSCR_ITEM_INSET, INVSCR_ITEM_SIZE, INVSCR_ITEM_SIZE, INVSCR_ITEM_SIZE);
					}
					if (item === p.inv.owner.carrying) Draw.spriteExt(INVSCR_HELD_ICON, 0, bx + INVSCR_HELD_X, by + INVSCR_HELD_Y, 1, 1, 0, NO_TINT, 1);
				}
				if (pi === this.selp && i === this.seli) Draw.spriteExt(INVSCR_SELECTION, blink, bx, by, 1, 1, 0, NO_TINT, 1);
				if (pi === this.curp && i === this.hli) Draw.spriteExt(INVSCR_CURSOR, blink, bx, by, 1, 1, 0, NO_TINT, 1);
			}
		});

		const item = this.panels[this.curp].grid[this.hli];
		if (item === null) return;
		Draw.halign = "center";
		Draw.guiText(Math.floor(GUI_W / 2), this.bottom + INVSCR_ITEM_GAP, item.gname, INVSCR_ITEM_COLOR, 1, INVSCR_ITEM_FONT);
	}
}

// The console's screen: its close up with green text typing out a letter an update under the
// header, the room's own text or the usual one. A shows it all, B closes and switches the console
// off.
class ConsoleScreen {
	constructor(owner, text) {
		this.owner = owner;
		this.text = text !== null && text !== undefined ? String(text) : CONSOLE_DEFAULT_TEXT;
		// how many letters show so far
		this.shown = 0;
	}

	update(con) {
		if (con.iBtnB) {
			Screens.close();
			this.owner.turnoff();
			return;
		}
		if (con.iBtnA) this.shown = this.text.length;
		else if (this.shown < this.text.length) this.shown++;
	}

	draw() {
		Draw.spriteExt(CONSOLE_PICTURE, 0, CONSOLE_PICTURE_X, CONSOLE_PICTURE_Y, CONSOLE_PICTURE_SCALE, CONSOLE_PICTURE_SCALE, 0, NO_TINT, 1);
		Draw.setFont(CONSOLE_FONT);
		Draw.color = CONSOLE_COLOR;
		Draw.textRaw(CONSOLE_TEXT_X, CONSOLE_TEXT_Y, CONSOLE_HEADER + this.text.substring(0, this.shown),
			Draw.stringHeight("M") * CONSOLE_LINE_SHARE, CONSOLE_WRAP, 1, 1, 0);
	}
}
