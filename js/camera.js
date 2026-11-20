// The camera, a straight port of the original's: a box the size of the view whose middle
// follows the player inside a small slack window, pans with an easing curve to a person or a
// fixed spot, zooms, shakes, and is pushed out of camera blocking boxes like any mover.
// Everything that asks where the view is reads it from here: the scroll of the view's top left
// corner, its middle, its size, and whether something is on screen. Nothing is checked for objects
// by itself: one that cares whether it is out of view asks here.
// Also the two room objects that steer it: blocking boxes and trigger areas that frame themselves.

// the view at no zoom
const CAM_ZOOM1_W = 320;
const CAM_ZOOM1_H = 180;

// Slack around the follow spot before the camera moves, so turning and small jumps do not scroll.
// The original set a taller window first and then replaced it with this one.
const CAM_FOLLOW_WINDOW_X = 8;
const CAM_FOLLOW_WINDOW_Y = 6;

// The follow spot sits a little above the feet. The original first used eight, then four.
const CAM_FOLLOW_OFFSET_X = 0;
const CAM_FOLLOW_OFFSET_Y = -4;

// the fastest the camera moves when its speed is limited, in pixels per frame
const CAM_MAX_SPEED = 5;

// how long trigger areas that frame themselves take to pan and zoom in, and back out
const CAM_ON_ME_PAN_TIME = 50;
const CAM_ON_ME_BACK_TIME = 20;

class oCamera extends oBaseObject {
	constructor() {
		super();
		this.initMoveable();
		this.spi = "sBlankGrCtr";

		this.zoom1w = CAM_ZOOM1_W;
		this.zoom1h = CAM_ZOOM1_H;
		this.curzoom = 1;

		this.follow = null;
		this.staticCam = { x: 0, y: 0, z: 0 };
		this.folwinx = CAM_FOLLOW_WINDOW_X;
		this.folwiny = CAM_FOLLOW_WINDOW_Y;
		this.foloffx = CAM_FOLLOW_OFFSET_X;
		this.foloffy = CAM_FOLLOW_OFFSET_Y;
		this.padx = 0;
		this.pady = 0;

		// half the view size, the view's middle from its corner
		this.cx = 0;
		this.cy = 0;
		this.orz = 1;
		this.tarz = 1;
		this.orw = 0;
		this.orh = 0;
		// the original's starting size, the player start replaces it with the room's
		this.curw = 640;
		this.curh = 360;
		this.lastw = 640;
		this.lasth = 360;
		this.zoomtime = -1;
		this.zoomcurt = 0;
		this.zoomoverride = 0;

		this.lastfolofx = 0;
		this.lastfolofy = 0;

		this.orx = 0;
		this.ory = 0;
		this.pantime = 0;
		this.pancurt = 0;

		// the view's top left corner in room pixels
		this.scrox = 0;
		this.scroy = 0;
		this.lastscrox = 0;
		this.lastscroy = 0;

		this.roomlimit = true;
		this.panlock = false;
		this.max_speed = CAM_MAX_SPEED;
		this.fastjump = false;

		this.shake = 0;
		this.xmag = 1;
		this.ymag = 1;
	}

	reset() {
		this.cx = 0;
		this.cy = 0;
		this.tarz = 1;
		this.curzoom = 1;
		this.lastzoom = 1;
		this.zoomtime = -1;
		this.zoomcurt = 0;
		this.scrox = 0;
		this.scroy = 0;
		this.lastscrox = 0;
		this.lastscroy = 0;
		this.roomlimit = true;
		this.panlock = false;
		this.pantime = 0;
		this.panrat = 0;
		this.fastjump = false;
	}

	// Eases to a new zoom over a number of frames, or at once with none.
	switchZoom(newz, zoomtime) {
		if (eq(newz, this.tarz)) return;
		this.orz = this.curzoom;
		this.tarz = newz;
		this.orw = this.curw;
		this.orh = this.curh;
		this.zoomtime = zoomtime !== undefined ? zoomtime : 0;
		this.zoomcurt = 0;
	}

	// Pans to follow someone over a number of frames. No time jumps straight there.
	// Guess: with no time the original stores nothing at all, it is taken as zero here.
	pan(follow, pantime) {
		follow = game.lookupInst(follow, this);
		if (pantime === undefined) pantime = 0;
		if (pantime === 0) this.fastjump = 1;
		this.orx = this.x;
		this.ory = this.y;
		this.follow = follow;
		this.pantime = pantime;
		this.pancurt = 0;
	}

