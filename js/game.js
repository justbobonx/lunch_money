// The game shell: loads the world, the sprites and the fonts, then runs the world at a fixed
// rate whatever the display rate. Each browser frame runs the updates that are due, then draws
// once if any ran, telling the drawing how many it covers so animation keeps update pace.
// Sound and the inventory are stand ins here that log
// once what was asked of them, until their own stages exist.

// the most steps run to catch up after a slow frame
const MAX_CATCHUP_STEPS = 5;

// The saved game, kept in the browser: the room and the player's spot, layer and facing.
// The key it is kept under, and how many updates pass between saves. It is also saved when the room
// changes and when the page closes.
const SAVE_KEY = "lunch_money_save";
const SAVE_EVERY_UPDATES = 300;
// adding this to the page address clears the save and neither reads nor writes it that visit
const NO_SAVE_PARAM = "nosave";

// The loading screen on the page canvas while the object files and sprite sheets arrive: its
// background, text and bar colours, the text's font and gap above the bar, and the bar's size,
// all in display pixels.
const LOADING_BG_COLOR = "#101018";
const LOADING_TEXT_COLOR = "#ffffff";
const LOADING_BAR_COLOR = "#6688cc";
const LOADING_BAR_BACK_COLOR = "#303040";
const LOADING_FONT = "16px monospace";
const LOADING_TEXT_GAP = 12;
const LOADING_BAR_W = 320;
const LOADING_BAR_H = 8;

// Debug keys, all listed in the debug key table further down. The browser's own meaning of them
// is blocked. Tab switches the debug overlay and backspace shows the list, both without control.
// With control (or command): restart the room fresh with the player alive at its start spot,
// bring the player back alive where they stand with everything else about them reset,
// switch scanlines, and switch pixel perfect scaling against the smooth fit to the window.
const DEBUG_KEY_OVERLAY = "Tab";
const DEBUG_KEY_HELP = "Backspace";
const DEBUG_KEY_RESTART_ROOM = "KeyR";
const DEBUG_KEY_REVIVE_PLAYER = "KeyE";
const DEBUG_KEY_SCANLINES = "KeyF";
const DEBUG_KEY_PIXEL_PERFECT = "KeyS";
// With the arrows, the player hops this far that way, straight through anything in the way.
const DEBUG_HOP_DIST = 30;

// Where the scanline and pixel perfect switches are kept between visits, and how they start the
// first time. The overlay's own key and start are with the world and the drawing.
const SCANLINES_KEY = "lunch_money_scanlines";
const SCANLINES_AT_START = true;
const PIXEL_PERFECT_KEY = "lunch_money_pixel_perfect";
const PIXEL_PERFECT_AT_START = false;

