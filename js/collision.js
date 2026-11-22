// Overlap tests between object masks, the family of place and position checks the movers use.
// Masks come from the sprite record: a rectangle with an offset from the origin, or a circle.
// Bounding boxes are whole pixels and include both edges, like the original.
// Objects that are not active or are destroyed never collide, and an object never hits itself.

// turned shapes closer than this along an axis only touch, so they do not count as overlapping
const SHAPE_TOUCH_TOLERANCE = 0.00001;

// Turns an object's mask at a given spot into a shape: a whole pixel box,
// plus a polygon when a turning mask is rotated, or a circle.
// Guess: box edges round to the nearest pixel, halves rounding up.
// Guess: a plain rectangle mask on a rotated object uses the upright box around the turned shape,
// while a mask marked to turn uses the turned rectangle itself.
function maskShape(o, x, y) {
	// shapes at an object's own spot are asked for constantly, so the last one is kept
	// until anything that changes it does
	const c = o.shapeCache;
	if (c && c.x === x && c.y === y && x === o.x && y === o.y && c.mask === o.mask && c.sprite === o.spi
		&& c.sx === o.x_sc && c.sy === o.y_sc && c.ang === o.ang) {
		return c.shape;
	}
	const shape = computeMaskShape(o, x, y);
	if (x === o.x && y === o.y) {
		o.shapeCache = { x: x, y: y, mask: o.mask, sprite: o.spi,
			sx: o.x_sc, sy: o.y_sc, ang: o.ang, shape: shape };
	}
	return shape;
}

function computeMaskShape(o, x, y) {
	const name = (o.mask !== null && o.mask !== undefined) ? o.mask : o.spi;
	if (name === null || name === undefined) return null;
	const spr = Sprites.get(name);
	if (!spr || !spr.mask) return null;
	const m = spr.mask;
	const sx = o.x_sc;
	const sy = o.y_sc;
	const ang = o.ang % 360;

	if (m.kind === "circle") {
		const r = m.r * Math.abs(sx);
		let cx = m.x * sx;
		let cy = m.y * sy;
		if (ang !== 0) {
			const c = Math.cos(degToRad(ang));
			const s = Math.sin(degToRad(ang));
			const rx = cx * c + cy * s;
			cy = -cx * s + cy * c;
			cx = rx;
		}
		cx += x;
		cy += y;
		return {
			l: Math.floor(cx - r + 0.5), t: Math.floor(cy - r + 0.5),
			r: Math.floor(cx + r + 0.5) - 1, b: Math.floor(cy + r + 0.5) - 1,
			poly: null, circle: { x: cx, y: cy, r: r }
		};
	}

	const x0 = Math.min(m.x * sx, (m.x + m.w) * sx);
	const x1 = Math.max(m.x * sx, (m.x + m.w) * sx);
	const y0 = Math.min(m.y * sy, (m.y + m.h) * sy);
	const y1 = Math.max(m.y * sy, (m.y + m.h) * sy);

	if (ang === 0) {
		return {
			l: Math.floor(x + x0 + 0.5), t: Math.floor(y + y0 + 0.5),
			r: Math.floor(x + x1 + 0.5) - 1, b: Math.floor(y + y1 + 0.5) - 1,
			poly: null, circle: null
		};
	}

	// turn the four corners around the origin, counterclockwise on screen
	const c = Math.cos(degToRad(ang));
	const s = Math.sin(degToRad(ang));
	const corners = [
		{ x: x + x0 * c + y0 * s, y: y - x0 * s + y0 * c },
		{ x: x + x1 * c + y0 * s, y: y - x1 * s + y0 * c },
		{ x: x + x1 * c + y1 * s, y: y - x1 * s + y1 * c },
		{ x: x + x0 * c + y1 * s, y: y - x0 * s + y1 * c }
	];
	let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
	for (const p of corners) {
		if (p.x < minx) minx = p.x;
		if (p.x > maxx) maxx = p.x;
		if (p.y < miny) miny = p.y;
		if (p.y > maxy) maxy = p.y;
	}
	return {
		l: Math.floor(minx + 0.5), t: Math.floor(miny + 0.5),
		r: Math.floor(maxx + 0.5) - 1, b: Math.floor(maxy + 0.5) - 1,
		poly: m.rotates ? corners : null, circle: null
	};
}

