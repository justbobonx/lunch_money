// The game shell: loads the world, the sprites and the fonts, then runs the world at a fixed
// rate whatever the display rate. Each step is followed by its draw, as in the original,
// where drawing is part of every frame and some things only move or animate as they draw.
// Sound, scripts, effects, pop up messages and the inventory are stand ins here that log
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

// Debug keys, held with control (or command). The browser's own meaning of them is blocked.
// The first restarts the room fresh with the player alive at its start spot, the second brings
// the player back alive where they stand with everything else about them reset.
const DEBUG_KEY_RESTART_ROOM = "KeyR";
const DEBUG_KEY_REVIVE_PLAYER = "KeyE";

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
	splash(who) {
		this.todo("water splash");
	},
	particles(kind, who, x, y) {
		this.todo("particles: " + kind);
		return null;
	},
	sound(name) {
		this.todo("sound " + name);
	},
	popMessage(who, text, offx, offy) {
		this.todo("pop up message");
	},
	say(who, text) {
		this.todo("speech bubbles");
	},
	// A script given by name is looked up in the world's script file. Running them is a later stage.
	runScript(script, who, skippable, skipScript) {
		if (typeof script === "string" && game.script_defs[script] === undefined) {
			this.todo("script not in the world's script file: " + script);
			return;
		}
		this.todo("scripts");
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

// The debug keys. The keys are caught ahead of everything else so the browser and the game
// never see them, and what they ask for happens at the start of the next frame, between updates.
const Debug = {
	pending: null,

	attach(target) {
		target.addEventListener("keydown", (e) => {
			if (!(e.ctrlKey || e.metaKey)) return;
			if (e.code === DEBUG_KEY_RESTART_ROOM) this.pending = "restart";
			else if (e.code === DEBUG_KEY_REVIVE_PLAYER) this.pending = "revive";
			else return;
			e.preventDefault();
			e.stopImmediatePropagation();
		}, true);
	},

	update() {
		const what = this.pending;
		this.pending = null;
		if (what === null || game.curroom === null) return;

		if (what === "restart") {
			// the world cleared and the room started again, as the room picker does
			if (game.enterRoom(game.curroomi)) Save.write();
		} else if (game.guy !== null) {
			game.guy.reviveInPlace();
			game.settleGuy();
			Save.write();
		}
	}
};

const Shell = {
	lastTime: 0,
	acc: 0,

	async start(canvas) {
		const ctx = canvas.getContext("2d");
		Draw.attach(ctx);
		Debug.attach(window);
		Input.attach(window);
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

		// a room asked for in the address wins over the save
		let startName = startRoomFromAddress();
		const saved = startName === undefined ? Save.read() : null;
		if (saved !== null) startName = saved.room;
		const roomText = await game.loadFiles(readText, startName);
		await Sprites.load(readJson, loadImage, spriteNamesInRoom(roomText));
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
				game.draw();
				roomPicker.draw();
				this.acc -= stepMs;
				steps++;
			}
			// too far behind, drop the rest rather than spiral
			if (steps === MAX_CATCHUP_STEPS) this.acc = 0;
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	}
};