// Calls out to systems that come in later stages. Each one logs the first time it is asked.
const Hooks = {
	told: {},
	// paths the movers report, shown by the debug overlay
	lines: [],

	todo(what) {
		if (this.told[what]) return;
		this.told[what] = true;
		console.log("not yet: " + what);
	},
	debugLine(x1, y1, x2, y2, color) {
		if (game.drawStats) this.lines.push({ x1: x1, y1: y1, x2: x2, y2: y2, color: color });
	},
	sound(name) {
		this.todo("sound " + name);
	},
	// A pop up message above someone, or at a room spot when who is 0, by default a little above
	// the top of their sprite. Text that is a list shows one after another. The options can set its
	// fade start and time, float speeds, backing and its colour, text colour, fade, and quick print,
	// which shows the whole text at once. Gives back the message.
	popMessage(who, text, offx, offy, opts) {
		if (who === undefined || who === null || text === undefined) return undefined;
		const o = opts || {};
		let mx = 0;
		let my = 0;
		if (who !== 0) {
			const rec = who.spi ? Sprites.peek(who.spi) : null;
			mx = who.x;
			my = who.y - (rec ? rec.oy : 0) - 2;
		}
		mx += offx !== undefined ? offx : 0;
		my += offy !== undefined ? offy : -10;

		const cfg = { x: mx, y: my, sayer: who, center: true };
		if (Array.isArray(text)) cfg.text_list = text;
		else cfg.text = text;
		for (const k of ["fadestart", "fadetime", "floatspdx", "floatspdy", "drawbg", "bgcolor", "alpha"]) {
			if (o[k] !== undefined) cfg[k] = o[k];
		}
		if (o.textcolor !== undefined) cfg.color = o.textcolor;

		const msg = game.createObject(oPuMsg, cfg, game.popupLayer);
		if (o.quick_print) msg.endTexting();
		return msg;
	},
	say(who, text) {
		this.todo("speech bubbles");
	},
	// Starts a script running for someone, the actor, and takes its first step now. A script or a
	// skip script given by name is looked up in the world's script file. The caller is whoever
	// started it, usually a trigger, and is what the script means by itself. When done is given,
	// it is called once the script finishes. Gives back the runner.
	runScript(script, who, skippable, skipScript, done, caller) {
		if (typeof script === "string") {
			if (game.script_defs[script] === undefined) {
				this.todo("script not in the world's script file: " + script);
				return undefined;
			}
			script = game.script_defs[script];
		}
		if (!Array.isArray(script)) return undefined;
		if (typeof skipScript === "string") skipScript = game.script_defs[skipScript];
		// a single action stands for a script of one
		if (script.length > 0 && !Array.isArray(script[0])) script = [script];

		// kept in the system layer no room switches off, so it carries on through a room change
		const runner = game.createObject(oScripty, {
			x: caller && typeof caller.x === "number" ? caller.x : 0,
			y: caller && typeof caller.y === "number" ? caller.y : 0,
			trigger: caller !== undefined ? caller : null,
			script: script,
			actor: game.lookupInst(who, caller) || null,
			skippable: truthy(skippable),
			skipScript: Array.isArray(skipScript) ? skipScript : -1,
			onDone: done !== undefined ? done : null
		}, game.etcLayer !== null ? game.etcLayer : undefined);
		runner.update();
		return runner;
	}
};

// Counts the files still to arrive and draws the loading screen each time the count changes.
// The first frame of play draws over it, so it is gone once the first room is built.
const Loading = {
	total: 0,
	loaded: 0,

	expect(count) {
		this.total += count;
		this.draw();
	},
	done() {
		this.loaded++;
		this.draw();
	},

	draw() {
		const ctx = Draw.ctx;
		// kept apart from the game's own draw state
		ctx.save();
		ctx.setTransform(Draw.screenScale, 0, 0, Draw.screenScale, 0, 0);
		ctx.globalAlpha = 1;
		ctx.fillStyle = LOADING_BG_COLOR;
		ctx.fillRect(0, 0, DISPLAY_W, DISPLAY_H);

		const barx = Math.floor((DISPLAY_W - LOADING_BAR_W) / 2);
		const bary = Math.floor((DISPLAY_H - LOADING_BAR_H) / 2);
		ctx.fillStyle = LOADING_TEXT_COLOR;
		ctx.font = LOADING_FONT;
		ctx.textAlign = "center";
		ctx.textBaseline = "bottom";
		ctx.fillText("Loading", DISPLAY_W / 2, bary - LOADING_TEXT_GAP);

		ctx.fillStyle = LOADING_BAR_BACK_COLOR;
		ctx.fillRect(barx, bary, LOADING_BAR_W, LOADING_BAR_H);
		ctx.fillStyle = LOADING_BAR_COLOR;
		const share = this.total > 0 ? Math.min(this.loaded / this.total, 1) : 0;
		ctx.fillRect(barx, bary, Math.round(LOADING_BAR_W * share), LOADING_BAR_H);
		ctx.restore();
	}
};

// The room to start in comes from the page address, as a room parameter, when one is given.
function startRoomFromAddress() {
	if (typeof location === "undefined") return undefined;
	const m = /[?&]room=([^&]*)/.exec(location.search || "");
	return m ? decodeURIComponent(m[1]) : undefined;
}

