// The object class tree, following the original parents one to one, plus the two
// classic mixins every interactive or pickupable object shares.
// Ported so far: what the player's physics touches (solids, one way floors, ladders, water,
// the loose crates), how each of those draws, the triggers, text signs, layer doors and masks.
// Everything else is a placeholder that keeps its parent, its collision flags and its
// parent's drawing, and gets a labeled outline.

// ---------------------------------------------------------------- mixins

// All an object needs to be looked at, picked up, used and given to.
// Fields live flat on the object. Classes that define their own version of a method keep it.
const Interactive = {
	initInteractive() {
		this.inview = false;
		this.nolook = false;
		this.cangive = 0;
		// shared with pickupable, same meaning: whoever holds this right now
		this.carriedBy = null;
		// shared with pickupable, same meaning: a held item taking over the controls
		this.over_con = false;
		this.gname = this.constructor.name;
	},

	pickup(upper) {
		upper.inv.pickup(this);
	},

	drop() {
		this.carriedBy.inv.drop_held();
	},

	// what would happen on an action, by default just interact
	act_check(action, who, pars) {
		return "INT";
	},

	// by default say the description if there is one
	acton(action, who, pars) {
		if (this.description !== undefined) {
			Hooks.runScript([["sayWfB", this.description, "actor", 0, -10, 0, 0]], this);
		}
	},

	// single use or start of use, held use, and release
	use(who) {},
	use_c(who) {},
	use_r(who) {}
};

// All an object needs to be picked up and held.
const Pickupable = {
	initPickupable() {
		this.pickupable = true;
		// held items can sit in the inventory and do not slow running
		this.holdable = false;
		this.over_con = false;
		// an item's own on or off switch, minus one when it has none
		this.active = -1;
		this.carriedBy = null;
		this.can_jump = 1;
		this.can_diveroll = 1;
		// offsets so the item sits right in the hand
		this.holdoffx = 0;
		this.holdoffy = 0;
	},

	put_away(who) {},
	take_out(who) {}
};

// ---------------------------------------------------------------- inventory stand in

// The inventory is a later stage. This keeps the calls the players make and reports them.
class Inventory {
	constructor(size, sprite, owner, font) {
		this.owner = owner;
		this.inv_list = [];
	}
	set_height(h) {}
	// never takes over the frame until the real one exists
	qp_handle_ui(con) {
		return false;
	}
	// the quick pick wheel is never open until the real one exists
	get in_inv_sel() {
		return false;
	}
	pickup(obj, pos, noSwitch) {
		Hooks.todo("inventory pickup of " + obj.constructor.name);
	}
	drop_held() {
		Hooks.todo("inventory drop");
	}
	switch_held(i) {
		Hooks.todo("inventory switch held");
	}
	switch_back() {
		Hooks.todo("inventory switch back");
	}
}

// ---------------------------------------------------------------- base

// The base of every game engine object. An object is made from one config, which for anything a
// room places is that room's entry for it as saved, with its setup block and any settings kept for
// its name already laid on top. Making one goes in this order: the placed sprite fields and their
// defaults copied on first, so every object has the same fields in the same order; the spot taken
// from the config, so defaults can be worked out from it; every class's defaults, from this base
// out to the object's own class; then the config over all of that, and the sprite asset set.
// Classes give their defaults by extending defaults rather than the constructor, because a base
// constructor runs before the classes built on it, so the config could not come last otherwise.
// The life of an object: made, then its optional setup once everything in its room exists, then
// each frame its update, then its optional after update once everything has updated, then its draw,
// until it is destroyed. Objects with no sprite draw nothing.
class oBaseObject {
	constructor(cfg) {
		Object.assign(this, LP_SPRITE_DEFAULTS);
		if (cfg === undefined) cfg = {};
		if (cfg.x !== undefined) this.x = cfg.x;
		if (cfg.y !== undefined) this.y = cfg.y;
		this.defaults(cfg);
		this.configure(cfg);
	}

	// The base defaults. Classes extend this, starting with the parent's defaults.
	defaults(cfg) {
		this.spi = this.constructor.defaultSprite || null;
		// its own collision mask, when not its sprite's box, and the one it started with
		this.mask = null;
		this.dmi = null;
		// comes along when the player changes rooms
		this.persistent = false;
		// switched off with its layer, then it neither runs, collides nor draws
		this.deactivated = false;
		// functions waiting a number of updates
		this.timers = null;

		this.xspd = 0;
		this.yspd = 0;
		this.rspd = 0;

		// top down height
		this.zspd = 0;
		this.z = 0;
		this.rz = 0;
		this.ht = 0;
		this.standonable = 0;

		this.moving = false;

		this.pushable = false;
		this.pushAdj = 1.0;

		this.hangable = false;
		this.breakable = false;

		this.thruable = false;
		this.thruUp = false;
		this.thruDown = false;
		this.thruLeft = false;
		this.thruRight = false;
		// junctions you pass unless holding up
		this.thruRightNU = false;
		this.thruLeftNU = false;

		this.inFallWall = null;

		this.dropDown = false;
		this.jumped = 0;

		this.canClimb = false;

		this.pickupable = false;

		this.facing = 1;
		// only used top down, so no facing by default
		this.facingy = 0;

		this.cur_stayin = null;
	}

	// Lays a config over the object and sets its sprite asset from it. Making an object ends with
	// this, and a room taking over an object of the same name from another room uses it again.
	configure(cfg) {
		Object.assign(this, cfg);
		Draw.setSprite(this, this.spi);
		// the mask it started with, for things that swap masks
		this.dmi = this.mask;
	}

