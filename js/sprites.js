// Sprite records: size, origin, collision mask, animation speed and sheet frames.
// Every sprite is a record by name. The facts for all of them come from sprites/src/index.json,
// so sizes and masks are right from the start. Pictures come from one of two places:
//   packed: sheets listed in sprites/sheets.json, one per group of related sprites
//   loose:  one horizontal strip png and one json per sprite under sprites/src/<group>/
// In packed mode a sprite that is not on a sheet falls back to its loose files.
// Both ways fill the same record, so nothing outside this file can tell them apart.

// "packed" or "loose", the page address can override it with ?packed or ?loose
const SPRITE_SOURCE = "packed";

const SPRITE_DIR = "sprites/";

// Sprites whose names start like this are always loaded before play begins in loose mode,
// so the characters do not flash as boxes while their poses arrive.
const SPRITE_PRELOAD_PREFIXES = ["guy_", "tem_"];

// The engine's own interface sprites. No room places them, so they are always loaded before play
// begins, from a sheet when one has them and loose otherwise.
const SPRITE_ALWAYS_LOAD = ["sBgBlox3", "sBgBlox_btm_out", "s_msg_done"];

// size used for any level sprite that is neither in the index nor guessed
const UNKNOWN_SPRITE_SIZE = 16;

// Sprites a room can place that are not in the converted set, with a guessed size and a mask
// of the whole picture, so they show as a faint box until their art arrives.
const SPRITE_GUESSES = {};

// picks the source from the page address when there is one
function spriteSourceFromAddress() {
	if (typeof location === "undefined") return SPRITE_SOURCE;
	const q = location.search || "";
	if (/[?&]loose\b/.test(q)) return "loose";
	if (/[?&]packed\b/.test(q)) return "packed";
	return SPRITE_SOURCE;
}

// A stored mask is measured from the frame's top left. The rest of the game uses the same box
// or circle measured from the origin, so the loader shifts it once here.
function maskFromStored(mask, ox, oy) {
	if (!mask) return mask;
	const out = Object.assign({}, mask);
	if (out.x !== undefined) out.x = out.x - ox;
	if (out.y !== undefined) out.y = out.y - oy;
	return out;
}

// Every sprite name a saved room places, found by reading the text, so they can be loaded first.
function spriteNamesInRoom(text) {
	const names = new Set();
	const re = /"spi"\s*:\s*"([^"]+)"/g;
	let m;
	while ((m = re.exec(text)) !== null) names.add(m[1]);
	return [...names];
}

