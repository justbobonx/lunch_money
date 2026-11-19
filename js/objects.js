// The object class tree, following the original parents one to one, plus the two
// classic mixins every interactive or pickupable object shares.
// Ported so far: what the player's physics touches (solids, one way floors, ladders, water,
// the loose crates), how each of those draws, the triggers, text signs, layer doors and masks.
// Everything else is a placeholder that keeps its parent, its collision flags and its
// parent's drawing, and gets a labeled outline.

// ---------------------------------------------------------------- tunables

// Flying bird. It drifts slowly while nothing rides it and speeds up with a rider.
const BIRD_IDLE_SPEED = 0.3;
const BIRD_RIDING_SPEED = 2;
// it dips on every third animation frame and rises on the others
const BIRD_DIP_SPEED = 0.3;
const BIRD_RISE_SPEED = -0.15;
const BIRD_DIP_FRAME_CYCLE = 3;
// one trip lasts this many updates, and it only flies for the first part of it unless ridden
const BIRD_LOOP_UPDATES = 400;
const BIRD_FLY_UPDATES = 340;

// Log shooter and its logs.
// updates between shots, and how long before a shot the barrel starts to open
const LOG_SHOT_RATE = 210;
const LOG_SHOT_WARNING = 40;
const LOG_SHOT_SPEED = 0.8;
// the log is made this far in front of the shooter, then moved to the muzzle
const LOG_MAKE_OFFSET_X = 3;
const LOG_MUZZLE_OFFSET_X = 6;
// shooter frames: closed, opening, and the first frame of the firing animation
const LOG_SHOOTER_CLOSED_FRAME = 0;
const LOG_SHOOTER_OPENING_FRAME = 1;
const LOG_SHOOTER_FIRING_FRAME = 2;
// a log loses this much sideways speed bouncing off a wall, and falls with this gravity
const LOG_WALL_BOUNCE_LOSS = 0.1;
const LOG_GRAVITY = 0.05;
// a log turns a quarter turn this many times per roll, over this many updates
const LOG_ROLL_UPDATES = 60;
const LOG_ROLL_STEPS = 4;
// what hitting the player does: spray amount, spray time, and how much the log's speed pushes the spray
const LOG_KILL_SPRAY_AMOUNT = 20;
const LOG_KILL_SPRAY_TIME = 10;
const LOG_KILL_SPRAY_PUSH = 0.5;
// the pop that shows where a log was eaten sits just above it
const LOG_POP_OFFSET_Y = -1;

// Falling box.
// the box is eased aside this far when it lands on the very edge of something, and dropped a pixel
const BOXFALL_EDGE_NUDGE_X = 5;
const BOXFALL_EDGE_NUDGE_Y = 1;
// its start drift and spin
const BOXFALL_DRIFT = 0.1;
const BOXFALL_SPIN_EXTRA = 0.2;
// its full life, and how many frames its picture shows as it runs down
const BOXFALL_LIFE = 130;
const BOXFALL_LIFE_FRAMES = 3;
// the camera shake when it lands: updates, sideways and up and down strength
const BOXFALL_SHAKE_UPDATES = 8;
const BOXFALL_SHAKE_X = 2;
const BOXFALL_SHAKE_Y = 1;

// Ball.
// sideways speed lost hitting a wall, and kept each update on the floor
const BALL_WALL_BOUNCE_LOSS = 0.1;
const BALL_FLOOR_SIDE_KEEP = 0.9;
// when it hits a floor: the sideways speed kept, the bounce kept, and the speed below which it just stops
const BALL_LAND_SIDE_KEEP = 0.95;
const BALL_BOUNCE_KEEP = 0.8;
const BALL_REST_SPEED = 0.3;
const BALL_GRAVITY = 0.04;
// thrown: forward speed added to the thrower's, and the lift
const BALL_THROW_FORWARD = 1.5;
const BALL_THROW_LIFT = 1.2;

// Dog.
// how far away the owner can be before it gives up following, when fetching or returning, and when it
// has to catch up faster
const DOG_GIVE_UP_DISTANCE = 100;
const DOG_FETCH_GIVE_UP_DISTANCE = 500;
const DOG_RETURNED_DISTANCE = 100;
const DOG_CATCH_UP_DISTANCE = 40;
// the catch up boost grows by this much, from the catch up distance over this span, or from the distance
// over this many pixels when fetching
const DOG_BOOST_PER_LEVEL = 0.2;
const DOG_BOOST_SPAN = 60;
const DOG_FETCH_BOOST_SPAN = 100;
const DOG_MIN_CATCH_UP_SPEED = 1;
const DOG_MIN_SPEED = 0.5;
const DOG_MAX_SPEED = 2.5;
// near enough to stop beside the owner
const DOG_STOP_DISTANCE = 12;
const DOG_ACCELERATION = 0.3;
// jumping for a thrown ball it is under: sideways reach and the height band above it
const DOG_JUMP_REACH_X = 3;
const DOG_JUMP_BAND_NEAR = -10;
const DOG_JUMP_BAND_FAR = -30;
const DOG_JUMP_SPEED = 1.8;
const DOG_JUMP_SPEED_BONUS = 0.3;
// how it notices an owner, the bark message, and where a carried ball sits
const DOG_BARK_TEXT = "BARK!";
const DOG_BARK_FADE_START = 10;
const DOG_BARK_FADE_TIME = 30;
const DOG_BARK_FLOAT_Y = -0.35;
const DOG_CARRY_OFFSET_MOVING = 5.5;
const DOG_CARRY_OFFSET_STILL = 4.5;
const DOG_CARRY_HIGH_Y = 2;
const DOG_CARRY_LOW_Y = 3;