	// bounding box edges at the current spot, whole pixels, both edges included
	get bbox_left() { const s = maskShape(this, this.x, this.y); return s ? s.l : this.x; }
	get bbox_top() { const s = maskShape(this, this.x, this.y); return s ? s.t : this.y; }
	get bbox_right() { const s = maskShape(this, this.x, this.y); return s ? s.r : this.x; }
	get bbox_bottom() { const s = maskShape(this, this.x, this.y); return s ? s.b : this.y; }

	get sprite_width() { const s = Sprites.get(this.spi); return s ? s.w * Math.abs(this.x_sc) : 0; }
	get sprite_height() { const s = Sprites.get(this.spi); return s ? s.h * Math.abs(this.y_sc) : 0; }

	sprite_cx() {
		return Math.floor((this.bbox_right + this.bbox_left + 1) / 2);
	}
	sprite_cy() {
		return Math.floor((this.bbox_bottom + this.bbox_top + 1) / 2);
	}

	// Each frame's own logic. Nothing by default.
	update() {}

	// By default the sprite through the one sprite draw that layer pictures use too.
	draw() {
		Draw.lpSprite(this);
	}

	// Gone for good: out of its layer, its name and the frame. Anything that owns other objects
	// destroys them here too, after this base. Destroying twice does nothing.
	destroy() {
		game.forgetObject(this);
	}

	// Runs a function after a number of updates. Counted in updates, never in real time, so it
	// waits while play is paused and stays in step with movement.
	startTimer(updates, fn) {
		if (this.timers === null) this.timers = [];
		this.timers.push({ left: updates, fn: fn });
	}

	// Counts the timers down, the world calls this just before each update. A timer that runs out
	// is dropped before it runs, so it can start another.
	countDownTimers() {
		for (let i = 0; i < this.timers.length; i++) {
			const t = this.timers[i];
			if (--t.left > 0) continue;
			this.timers.splice(i--, 1);
			t.fn.call(this);
		}
		if (this.timers.length === 0) this.timers = null;
	}
}
Object.assign(oBaseObject.prototype, Collision);
Object.assign(oBaseObject.prototype, Movers);

// Solid things. They block movement by default and are endlessly tall top down.
class oObject extends oBaseObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.ht = BIGGEST_INT;
	}
	// any object can be acted on, by default nothing happens
	acton(action, who, pars) {}
}

// Terrain, hangable by default.
class oGround extends oObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.hangable = true;
	}
}

// Stretchable ground: an edge strip along the top and a fill stretched over the rest.
// Both pieces are eight pixels square with no origin.
class oFloor extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.hangable = true;
		this.landed = true;
		this.top_spr = "sFloorTop";
		this.mid_spr = "sFloorMid";
	}
	draw() {
		Draw.spriteExt(this.top_spr, this.ifr, this.x, this.y, this.sprite_width / 8, 1,
			this.ang, this.col, this.alph);
		Draw.spriteExt(this.mid_spr, this.ifr, this.x, this.y + 8, this.sprite_width / 8, (this.sprite_height - 8) / 8,
			this.ang, this.col, this.alph);
	}
}

class oSolidFloor extends oGround {}

// Spiky wall that hurts on touch.
class oWall extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.hurts = 2;
	}
	acton(action, who) {
		if (action === "touch") {
			game.guy.takeHit(this.x, this.y, this.hurts);
		}
	}
}

// Breaks when hit fast, slowing whoever broke it a little.
class oGlass extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.hangable = false;
	}
	acton(action, who) {
		if (action === "hit") {
			Hooks.particles("glass break", this, who.x + who.xspd, who.y + who.yspd);
			this.destroy();
			who.xspd = sign(who.xspd) * (Math.abs(who.xspd) - 0.2);
			who.calcOnFloorAtWall();
		}
	}
}

class oGlassv extends oGlass {}

// One way floor, pass from below and the sides, drop down through it.
class oFloorThru extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.hangable = false;
		this.thruable = true;
		this.thruUp = true;
		this.thruLeft = true;
		this.thruRight = true;
		this.dropDown = true;
	}
}

class oPlatform extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.xspd = 0;
		this.yspd = 0;
		this.rspd = 0;
		this.hangable = false;
		this.thruable = true;
		this.thruUp = true;
		this.dropDown = true;
	}
}

class oPlank extends oGround {}
class oBox extends oGround {}

// Ground drawn repeated over its size when tiled, else stretched. Its own tiling always repeats
// both ways at unit size, even when only one way was asked for, and leaves out the draw offset.
class oSolidGr extends oGround {
	draw() {
		if (!truthy(this.tiled)) {
			Draw.lpSprite(this);
			return;
		}
		// a zero size would never finish
		if (!(this.t_w > 0) || !(this.t_h > 0)) return;
		for (let j = 0; j < this.t_spw; j += this.t_w) {
			for (let k = 0; k < this.t_sph; k += this.t_h) {
				Draw.spriteExt(this.spi, this.ifr, this.x + j - this.t_stx, this.y + k - this.t_sty,
					this.t_flipx, this.t_flipy, this.ang, this.col, this.alph);
			}
		}
	}
}

class oIaSolidGr extends oSolidGr {
	defaults(cfg) {
		super.defaults(cfg);
		this.initInteractive();
		this.pickupable = false;
	}
}
mixin(oIaSolidGr, Interactive);