// The saved game. Nothing is saved while the player is dead, so a restore never puts them back
// in the middle of a pit. A browser that will not keep data just means nothing is saved.
const Save = {
	enabled: true,
	updates: 0,
	lastRoomi: -1,

	attach(target) {
		if (typeof location !== "undefined" && new RegExp("[?&]" + NO_SAVE_PARAM + "(&|=|$)").test(location.search || "")) {
			this.enabled = false;
			try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing kept */ }
			console.log("save cleared and off for this visit");
		}
		target.addEventListener("beforeunload", () => this.write());
		target.addEventListener("pagehide", () => this.write());
	},

	// The saved game, or nothing when there is none, it is off, or it does not read right.
	read() {
		if (!this.enabled) return null;
		try {
			const text = localStorage.getItem(SAVE_KEY);
			if (text === null) return null;
			const sv = JSON.parse(text);
			if (sv.world !== WORLD_NAME || typeof sv.room !== "string" || typeof sv.x !== "number" || typeof sv.y !== "number") return null;
			return sv;
		} catch (e) {
			return null;
		}
	},

	write() {
		if (!this.enabled || game.curroom === null || game.guy === null || truthy(game.guy.dead)) return;
		const guy = game.guy;
		const sv = {
			world: WORLD_NAME, room: game.curroom.name, x: guy.x, y: guy.y,
			layer: guy.mylayer ? guy.mylayer.name : undefined, facing: guy.facing, facingy: guy.facingy
		};
		try { localStorage.setItem(SAVE_KEY, JSON.stringify(sv)); } catch (e) { /* nothing kept */ }
	},

	// Each update: saves on a change of room, and every so often.
	update() {
		if (game.curroomi !== this.lastRoomi) {
			this.lastRoomi = game.curroomi;
			this.updates = 0;
			this.write();
		} else if (++this.updates >= SAVE_EVERY_UPDATES) {
			this.updates = 0;
			this.write();
		}
	}
};

// The debug key table, the one list both the key catching and the help read. Each has the keys
// that set it off, whether control is held, how the help names the keys and what it does, and
// what it does, run between updates. Switches also have their setting, where it is kept between
// visits and how it starts, and flipping one keeps the new setting. Holding a key down repeats only
// the hops.
const DEBUG_KEYS = [
	{
		codes: [DEBUG_KEY_OVERLAY], ctrl: false, keys: "Tab", label: "debug overlay",
		kept: DEBUG_OVERLAY_KEY, start: DRAW_STATS_AT_START,
		get: () => game.drawStats,
		set: (on) => { game.drawStats = on; }
	},
	{
		codes: [DEBUG_KEY_RESTART_ROOM], ctrl: true, keys: "ctrl R", label: "restart room",
		// the world cleared and the room started again, as the room picker does
		act: () => {
			if (game.curroom !== null && game.enterRoom(game.curroomi)) Save.write();
		}
	},
	{
		codes: [DEBUG_KEY_REVIVE_PLAYER], ctrl: true, keys: "ctrl E", label: "revive",
		act: () => {
			if (game.curroom === null || game.guy === null) return;
			game.guy.reviveInPlace();
			game.settleGuy();
			// every particle goes, the blood with the rest, as the original did on its revive
			for (const o of game.instances) {
				if (o instanceof oFxParticler) o.particles.length = 0;
			}
			Save.write();
		}
	},
	{
		codes: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"], ctrl: true, keys: "ctrl arrows", label: "hop",
		repeats: true,
		// a plain jump to the new spot with all motion dropped, so the movers see no travel
		act: (code) => {
			if (game.curroom === null || game.guy === null) return;
			const guy = game.guy;
			if (code === "ArrowLeft") guy.x -= DEBUG_HOP_DIST;
			else if (code === "ArrowRight") guy.x += DEBUG_HOP_DIST;
			else if (code === "ArrowUp") guy.y -= DEBUG_HOP_DIST;
			else guy.y += DEBUG_HOP_DIST;
			guy.xspd = 0;
			guy.yspd = 0;
			guy.rx = 0;
			guy.ry = 0;
			guy.lastx = guy.x;
			guy.lasty = guy.y;
		}
	},
	{
		codes: [DEBUG_KEY_SCANLINES], ctrl: true, keys: "ctrl F", label: "scanlines",
		kept: SCANLINES_KEY, start: SCANLINES_AT_START,
		get: () => Draw.scanlines,
		set: (on) => { Draw.scanlines = on; }
	},
	{
		codes: [DEBUG_KEY_PIXEL_PERFECT], ctrl: true, keys: "ctrl S", label: "pixel perfect",
		kept: PIXEL_PERFECT_KEY, start: PIXEL_PERFECT_AT_START,
		get: () => Draw.pixelPerfect,
		// the canvas fits again at once, as a window resize does
		set: (on) => {
			Draw.pixelPerfect = on;
			Shell.fit();
		}
	},
	{
		codes: [DEBUG_KEY_HELP], ctrl: false, keys: "Backspace", label: "this help",
		act: () => { Debug.helpOpen = !Debug.helpOpen; }
	}
];