// Rat chaser.
const RAT_FOLLOW_DISTANCE_DEFAULT = 100;
const RAT_TURNAROUND_MIN = 8;
const RAT_TURNAROUND_MAX = 14;
const RAT_SPEED_MIN = 0.5;
const RAT_SPEED_MAX = 0.8;
// close enough to bite, and close enough to start chasing
const RAT_BITE_DISTANCE = 4;
const RAT_NOTICE_DISTANCE = 50;
// farther than this it runs at double speed
const RAT_SPRINT_DISTANCE = 100;
const RAT_SPRINT_BOOST = 2.1;
const RAT_ACCELERATION = 0.2;
// a one in this many chance each update on the floor to hop
const RAT_HOP_ODDS = 60;
const RAT_HOP_MIN = -0.9;
const RAT_HOP_MAX = -1.5;
const RAT_WALL_JUMP_SPEED = 1.6;
const RAT_WALL_JUMP_BONUS = 0.2;
const RAT_BITE_SPRAY_AMOUNT = 100;
const RAT_BITE_SPRAY_TIME = 10;
const RAT_AIR_FRAME = 1;

// Rat door.
const RATDOOR_RATS_MIN = 30;
const RATDOOR_RATS_EXTRA = 5;
const RATDOOR_FIRST_RAT_WAIT = 60;
const RATDOOR_FIRST_SQUEAK_WAIT = 1;
const RATDOOR_SQUEAK_WAIT_MIN = 40;
const RATDOOR_SQUEAK_WAIT_SHORT_MAX = 60;
const RATDOOR_SQUEAK_WAIT_LONG_MAX = 300;
// one squeak wait in this many plus one is the short kind
const RATDOOR_SHORT_WAIT_ODDS = 3;
const RATDOOR_RAT_WAIT_MIN = 5;
const RATDOOR_RAT_WAIT_MAX = 12;
const RATDOOR_RAT_FOLLOW_DISTANCE = 500;
const RATDOOR_SQUEAKS = ["skreee", "skreee", "skrich"];

// Player revive.
// the sprite fields a revive leaves alone: where it is, its name, its layer, and whether it is gone or switched off
const REVIVE_KEEP_FIELDS = ["x", "y", "name", "mylayer", "destroyed", "pdis"];

// Star field. These are the defaults a room's settings can change.
// how many stars per square pixel of the field, and the field size used until it knows its picture
const STARS_PER_PIXEL = 0.005;
const STARS_DEFAULT_W = 255;
const STARS_DEFAULT_H = 339;
const STARS_SPRITE = "star1";
const STARS_COLOR = "#c8c8ff";
// how fast each star's twinkle turns, picked between these per star
const STARS_TWINKLE_SPEED_MIN = 0.005;
const STARS_TWINKLE_SPEED_MAX = 0.02;
// a star's depth is this much plus up to the range, deeper ones drift and stretch more
const STARS_DEPTH_MIN = 0.1;
const STARS_DEPTH_RANGE = 0.9;
// a star's brightness swings between the base and the base plus the swing
const STARS_BRIGHTNESS_BASE = 0.1;
const STARS_BRIGHTNESS_SWING = 0.8;
// the dark cover over the field
const STARS_COVER_COLOR = "#000000";
const STARS_COVER_ALPHA = 1;
// shooting stars: how often, in milliseconds, with how much extra random wait, and how long before the first
const SHOOTER_FREQ = 0;
const SHOOTER_FREQ_VAR = 3000;
const SHOOTER_FIRST_WAIT = 1000;
const SHOOTER_SPRITE = "sShootingStar";
// their speed, where they start as a share of the field, and how they fade in and out
const SHOOTER_XSPD = -6;
const SHOOTER_YSPD = 1;
const SHOOTER_START_X_MIN = 0.3;
const SHOOTER_START_X_MAX = 1;
const SHOOTER_START_Y_MIN = 0;
const SHOOTER_START_Y_MAX = 0.5;
const SHOOTER_START_ALPHA = 0;
const SHOOTER_START_ALPHA_VAR = 0;
const SHOOTER_FADE_IN_SPEED = 0.04;
const SHOOTER_FADE_IN_SPEED_VAR = 0.08;
const SHOOTER_MAX_ALPHA = 0.8;
const SHOOTER_MAX_ALPHA_VAR = 0.1;
const SHOOTER_DEPTH = 1;
const SHOOTER_DEPTH_VAR = 0;
// once at full strength it fades out at this plus up to the range per update
const SHOOTER_FADE_OUT_MIN = 0.01;
const SHOOTER_FADE_OUT_RANGE = 0.1;

// Snow pile.
// the pile settles for this many updates after someone leaves before it can puff again
const SNOW_PUFF_COOLDOWN = 5;
// its own animation speed when stepped on: this plus up to the range
const SNOW_SQUISH_SPEED_MIN = 0.8;
const SNOW_SQUISH_SPEED_RANGE = 0.4;
// the puff's start frame depends on how hard they landed, up to this many frames in
const SNOW_PUFF_FRAMES = 4;
const SNOW_PUFF_LANDING_SCALE = 4;
// the puff's speed, set here though its own first update replaces it, as in the original
const SNOW_PUFF_SPEED_MIN = 0.7;
const SNOW_PUFF_SPEED_RANGE = 0.5;
const SNOW_PUFF_SPRITE = "s_snow_poof";

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
		// kept so the object can be made fresh again in place
		this.startCfg = cfg;
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