class oBlankGr extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.pvis = false;
	}
}

class oGrWall extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.hangable = false;
		this.landed = true;
	}
}
class oGrWall2 extends oGrWall {}

class oOneWayDoor extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.xspd = 0;
		this.yspd = 0;
		this.rspd = 0;
		this.hangable = false;
		this.thruable = true;
		this.thruRight = true;
	}
}

// Placeholder: falls and tumbles once its own step is ported.
class oBoxFall extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.initMoveable();
		this.landed = false;
		this.xspd = rng.randomRange(-0.1, 0.1);
		this.yspd = rng.randomRange(-0.1, 0.1);
		this.rspd = (this.yspd / 3 + rng.random(0.2)) * (rng.random(10) < 5 ? -1 : 1);
		this.spd = 0;
		this.ifr = 0;
		this.life = 130;
	}
}
oBoxFall.ported = false;

// Placeholder: a bobbing floor once its own step is ported.
class oGrTechno extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.hangable = false;
		this.moving = true;
		this.initMoveable();
		this.stoodon = false;
		this.step = rng.irandom(3) * 10;
		this.y += this.step * 0.1;
		this.on = 1;
	}
}
oGrTechno.ported = false;

class oGrTechnoVoid extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.hangable = false;
		this.moving = true;
		this.initMoveable();
		this.stoodon = false;
		this.step = rng.irandom(5) * 10;
		this.y += this.step * 0.06;
	}
}
oGrTechnoVoid.ported = false;

// Placeholder: the original turns its pass flags on, then straight back off.
class oJgHeart extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.initMoveable();
	}
}
oJgHeart.ported = false;

class oJgLogShooter extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.hangable = false;
	}
}
oJgLogShooter.ported = false;

// Placeholder: a hangable flying bird once its step is ported.
class oBird extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.initMoveable();
		this.hangable = true;
	}
}
oBird.ported = false;

class oBouncer extends oObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.spd = 0;
	}
}
oBouncer.ported = false;

class oTank extends oObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initMoveable();
	}
}
oTank.ported = false;

// Solid interactive things.
class oIaObject extends oObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initInteractive();
		this.landed = true;
		this.hitFloor = false;
		this.hitWall = false;
		this.canClimb = true;
		this.pickupable = false;
		this.inventory = null;
	}
}
mixin(oIaObject, Interactive);

// Loose crate: falls, slides and can be picked up.
class oCrate extends oIaObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initPickupable();
		this.holdoffx = 1;
		this.initMoveable();
	}
	update() {
		this.calcOnFloorAtWall();
		this.lastx = this.x;
		this.lasty = this.y;
		this.applyFrictionGravity();
		if (!this.carriedBy) {
			this.moveThroughObjectsSimple(this.xspd, this.yspd);
		}
	}
}
mixin(oCrate, Pickupable);

// Crate that stays put but can be picked up.
class oCrateSt extends oIaObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initPickupable();
		this.holdoffx = 1;
	}
}
mixin(oCrateSt, Pickupable);

// Big crate that gets pushed along the floor.
class oCrateBg extends oIaObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initMoveable();
		this.pushable = true;
		this.pushAdj = 0.8;
		this.spd = 0;
	}
	update() {
		this.calcOnFloorAtWall();
		if (this.atWall) {
			this.xspd = -sign(this.xspd) * Math.max(Math.abs(this.xspd) - 0.1, 0);
		}
		if (this.onFloor) {
			this.yspd = 0;
		} else {
			this.yspd += 0.05;
		}
		this.moveThroughObjects(this.xspd, this.yspd);
	}
}

// Metal crate, pulled by the magnet and knocked by hits.
class oCrateMetal extends oIaObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initMoveable();
		this.maxspd = 1;
	}
	acton(action, who) {
		if (action === "magnate") {
			this.xspd = this.xspd + (this.fric + 0.1) * sign(who.x - this.x);
			this.xspd = sign(this.xspd) * Math.min(Math.abs(this.xspd), this.maxspd);
			this.yspd = this.yspd - this.grav + 0.1 * sign(who.y - this.y);
			this.yspd = sign(this.yspd) * Math.min(Math.abs(this.yspd), this.maxspd);
		} else if (action === "hit") {
			this.xspd = this.xspd + (this.fric + 0.4) * sign(this.x - who.x);
			this.xspd = sign(this.xspd) * Math.min(Math.abs(this.xspd), this.maxspd);
			this.yspd = this.yspd + -0.2;
			this.yspd = sign(this.yspd) * Math.min(Math.abs(this.yspd), this.maxspd);
		}
	}
	update() {
		this.calcOnFloorAtWall();
		this.applyFrictionGravity();
		this.lastx = this.x;
		this.lasty = this.y;
		this.moveThroughObjectsSimple(this.xspd, this.yspd);
	}
}

// ---------------------------------------------------------------- background objects

// Non blocking things. They never stop movement but can be hung from, climbed, or grabbed.
class oBgObject extends oBaseObject {}

class oIaBgObject extends oBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initInteractive();
		this.landed = true;
		this.pickupable = false;
		this.hitFloor = false;
		this.hitWall = false;
	}
}
mixin(oIaBgObject, Interactive);

class oClimbableObj extends oBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.pvis = false;
		this.climbable = true;
		this.jumpoff = true;
		this.twoway = true;
	}
}
class oLadder extends oClimbableObj {}

