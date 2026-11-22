// Weather: rain, snow or fog drifting over the room, a port of the original's.
// The drops live on the screen, not in the room. Each moves by its own fall direction and speed,
// wraps around the view's size plus a margin each side, and is drawn shifted by the camera so it scrolls with the world.
// The drops are shared out evenly over the room's own layers that are switched on, leaving out
// overlay layers and the shared popup and overlay layers on top, so weather never covers the
// HUD or a popup. Each layer draws its share over its own content, and the higher a layer sits
// the faster its share moves, which gives a cheap sense of depth.
// Moving happens in the world's update, so it keeps update pace and stops while play is paused;
// drawing only places the drops.

// the kinds of weather, by the number scripts ask for
const WEATHER_NONE = 0;
const WEATHER_RAIN = 1;
const WEATHER_SNOW = 2;
const WEATHER_FOG = 3;

// Each kind: how many drops, its pictures with how often each is picked against the others,
// the fall direction range in degrees counterclockwise with zero to the right, and the speed
// range in pixels per update.
const WEATHER_KINDS = {
	[WEATHER_RAIN]: {
		count: 450,
		sprites: [["swRain1", 1], ["swRain2", 1]],
		angle: [225, 225],
		speed: [4, 5]
	},
	[WEATHER_SNOW]: {
		count: 400,
		sprites: [["swSnow1", 11], ["swSnow2", 1], ["swSnow3", 1]],
		angle: [210, 310],
		speed: [0.2, 0.5]
	},
	[WEATHER_FOG]: {
		count: 150,
		sprites: [["swFog1", 1], ["swFog2", 1], ["swFog3", 1]],
		angle: [180, 180],
		speed: [0.01, 0.1]
	}
};

// How far past each edge of the view the drops travel before wrapping, at least the widest
// weather picture, so a drop leaves fully offscreen and comes back in from fully offscreen.
const WEATHER_WRAP_MARGIN = 64;

// how many kinds there are counting none, for stepping through them
const WEATHER_KIND_COUNT = 4;

// The lowest weather layer moves its share at this part of their speed, and the share of each
// layer above adds up to this much more, spread evenly up the layers.
const WEATHER_LAYER_SPEED_BASE = 0.6;
const WEATHER_LAYER_SPEED_RISE = 0.4;

class Weather {
	constructor() {
		this.on = false;
		this.type = WEATHER_NONE;
		// each drop: its picture, its spot on the screen, and its move each update
		this.particles = [];
		// the layers the drops were last shared out over, bottom first, which the drawing follows
		this.layers = [];
	}

	// Starts a kind of weather with fresh drops scattered over the view, or stops it with none
	// or a number that is no kind.
	set_weather(type) {
		this.type = type;
		this.particles.length = 0;
		const kind = WEATHER_KINDS[type];
		this.on = kind !== undefined;
		if (!this.on) return;
		const cam = game.cam;
		let total = 0;
		for (const s of kind.sprites) total += s[1];
		for (let i = 0; i < kind.count; i++) {
			let pick = Math.random() * total;
			let spr = kind.sprites[kind.sprites.length - 1][0];
			for (const s of kind.sprites) {
				pick -= s[1];
				if (pick < 0) {
					spr = s[0];
					break;
				}
			}
			const ang = degToRad(kind.angle[0] + Math.random() * (kind.angle[1] - kind.angle[0]));
			const spd = kind.speed[0] + Math.random() * (kind.speed[1] - kind.speed[0]);
			this.particles.push({
				spr: spr,
				x: Math.random() * (cam.curw + 2 * WEATHER_WRAP_MARGIN),
				y: Math.random() * (cam.curh + 2 * WEATHER_WRAP_MARGIN),
				vx: spd * Math.cos(ang),
				vy: -spd * Math.sin(ang)
			});
		}
	}

	// One update: shares the drops out over the room's weather layers as they are now, then moves
	// each share at its layer's speed and wraps it around the view and its margins.
	update() {
		this.layers.length = 0;
		const rm = game.curroom;
		if (!this.on || rm === null || rm.layers === null) return;
		for (const lyr of rm.layers) {
			if (lyr === game.popupLayer) break;
			if (!lyr.disabled && !lyr.gui) this.layers.push(lyr);
		}
		const ll = this.layers.length;
		const w = game.cam.curw + 2 * WEATHER_WRAP_MARGIN;
		const h = game.cam.curh + 2 * WEATHER_WRAP_MARGIN;
		const share = this.particles.length / ll;
		for (let li = 0; li < ll; li++) {
			const spdmod = WEATHER_LAYER_SPEED_BASE + WEATHER_LAYER_SPEED_RISE * li / ll;
			for (let i = Math.floor(share * li), l = Math.floor(share * (li + 1)); i < l; i++) {
				const p = this.particles[i];
				p.x = (p.x + p.vx * spdmod + w) % w;
				p.y = (p.y + p.vy * spdmod + h) % h;
			}
		}
	}

	// Draws a layer's share of the drops in its screen pixels, shifted by the camera so they
	// scroll with the world. The drawing's stretch is already the layer's.
	draw(lyr) {
		const li = this.layers.indexOf(lyr);
		if (!this.on || li < 0) return;
		const cam = game.cam;
		const w = cam.curw + 2 * WEATHER_WRAP_MARGIN;
		const h = cam.curh + 2 * WEATHER_WRAP_MARGIN;
		const share = this.particles.length / this.layers.length;
		for (let i = Math.floor(share * li), l = Math.floor(share * (li + 1)); i < l; i++) {
			const p = this.particles[i];
			Draw.spriteRaw(p.spr, 0,
				Math.floor((((p.x - cam.x) % w) + w) % w - WEATHER_WRAP_MARGIN),
				Math.floor((((p.y - cam.y) % h) + h) % h - WEATHER_WRAP_MARGIN),
				1, 1, 0, NO_TINT, 1);
		}
	}
}