// A box that falls with a slow tumble, lands on the first floor it finds, and shakes the camera.
// If it lands on the very edge of something it is eased off to the side first. Its picture steps
// through frames as its life runs down. Nothing in the original ever lowers its life, so it
// stays where it landed unless something else removes it.
class oBoxFall extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.initMoveable();
		this.landed = false;
		this.xspd = rng.randomRange(-BOXFALL_DRIFT, BOXFALL_DRIFT);
		this.yspd = rng.randomRange(-BOXFALL_DRIFT, BOXFALL_DRIFT);
		this.rspd = (this.yspd / 3 + rng.random(BOXFALL_SPIN_EXTRA)) * (rng.random(10) < 5 ? -1 : 1);
		this.spd = 0;
		this.ifr = 0;
		this.life = BOXFALL_LIFE;
	}

	update() {
		if (this.life === 0) {
			this.destroy();
			return;
		}

		if (truthy(this.landed)) return;

		this.lastx = this.x;
		this.lasty = this.y;

		this.calcOnFloorAtWall();

		if (truthy(this.onFloor)) {
			const ho = this.onFloorObj;
			if (ho !== null && this.y < ho.y) {
				if (this.x < ho.x && this.x < ho.bbox_left) {
					this.x -= BOXFALL_EDGE_NUDGE_X;
					this.y += BOXFALL_EDGE_NUDGE_Y;
					this.rspd = Math.abs(this.rspd);
				} else if (this.x > ho.x && this.x > ho.bbox_right) {
					this.x += BOXFALL_EDGE_NUDGE_X;
					this.y += BOXFALL_EDGE_NUDGE_Y;
					this.rspd = -Math.abs(this.rspd);
				}
				this.calcOnFloorAtWall();
			}
		}
		if (truthy(this.onFloor)) {
			Hooks.sound("sndThud");
			this.landed = true;
			game.cam.shakeit(BOXFALL_SHAKE_UPDATES, BOXFALL_SHAKE_X, BOXFALL_SHAKE_Y);
		}

		this.ang += this.rspd;

		this.moveThroughObjects(this.xspd, this.yspd);
	}

	// the frame follows the life left
	draw() {
		this.ifr = BOXFALL_LIFE_FRAMES - Math.ceil(this.life / BOXFALL_LIFE * BOXFALL_LIFE_FRAMES);
		Draw.lpSprite(this);
	}
}
oBoxFall.defaultSprite = "s_box_thru";

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

// Shoots a log out of its front now and then, facing the way it is stretched. The barrel opens
// a little ahead of each shot and its firing animation plays out and stops on the closed frame.
// A shooter can be switched off by its room entry.
class oJgLogShooter extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.hangable = false;
		this.landed = true;
		// each starts at a random point in its cycle so a row of them does not fire together
		this.step = rng.irandom(LOG_SHOT_RATE - LOG_SHOT_WARNING - 1);
		this.shotSpd = LOG_SHOT_SPEED;
		this.spd = 0;
		this.ifr = LOG_SHOOTER_CLOSED_FRAME;
		this.on = true;
	}

	update() {
		if (!truthy(this.on)) return;

		this.step++;

		if (this.step === LOG_SHOT_RATE - LOG_SHOT_WARNING) {
			this.ifr = LOG_SHOOTER_OPENING_FRAME;
		} else if (this.step === LOG_SHOT_RATE) {
			// made at the first spot so its remembered last spot is there, then moved to the muzzle
			const nextLog = game.createObject(oJgLog, { x: this.x + LOG_MAKE_OFFSET_X * this.x_sc, y: this.y }, this.mylayer);
			nextLog.x = this.x + LOG_MUZZLE_OFFSET_X * this.x_sc;
			nextLog.xspd = this.shotSpd * this.x_sc;

			Hooks.sound("snd8bPoofShoot");

			this.step = 0;
			this.ifr = LOG_SHOOTER_FIRING_FRAME;
			this.spd = 1;
		}
	}

	// Stops the animation once it comes round to the closed frame.
	draw() {
		Draw.lpSprite(this);
		if (Math.floor(this.ifr) === LOG_SHOOTER_CLOSED_FRAME) this.spd = 0;
	}
}

// A rolling log. It falls, bounces off walls losing a little speed, hurts the player on touch,
// and is eaten, with a pop, by any log eater it overlaps. It is a solid object itself.
class oJgLog extends oObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.spd = 0;
		this.initMoveable();
		this.rollst = 0;
		this.on = true;
	}

	update() {
		this.calcOnFloorAtWall();

		// bounce off a wall and slow a little
		if (this.atWall) {
			this.xspd = -sign(this.xspd) * Math.max(Math.abs(this.xspd) - LOG_WALL_BOUNCE_LOSS, 0);
		}
		if (this.onFloor) {
			this.yspd = 0;
		} else {
			this.yspd += LOG_GRAVITY;
		}

		if (this.onFloor && !this.onFloorL) Hooks.sound("snd8bThud");

		this.moveThroughObjects(this.xspd, this.yspd);

		if (truthy(this.on) && this.instancePlace(this.x, this.y, game.guy) !== null) {
			killGuy(LOG_KILL_SPRAY_AMOUNT, LOG_KILL_SPRAY_TIME,
				[-1 + this.xspd * LOG_KILL_SPRAY_PUSH, 1 + this.xspd * LOG_KILL_SPRAY_PUSH], 0, 1, "sndHit1");
		}

		const eater = this.instancePlace(this.x, this.y, oLogEater);
		if (eater !== null) {
			game.createObject(oFxOneShot, { x: this.x, y: this.y + LOG_POP_OFFSET_Y, spi: eater.popType }, this.mylayer);
			if (eater.popSound >= 0) Hooks.sound(eater.popSound);
			this.destroy();
			return;
		}

		this.rollst = (this.rollst + 1) % LOG_ROLL_UPDATES;

		this.ang = Math.floor(this.rollst / LOG_ROLL_UPDATES * LOG_ROLL_STEPS) * 90 * sign(this.xspd);
	}
}

// Made by code, not placed by a room, so it has to bring its own sprite or it has no picture and no mask.
oJgLog.defaultSprite = "sJgLog";

// A one time animation: hidden until its optional start delay is over, then plays once at its
// own speed while drifting and fading as asked, and is gone when the animation ends.
class oFxOneShot extends oBaseObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.delaystart = 0;
		// overrides the asset's pace
		this.ispeed = 1;
		this.xspd = 0;
		this.yspd = 0;
		// how much it fades per update
		this.aspd = 0;
		this.pvis = false;
		this.spd = 0;
		this.onAnimEnd = (self) => self.destroy();
	}

	update() {
		if (this.delaystart > 0) {
			this.delaystart--;
		} else {
			this.pvis = true;
			this.spd = this.ispeed;

			this.x += this.xspd;
			this.y += this.yspd;
			this.alph -= this.aspd;
		}
	}
}