// Falling in kills, checked by the side view player.
class oPit extends oBgObject {}

class oRope extends oBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.hangable = true;
	}
}
oRope.ported = false;

class oLogEater extends oBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.hangable = false;
	}
}
oLogEater.ported = false;

class oAniSpark extends oBgObject {}
oAniSpark.ported = false;

// A door into other layers or another room. It is a picture with a separate invisible wall
// that comes and goes as it opens and closes. Walking into an open one switches the view
// to the layers it leads to, or goes to the room it connects to. It can open by itself when
// something stands at its sensor, and be locked.
class oLyrDoor extends oIaBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.spd = 0;
		this.ifr = 0;
		this.open = false;
		this.locked = false;
		this.connected = -1;
		this.wall_obj = null;
		this.enter_lyrs = "";
		this.enter_clyr = "";
		this.locked_message = "locked";
		this.conRoom = undefined;
		this.conRoomEnter = undefined;
		this.entering = -1;
		// for coming in from other rooms
		this.inTrigger = 0;
		this.triggered = 0;
		this.no_trig_on_reenter = 1;
		this.open_sensor = undefined;
		this.sense_on = null;
		this.manual_override = 0;
	}

	init() {
		this.wall_obj = game.createObject(oBlankGr, { x: this.x, y: this.y });
		this.wall_obj.mask = this.spi;
		this.open_sensor = game.lookupInst(this.open_sensor, this);
		this.set_open(this.open, 0, 1);
	}

	// Opens or closes, playing the animation or jumping to its end. A lock stops it unless overridden.
	set_open(open, animate, lockOverride) {
		if (truthy(this.locked) && !truthy(lockOverride)) return false;
		this.open = open;
		this.wall_obj.mask = truthy(open) ? "sNoMask" : this.spi;
		if (truthy(animate)) {
			this.spd = 1;
		} else {
			this.ifr = truthy(open) ? Math.ceil(Sprites.frameCount(this.spi) / 2) : 0;
		}
		return true;
	}

	acton(action, who) {
		const didit = this.set_open(!truthy(this.open), 1);
		if (!didit && truthy(this.locked)) Hooks.say(who, this.locked_message);
		// working an automatic door by hand keeps it as left until the sensor clears
		if (this.open_sensor !== undefined && this.sense_on !== null) this.manual_override = 1;
	}

	update() {
		const frames = Sprites.frameCount(this.spi);
		if (this.spd > 0) {
			if ((truthy(this.open) && Math.floor(this.ifr) === Math.ceil(frames / 2))
				|| (!truthy(this.open) && Math.floor(this.ifr) === 0)) {
				this.spd = 0;
			} else {
				return;
			}
		}

		// coming in from another room, wait until we are clear before entering again
		if (truthy(this.inTrigger)) {
			this.inTrigger = this.instancePlace(this.x, this.y, oChar) !== null;
		} else if (truthy(this.open)) {
			const entering = this.instancePlace(this.x, this.y, oChar);
			if (entering !== null && this.enter_lyrs !== "") {
				game.saveLayersState();
				game.layerViz("*", 0);
				game.layerViz(this.enter_lyrs, 1);
				game.moveObjToLayer(entering, this.enter_clyr);
			}
			if (entering !== null && this.conRoom !== undefined) {
				game.gotoRoom(this.conRoom, this, this.conRoomEnter, 1, 1);
			}
			this.inTrigger = entering !== null;
		}

		if (this.open_sensor && !truthy(this.locked)) {
			this.sense_on = this.open_sensor.instancePlace(this.open_sensor.x, this.open_sensor.y, oActor);
			if (!truthy(this.manual_override)) {
				if (this.sense_on !== null && !truthy(this.open)) this.set_open(1, 1);
				else if (this.sense_on === null && truthy(this.open)) this.set_open(0, 1);
			}
			this.manual_override = truthy(this.manual_override) && this.sense_on !== null;
		}
	}

	// the wall goes with the door
	destroy() {
		super.destroy();
		if (this.wall_obj) this.wall_obj.destroy();
	}
}

class oChest extends oIaBgObject {}
oChest.ported = false;
class oDoor extends oIaBgObject {}
oDoor.ported = false;
class oRatDoor extends oDoor {}
oRatDoor.ported = false;
class oGameBoxV extends oIaBgObject {}
oGameBoxV.ported = false;
class oBike extends oIaBgObject {}
oBike.ported = false;

// Placeholder items: they keep the pickup shape, their use comes later.
class oPickupObj extends oIaBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initPickupable();
	}
}
mixin(oPickupObj, Pickupable);
oPickupObj.ported = false;

class oHoldObject extends oIaBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initPickupable();
	}
}
mixin(oHoldObject, Pickupable);
oHoldObject.ported = false;

// Placeholder items, each keeps its real parent and the pickup shape, their use comes later.
class oKey extends oIaBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initPickupable();
	}
}
mixin(oKey, Pickupable);
oKey.ported = false;

class oGun extends oIaBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initPickupable();
	}
}
mixin(oGun, Pickupable);
oGun.ported = false;

class oFlamer extends oIaBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initPickupable();
	}
}
mixin(oFlamer, Pickupable);
oFlamer.ported = false;

class oArBow extends oIaBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initPickupable();
	}
}
mixin(oArBow, Pickupable);
oArBow.ported = false;

class oMagnet extends oIaBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initPickupable();
	}
}
mixin(oMagnet, Pickupable);
oMagnet.ported = false;

