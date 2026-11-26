// The editor itself: getting at the game's folder, loading the world and a room, the input of each
// step, saving and reading the room again, and the frame loop that draws the room and the overlay.
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
// A room added from the room list and not saved yet is the original's new room: one area's backdrop,
// back, main and front layers with the main one current, the view at the top left. Until named it
// takes this name, with a number after it when that is taken.
const ED_NEW_ROOM_TEXT = '{ "curlyri": "2", "layers": [ { "name": "a.bd", "spriteList": [] }, { "name": "a.bg", "spriteList": [] }, '
	+ '{ "name": "a.", "spriteList": [] }, { "name": "a.fg", "spriteList": [] } ] }';
const ED_NEW_ROOM_NAME = "room";
// keys whose browser meaning would get in the way, always, and while a field is being edited
const ED_KEPT_KEYS = ["Space", "Tab", "PageUp", "PageDown", "AltLeft", "AltRight", "Escape", "F11", "F12",
	"Home", "End", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Delete", "Backspace", "Quote", "Slash"];

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
	// whether the mouse is over the canvas, so the editor's own mouse is drawn only then
	mouseIn: false,
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
		// every key going down this step in order, held keys repeating, for the field being edited
		typed: [],
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
	// Ctrl F11 outlines the area bounds and stay in boxes
	drawBounds: false,
	// what is under the mouse, the one the wheel picked out of a stack, and how many
	hovers: [],
	curhoveri: 0,
	// animation time: frames passed in the game's frame rate, and this frame's share
	frames: 0,
	steps: 0,
	lastTime: 0,
	fpsHist: GAME_FPS,
	// a short note after the status line, of loading or saving trouble
	debugtxt: "",
	// The world file as read and the name counter it keeps, with the counter and the room list as
	// last saved, so the world is only saved again once new names were handed out or rooms added. A
	// room missing from the saved list has no file yet.
	world: { data: null, curuid: 0, savedCuruid: 0, savedRooms: [] },
	// whether the mouse is on the overlay this step, and whether the hovers must be found again
	// though the mouse stayed put, after entries went away
	ingui: false,
	rehover: false,
	// a question being asked in its dialog, which holds the step until answered
	asking: false,
	saving: false,

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
			// over a dialog on top of the canvas the browser's own arrow shows instead
			this.mouseIn = e.target === canvas;
			mods(e);
		};
		canvas.addEventListener("mouseleave", () => {
			this.mouseIn = false;
		});
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
			// down is one step forward, as in the original
			inp.wheel += Math.sign(e.deltaY);
			e.preventDefault();
		}, { passive: false });
		canvas.addEventListener("contextmenu", (e) => e.preventDefault());
		window.addEventListener("keydown", (e) => {
			// the browser's print, and its back and forward on alt and the side arrows, never come up,
			// even while a question or the settings panel has the keys
			if (((e.ctrlKey || e.metaKey) && e.code === "KeyP") || (e.altKey && (e.code === "ArrowLeft" || e.code === "ArrowRight"))) e.preventDefault();
			// a question, or typing in the settings panel, keeps every key from the editor
			if (this.asking || EdPanel.el.contains(document.activeElement)) return;
			mods(e);
			// control letters are the editor's own, saving and reading again among them, and a field
			// being edited takes every key
			if (ED_KEPT_KEYS.includes(e.code) || ((e.ctrlKey || e.metaKey) && /^Key[A-Z]$/.test(e.code)) || EdGui.edit !== null) {
				e.preventDefault();
			}
			inp.typed.push({ code: e.code, key: e.key, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey });
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
		// leaving the page with changes not saved asks first
		window.addEventListener("beforeunload", (e) => {
			if (this.room === null || !EdEdit.dirty()) return;
			e.preventDefault();
			e.returnValue = "";
		});

		// the help first, so escape closes it before the settings panel
		EdHelp.install();
		EdPanel.install();
		EdLink.start();
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
		// the world file again for saving, and the picker's object list, which may be missing
		try {
			const data = EdFile.parse(await EdFolder.readText(WORLD_FILE));
			const uid = parseInt(data.curuid, 16) || 0;
			this.world = { data: data, curuid: uid, savedCuruid: uid, savedRooms: [] };
		} catch (e) {
			this.world = { data: null, curuid: game.curuid, savedCuruid: game.curuid, savedRooms: [] };
		}
		this.world.savedRooms = game.rooms.map((rm) => rm.name);
		let list = { objects: {} };
		try {
			list = await EdFolder.readJson(ED_OBJECT_LIST_FILE);
		} catch (e) {
			console.log("no " + ED_OBJECT_LIST_FILE + ", so the picker has no objects to offer");
		}
		EdPicker.load(list);
		this.loading = false;
		this.debugtxt = "";
		let rmi = game.findRoomIndex(localStorage.getItem(ED_LAST_ROOM_KEY) || START_ROOM_NAME);
		if (rmi < 0) rmi = game.findRoomIndex(START_ROOM_NAME);
		await this.openRoom(rmi < 0 ? 0 : rmi);
	},

	// Reads a room's file fresh, or starts a room with no file yet as a new room, loads its sprites,
	// and builds it to look at, with the camera where the room was saved looking. Leaving the room
	// asks first, unless told the changes are already dealt with; when that lets go of a room never
	// saved and it was the one asked for, the start room opens instead.
	async openRoom(rmi, settled) {
		if (this.loading || rmi < 0 || rmi >= game.rooms.length) return;
		let name = game.rooms[rmi].name;
		if (!settled && !(await this.leaveRoom())) return;
		if (game.findRoomIndex(name) < 0) name = START_ROOM_NAME;
		rmi = game.findRoomIndex(name);
		if (rmi < 0) return;
		this.loading = true;
		try {
			const text = this.world.savedRooms.includes(name) ? await EdFolder.readText(ROOM_DIR + "room_" + name + ".dat") : ED_NEW_ROOM_TEXT;
			await Sprites.ensure(spriteNamesInRoom(text));
			const room = EdRoom.build(rmi, text);
			this.cam.w = room.camw;
			this.cam.x = room.camx;
			this.cam.y = room.camy + room.camw * ED_GM_VIEW_H / ED_GM_VIEW_W / 2 - EdView.camH() / 2;
			this.adoptRoom(room);
		} catch (e) {
			this.loading = false;
			this.debugtxt = " room " + name + " would not load: " + e.message;
			console.log(e);
			return;
		}
		this.loading = false;
		this.debugtxt = "";
		EdEdit.reset();
		// a room with no file yet stays unsaved however it is read again
		if (!this.world.savedRooms.includes(name)) EdEdit.touch();
		this.lastDevX = -1;
		localStorage.setItem(ED_LAST_ROOM_KEY, name);
	},

	// Leaving the room with changes asks to save them, let them go, or stay. A room never saved that
	// is let go leaves the world's room list again. Tells whether to go on.
	async leaveRoom() {
		const room = this.room;
		if (room === null || !EdEdit.dirty()) return true;
		const answer = await this.ask("Room " + room.name + " has changes that are not saved.", ["Save", "Discard", "Cancel"]);
		if (answer === "Cancel") return false;
		if (answer === "Save") return await this.save();
		if (!this.world.savedRooms.includes(room.name) && game.rooms[room.index] !== undefined && game.rooms[room.index].name === room.name) {
			game.rooms.splice(room.index, 1);
			game.roombyname = {};
			game.rooms.forEach((rm, i) => {
				game.roombyname[rm.name] = i;
			});
		}
		return true;
	},

	// The room list's add row, as the original's: after leaving the room, a new room at the end of
	// the world's list, opened unsaved, its name asked for in the header at once. A world read
	// without its file can't keep new rooms, so none are added then.
	async addRoom() {
		if (this.loading) return;
		if (this.world.data === null) {
			this.debugtxt = " no world file to add a room to";
			return;
		}
		if (!(await this.leaveRoom())) return;
		let name = ED_NEW_ROOM_NAME;
		for (let n = 2; game.findRoomIndex(name) >= 0; n++) name = ED_NEW_ROOM_NAME + n;
		game.rooms.push(new Room(name));
		game.roombyname[name] = game.rooms.length - 1;
		await this.openRoom(game.rooms.length - 1, true);
		if (this.room === null || this.room.name !== name) return;
		EdGui.startEdit("header", null, "", false, false, false, false);
	},

	// Takes up a room just built, from its file, an undo step or a panel change, leaving the camera
	// alone: its layers, folds and filters as it keeps them, how its layers map onto the screen
	// worked out at once, so its entries can be measured before the next frame draws, and nothing
	// under the mouse until found again.
	adoptRoom(room) {
		this.room = room;
		EdView.lenses();
		EdGui.roomLoaded();
		EdPicker.roomLoaded(room);
		this.hovers = [];
		this.curhoveri = 0;
		this.rehover = true;
	},

	// What the room file keeps of the editor: the camera as the original's top left and width, the
	// current layer and the picker's filters.
	fileState() {
		const cam = this.cam;
		const flt = EdPicker.filters();
		return {
			camx: cam.x,
			camy: cam.y + EdView.camH() / 2 - cam.w * ED_GM_VIEW_H / ED_GM_VIEW_W / 2,
			camw: cam.w,
			curlyri: this.curlayeri,
			last_sp_flt: flt.sprite,
			last_ob_flt: flt.object
		};
	},

	// Saves the room, its area bounds made again first while auto bounds is on, and the world when
	// new names were handed out or the room list changed, each
	// with a backup of the file before, then tells the player tabs switched on, with control shift P's
	// drop for the tab this editor opened when given one. Tells whether it all went.
	async save(drop) {
		const room = this.room;
		if (room === null || this.saving) return false;
		this.saving = true;
		// with auto bounds on the area bounds are made again first, as their own undo step
		if (room.autogen) EdEdit.rebuildBounds();
		const rev = EdEdit.rev;
		try {
			await EdFolder.save(ROOM_DIR + "room_" + room.name + ".dat", EdFile.roomText(room, this.fileState()));
			const w = this.world;
			const names = game.rooms.map((rm) => rm.name);
			if (w.data !== null && (w.curuid !== w.savedCuruid || names.join("\n") !== w.savedRooms.join("\n"))) {
				const st = this.fileState();
				await EdFolder.save(WORLD_FILE, EdFile.worldText(w, { curroomi: room.index, camx: st.camx, camy: st.camy, camw: st.camw }));
				w.savedCuruid = w.curuid;
				w.savedRooms = names;
			}
		} catch (e) {
			this.saving = false;
			this.debugtxt = " save failed: " + e.message;
			console.log(e);
			await this.ask("Saving " + room.name + " failed: " + e.message, ["OK"]);
			return false;
		}
		this.saving = false;
		EdEdit.savedRev = rev;
		this.debugtxt = " saved " + room.name;
		// player tabs switched on in the players list read it again
		EdLink.saved(room.name, drop);
		return true;
	},

	// Asks a question in the page's dialog with a button for each answer, giving the answer pressed,
	// or the last one when the dialog is closed another way. The step waits meanwhile, and anything
	// held when it opened is let go.
	ask(text, answers) {
		const dlg = document.getElementById("ed_ask");
		const buttons = document.getElementById("ed_ask_buttons");
		document.getElementById("ed_ask_msg").textContent = text;
		buttons.textContent = "";
		this.asking = true;
		return new Promise((resolve) => {
			let answer = answers[answers.length - 1];
			for (const a of answers) {
				const b = document.createElement("button");
				b.textContent = a;
				b.onclick = () => {
					answer = a;
					dlg.close();
				};
				buttons.appendChild(b);
			}
			dlg.onclose = () => {
				const inp = this.inp;
				this.asking = false;
				inp.keysDown.clear();
				for (const b of ["left", "middle", "right"]) inp.down[b] = false;
				inp.shift = inp.ctrl = inp.alt = false;
				this.pan = false;
				resolve(answer);
			};
			dlg.showModal();
		});
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

	// One frame: animation time, the step, the room, the overlay, the help closed when showing as the
	// player, then this step's input cleared.
	frame(now) {
		const dt = this.lastTime === 0 ? 0 : now - this.lastTime;
		this.lastTime = now;
		this.steps = dt * GAME_FPS / 1000;
		this.frames += this.steps;
		if (dt > 0) this.fpsHist += (1000 / dt - this.fpsHist) * ED_FPS_SMOOTHING;
		if (this.room !== null && !this.loading && !this.asking) this.step();
		EdView.draw();
		EdGui.draw();
		EdView.drawMouse();
		if (this.showAsPlayer) EdHelp.show(false);

		const inp = this.inp;
		for (const b of ["left", "middle", "right"]) {
			inp.pressed[b] = false;
			inp.released[b] = false;
		}
		inp.wheel = 0;
		inp.typed.length = 0;
		inp.keysPressed.clear();
		inp.keysReleased.clear();
	},

	// The step's input, in the original's order: keys that work everywhere, then the overlay, then the
	// editing keys, then, when the mouse is not on the overlay, the view's own clicks and wheel, the
	// edits with the mouse, and the hovers. A field being edited holds every key.
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
		const editing = EdGui.edit !== null;
		if (!editing) this.alwaysKeys();

		// the overlay takes nothing while the view is being dragged
		const ingui = this.pan ? false : EdGui.step();
		this.ingui = ingui;
		if (inp.pressed.left) EdEdit.fromRoom = !ingui;
		// the editing keys, unless a field took them; showing every hidden entry ends the step
		const going = editing || EdGui.edit !== null || EdEdit.keys();
		// tab switches the picker's mode, or with F held steps through what was found, back with shift
		if (!editing && EdGui.edit === null && inp.keysPressed.has("Tab")) {
			if (inp.keysDown.has("KeyF")) EdEdit.showFound(inp.shift ? -1 : 1);
			else EdPicker.setMode((EdPicker.mode + 1) % ED_PICK_MODE_NAMES.length);
		}

		if (!ingui) {
			if (inp.alt && wh !== 0) EdGui.rotate(wh, inp.shift);
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
			// control and the wheel zooms, as in the original
			if (wh !== 0 && inp.ctrl && !inp.shift && !inp.alt) EdView.zoom(wh);
		}
		if (this.pan) {
			cam.x = this.panCamX - (mouse.devx / z - this.panMouseX);
			cam.y = this.panCamY - (mouse.devy / z - this.panMouseY);
		}
		if (inp.released.middle) this.pan = false;
		EdEdit.edgeScroll();
		if (!ingui && !this.pan && going) EdEdit.mouse(mmoved, wh);
		if (inp.released.left) EdPicker.dragging = false;

		// What is under the mouse, when it or the view moved or entries went: the top one marked
		// unless the stack is the same, then the path point, which a dragged one stays.
		if ((mmoved || wh !== 0 || this.rehover) && !this.pan) {
			this.rehover = false;
			EdView.lenses();
			const found = this.ingui ? [] : EdView.findHovers(inp.alt);
			const same = found.length === this.hovers.length && found.every((rec, i) => rec === this.hovers[i]);
			if (!same) {
				this.hovers = found;
				this.curhoveri = found.length - 1;
				this.markHover();
			}
			if (EdEdit.pathDrag === null) EdEdit.pathHot = this.ingui ? null : EdView.findPathPoint();
		}

		if (EdGui.focuson !== null) {
			EdGui.focus(EdGui.focuson.name, EdGui.focuson.others);
			EdGui.focuson = null;
		}
		// last, so the panel sees whether this step's press opened it or should close it
		EdPanel.step();
	},

	// The keys that work wherever the mouse is: the backdrops, the bounds overlay, folding every group, paging the layer
	// list, showing as the player, and saving or reading the room again.
	alwaysKeys() {
		const inp = this.inp;
		const room = this.room;
		if (inp.ctrl && inp.keysPressed.has("F12")) this.drawBdSprites = !this.drawBdSprites;
		if (inp.ctrl && inp.keysPressed.has("F11")) this.drawBounds = !this.drawBounds;
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

		// control S saves; control R saves and reads the room back; control L reads it back, asking
		// first when that would lose changes
		if (inp.ctrl && !inp.shift && inp.keysPressed.has("KeyS")) this.save();
		if (inp.ctrl && !inp.shift && inp.keysPressed.has("KeyR")) {
			this.save().then((ok) => {
				if (ok) this.openRoom(room.index, true);
			});
		}
		// Control P saves, then brings the player tab this editor opened to the front or opens one in
		// this room, as the original's play did. With shift it is the original's start at the mouse:
		// the player dropped on the current layer at the mouse, or at the view's middle when the mouse
		// is off the view, in the opened tab as it reloads or in the new one.
		if (inp.ctrl && inp.keysPressed.has("KeyP")) {
			const lyr = room.layers[this.curlayeri];
			let drop;
			if (inp.shift && lyr !== undefined) {
				const at = this.mouseIn ? EdView.mouseOn(lyr) : EdView.toLayer(lyr, this.cam.x + this.cam.w / 2, this.cam.y + EdView.camH() / 2);
				drop = { x: at.x, y: at.y, layer: lyr.name };
			}
			this.save(drop).then((ok) => {
				if (ok) EdLink.play(room.name, drop);
			});
		}
		if (inp.ctrl && !inp.shift && inp.keysPressed.has("KeyL")) {
			if (!EdEdit.dirty()) this.openRoom(room.index, true);
			else {
				this.ask("Read " + room.name + " again from its file and lose the changes?", ["Discard", "Cancel"]).then((answer) => {
					if (answer === "Discard" && this.room === room) this.openRoom(room.index, true);
				});
			}
		}
	},

	// Marks the picked hover, and without alt, the rest of its next group.
	markHover() {
		for (const lyr of this.room.layers) {
			for (const rec of lyr.lsprites) rec.hover = false;
		}
		const rec = this.hovers[this.curhoveri];
		if (rec === undefined) return;
		rec.hover = true;
		const gname = this.inp.alt ? null : EdEdit.nextGroup(rec);
		if (gname !== null) for (const member of this.room.objGroups[gname]) member.hover = true;
	}
};