// Kills the player: the first time only, slows them, and when they are still shown, sprays and
// hides them unless told to leave them showing. The spray details are for the particle stage.
function killGuy(amount, time, xminmax, yminmax, leavevis, soundfx) {
	const guy = game.guy;
	if (truthy(guy.dead)) return;

	guy.dead = true;
	guy.yspd = Math.max(guy.yspd / 2, 0);
	guy.xspd = guy.xspd / 2;

	if (amount === undefined) amount = 0;
	if (time === undefined) time = 1;

	// only if they are still there
	if (truthy(guy.pvis)) {
		Hooks.particles("death spray", guy, guy.x, guy.y, {
			amount: amount / time, time: time,
			xminmax: (xminmax !== undefined && xminmax !== 0) ? xminmax : [-1, 1],
			yminmax: (yminmax !== undefined && yminmax !== 0) ? yminmax : [-1, 0],
			sizeminmax: [0.25, 1],
			colors: ["#ff0000", "#990000", "#cc0000"]
		});

		guy.pvis = truthy(leavevis);

		if (soundfx !== undefined) Hooks.sound(soundfx);
	}
}

// Floats up and down along its way, riding the player with it when they stand or hang on it.
// It moves by its speeds alone, passing through everything. Its dip and rise follow its own
// animation frame, so they only advance while it is drawn.
class oBird extends oGround {
	defaults(cfg) {
		super.defaults(cfg);
		this.initMoveable();
		this.hangable = true;
		this.xspd = BIRD_IDLE_SPEED;
		this.rx = 0;
		this.ry = 0;
		this.step = 0;
	}

	update() {
		let riding = false;
		let rider = this.instancePlace(this.x, this.y - 1, game.guy);

		if (rider !== null && truthy(rider.onFloor)) {
			riding = true;
		} else {
			rider = this.instancePlace(this.x - 1, this.y, game.guy);
			if (rider === null) rider = this.instancePlace(this.x + 1, this.y, game.guy);
			if (rider !== null && truthy(rider.hanging)) riding = true;
		}

		this.xspd = sign(this.xspd) * (riding ? BIRD_RIDING_SPEED : BIRD_IDLE_SPEED);

		this.yspd = Math.floor(this.ifr) % BIRD_DIP_FRAME_CYCLE === 0 ? BIRD_DIP_SPEED : BIRD_RISE_SPEED;

		this.step = (this.step + 1) % BIRD_LOOP_UPDATES;

		if (this.step < BIRD_FLY_UPDATES || riding) {
			this.moveIgnoringObjects(this.xspd, this.yspd);
		}
	}
}

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
		this.climbable = true;
		this.jumpoff = true;
		this.twoway = true;
	}
}
class oLadder extends oClimbableObj {}

// Falling in kills, checked by the side view player.
class oPit extends oBgObject {}

// A rope to hang from. While the player hangs from this one they are kept right on it, so they
// slide along its middle rather than where they grabbed.
class oRope extends oBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.hangable = true;
	}
	update() {
		if (game.guy.hangingObj === this) {
			game.guy.x = this.x;
		}
	}
}
oRope.defaultSprite = "rope";

// An invisible area that eats any log touching it, which pops there. Logs ask it what pop to
// show and what sound to play. Its marker sprite is only for placing it, so it draws nothing.
class oLogEater extends oBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.hangable = false;
		this.landed = true;
		this.popType = "sAniPop";
		this.popSound = -1;
	}
	draw() {}
}

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
// A door that opens and closes by hand, a frame each, and goes to another room when walked into
// while open and the player presses up. The original's default room is not in this room list,
// so a door goes nowhere until its room entry gives a room.
class oDoor extends oIaBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.spd = 0;
		this.conRoom = undefined;
		this.roomEntInst = undefined;
	}

	acton(action, who) {
		this.ifr = (this.ifr + 1) % 2;
	}

	update() {
		if (truthy(this.inview) && Math.floor(this.ifr) === 1 && game.guy.con.iUpP && this.conRoom !== undefined) {
			game.gotoRoom(this.conRoom, this, this.roomEntInst, 1, 1);
		}
	}
}
oDoor.defaultSprite = "sDoor";

// A door that lets rats out. While shut it squeaks now and then, and while open it lets out a
// fixed number of rats one after another, each chasing the player from far away. Using it
// warns the player once there are rats left. Its own update replaces the plain door's, as in
// the original, so it never takes the player to another room.
class oRatDoor extends oDoor {
	defaults(cfg) {
		super.defaults(cfg);
		this.nextScree = RATDOOR_FIRST_SQUEAK_WAIT;
		this.rats = RATDOOR_RATS_MIN + rng.irandom(RATDOOR_RATS_EXTRA);
		this.nextRat = RATDOOR_FIRST_RAT_WAIT;
	}

	acton(action, who) {
		super.acton(action, who);

		if (this.rats === 0) return;

		Hooks.popMessage(0, "RUN!!!", this.x - 11, this.y - 18, { fadestart: 60, floatspdy: -0.15 });
	}