class oRocketpack extends oIaBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initPickupable();
		this.active = 0;
	}
}
mixin(oRocketpack, Pickupable);
oRocketpack.ported = false;

class oSword extends oIaBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initMoveable();
		this.initPickupable();
	}
}
mixin(oSword, Pickupable);
oSword.ported = false;
class oBall extends oIaBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initMoveable();
		this.initPickupable();
	}
}
mixin(oBall, Pickupable);
oBall.ported = false;

// ---------------------------------------------------------------- others under the base

class oWater extends oBaseObject {}
// Repeats its sprite at unit size over its stretched area.
class oSpriteTiler extends oBaseObject {
	init() {
		const rec = Sprites.get(this.spi);
		this.w = rec ? rec.w : 0;
		this.h = rec ? rec.h : 0;
	}
	draw() {
		// a zero size would never finish
		if (!(this.w > 0) || !(this.h > 0)) return;
		for (let i = 0; i < this.sprite_width; i += this.w) {
			for (let k = 0; k < this.sprite_height; k += this.h) {
				Draw.spriteExt(this.spi, this.ifr, this.x + i, this.y + k, 1, 1, 0, this.col, this.alph);
			}
		}
	}
}
class oWaterFg extends oSpriteTiler {}
oWaterFg.ported = false;

class oFloorEffect extends oBaseObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.pvis = false;
	}
	// called by whoever stands on it so it can change their movement
	effect_obj(obj, acc, maxspd) {}
}

// An area that fires when a player character enters it and again when they leave.
// It can need the player wholly inside, under its height, or other conditions first,
// can wait some frames before firing, and can fire only once.
class oTrigger extends oBaseObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.pvis = false;
		// was on by default once, it almost never should be
		this.trigOnce = 0;
		this.only_inside = false;
		this.check_height = undefined;
		this.trigEvent = "none";
		this.trigReqs = 0;
		this.triggerer = oChar;
		this.whotriggered = null;
		this.inTrigger = false;
		this.triggered = false;
		this.no_trig_on_reenter = 0;
		this.offsetToTriggerer = false;
		this.offx = 0;
		this.offy = -10;
		this.trigtimes = 0;
		this.step = 0;
		this.triggerWaitToStart = 0;
		this.eventListStep = 0;
	}

	on_trigger() {
		console.log("triggered");
	}
	off_trigger() {
		console.log("off trigger");
	}

	update() {
		let tr = this.instancePlace(this.x, this.y, this.triggerer);
		// wholly inside means every edge of its box within ours
		if (tr !== null && truthy(this.only_inside) && !(tr.bbox_left >= this.bbox_left && tr.bbox_right <= this.bbox_right
			&& tr.bbox_top >= this.bbox_top && tr.bbox_bottom <= this.bbox_bottom)) tr = null;
		if (tr !== null && this.check_height !== undefined && tr.z > this.ht) tr = null;

		if (!truthy(this.inTrigger) && tr !== null && (!truthy(this.trigOnce) || this.trigtimes < 1)) {
			// Guess: the named thing in a requirement is looked up by name.
			let trigGo = true;
			if (Array.isArray(this.trigReqs)) {
				for (const req of this.trigReqs) {
					if (req[0] === "checkExists") {
						const who = game.lookupInst(req[1], this);
						if ((!!who && !who.destroyed) !== truthy(req[2])) {
							trigGo = false;
							break;
						}
					} else if (req[0] === "checkInstValEqu") {
						const who = game.lookupInst(req[1], this);
						if (!who || !eq(who[req[2]], req[3])) {
							trigGo = false;
							break;
						}
					}
				}
			}
			if (trigGo) {
				this.inTrigger = true;
				this.whotriggered = tr;
				this.triggered = false;
				this.step = 0;
			}
		}

		if (truthy(this.inTrigger) && !truthy(this.triggered) && this.step++ === this.triggerWaitToStart) {
			this.on_trigger();
			this.triggered = true;
			this.trigtimes++;
		}

		if (truthy(this.inTrigger) && tr === null) {
			this.off_trigger();
			this.inTrigger = false;
			this.whotriggered = tr;
		}
	}
}

// A trigger that runs a script on entering, and another on leaving if it has one.
class oTrigScript extends oTrigger {
	defaults(cfg) {
		super.defaults(cfg);
		this.triggerScript = [["say", "triggered", "actor", 0, -20, 50]];
		this.skippable = false;
		this.skipScript = [];
		this.trigOffScript = -1;
	}
	on_trigger() {
		Hooks.runScript(this.triggerScript, this.whotriggered, this.skippable, this.skipScript);
	}
	off_trigger() {
		if (this.trigOffScript !== -1) Hooks.runScript(this.trigOffScript, this.whotriggered);
	}
}

// An extra area for another trigger, passing on who entered and taking its settings.
class oTrigKid extends oTrigger {
	defaults(cfg) {
		super.defaults(cfg);
		this.trigDad = undefined;
	}
	init() {
		if (typeof this.trigDad === "string") this.trigDad = game.allObjects[this.trigDad];
		this.trigOnce = this.trigDad.trigOnce;
		this.check_height = this.trigDad.check_height;
	}
	on_trigger() {
		if (this.trigDad !== undefined) {
			this.trigDad.whotriggered = this.whotriggered;
			this.trigDad.on_trigger();
		}
	}
	off_trigger() {
		if (this.trigDad !== undefined) this.trigDad.off_trigger();
	}
}

