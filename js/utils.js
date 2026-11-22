// Math and value rules the original engine relied on, so ported logic behaves the same.
// Angles are degrees, counterclockwise on screen, with y pointing down.

// the original used this as its "infinitely tall" height
const BIGGEST_INT = 2147483643;

// steps per second, which is also the rate sprite speeds are given in
const GAME_FPS = 60;

// Milliseconds since the page started, the engine's clock that some drawing wobbles by.
// Nothing that moves the game reads it.
function currentTime() {
	return (typeof performance !== "undefined") ? performance.now() : Date.now();
}

// The engine's remainder keeps the sign of the left side.
// The plain remainder operator in this language already does that, so ports use it directly.

function sign(v) {
	return v > 0 ? 1 : (v < 0 ? -1 : 0);
}

function clamp(v, lo, hi) {
	return v < lo ? lo : (v > hi ? hi : v);
}

function lerp(a, b, t) {
	return a + (b - a) * t;
}

function degToRad(d) {
	return d / 180 * Math.PI;
}

// direction from the first point to the second, zero to under three sixty
function pointDirection(x1, y1, x2, y2) {
	const d = Math.atan2(-(y2 - y1), x2 - x1) * 180 / Math.PI;
	return d < 0 ? d + 360 : d;
}

function pointDistance(x1, y1, x2, y2) {
	return Math.hypot(x2 - x1, y2 - y1);
}

function lengthdirX(len, dir) {
	return len * Math.cos(dir / 180 * Math.PI);
}

function lengthdirY(len, dir) {
	return -len * Math.sin(dir / 180 * Math.PI);
}

// shortest signed turn from the second angle to the first, between minus and plus one eighty
function angleDifference(a, b) {
	return ((((a - b) % 360) + 540) % 360) - 180;
}

// blend between two angles by a weight, half way when no weight is given
function angleAvg(a1, a2, w) {
	if (w === undefined) w = 0.5;
	return (a1 + angleDifference(a2, a1) * w + 360) % 360;
}

function angleAdd(a1, a2) {
	return (a1 + a2 + 720) % 360;
}

// Copies a mixin's fields and methods onto a class prototype.
// Anything the class defines itself is kept, the same way an object overrode
// a shared setup by assigning its own version after calling it.
function mixin(cls, addon) {
	for (const key of Object.keys(addon)) {
		if (!Object.prototype.hasOwnProperty.call(cls.prototype, key)) {
			cls.prototype[key] = addon[key];
		}
	}
}

// Small seeded generator so runs and recorded traces can be replayed exactly.
class Rng {
	constructor(seed) {
		this.state = (seed >>> 0) || 1;
	}
	next() {
		// a well known small generator, fast and good enough for games
		this.state = (this.state + 0x6D2B79F5) >>> 0;
		let t = this.state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}
	random(n) {
		return this.next() * n;
	}
	randomRange(a, b) {
		return a + this.next() * (b - a);
	}
	irandom(n) {
		return Math.floor(this.next() * (n + 1));
	}
	irandomRange(a, b) {
		return a + Math.floor(this.next() * (b - a + 1));
	}
	choose(...vals) {
		return vals[Math.floor(this.next() * vals.length)];
	}
}

const rng = new Rng(12345);