	update() {
		if (this.rats > 0 && Math.floor(this.ifr) === 0 && --this.nextScree === 0) {
			this.nextScree = rng.irandomRange(RATDOOR_SQUEAK_WAIT_MIN,
				rng.irandom(RATDOOR_SHORT_WAIT_ODDS) === 0 ? RATDOOR_SQUEAK_WAIT_SHORT_MAX : RATDOOR_SQUEAK_WAIT_LONG_MAX);

			// the original picked a spot to squeak from and then never used it, but the random numbers
			// still came out, so they are drawn here to keep the sequence
			rng.irandomRange(-10, 5);
			rng.irandomRange(-12, -4);

			const floatspdy = -0.15 - rng.random(0.1);
			const floatspdx = rng.randomRange(-0.05, 0.05);
			Hooks.popMessage(0, rng.choose(...RATDOOR_SQUEAKS), this.x - 11, this.y - 12,
				{ alpha: 0.5, floatspdy: floatspdy, floatspdx: floatspdx });
		}

		if (Math.floor(this.ifr) === 1 && this.rats > 0 && --this.nextRat === 0) {
			this.rats--;
			this.nextRat = rng.irandomRange(RATDOOR_RAT_WAIT_MIN, RATDOOR_RAT_WAIT_MAX);
			const rat = game.createObject(oNpc_Chaser, { x: this.x, y: this.y }, this.mylayer);
			rat.following = true;
			rat.max_follow_dist = RATDOOR_RAT_FOLLOW_DISTANCE;
			rat.init();
		}
	}
}
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
// A ball to carry and throw. Used, it is dropped with the thrower's speed plus a forward and up
// push. It falls, loses speed on walls, bounces off floors until the bounce is too small, and
// rolls to a stop. It does not move while carried.
class oBall extends oIaBgObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.initMoveable();
		this.initPickupable();
		this.spd = 0;
	}

	use(who, user) {
		if (this.carriedBy === null) return;

		const thrower = this.carriedBy;

		thrower.inv.drop_held();

		// the throw replaces the drop's speeds
		this.xspd = thrower.xspd + sign(thrower.facing) * BALL_THROW_FORWARD;
		this.yspd = thrower.yspd - BALL_THROW_LIFT;
	}

	update() {
		this.calcOnFloorAtWall();

		if (truthy(this.hitWall) || truthy(this.atWall)) {
			this.xspd = -sign(this.xspd) * Math.max(Math.abs(this.xspd) - BALL_WALL_BOUNCE_LOSS, 0);
		}
		if (truthy(this.hitFloor)) {
			// the original wrapped this test in an absolute value, so it only ever tests the speed
			this.yspd = this.yspd < BALL_REST_SPEED ? 0 : -sign(this.yspd) * Math.max(Math.abs(this.yspd) * BALL_BOUNCE_KEEP, 0);
			this.xspd = sign(this.xspd) * Math.max(Math.abs(this.xspd) * BALL_LAND_SIDE_KEEP, 0);
		}
		if (truthy(this.onFloor)) {
			this.xspd = sign(this.xspd) * Math.max(Math.abs(this.xspd) * BALL_FLOOR_SIDE_KEEP, 0);
		} else {
			this.yspd += BALL_GRAVITY;
		}

		if (!this.carriedBy) {
			this.moveThroughObjects(this.xspd, this.yspd);
		}
	}
}
mixin(oBall, Pickupable);
oBall.defaultSprite = "sBall";

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
// A field of twinkling stars filling its stretched area, with an optional dark cover and
// shooting stars. Stars drift by the field's speed, deeper ones faster and stretched more, and
// wrap round the edges. Everything about it comes from the room's settings for it: speeds, the
// star picture and colour, how many, the cover colour and strength, and the shooting star
// timing, speed, fade, depth and the warp stretch. The stars are made once everything exists, since
// they need the final size. Like the original it all runs as it draws, and shooting stars wait in
// real time, so it stands still when drawing is paused.
class oStarField extends oBaseObject {
	defaults(cfg) {
		super.defaults(cfg);

		this.starfield = [];
		this.sfsize = 500;
		this.st_per_sqp = STARS_PER_PIXEL;
		this.starst = 0;

		this.star_sprite = STARS_SPRITE;

		this.starfw = STARS_DEFAULT_W;
		this.starfh = STARS_DEFAULT_H;

		this.velox = 0;
		this.veloy = 0;

		this.st_color = STARS_COLOR;
		this.twinkle_spd_min = STARS_TWINKLE_SPEED_MIN;
		this.twinkle_spd_max = STARS_TWINKLE_SPEED_MAX;

		this.covercolor = STARS_COVER_COLOR;
		this.coveralpha = STARS_COVER_ALPHA;

		this.shooters = [];
		// zero turns them off
		this.shooterFreq = SHOOTER_FREQ;
		this.shooterFreqVar = SHOOTER_FREQ_VAR;
		this.nextShot = currentTime() + SHOOTER_FIRST_WAIT;

		this.shooters_spr = SHOOTER_SPRITE;
		this.sh_xspd = SHOOTER_XSPD;
		this.sh_yspd = SHOOTER_YSPD;
		this.sh_stxmin = SHOOTER_START_X_MIN;
		this.sh_stxmax = SHOOTER_START_X_MAX;
		this.sh_stymin = SHOOTER_START_Y_MIN;
		this.sh_stymax = SHOOTER_START_Y_MAX;
		// past this x a shooting star is gone, none by default
		this.sh_endx = undefined;
		this.starta = SHOOTER_START_ALPHA;
		this.startavar = SHOOTER_START_ALPHA_VAR;
		this.startaspd = SHOOTER_FADE_IN_SPEED;
		this.startaspdvar = SHOOTER_FADE_IN_SPEED_VAR;
		this.maxa = SHOOTER_MAX_ALPHA;
		this.maxavar = SHOOTER_MAX_ALPHA_VAR;
		this.shdepth = SHOOTER_DEPTH;
		this.shdepthvar = SHOOTER_DEPTH_VAR;

		// stretches shooting stars sideways by this times their depth, none when off
		this.warpspeed = 0;
	}

	// Takes the field's size from its stretched picture and scatters the stars.
	init() {
		this.starfw = this.sprite_width;
		this.starfh = this.sprite_height;

		this.sfsize = this.st_per_sqp * this.starfw * this.starfh;

		this.nextShot = currentTime() + rng.irandom(this.shooterFreqVar);

		for (let i = 0; i < this.sfsize; i++) {
			this.starfield.push({
				sprite: this.star_sprite,
				x: rng.irandom(Math.floor(this.starfw)),
				y: rng.irandom(Math.floor(this.starfh)),
				color: this.st_color,
				arot: rng.random(2 * Math.PI),
				tw_speed: rng.randomRange(this.twinkle_spd_min, this.twinkle_spd_max),
				depth: STARS_DEPTH_MIN + rng.random(STARS_DEPTH_RANGE)
			});
		}
	}