	// pans to a fixed spot and stays there
	lockToStatic(x, y, pantime) {
		this.staticCam.x = x;
		this.staticCam.y = y;
		this.pan(this.staticCam, pantime);
	}

	// stays where it is now
	lockToCurrent(pantime) {
		this.lockToStatic(this.x - this.foloffx - this.padx, this.y - this.foloffy - this.pady, pantime);
	}

	// The script action: someone and a time, a spot and a time, or only a time to stay put.
	lockCamTo(a, b, c) {
		if (typeof a === "string") this.pan(game.lookupInst(a, this), b);
		else if (b !== undefined) this.lockToStatic(a, b, c);
		else this.lockToCurrent(a);
	}

	// jumps there next frame with no easing
	setTo(x, y) {
		this.x = x;
		this.y = y;
		this.fastjump = 1;
	}

	// while zooming the smaller of the start and end zoom, else the current one
	get_cur_minzoom() {
		if (this.zoomtime > 0 || truthy(this.zoomoverride)) return Math.min(this.orz, this.tarz);
		return this.curzoom;
	}

	// A shake for a number of frames. Shaking again keeps the stronger of the two.
	shakeit(len, xmag, ymag) {
		if (this.shake > 0) {
			xmag = Math.max(this.xmag, xmag);
			ymag = Math.max(this.ymag, ymag);
		}
		this.xmag = xmag;
		this.ymag = ymag;
		this.shake = Math.max(this.shake, len);
	}

	// any part of the object inside the view, widened by the padding
	onScreen(obj, padding) {
		if (padding === undefined) padding = 0;
		return obj.bbox_right >= this.scrox - padding && obj.bbox_left <= this.scrox + this.curw + padding
			&& obj.bbox_bottom >= this.scroy - padding && obj.bbox_top <= this.scroy + this.curh + padding;
	}

	// the same test for a top down thing drawn at its height
	onScreenAtHeight(obj, padding) {
		obj.y -= obj.z;
		const on = this.onScreen(obj, padding);
		obj.y += obj.z;
		return on;
	}

	// wholly past one edge of the view by more than the padding
	offScreen(obj, padding) {
		if (padding === undefined) padding = 0;
		if (obj.bbox_right + padding < this.scrox) return true;
		if (obj.bbox_bottom + padding < this.scroy) return true;
		if (obj.bbox_left - padding > this.scrox + this.curw) return true;
		if (obj.bbox_top - padding > this.scroy + this.curh) return true;
		return false;
	}

	// The camera's turn each frame, run by the world after every object has updated and settled:
	// out of any blocking box, zoom on, then toward the follow spot, sliding against blocking boxes,
	// and the new view corner.
	update() {
		const boxes = [];
		this.instancePlaceList(this.x, this.y, oCamBox, boxes, true);
		for (const cbox of boxes) this.pushOutOfBox(cbox);

		this.lastscrox = this.scrox;
		this.lastscroy = this.scroy;
		this.lastw = this.curw;
		this.lasth = this.curh;

		if (this.zoomtime >= 0) {
			this.zoomcurt++;
			if (this.zoomcurt >= this.zoomtime) {
				this.curzoom = this.tarz;
				this.zoomtime = -1;
			} else {
				this.curzoom = this.easeOutCubic(this.zoomcurt, this.orz, this.tarz, this.zoomtime);
			}
		}

		this.cx = this.curw / 2;
		this.cy = this.curh / 2;

		let ncx = this.x;
		let ncy = this.y;
		const foledgew = Math.floor((this.curw / this.zoom1w) * this.folwinx / this.curzoom);
		const foledgeh = Math.floor((this.curh / this.zoom1h) * this.folwiny / this.curzoom);

		this.padx = 0;
		this.pady = 0;

		// the original crashes with nobody to follow, here the camera just stays
		if (this.follow) {
			let folx = round(this.follow.x + this.foloffx + this.padx);
			// top down height lifts the spot
			let foly = round(this.follow.y - this.follow.z + this.foloffy + this.pady);

			if (this.pantime >= 0) {
				this.pancurt++;
				if (this.pancurt >= this.pantime) {
					ncx = folx;
					ncy = foly;
					this.pantime = -1;
				} else {
					ncx = round(this.easeOutCubic(this.pancurt, this.orx, folx, this.pantime));
					ncy = round(this.easeOutCubic(this.pancurt, this.ory, foly, this.pantime));
				}
			} else {
				if (!truthy(this.fastjump)) {
					folx = clamp(this.x, folx - foledgew, folx + foledgew);
					foly = clamp(this.y, foly - foledgeh, foly + foledgeh);
				}
				// the last test always holds, since the start spot is the camera's own,
				// so following always lands on the windowed spot
				if (this.zoomtime >= 0 || truthy(this.fastjump) || (Math.abs(ncx - this.x) < 2 && Math.abs(ncy - this.y) <= 2)) {
					ncx = folx;
					ncy = foly;
				}
				this.lastfolofx = this.x - this.follow.x;
				this.lastfolofy = this.y - this.follow.y;
			}
		}

		// the mask is the view's size
		this.x_sc = this.curw / 2;
		this.y_sc = this.curh / 2;

		this.xspd = ncx - this.x;
		this.yspd = ncy - this.y;

		// Kept from the original: a pan time of zero has already been turned to minus one above,
		// so this limit never applies.
		if (!truthy(this.fastjump) && this.pantime === 0) {
			this.limitSpeed(this.max_speed);
		}
		this.fastjump = 0;

		// no sub pixel carry for the camera
		this.rx = 0;
		this.ry = 0;
		this.moveThroughObjectsSimple(this.xspd, this.yspd, oCamBox);

		this.scrox = Math.floor(this.x - this.cx);
		this.scroy = Math.floor(this.y - this.cy);
	}