// The debug keys. The keys are caught ahead of everything else so the browser and the game
// never see them, their releases included, so a debug key that shares a letter with a game button
// never shows the game a press or a release. What they ask for happens at the start of the next
// frame, between updates.
const Debug = {
	pending: null,
	// keys caught on the way down whose release is caught too
	held: {},
	helpOpen: false,

	// Brings back the switches as they were last left, then listens for the keys.
	attach(target) {
		for (const d of DEBUG_KEYS) {
			if (!d.kept) continue;
			let kept = null;
			try { kept = localStorage.getItem(d.kept); } catch (e) { /* nothing kept */ }
			d.set(kept === null ? d.start : kept === "1");
		}
		target.addEventListener("keydown", (e) => {
			const d = DEBUG_KEYS.find((k) => k.codes.includes(e.code) && k.ctrl === (e.ctrlKey || e.metaKey));
			if (d === undefined) return;
			e.preventDefault();
			e.stopImmediatePropagation();
			// a key the game already saw go down keeps its release, so it is not left stuck down
			if (!Input.down[e.code]) this.held[e.code] = true;
			if (!e.repeat || d.repeats) this.pending = { entry: d, code: e.code };
		}, true);
		target.addEventListener("keyup", (e) => {
			if (!this.held[e.code]) return;
			this.held[e.code] = false;
			e.stopImmediatePropagation();
		}, true);
	},

	update() {
		const p = this.pending;
		this.pending = null;
		if (p === null) return;
		const d = p.entry;
		if (!d.kept) {
			d.act(p.code);
			return;
		}
		d.set(!d.get());
		try { localStorage.setItem(d.kept, d.get() ? "1" : "0"); } catch (e) { /* nothing kept */ }
	}
};

const Shell = {
	lastTime: 0,
	acc: 0,
	canvas: null,

	// The canvas fits the window, on a resize and when the scaling switch flips.
	fit() {
		Draw.fitCanvas(this.canvas, window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
	},

	async start(canvas) {
		this.canvas = canvas;
		// the switches come back first, so the first fit already knows how to scale
		Debug.attach(window);
		this.fit();
		window.addEventListener("resize", () => this.fit());
		Input.attach(window, canvas);
		Save.attach(window);
		roomPicker.attach(canvas);

		const readText = (path) => fetch(path).then((r) => {
			if (!r.ok) throw new Error(path + " " + r.status);
			return r.text();
		});
		const readJson = (path) => readText(path).then((t) => JSON.parse(t));
		const loadImage = (path) => new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = reject;
			img.src = path;
		});
		const loadScript = (path) => new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.onload = resolve;
			script.onerror = () => reject(new Error(path));
			script.src = path;
			document.head.appendChild(script);
		});

		Loading.draw();

		// a room asked for in the address wins over the save
		let startName = startRoomFromAddress();
		const saved = startName === undefined ? Save.read() : null;
		if (saved !== null) startName = saved.room;
		const roomText = await game.loadFiles(readText, startName, loadScript, Loading);
		await Sprites.load(readJson, loadImage, spriteNamesInRoom(roomText), undefined, Loading);
		await Draw.loadFonts(readJson, loadImage);
		game.start(startName);
		// back to where they were, unless the saved room was not there to start in
		if (saved !== null && game.curroom !== null && game.guy !== null && game.curroom.name === saved.room) {
			game.placeGuyAt(saved.x, saved.y, saved.layer, saved.facing, saved.facingy);
		}

		const stepMs = 1000 / GAME_FPS;
		const tick = (now) => {
			if (this.lastTime === 0) this.lastTime = now;
			this.acc += now - this.lastTime;
			this.lastTime = now;
			let steps = 0;
			while (this.acc >= stepMs && steps < MAX_CATCHUP_STEPS) {
				// the room picker pauses the game while it is up
				Debug.update();
				if (roomPicker.update()) {
					game.step();
					Save.update();
				}
				this.acc -= stepMs;
				steps++;
			}
			// too far behind, drop the rest rather than spiral
			if (steps === MAX_CATCHUP_STEPS) this.acc = 0;
			if (steps > 0) {
				Draw.frameSteps = steps;
				game.draw();
				roomPicker.draw();
			}
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	}
};