	draw() {
		const ox = this.x - this.exoffx;
		const oy = this.y - this.exoffy;

		if (this.coveralpha > 0) {
			Draw.color = this.covercolor;
			Draw.alpha = this.coveralpha;
			Draw.rectangle(this.x, this.y, this.x + this.starfw, this.y + this.starfh, 0);
			Draw.alpha = this.alph;
		}

		for (const star of this.starfield) {
			star.arot = (star.arot + star.tw_speed) % (2 * Math.PI);
			star.x = (star.x + this.velox * star.depth + this.starfw) % this.starfw;
			star.y = (star.y + this.veloy * star.depth + this.starfh) % this.starfh;

			// brighter and dimmer as it turns, and stretched along the drift
			const br = STARS_BRIGHTNESS_BASE + STARS_BRIGHTNESS_SWING * Math.abs(Math.sin(star.arot));
			Draw.spriteExt(star.sprite, 0, ox + star.x, oy + star.y,
				1 + this.velox * star.depth, 1 + this.veloy * star.depth,
				0, star.color, br * this.alph);
		}

		if (this.shooterFreq > 0 && currentTime() > this.nextShot) {
			const newshoo = {
				sprite: this.shooters_spr,
				x: this.starfw * rng.randomRange(this.sh_stxmin, this.sh_stxmax),
				y: this.starfh * rng.randomRange(this.sh_stymin, this.sh_stymax),
				xspd: this.sh_xspd,
				yspd: this.sh_yspd,
				a: this.starta + rng.random(this.startavar),
				aspd: this.startaspd + rng.random(this.startaspdvar),
				maxa: this.maxa + rng.random(this.maxavar),
				depth: this.shdepth + rng.random(this.shdepthvar),
				warpw: 1
			};
			if (truthy(this.warpspeed)) {
				newshoo.warpw = this.warpspeed * newshoo.depth;
			}
			this.shooters.push(newshoo);

			this.nextShot = currentTime() + this.shooterFreq + rng.irandom(this.shooterFreqVar);
		}

		for (let i = 0; i < this.shooters.length; i++) {
			const shoot = this.shooters[i];

			Draw.spriteExt(shoot.sprite, 0, ox + shoot.x, oy + shoot.y, shoot.warpw, 1, 0, "#ffffff", shoot.a * this.alph);

			shoot.a += shoot.aspd;

			if (shoot.aspd > 0 && shoot.a >= shoot.maxa) {
				// at full strength it starts fading out, and does not move this update
				shoot.aspd = -(SHOOTER_FADE_OUT_MIN + rng.random(SHOOTER_FADE_OUT_RANGE));
			} else if (shoot.a <= 0 || (this.sh_endx !== undefined && shoot.x > this.sh_endx)) {
				this.shooters.splice(i, 1);
				i--;
			} else {
				shoot.x += shoot.xspd * shoot.depth;
				shoot.y += shoot.yspd * shoot.depth;
			}
		}

		Draw.alpha = 1;
	}
}

// A pile of snow that squishes and puffs when something stands in it. The puff is a one time
// animation that starts further in the harder they landed. It can only puff again a few
// updates after the pile is empty. The pile's own animation runs on and loops. In the original the
// puff's speed is set and then replaced by its own first update, which this keeps.
class oSnow1 extends oBaseObject {
	defaults(cfg) {
		super.defaults(cfg);
		this.spd = 0;
		this.poofed = 0;
	}

	update() {
		if (this.ifr < 1) {
			this.ifr = 0;
			this.spd = 1;
		}

		const stander = this.instancePlace(this.x, this.y, oActor);
		if (stander !== null && this.poofed === 0) {
			this.ifr = 1;
			this.spd = SNOW_SQUISH_SPEED_MIN + rng.random(SNOW_SQUISH_SPEED_RANGE);

			const poof = game.createObject(oFxOneShot, { x: this.x, y: this.y, spi: SNOW_PUFF_SPRITE }, this.mylayer);
			poof.ifr = SNOW_PUFF_FRAMES - Math.min(Math.floor(stander.yspd * SNOW_PUFF_LANDING_SCALE), SNOW_PUFF_FRAMES);
			poof.spd = SNOW_PUFF_SPEED_MIN + rng.random(SNOW_PUFF_SPEED_RANGE);
			this.poofed = SNOW_PUFF_COOLDOWN;
		}
		if (stander === null && this.poofed > 0) {
			this.poofed--;
		}
	}
}

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

	// All an actor needs to follow things around: the distance and the way to whatever it follows,
	// and the distance last time.
	initLocObj() {
		this.loco_lastd = 0;
		this.loco_obj = undefined;
		this.locod = 0;
		this.locodx = 0;
		this.locody = 0;
	}

	// Works out the way and distance to something, the player when none is given, or very far when
	// there is nothing to find.
	locObj(obj) {
		if (obj === undefined) obj = game.guy;

		this.loco_lastd = this.locod;

		if (obj === null) {
			this.locodx = 999999;
			this.locody = 999999;
		} else {
			this.locodx = obj.x - this.x;
			this.locody = obj.y - this.y;
		}

		this.locod = pointDistance(0, 0, this.locodx, this.locody);
	}

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

// A dog that follows an actor close by, and fetches any ball that actor carries once it is thrown
// down. It runs faster the farther behind it is, jumps at walls and at balls above it, gives up
// when left too far behind, and barks when it notices someone or starts a fetch. Using it toggles
// whether it follows, and picking it up hands over what it carries.
// Quirks of the original kept: giving up forgets the thing it was fetching in a variable nothing
// reads, so it still remembers the ball; and it follows any actor, rats included.
// The inventory is a stand in, so picking a ball up does nothing yet, and it never really carries.
class oDoggie extends oActor {
	defaults(cfg) {
		super.defaults(cfg);
		this.initLocObj();

		// who it follows, or nothing
		this.followObj = null;
		// whether it follows at all, it will not follow anything when off
		this.following = true;
		// while fetching it goes to the item and speeds up more to catch it
		this.fetchObject = null;
		this.fetching = 0;
		this.lastFollowObj = null;

		this.returning = 0;

		this.barks = 0;
		this.lastBark = 0;

		this.inv = new Inventory(1, undefined, this, "Doggie");
	}