// An area's bounds. Walking wholly inside a connected area moves the player into it.
class oGroupBounds extends oTrigScript {
	defaults(cfg) {
		super.defaults(cfg);
		this.group = null;
		this.only_inside = 1;
	}
	on_trigger() {
		if (this.group.type === LGT_CONNECTED) game.enterArea(this.group.name);
	}
}

// Brings an area into view while the player is inside it, and takes it out after.
class oVisBounds extends oTrigScript {
	defaults(cfg) {
		super.defaults(cfg);
		this.group = null;
		this.only_inside = 0;
	}
	on_trigger() {
		game.areaSetVis(this.group, 1);
	}
	off_trigger() {
		game.areaSetVis(this.group, 0);
	}
}

// A shape that limits what some layers show to where it covers. It sits in no layer and never runs.
// It has no parent in the original, it sits on the base here only to share engine state.
class oLayerMask extends oBaseObject {
	defaults(cfg) {
		super.defaults(cfg);
		this._mask = true;
		this.layer_list = [];
	}
}

// A sign: text in one of the pixel fonts, centred or placed by an offset, shadowed,
// and blinking when asked.
class oText extends oBaseObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.step = 0;
		this.font = "ftSmall";
		this.color = "#ffffff";
		this.alphac = 1;
		this.text = "";
		this.blinkr = 0;
		this.xoffset = "c";
		this.yoffset = 0;
		this.shadow = true;
		this.alphash = 1;
		this.center = 1;
		this.twidth = -1;
		this.linesep = -1;
	}

	// Kept from the original: the width for centring is measured before this sign's font is set,
	// so it uses whichever font was drawn last.
	draw() {
		if (truthy(this.blinkr)) {
			this.step = (this.step + 1) % (this.blinkr * 2);
			if (this.step > this.blinkr) return;
		}
		let xo;
		if (this.xoffset === "c") xo = -Math.floor(Draw.stringWidth(this.text)) / 2;
		else if (this.xoffset < 0) xo = -Math.floor(Draw.stringWidth(this.text));
		else xo = this.xoffset;
		const yo = this.yoffset;

		Draw.setFont(this.font);
		if (truthy(this.shadow)) {
			Draw.color = "#000000";
			Draw.alpha = this.alphac * this.alphash;
			Draw.textTransformed(this.x - this.exoffx + xo + 1, this.y - this.exoffy + yo + 1, this.text,
				this.linesep, this.twidth, 1, 1, this.ang);
		}
		Draw.color = this.color;
		Draw.alpha = this.alphac;
		Draw.textTransformed(this.x - this.exoffx + xo, this.y - this.exoffy + yo, this.text,
			this.linesep, this.twidth, 1, 1, this.ang);
		Draw.alpha = 1;
	}
}
class oStarField extends oBaseObject {}
oStarField.ported = false;

// Only marks the player start in the editor, the room swaps it for the real player.
// It has no parent in the original, it sits on the base here only to share engine state.
class oGuyPlacer extends oBaseObject {}

// ---------------------------------------------------------------- actors

// Anything that moves itself: contact flags, abilities and states for the movers.
class oActor extends oBaseObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.ch_side = 1;
		this.ch_topd = 0;

		this.step = 0;
		this.dead = false;

		this.onFloor = false;
		this.onFloorL = false;
		this.onFloorObj = null;
		this.hitFloor = false;
		this.atWall = false;
		this.atWallObj = null;
		this.hitWall = false;

		this.atWally = false;
		this.atWallyObj = null;
		this.hitWally = false;
		this.hitWallyObj = null;

		this.canHang = false;
		this.hanging = false;
		this.hangingObj = null;
		this.hangingObjBg = false;

		this.canClimb = true;
		this.climbH = 2;
		this.climb = false;
		this.climbp = false;

		this.canDive = false;
		this.diving = false;
		this.swimming = false;
		this.climbing = false;

		this.canRoll = false;
		this.rolling = 0;
		this.rolltime = 20;

		this.canCrawl = false;
		this.crawling = false;

		this.canSlide = false;
		this.sliding = 0;
		this.slideTime = 25;

		this.dropping = false;
		this.pushing = false;

		this.hit = 0;
		this.hit_dead = 0;

		this.yspd = 0;
		this.xspd = 0;
		this.rspd = 0;

		this.maxspd = 6;

		this.grav = 0.1;
		// most actors ignore this while moving, slides and the dead use it
		this.fric = 0.06;
		this.air_fric = 0.006;

		this.rx = 0;
		this.ry = 0;
		this.rz = 0;

		this.carriedBy = null;
		this.carrying = null;

		this.spriteShade = "#ffffff";
		this.drawSprite = "";

		this.initInteractive();

		this.in_pose = null;
	}

	// override for behavior
	acton(action, who) {}

	// The sprite flipped by facing, nudged a pixel when an odd width is flipped,
	// with the mask box and origin shown when the debug overlay is on.
	draw() {
		if (game.drawStats) {
			Draw.alpha = 0.5;
			Draw.color = "#00ff00";
			Draw.rectangle(this.bbox_left, this.bbox_top + this.z, this.bbox_right, this.bbox_bottom + this.z, 1);
			Draw.alpha = 1;
		}
		const xscale = this.facing === 0 ? 1 : this.facing;
		const xoadj = (truthy(this.xodd) && xscale < 0) ? 1 : 0;
		Draw.spriteExt(this.spi, this.ifr, this.x + xoadj, this.y, xscale, this.y_sc,
			this.ang, this.col, this.alph);
		if (game.drawStats) {
			Draw.color = truthy(this.facing) ? "#ff0000" : "#ff00ff";
			Draw.rectangle(this.x, this.y + this.z, this.x, this.y + this.z, 0);
		}
	}

	pose(pose_sk) {
		this.in_pose = (typeof pose_sk === "string") ? pose_sk : null;
	}

	// Knocked back by a hit. Side view pops up and away from the hitter, top down
	// either bounces back the way it came or flies away from the hitter, and hops.
	// A second hit while the first is still fresh is ignored.
	takeHit(hitbyx, hitbyy, hitbyf, bounce) {
		if (this.hit === 1) return;

		this.hit = 1;
		this.diving = 0;
		this.rolling = 0;

		if (truthy(this.ch_side)) {
			this.xspd = sign(this.x - hitbyx) * hitbyf * 0.8;
			this.yspd = -0.5 * hitbyf;
			this.facing = sign(this.xspd);
		} else {
			if (truthy(bounce)) {
				this.xspd = -this.xspd * hitbyf * 0.5;
				this.yspd = -this.yspd * hitbyf * 0.5;
			} else {
				const hitdir = pointDirection(hitbyx, hitbyy, this.x, this.y);
				this.xspd = lengthdirX(hitbyf, hitdir);
				this.yspd = lengthdirY(hitbyf, hitdir);
			}
			this.zspd = 0.4 * hitbyf;
			this.z += this.zspd;
		}
	}
}
mixin(oActor, Interactive);