	// Pushed out of a box along whichever way, sideways or up and down, is the shorter way out,
	// walking from the middles apart.
	pushOutOfBox(ho) {
		let nx = this.x;
		let ny = this.y;
		const mycx = this.sprite_cx();
		const mycy = this.sprite_cy();
		const hocx = ho.sprite_cx();
		const hocy = ho.sprite_cy();
		Hooks.debugLine(mycx, mycy, hocx, hocy, "#ffffff");
		const xi = sign(mycx - hocx);
		const yi = sign(mycy - hocy);

		let tries = 0;
		while (xi !== 0 && tries++ < PUSH_OUT_SAFETY_LIMIT) {
			nx += xi;
			if (this.instancePlace(nx, this.y, ho) === null) break;
		}
		tries = 0;
		while (yi !== 0 && tries++ < PUSH_OUT_SAFETY_LIMIT) {
			ny += yi;
			if (this.instancePlace(this.x, ny, ho) === null) break;
		}

		if (xi !== 0 && Math.abs(nx - this.x) < Math.abs(ny - this.y)) {
			ny = this.y;
		} else if (yi !== 0 && Math.abs(ny - this.y) < Math.abs(nx - this.x)) {
			nx = this.x;
		}

		if (nx !== this.x || ny !== this.y) {
			Hooks.debugLine(this.x, this.y, nx, ny, "#ff22ff");
			this.x = nx;
			this.y = ny;
		}
	}

	// starts fast and settles into the end value
	easeOutCubic(elapsed, startv, endv, total) {
		let t = elapsed / total - 1;
		t = t * t * t + 1;
		return startv + (endv - startv) * t;
	}
}

// Keeps the camera out. Never drawn.
class oCamBox extends oBaseObject {
	constructor() {
		super();
		this.visible = false;
	}
}

// A trigger area that pans the camera onto itself, zooming to fit, and back to the player on leaving.
class oCamOnMe extends oTrigScript {
	constructor() {
		super();
		this.group = null;
		this.only_inside = 1;
		this.andzoom = 1;
		this.padding = 0;
	}

	on_trigger() {
		game.cam.lockToStatic(this.x, this.y, CAM_ON_ME_PAN_TIME);
		if (truthy(this.andzoom)) {
			let w = this.bbox_right - this.bbox_left + this.padding;
			let h = this.bbox_bottom - this.bbox_top + this.padding;
			// rounds the size to the view's shape
			w = w - ((w + 16) % 16);
			h = h - ((h + 9) % 9);
			const maxr = Math.min(CAM_ZOOM1_W / w, CAM_ZOOM1_H / h);
			game.cam.switchZoom(maxr, CAM_ON_ME_PAN_TIME);
		}
	}

	off_trigger() {
		game.cam.pan("main", CAM_ON_ME_BACK_TIME);
		game.cam.switchZoom(1, CAM_ON_ME_BACK_TIME);
	}
}