	stop() {
		this.followObj = null;
		// the original named a different variable here, so the one it fetches stays set
		this.fetchObj = null;
		this.fetching = 0;
		this.returning = 0;
		this.xspd = 0;
		this.barks = 1;
	}

	pickup(who) {
		if (this.carrying) {
			who.inv.pickup(this.carrying);
			this.carrying = null;
		}
	}

	acton(action, who) {
		if (this.followObj === null || this.followObj === who) {
			this.following = !this.following;
			if (!this.following) {
				this.stop();
			}
		}
	}

	update() {
		this.step++;

		this.pushedByObjects();

		this.calcOnFloorAtWall();

		this.applyFrictionGravity();

		// look for someone to follow with a wide awareness area
		if (this.following && this.followObj === null) {
			const omi = this.mask;
			this.mask = "awareMask50";
			this.followObj = this.instancePlace(this.x, this.y, oActor);
			this.mask = omi;
			if (this.followObj !== null) {
				this.barks = 2;
			}
		}

		this.checkStartSwimming();

		if (this.followObj !== null) {
			// look for something to fetch
			if (this.fetchObject === null && this.followObj.carrying && this.followObj.carrying.constructor === oBall) {
				this.fetchObject = this.followObj.carrying;
				this.barks = 1;
			}

			// start the fetch once it is thrown
			if (this.fetchObject !== null && !truthy(this.fetching) && this.fetchObject.carriedBy === null) {
				this.lastFollowObj = this.followObj;
				this.followObj = this.fetchObject;
				this.fetching = 1;
				this.barks = 2;
			}

			// pick it up and take it back
			if (this.fetchObject !== null && this.instancePlace(this.x, this.y, this.fetchObject) !== null) {
				this.inv.pickup(this.fetchObject);
				this.followObj = this.lastFollowObj;
				this.fetching = 0;
				this.returning = 1;
				this.fetchObject = null;
			}

			this.locObj(this.followObj);

			if (truthy(this.returning) && this.locod < DOG_RETURNED_DISTANCE) {
				this.returning = 0;
			}

			let maxsp;

			// too far, stop, but further when fetching or returning
			if ((this.locod > DOG_GIVE_UP_DISTANCE && !truthy(this.returning) && !truthy(this.fetching))
				|| this.locod > DOG_FETCH_GIVE_UP_DISTANCE) {
				this.stop();
				maxsp = 0;
			} else if (this.locod > DOG_CATCH_UP_DISTANCE || truthy(this.fetching) || truthy(this.returning)) {
				// linearly faster the farther behind
				const spdboost = 1 + DOG_BOOST_PER_LEVEL * (truthy(this.fetching)
					? Math.max(this.locod / DOG_FETCH_BOOST_SPAN, 1)
					: ((this.locod - DOG_CATCH_UP_DISTANCE) / DOG_BOOST_SPAN));
				maxsp = Math.max(Math.abs(this.followObj.xspd) * spdboost, DOG_MIN_CATCH_UP_SPEED);
			} else {
				// close enough, just keep up
				maxsp = Math.abs(this.followObj.xspd);
			}

			maxsp = clamp(maxsp, DOG_MIN_SPEED, DOG_MAX_SPEED);

			// stop when close enough unless fetching
			if (this.locod < DOG_STOP_DISTANCE && !truthy(this.fetching)) {
				this.xspd = 0;
			} else {
				this.xspd = clamp(this.xspd + sign(this.locodx) * DOG_ACCELERATION, -maxsp, maxsp);
			}

			// wants to jump for a ball above it, or at a wall when falling behind
			const wannajump = (truthy(this.fetching) && Math.abs(this.locodx) < DOG_JUMP_REACH_X
					&& this.locody < DOG_JUMP_BAND_NEAR && this.locody > DOG_JUMP_BAND_FAR)
				|| (truthy(this.atWall) && this.locod >= this.loco_lastd);

			if (wannajump && (truthy(this.onFloor) || truthy(this.swimming))) {
				this.yspd = -(DOG_JUMP_SPEED + Math.min(Math.abs(this.xspd), 1) * DOG_JUMP_SPEED_BONUS);
			}
		}

		// face the way it goes, else the way it is looking
		if (this.xspd !== 0) {
			this.facing = sign(this.xspd);
		} else if (this.locodx !== 0) {
			this.facing = sign(this.locodx);
		}

		this.moveThroughObjects(this.xspd, this.yspd);

		if (this.barks > 0) {
			Hooks.popMessage(this, DOG_BARK_TEXT, -this.facing * (2 + this.barks * 2), -2 - 8 * this.barks,
				{ fadestart: DOG_BARK_FADE_START, fadetime: DOG_BARK_FADE_TIME, floatspdx: 0, floatspdy: DOG_BARK_FLOAT_Y });
			this.barks--;
		}
	}

	// Picks the picture for what it is doing and sets a carried item in its mouth.
	afterUpdate() {
		let si = "sDoggie_";

		if (truthy(this.swimming)) {
			si += "run";
		} else if (!truthy(this.onFloor)) {
			si += "jump";
		} else if (Math.abs(this.xspd) > 0) {
			si += "run";
		} else {
			si += "stand";
		}

		if (!truthy(this.dead) && this.carrying) {
			this.carrying.x = this.x + Math.ceil(this.facing * (this.xspd !== 0 ? DOG_CARRY_OFFSET_MOVING : DOG_CARRY_OFFSET_STILL));
			this.carrying.y = this.y - (this.xspd === 0 || Math.floor(this.ifr) === 0 ? DOG_CARRY_HIGH_Y : DOG_CARRY_LOW_Y);
			this.carrying.x_sc = this.facing;
		}

		this.drawSprite = si;
		this.spi = si;
	}
}
oDoggie.defaultSprite = "sDoggie_stand";

