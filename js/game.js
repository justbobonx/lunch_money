// The game shell: loads the world, the sprites and the fonts, then runs the world at a fixed
// rate whatever the display rate. Each step is followed by its draw, as in the original,
// where drawing is part of every frame and some things only move or animate as they draw.
// Sound, scripts, effects, pop up messages and the inventory are stand ins here that log
// once what was asked of them, until their own stages exist.

// the most steps run to catch up after a slow frame
const MAX_CATCHUP_STEPS = 5;

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
	runScript(script, who, skippable, skipScript) {
		this.todo("scripts");
	}
};

const Shell = {
	lastTime: 0,
	acc: 0,

	async start(canvas) {
		const ctx = canvas.getContext("2d");
		Draw.attach(ctx);
		Input.attach(window);

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

		const roomText = await game.loadFiles(readText);
		await Sprites.load(readJson, loadImage, spriteNamesInRoom(roomText));
		await Draw.loadFonts(readJson, loadImage);
		game.start();

		const stepMs = 1000 / GAME_FPS;
		const tick = (now) => {
			if (this.lastTime === 0) this.lastTime = now;
			this.acc += now - this.lastTime;
			this.lastTime = now;
			let steps = 0;
			while (this.acc >= stepMs && steps < MAX_CATCHUP_STEPS) {
				game.step();
				game.draw();
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