// True when two shapes share any area. Touching edges do not count.
// Boxes compare whole pixel edges, turned rectangles use separating axes,
// and circles use the nearest point on the other shape.
function shapesOverlap(a, b) {
	if (a.r < b.l || a.l > b.r || a.b < b.t || a.t > b.b) return false;
	if (!a.poly && !a.circle && !b.poly && !b.circle) return true;

	if (a.circle && b.circle) {
		return pointDistance(a.circle.x, a.circle.y, b.circle.x, b.circle.y) < a.circle.r + b.circle.r;
	}

	// a box covers its pixels fully, so its polygon runs to the far side of the last pixel
	const pa = a.circle ? null : (a.poly || [
		{ x: a.l, y: a.t }, { x: a.r + 1, y: a.t }, { x: a.r + 1, y: a.b + 1 }, { x: a.l, y: a.b + 1 }
	]);
	const pb = b.circle ? null : (b.poly || [
		{ x: b.l, y: b.t }, { x: b.r + 1, y: b.t }, { x: b.r + 1, y: b.b + 1 }, { x: b.l, y: b.b + 1 }
	]);

	if (a.circle || b.circle) {
		const circ = a.circle || b.circle;
		const poly = a.circle ? pb : pa;
		// inside the polygon counts, otherwise the nearest edge point must be within the radius
		let inside = true;
		let best = Infinity;
		for (let i = 0; i < 4; i++) {
			const p = poly[i];
			const q = poly[(i + 1) % 4];
			const ex = q.x - p.x;
			const ey = q.y - p.y;
			if (ex * (circ.y - p.y) - ey * (circ.x - p.x) < 0) inside = false;
			const len2 = ex * ex + ey * ey;
			const t = len2 > 0 ? clamp(((circ.x - p.x) * ex + (circ.y - p.y) * ey) / len2, 0, 1) : 0;
			const d = pointDistance(circ.x, circ.y, p.x + ex * t, p.y + ey * t);
			if (d < best) best = d;
		}
		return inside || best < circ.r;
	}

	// separating axes, the edge normals of both rectangles
	for (const poly of [pa, pb]) {
		for (let i = 0; i < 2; i++) {
			const p = poly[i];
			const q = poly[i + 1];
			const nx = -(q.y - p.y);
			const ny = q.x - p.x;
			let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
			for (const v of pa) {
				const d = v.x * nx + v.y * ny;
				if (d < amin) amin = d;
				if (d > amax) amax = d;
			}
			for (const v of pb) {
				const d = v.x * nx + v.y * ny;
				if (d < bmin) bmin = d;
				if (d > bmax) bmax = d;
			}
			if (amax <= bmin + SHAPE_TOUCH_TOLERANCE || bmax <= amin + SHAPE_TOUCH_TOLERANCE) return false;
		}
	}
	return true;
}

// True when a point sits inside a shape, edges included.
function pointInShape(s, px, py) {
	if (px < s.l || px > s.r + 1 || py < s.t || py > s.b + 1) return false;
	if (s.circle) return pointDistance(s.circle.x, s.circle.y, px, py) <= s.circle.r;
	if (!s.poly) return px <= s.r && py <= s.b;
	for (let i = 0; i < 4; i++) {
		const p = s.poly[i];
		const q = s.poly[(i + 1) % 4];
		if ((q.x - p.x) * (py - p.y) - (q.y - p.y) * (px - p.x) < 0) return false;
	}
	return true;
}

// A type to test against is either a class, matching it and every subclass, or one object.
function matchesType(o, what) {
	if (what === null || what === undefined) return false;
	if (typeof what === "function") return o instanceof what;
	return o === what;
}

// The place and position checks, mixed onto the base object so every object can ask them.
// Guess: when several objects qualify, the first one returned is the earliest created.
// Guess: ordered lists sort by distance from the tested spot to each object's origin.
const Collision = {
	placeMeeting(x, y, what) {
		return this.instancePlace(x, y, what) !== null;
	},

	instancePlace(x, y, what) {
		if (what === null || what === undefined) return null;
		const me = maskShape(this, x, y);
		if (!me) return null;
		for (const o of game.instances) {
			if (o === this || !o.active || o.destroyed || !matchesType(o, what)) continue;
			const s = maskShape(o, o.x, o.y);
			if (s && shapesOverlap(me, s)) return o;
		}
		return null;
	},

	// Appends every hit to the list and returns how many were found.
	instancePlaceList(x, y, what, list, ordered) {
		if (what === null || what === undefined) return 0;
		const me = maskShape(this, x, y);
		if (!me) return 0;
		const found = [];
		for (const o of game.instances) {
			if (o === this || !o.active || o.destroyed || !matchesType(o, what)) continue;
			const s = maskShape(o, o.x, o.y);
			if (s && shapesOverlap(me, s)) found.push(o);
		}
		if (ordered) {
			found.sort((a, b) => pointDistance(x, y, a.x, a.y) - pointDistance(x, y, b.x, b.y));
		}
		for (const o of found) list.push(o);
		return found.length;
	},

	// First object of the type covering a point, optionally skipping the asker.
	collisionPoint(px, py, what, precise, notme) {
		for (const o of game.instances) {
			if ((notme && o === this) || !o.active || o.destroyed || !matchesType(o, what)) continue;
			const s = maskShape(o, o.x, o.y);
			if (s && pointInShape(s, px, py)) return o;
		}
		return null;
	},

	positionMeeting(px, py, what) {
		return this.collisionPoint(px, py, what, false, false) !== null;
	},

	// Appends every object of the type whose box comes within a radius of a point, never the
	// asker, and returns how many were found. Boxes only, turns and circles ignored. Ordered lists
	// sort by distance from the point to each object's origin.
	collisionCircleList(cx, cy, r, what, list, ordered) {
		const found = [];
		for (const o of game.instances) {
			if (o === this || !o.active || o.destroyed || !matchesType(o, what)) continue;
			const s = maskShape(o, o.x, o.y);
			if (!s) continue;
			const dx = cx - clamp(cx, s.l, s.r + 1);
			const dy = cy - clamp(cy, s.t, s.b + 1);
			if (dx * dx + dy * dy <= r * r) found.push(o);
		}
		if (ordered) {
			found.sort((a, b) => pointDistance(cx, cy, a.x, a.y) - pointDistance(cx, cy, b.x, b.y));
		}
		for (const o of found) list.push(o);
		return found.length;
	},

	// the first such object made, or nothing
	collisionCircle(cx, cy, r, what) {
		const found = [];
		this.collisionCircleList(cx, cy, r, what, found, false);
		return found.length > 0 ? found[0] : null;
	}
};