// A rat that chases a target, the player by default, once it is within range or told to, and
// bites at close range. It turns around only after getting a little past the target, so rats
// do not stack. It hops now and then and at walls, speeds up when far behind, gives up past
// its follow distance, and pops out of sight in a pit. Its picture holds a frame in the air.
class oNpc_Chaser extends oActor {
	defaults(cfg) {
		super.defaults(cfg);
		this.initLocObj();

		this.target = null;

		this.following = false;
		this.followd = 0;

		this.max_follow_dist = RAT_FOLLOW_DISTANCE_DEFAULT;

		// how far past the target before it turns round to chase the other way
		this.turnaroundd = rng.irandomRange(RAT_TURNAROUND_MIN, RAT_TURNAROUND_MAX);

		this.umxsdp = rng.randomRange(RAT_SPEED_MIN, RAT_SPEED_MAX);
	}

	// the target is found once everything exists
	init() {
		this.target = game.guy;
	}

	at_target(t) {
		killGuy(RAT_BITE_SPRAY_AMOUNT, RAT_BITE_SPRAY_TIME, [-0.6, 0.6], [-1, 1, 0.4], 1);
	}

	update() {
		this.locObj(this.target);

		this.calcOnFloorAtWall();

		// a pit takes it
		this.dead = false;
		const overs = [];
		this.instancePlaceList(this.x, this.y, oBgObject, overs, true);
		for (const bo of overs) {
			if (bo.constructor === oPit) {
				this.dead = true;
				break;
			}
		}
		if (this.dead) {
			game.createObject(oFxOneShot, { x: this.x, y: this.y, spi: "sAniPop" }, this.mylayer);
			this.destroy();
			return;
		}

		if (this.locod < RAT_BITE_DISTANCE) {
			this.at_target(this.target);
		}

		this.checkStartSwimming();

		this.applyFrictionGravity();

		// hop at random
		if (truthy(this.onFloor) && rng.irandom(RAT_HOP_ODDS) === 0) {
			this.yspd += rng.randomRange(RAT_HOP_MIN, RAT_HOP_MAX);
		}

		// faster when far behind
		const maxsp = this.umxsdp * (this.locod > RAT_SPRINT_DISTANCE ? RAT_SPRINT_BOOST : 1);

		// not following means standing still until the target comes near
		if (!this.following) {
			this.xspd = 0;
			if (this.locod < RAT_NOTICE_DISTANCE) {
				this.following = true;
			}
		}

		if (this.following) {
			// give up when too far, and skip the rest of the update
			if (this.locod > this.max_follow_dist) {
				this.following = false;
				this.xspd = 0;
				return;
			}

			// jump when stuck at a wall and the distance is not closing
			if (truthy(this.atWall) && truthy(this.onFloor) && this.locod >= this.loco_lastd && this.followd === sign(this.locodx)) {
				this.yspd = -(RAT_WALL_JUMP_SPEED + Math.min(Math.abs(this.xspd), 1) * RAT_WALL_JUMP_BONUS);
			}

			// turn round when going the wrong way, but only after getting past the target
			if (Math.abs(this.locodx) > this.turnaroundd || this.xspd === 0) {
				this.followd = sign(this.locodx);
			}
			this.xspd = clamp(this.xspd + this.followd * RAT_ACCELERATION, -maxsp, maxsp);
		}

		if (this.xspd !== 0) {
			this.facing = sign(this.xspd);
		} else if (this.locodx !== 0) {
			this.facing = sign(this.locodx);
		}

		this.moveThroughObjects(this.xspd, this.yspd);

		if (truthy(this.hitFloor)) {
			this.yspd = 0;
		}

		this.x_sc = this.facing;
	}

	// held on one frame in the air, otherwise it runs at its own pace
	afterUpdate() {
		if (!truthy(this.onFloor)) {
			this.spd = 0;
			this.ifr = RAT_AIR_FRAME;
		} else {
			this.spd = 1;
		}
	}
}
oNpc_Chaser.defaultSprite = "sRat";
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

	// Debug: brings the player back alive where they stand, everything else as when they were
	// first made: every default and then their room entry laid on again, so speeds, dead, hanging,
	// timers and the rest start over, for side or top down alike. The controller, the inventory
	// and its contents carry on, and anything they were holding is let go.
	reviveInPlace() {
		const x = this.x;
		const y = this.y;
		const inv = this.inv;
		const con = this.con;

		if (this.carrying) this.carrying.carriedBy = null;

		for (const key of Object.keys(LP_SPRITE_DEFAULTS)) {
			if (REVIVE_KEEP_FIELDS.indexOf(key) < 0) this[key] = LP_SPRITE_DEFAULTS[key];
		}
		this.defaults(this.startCfg);
		this.configure(this.startCfg);

		this.x = x;
		this.y = y;
		this.con = con;
		if (inv !== undefined) {
			this.inv = inv;
			if (this.inv_list !== undefined) this.inv_list = inv.inv_list;
		}
		this.init();
	}

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
	oBoxFall, oGrTechno, oGrTechnoVoid, oJgHeart, oJgLogShooter, oJgLog, oFxOneShot, oBird, oBouncer, oTank,
	oIaObject, oCrate, oCrateSt, oCrateBg, oCrateMetal,
	oBgObject, oIaBgObject, oClimbableObj, oLadder, oPit, oRope, oLogEater, oAniSpark,
	oChest, oDoor, oRatDoor, oGameBoxV, oBike, oPickupObj, oHoldObject,
	oKey, oGun, oFlamer, oArBow, oMagnet, oRocketpack, oSword, oBall,
	oWater, oSpriteTiler, oWaterFg, oFloorEffect, oTrigger, oTrigScript, oTrigKid,
	oGroupBounds, oVisBounds, oLayerMask, oLyrDoor,
	oText, oStarField, oSnow1, oGuyPlacer, oActor, oDoggie, oNpc_Chaser, oNpcChar, oChar
};

// The class for an object name a room file uses: a ported one, else a stand in, else nothing.
function objectType(name) {
	return OBJECT_TYPES[name] || standins.classFor(name);
}