// Holds every sprite record by name and the loaded pictures.
const Sprites = {
	records: {},
	mode: "packed",
	readJson: null,
	loadImage: null,
	// loose strips already asked for, by group and name, so each is fetched once
	pending: {},

	// Reads the index, then in packed mode the sheets, then loads the wanted names that are still loose.
	// The readers are handed in so the same code runs in the page and in a test harness.
	// When a progress is given, each sheet counts on it as it arrives.
	async load(readJson, loadImage, wanted, mode, progress) {
		this.readJson = readJson;
		this.loadImage = loadImage;
		this.mode = mode || spriteSourceFromAddress();
		this.records = {};
		this.pending = {};

		const index = (await readJson(SPRITE_DIR + "src/index.json")).sprites;
		for (const name of Object.keys(index)) {
			const s = index[name];
			this.records[name] = this.makeRecord(name, s, s.group);
		}

		if (this.mode === "packed") {
			const list = (await readJson(SPRITE_DIR + "sheets.json")).sheets;
			if (progress) progress.expect(list.length);
			await Promise.all(list.map(async (entry) => {
				const sheet = await readJson(SPRITE_DIR + entry.file);
				const image = await loadImage(SPRITE_DIR + sheet.image_file);
				for (const name of Object.keys(sheet.sprites)) {
					const rec = this.records[name];
					if (!rec) continue;
					const s = sheet.sprites[name];
					rec.frames = s.frames;
					rec.image = image;
					rec.state = "packed";
				}
				if (progress) progress.done();
			}));
		}

		for (const name of Object.keys(SPRITE_GUESSES)) {
			if (this.records[name]) continue;
			const g = SPRITE_GUESSES[name];
			this.records[name] = {
				name: name, w: g.w, h: g.h, ox: 0, oy: 0,
				mask: { kind: "rect", w: g.w, h: g.h, x: 0, y: 0, rotates: false },
				imageSpeed: 1, frameCount: 1, frames: null, image: null, state: "guessed", guessed: true
			};
		}
		// the no mask sprite exists so carried things stop colliding
		this.records.sNoMask = { name: "sNoMask", w: 1, h: 1, ox: 0, oy: 0, mask: null, imageSpeed: 0, frameCount: 1, frames: null, image: null, state: "none", guessed: false };

		const eager = new Set([...(wanted || []), ...SPRITE_ALWAYS_LOAD]);
		if (this.mode === "loose") {
			for (const name of Object.keys(index)) {
				if (SPRITE_PRELOAD_PREFIXES.some((p) => name.startsWith(p))) eager.add(name);
			}
		}
		await this.ensure([...eager]);
	},

	// Waits until the named sprites that are still loose have their pictures,
	// so a room about to be entered does not flash empty while they arrive.
	ensure(names) {
		return Promise.all(names.map((name) => this.fetchLoose(name)));
	},

	// a record made from index facts, with frames laid out as in the loose strip
	makeRecord(name, s, group) {
		const frames = [];
		for (let i = 0; i < s.frames; i++) frames.push([i * s.w, 0, s.w, s.h]);
		return {
			name: name, w: s.w, h: s.h, ox: s.ox, oy: s.oy,
			mask: maskFromStored(s.mask, s.ox, s.oy), imageSpeed: s.image_speed, frameCount: s.frames, frames: frames,
			image: null, group: group, state: "index", guessed: false
		};
	},

	// Loads a sprite's loose strip unless it is already packed or loading.
	// The record is filled in place, so anything holding it sees the picture arrive.
	fetchLoose(name) {
		const rec = this.records[name];
		if (!rec || rec.state !== "index") return Promise.resolve();
		if (this.pending[name]) return this.pending[name];
		const base = SPRITE_DIR + "src/" + rec.group + "/" + name;
		this.pending[name] = (async () => {
			try {
				// the json beside the strip wins over the index, so a hand edited sprite shows at once
				const s = await this.readJson(base + ".json");
				const fresh = this.makeRecord(name, s, rec.group);
				rec.image = await this.loadImage(base + ".png");
				Object.assign(rec, fresh, { image: rec.image, state: "loose" });
			} catch (e) {
				rec.state = "failed";
				console.warn("sprite would not load: " + name, e);
			}
		})();
		return this.pending[name];
	},

	exists(name) {
		return name !== null && name !== undefined && this.records[name] !== undefined;
	},

	// The record if there is one, started loading if it is still waiting. Never invents a record.
	peek(name) {
		const rec = this.records[name];
		if (rec && rec.state === "index") this.fetchLoose(name);
		return rec;
	},

	// Every level sprite gets a record, unknown names get the default square so they still collide.
	get(name) {
		if (name === null || name === undefined) return null;
		let s = this.peek(name);
		if (!s) {
			const n = UNKNOWN_SPRITE_SIZE;
			s = this.records[name] = {
				name: name, w: n, h: n, ox: 0, oy: 0,
				mask: { kind: "rect", w: n, h: n, x: 0, y: 0 },
				imageSpeed: 1, frameCount: 1, frames: null, image: null, state: "unknown",
				guessed: true, unknown: true
			};
		}
		return s;
	},

	// number of animation frames, one for sprites without a sheet
	frameCount(name) {
		const s = this.records[name];
		return s ? s.frameCount : 1;
	}
};
