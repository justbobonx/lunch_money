// The editor itself: getting at the game's folder, loading the world and a room, the input of each
// step, and the frame loop that draws the room and the overlay. Phase one only looks: it pans, zooms,
// picks rooms and layers and shows what is under the mouse, and never changes a file.
// The player's code is called for loading, parsing and drawing, but the game itself never runs here:
// no object updates, camera follow, collision or weather.

// The original editor's view was this size; a room's saved camera is its top left and width, with
// the height following this shape. Its middle stays the middle on any screen shape here.
const ED_GM_VIEW_W = 640;
const ED_GM_VIEW_H = 400;
// two middle clicks this close are a double click, in ms
const ED_DOUBLE_MIDDLE_MS = 200;
// holding space at least this long shows as the player only while held
const ED_SPACE_HOLD_MS = 500;
// how much each new frame moves the shown frame rate
const ED_FPS_SMOOTHING = 0.05;
// where the last room looked at is remembered between visits
const ED_LAST_ROOM_KEY = "lunch_money_editor_room";
// keys whose browser meaning would get in the way
const ED_KEPT_KEYS = ["F1", "Space", "Tab", "PageUp", "PageDown", "AltLeft", "AltRight", "Escape", "F12"];

const Editor = {
	canvas: null,
	ctx: null,
	// screen pixels per page pixel
	dpr: 1,
	// the room being looked at, built by the room reader, and whether one is on its way
	room: null,
	loading: false,
	// the editor's camera: top left and width in room pixels, the height following the screen
	cam: { x: 0, y: 0, w: ED_GM_VIEW_W },
	curlayeri: 0,
	// the mouse on the screen, on the overlay grid, and in the room
	mouse: { devx: 0, devy: 0, gx: 0, gy: 0, wx: 0, wy: 0 },
	lastDevX: -1,
	lastDevY: -1,
	// This step's input: buttons held, pressed and let go, the wheel, keys by their spot on the
	// keyboard, and the modifier keys. Events collect into it and the step reads it.
	inp: {
		down: { left: false, middle: false, right: false },
		pressed: { left: false, middle: false, right: false },
		released: { left: false, middle: false, right: false },
		wheel: 0,
		keysDown: new Set(),
		keysPressed: new Set(),
		keysReleased: new Set(),
		shift: false,
		ctrl: false,
		alt: false
	},
	// dragging the view with the middle button: where the camera and the mouse were when it began
	pan: false,
	panCamX: 0,
	panMouseX: 0,
	panCamY: 0,
	panMouseY: 0,
	lastMiddle: 0,
	// hides the overlay and the marks to show the room as the player would; held or toggled by space
	showAsPlayer: false,
	spaceAt: 0,
	// Ctrl F12 hides the area backdrops as the original's did
	drawBdSprites: true,
	// what is under the mouse, the one the wheel picked out of a stack, and how many
	hovers: [],
	curhoveri: 0,
	// animation time: frames passed in the game's frame rate, and this frame's share
	frames: 0,
	steps: 0,
	lastTime: 0,
	fpsHist: GAME_FPS,
	// a short note after the status line, of loading trouble
	debugtxt: "",

	// Sets up the canvas, the input and the folder gate, then starts the frame loop.
	start(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.fit();
		window.addEventListener("resize", () => this.fit());

		const inp = this.inp;
		const buttons = ["left", "middle", "right"];
		const mods = (e) => {
			inp.shift = e.shiftKey;
			inp.ctrl = e.ctrlKey || e.metaKey;
			inp.alt = e.altKey;
		};
		const move = (e) => {
			const r = canvas.getBoundingClientRect();
			this.mouse.devx = (e.clientX - r.left) * this.dpr;
			this.mouse.devy = (e.clientY - r.top) * this.dpr;
			mods(e);
		};
		canvas.addEventListener("mousedown", (e) => {
			move(e);
			const b = buttons[e.button];
			if (b === undefined) return;
			inp.down[b] = true;
			inp.pressed[b] = true;
			// the middle button would otherwise start the browser's scrolling
			e.preventDefault();
		});
		window.addEventListener("mouseup", (e) => {
			move(e);
			const b = buttons[e.button];
			if (b === undefined) return;
			inp.down[b] = false;
			inp.released[b] = true;
		});
		window.addEventListener("mousemove", move);
		canvas.addEventListener("wheel", (e) => {
			move(e);
			// up is one step forward, as in the original
			inp.wheel -= Math.sign(e.deltaY);
			e.preventDefault();
		}, { passive: false });
		canvas.addEventListener("contextmenu", (e) => e.preventDefault());
		window.addEventListener("keydown", (e) => {
			mods(e);
			if (ED_KEPT_KEYS.includes(e.code) || (e.ctrlKey && e.shiftKey && (e.code === "ArrowLeft" || e.code === "ArrowRight"))) {
				e.preventDefault();
			}
			if (e.repeat) return;
			inp.keysDown.add(e.code);
			inp.keysPressed.add(e.code);
		});
		window.addEventListener("keyup", (e) => {
			mods(e);
			inp.keysDown.delete(e.code);
			inp.keysReleased.add(e.code);
		});
		// keys and buttons let go outside the page would otherwise stay held
		window.addEventListener("blur", () => {
			inp.keysDown.clear();
			for (const b of buttons) inp.down[b] = false;
			inp.shift = false;
			inp.ctrl = false;
			inp.alt = false;
			this.pan = false;
		});

		this.gate();
		const tick = (now) => {
			this.frame(now);
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	},

	// The folder gate over the canvas: a note when this browser has no folder access, else a button
	// to take up the folder from an earlier visit and one to pick it. Either loads the world.
	async gate() {
		const gate = document.getElementById("ed_gate");
		const msg = document.getElementById("ed_gate_msg");
		const reopen = document.getElementById("ed_reopen");
		const pick = document.getElementById("ed_pick");
		if (!EdFolder.supported()) {
			msg.textContent = "This browser can't open a folder for the editor. Open editor.html in Chrome or Edge.";
			pick.hidden = true;
			return;
		}
		const go = async (open) => {
			try {
				await open();
			} catch (e) {
				msg.textContent = e.name === "AbortError" ? "No folder picked." : e.message;
				return;
			}
			gate.hidden = true;
			gate.style.display = "none";
			this.load();
		};
		const handle = await EdFolder.remembered();
		if (handle !== null) {
			reopen.textContent = "Open " + handle.name;
			reopen.hidden = false;
			reopen.onclick = () => go(() => EdFolder.reopen(handle));
		}
		pick.onclick = () => go(() => EdFolder.pick());
	},

	// The world as the player loads it, through the folder: its rooms, the object classes, the
	// sprites and fonts. Then the room looked at last time, or the player's start room.
	async load() {
		this.loading = true;
		this.debugtxt = " loading";
		const progress = { expect() {}, done() {} };
		try {
			await game.loadFiles(EdFolder.readText, undefined, EdFolder.loadScript, progress);
			await Sprites.load(EdFolder.readJson, EdFolder.loadImage, [], undefined, progress);
			await Draw.loadFonts(EdFolder.readJson, EdFolder.loadImage);
		} catch (e) {
			this.loading = false;
			this.debugtxt = " world would not load: " + e.message;
			console.log(e);
			return;
		}
		this.loading = false;
		this.debugtxt = "";
		let rmi = game.findRoomIndex(localStorage.getItem(ED_LAST_ROOM_KEY) || START_ROOM_NAME);
		if (rmi < 0) rmi = game.findRoomIndex(START_ROOM_NAME);
		await this.openRoom(rmi < 0 ? 0 : rmi);
	},

	// Reads a room's file fresh, loads its sprites, and builds it to look at, with the camera where
	// the room was saved looking.
	async openRoom(rmi) {
		// once rooms can be edited, leaving one with changes asks to save, discard or stay here
		if (this.loading || rmi < 0 || rmi >= game.rooms.length) return;
		this.loading = true;
		const name = game.rooms[rmi].name;
		try {
			const text = await EdFolder.readText(ROOM_DIR + "room_" + name + ".dat");
			await Sprites.ensure(spriteNamesInRoom(text));
			this.room = EdRoom.build(rmi, text);
		} catch (e) {
			this.loading = false;
			this.debugtxt = " room " + name + " would not load: " + e.message;
			console.log(e);
			return;
		}
		this.loading = false;
		this.debugtxt = "";
		const room = this.room;
		this.cam.w = room.camw;
		this.cam.x = room.camx;
		this.cam.y = room.camy + room.camw * ED_GM_VIEW_H / ED_GM_VIEW_W / 2 - EdView.camH() / 2;
		EdGui.roomLoaded();
		this.hovers = [];
		this.curhoveri = 0;
		this.lastDevX = -1;
		localStorage.setItem(ED_LAST_ROOM_KEY, name);
	},

	// The canvas at the screen's own pixels, keeping the view's middle and width.
	fit() {
		const c = this.canvas;
		const midy = this.cam.y + EdView.camH() / 2;
		this.dpr = window.devicePixelRatio || 1;
		c.width = Math.round(c.clientWidth * this.dpr);
		c.height = Math.round(c.clientHeight * this.dpr);
		this.cam.y = midy - EdView.camH() / 2;
		EdGui.scale = Math.max(1, Math.round(c.width / ED_GUI_W));
	},

	// One frame: animation time, the step, the room, the overlay, then this step's input cleared.
	frame(now) {
		const dt = this.lastTime === 0 ? 0 : now - this.lastTime;
		this.lastTime = now;
		this.steps = dt * GAME_FPS / 1000;
		this.frames += this.steps;
		if (dt > 0) this.fpsHist += (1000 / dt - this.fpsHist) * ED_FPS_SMOOTHING;
		if (this.room !== null && !this.loading) this.step();
		EdView.draw();
		EdGui.draw();

		const inp = this.inp;
		for (const b of ["left", "middle", "right"]) {
			inp.pressed[b] = false;
			inp.released[b] = false;
		}
		inp.wheel = 0;
		inp.keysPressed.clear();
		inp.keysReleased.clear();
	},

	// The step's input, in the original's order: keys that work everywhere, then the overlay, then,
	// when the mouse is not on the overlay, the view's own clicks, wheel and hovers.
	step() {
		const inp = this.inp;
		const mouse = this.mouse;
		const cam = this.cam;
		const room = this.room;
		const z = this.canvas.width / cam.w;
		mouse.gx = mouse.devx / EdGui.scale;
		mouse.gy = mouse.devy / EdGui.scale;
		mouse.wx = cam.x + mouse.devx / z;
		mouse.wy = cam.y + mouse.devy / z;
		const mmoved = mouse.devx !== this.lastDevX || mouse.devy !== this.lastDevY;
		this.lastDevX = mouse.devx;
		this.lastDevY = mouse.devy;
		const wh = Math.sign(inp.wheel);

		if (EdGui.needLyrGuiReset) {
			EdGui.needLyrGuiReset = false;
			EdGui.page();
		}
		if (inp.ctrl && inp.keysPressed.has("F12")) this.drawBdSprites = !this.drawBdSprites;
		// fold or unfold every group at once
		if (inp.ctrl && inp.shift && (inp.keysPressed.has("ArrowLeft") || inp.keysPressed.has("ArrowRight"))) {
			const folding = inp.keysPressed.has("ArrowLeft");
			for (const lyr of room.layers) {
				const grp = lyr.group !== undefined ? room.lgroups[lyr.group] : undefined;
				if (grp !== undefined && lyr === grp.col_head_lyr) EdGui.fold(lyr, folding);
			}
		}
		if (!inp.alt && inp.keysPressed.has("PageUp")) EdGui.page(-1);
		if (!inp.alt && inp.keysPressed.has("PageDown")) EdGui.page(1);
		// a tap of space toggles showing as the player, holding it shows only while held
		if (inp.keysPressed.has("Space")) {
			this.showAsPlayer = !this.showAsPlayer;
			this.spaceAt = currentTime();
		}
		if (inp.keysReleased.has("Space") && currentTime() - this.spaceAt >= ED_SPACE_HOLD_MS) {
			this.showAsPlayer = !this.showAsPlayer;
		}

		// the overlay takes nothing while the view is being dragged
		const ingui = this.pan ? false : EdGui.step();

		if (!ingui) {
			if (inp.alt && wh !== 0) EdGui.rotate(wh);
			if (inp.pressed.middle) {
				const now = currentTime();
				if (now - this.lastMiddle < ED_DOUBLE_MIDDLE_MS) {
					// the whole room in view
					cam.w = room.roomw;
					EdView.centerOn(room.roomw / 2, room.roomh / 2);
				} else if (inp.ctrl || inp.alt) {
					// Control centres on the click. Alt switches between the whole room and one room
					// pixel to a screen pixel, as the original did; when that zooms in it first centres on
					// the click the same way, and either way it then resizes about the view's middle.
					const neww = inp.ctrl ? cam.w : (cam.w === room.roomw ? this.canvas.width : room.roomw);
					if (inp.ctrl || neww < cam.w) {
						cam.x = mouse.wx - cam.w / 2;
						cam.y = mouse.wy - EdView.camH() / 2;
					}
					const midx = cam.x + cam.w / 2;
					const midy = cam.y + EdView.camH() / 2;
					cam.w = neww;
					cam.x = midx - cam.w / 2;
					cam.y = midy - EdView.camH() / 2;
				} else {
					this.pan = true;
					this.panCamX = cam.x;
					this.panCamY = cam.y;
					this.panMouseX = mouse.devx / z;
					this.panMouseY = mouse.devy / z;
				}
				this.lastMiddle = now;
			}
			// Control and the wheel zooms, as in the original. The plain wheel picks through a stack
			// of hovers there, and zooms when there is no stack.
			if (wh !== 0 && inp.ctrl && !inp.shift && !inp.alt) EdView.zoom(-wh);
			if (wh !== 0 && !inp.ctrl && !inp.shift && !inp.alt) {
				const n = this.hovers.length;
				if (n > 1) {
					this.curhoveri = (this.curhoveri - wh + n) % n;
					this.markHover();
				} else {
					EdView.zoom(-wh);
				}
			}
		}
		if (this.pan) {
			cam.x = this.panCamX - (mouse.devx / z - this.panMouseX);
			cam.y = this.panCamY - (mouse.devy / z - this.panMouseY);
		}
		if (inp.released.middle) this.pan = false;

		// What is under the mouse, when it or the view moved: the top one marked unless the stack is
		// the same.
		if ((mmoved || wh !== 0) && !this.pan) {
			EdView.lenses();
			const found = ingui ? [] : EdView.findHovers(inp.alt);
			const same = found.length === this.hovers.length && found.every((rec, i) => rec === this.hovers[i]);
			if (!same) {
				this.hovers = found;
				this.curhoveri = found.length - 1;
				this.markHover();
			}
		}

		if (EdGui.focuson !== null) {
			EdGui.focus(EdGui.focuson);
			EdGui.focuson = null;
		}
	},

	// Marks the picked hover, and without alt, the rest of the last group it belongs to.
	markHover() {
		for (const lyr of this.room.layers) {
			for (const rec of lyr.lsprites) rec.hover = false;
		}
		const rec = this.hovers[this.curhoveri];
		if (rec === undefined) return;
		rec.hover = true;
		if (this.inp.alt || rec.groups === null || rec.groups.length === 0) return;
		for (const member of this.room.objGroups[rec.groups[rec.groups.length - 1]]) member.hover = true;
	}
};