// Placeholder: a dog that wanders once its brain is ported.
class oDoggie extends oActor {}
oDoggie.ported = false;
class oNpcChar extends oActor {}
oNpcChar.ported = false;

// Shared by the player characters only.
class oChar extends oActor {
	defaults(cfg) {
		super.defaults(cfg);
		this.status = null;
		// when on, death just lets the body fall away
		this.deadfall = 0;
		this.skin = "guy";
		this.con = null;
		// keeps the same facing, as in strafing
		this.lockface = 0;
		this.presenting = 0;
	}

	init() {
		const spi = this.skin + "_stand";
		if (Sprites.exists(spi)) {
			Draw.setSprite(this, spi);
		}
	}

	// do anything when the inventory closes
	inv_done() {}

	// Three turning sparkles over our head and the held item shown above them, twice for a glow.
	drawPresenting() {
		Draw.spriteExt("s_presenting", 0, this.x, this.y - 6, 1, 1, -Math.sin(currentTime() / 360) * 15, "#bbbbff", 0.4);
		Draw.spriteExt("s_presenting", 0, this.x, this.y - 8, 1, 1, Math.sin(currentTime() / 180) * 30, "#bbffbb", 0.4);
		Draw.spriteExt("s_presenting", 0, this.x, this.y - 8, 1, 1, Math.cos(currentTime() / 180) * 30, "#bbbbff", 0.4);
		Hooks.todo("inventory pictures of held items");
	}

	// Dies once: halves the speeds, sprays blood, and can vanish.
	// The spray itself is a later stage effect.
	kill(amount, time, xminmax, yminmax, leavevis, soundfx) {
		if (truthy(this.dead)) return null;
		this.dead = true;
		this.yspd = Math.max(this.yspd / 2, 0);
		this.xspd = this.xspd / 2;
		let deathSpray = null;
		if (truthy(this.pvis)) {
			deathSpray = Hooks.particles("death spray", this, this.x, this.y);
			this.pvis = leavevis === true || leavevis === 1;
			if (soundfx !== undefined) Hooks.sound(soundfx);
		}
		return deathSpray;
	}

	// The same death with a second burst, used by pits.
	killTwoBursts(amount, time, dirminmax, dirspdminmax, dir2minmax, dir2spdminmax, leavevis, soundfx) {
		if (truthy(this.dead)) return;
		this.dead = true;
		this.yspd = Math.max(this.yspd / 2, 0);
		this.xspd = this.xspd / 2;
		if (truthy(this.pvis)) {
			Hooks.particles("death spray, two bursts", this, this.x, this.y);
			this.pvis = leavevis === true || leavevis === 1;
			if (soundfx !== undefined) Hooks.sound(soundfx);
		}
	}

	// Using, dropping, giving and grabbing, shared by both player characters.
	// With something in hand: drop or give on the drop button, put away, use.
	// With an empty hand: look at or pick up whatever is in reach, or pull out an item.
	// When the hand empties mid way, later checks fall back to the player itself,
	// because the original's empty hand value also meant the asking object.
	charActOnObjs() {
		if (this.carrying) {
			// start a drop, measuring where the item will land
			if (this.con.iBtnY) {
				this.drop_request = 1;
				this.lockface = 1;
				const omi = this.carrying.mask;
				this.carrying.mask = this.carrying.dmi;
				if (truthy(this.ch_side)) {
					this.drop_offx = (this.carrying.x - this.x) * this.facing;
					this.drop_offy = this.carrying.y - this.y;
				} else {
					this.drop_offx = 3 + (this.facing < 0 ? (this.carrying.bbox_right + 1 - this.carrying.x) : (this.carrying.x - this.carrying.bbox_left));
					this.drop_offy = 2 + (this.facingy < 0 ? (this.carrying.bbox_bottom + 1 - this.carrying.y) : (this.carrying.y - this.carrying.bbox_top));
				}
				this.carrying.mask = omi;
			}
			// release drops it, or gives it to whoever is in reach and wants it
			if (this.con.iBtnYr) {
				if (this.lookObjs.length > 0) {
					if (truthy(this.lookObjs[0].acton("give", this, { item: this.carrying }))) {
						this.carrying = null;
						this.cur_held_i = -1;
					}
				} else {
					this.carrying.x = this.x + this.drop_offx * this.facing;
					// side view counts as facing down for the drop height
					this.carrying.y = this.y + this.drop_offy * (this.facingy + this.ch_side);
					this.carrying.drop();
					this.carrying = null;
					this.cur_held_i = -1;
				}
				this.drop_request = 0;
				this.lockface = 0;
			}
			if (this.con.iBtnB) {
				this.inv.switch_held(-1);
			}
			if (this.con.iBtnX) {
				if ((this.carrying || this).use(this) === "drop") {
					(this.carrying || this).carriedBy = null;
					this.carrying = null;
					this.cur_held_i = -1;
				}
			}
			if (this.con.iBtnXd) {
				(this.carrying || this).use_c(this);
			}
			if (this.con.iBtnXr) {
				(this.carrying || this).use_r(this);
			}
		} else if (this.lookObjs.length > 0) {
			for (const lobj of this.lookObjs) {
				// someone else is holding it
				if (lobj.carriedBy) continue;
				if (this.con.iBtnX) {
					lobj.acton("look", this);
				}
				if (this.con.iBtnB) {
					lobj.pickup(this);
				}
			}
			// show the name of whatever we just picked up
			if (this.carrying) {
				Hooks.popMessage(this, this.carrying.gname, 0, -12);
			}
		} else if (this.con.iBtnB) {
			this.inv.switch_back();
		}

		// open hand fighting, kept apart so the look list still gets used
		if (truthy(this.canFight) && !truthy(this.punching) && !this.carrying && this.con.iBtnX) {
			if (truthy(this.jumped)) {
				this.punching = 10;
				// a kick pushes forward and loses some rise
				let sadj = 0;
				if (this.yspd < 0) {
					sadj = Math.abs(this.yspd / 2);
					this.yspd += sadj;
				}
				this.xspd = this.facing * Math.max(Math.abs(this.xspd) + sadj, 0.9);
			} else if (truthy(this.crawling) || truthy(this.sliding)) {
				this.punching = 10;
				this.xspd = 0.9 * this.facing;
			} else {
				this.punching = 8;
				this.xspd = 0.8 * this.facing;
			}
		}
	}

	// Dead but just falling away, ignoring everything.
	killFall() {
		this.deadfall = 1;
		this.dead = 1;
		this.hitWall = 0;
		this.hitFloor = 0;
		this.onFloor = 0;
	}
}

// ---------------------------------------------------------------- stand ins for what is not ported

// Rooms place many objects that have no class here yet. Each still gets a class of its own
// name, built from the original's list of parents on top of the nearest ported one, so it keeps
// the parent's collision and drawing and shows as an outlined, labeled stand in.
// The list of parents is a generated file read with the world.
const STANDIN_MAX_DEPTH = 40;

class Standins {
	constructor() {
		this.parents = {};
		this.made = {};
	}

	load(info) {
		this.parents = info && info.parents ? info.parents : {};
		this.made = {};
	}

	// the class for an original object name, or nothing when the name is not an original object
	classFor(name, depth) {
		if (this.made[name] !== undefined) return this.made[name];
		if (!Object.prototype.hasOwnProperty.call(this.parents, name)) return undefined;
		depth = depth === undefined ? 0 : depth;
		const parentName = this.parents[name];
		let base = oBaseObject;
		if (parentName && depth < STANDIN_MAX_DEPTH) {
			base = OBJECT_TYPES[parentName] || this.classFor(parentName, depth + 1) || oBaseObject;
		}
		// the key names the class, so labels and logs show the original's name
		const cls = ({ [name]: class extends base {} })[name];
		cls.ported = false;
		cls.standin = true;
		this.made[name] = cls;
		return cls;
	}
}

const standins = new Standins();

// ---------------------------------------------------------------- lookup by name

// Room files name their objects, this maps the names to classes.
// Player classes are added by their own files.
const OBJECT_TYPES = {
	oBaseObject, oObject, oGround, oFloor, oSolidFloor, oWall, oGlass, oGlassv, oFloorThru,
	oPlatform, oPlank, oBox, oSolidGr, oIaSolidGr, oBlankGr, oGrWall, oGrWall2, oOneWayDoor,
	oBoxFall, oGrTechno, oGrTechnoVoid, oJgHeart, oJgLogShooter, oBird, oBouncer, oTank,
	oIaObject, oCrate, oCrateSt, oCrateBg, oCrateMetal,
	oBgObject, oIaBgObject, oClimbableObj, oLadder, oPit, oRope, oLogEater, oAniSpark,
	oChest, oDoor, oRatDoor, oGameBoxV, oBike, oPickupObj, oHoldObject,
	oKey, oGun, oFlamer, oArBow, oMagnet, oRocketpack, oSword, oBall,
	oWater, oSpriteTiler, oWaterFg, oFloorEffect, oTrigger, oTrigScript, oTrigKid,
	oGroupBounds, oVisBounds, oLayerMask, oLyrDoor,
	oText, oStarField, oGuyPlacer, oActor, oDoggie, oNpcChar, oChar
};

// The class for an object name a room file uses: a ported one, else a stand in, else nothing.
function objectType(name) {
	return OBJECT_TYPES[name] || standins.classFor(name);
}
