// The engine's object classes: everything the engine files name, the shared mixins, the stand in
// inventory, and the stand ins and name lookup for object classes. Always loaded first.

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
			Hooks.runScript([["sayWfB", this.description, "actor", 0, -10, 0, 0]], this, undefined, undefined, undefined, this);
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
		this.itemOn = -1;
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

// The base of every game engine object.
// Making one is three steps, done by the world: the constructors set every default, parent first
// and children writing over, then the config is laid on top, then init does any setup that needs the
// final values. A room runs init once everything in it exists, so setup can find other objects.
// After that, each frame its update, then its optional after update, then its draw, until destroyed.
class oBaseObject {
	constructor() {
		// the placed sprite fields first, so every object has the same fields in the same order
		Object.assign(this, LP_SPRITE_DEFAULTS);
		this.spi = this.constructor.defaultSprite || null;
		// its own collision mask, when not its sprite's box, and the one it started with
		this.mask = null;
		this.dmi = null;
		// comes along when the player changes rooms
		this.persistent = false;
		// on only while its room, its layer and the object itself are all switched on; off, it
		// neither runs nor collides. Only the world sets it.
		this.active = true;
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

	// Lays a config over the object and sets its sprite asset from it. A room taking over an object
	// of the same name from another room uses it again.
	configure(cfg) {
		Object.assign(this, cfg);
		// kept so the object can be made fresh again in place
		this.startCfg = cfg;
		Draw.setSprite(this, this.spi);
		// the mask it started with, for things that swap masks
		this.dmi = this.mask;
	}

	// Setup that needs the final values. Classes extend this and call the parent's where they need it.
	init() {
		// a mover starts out remembering the spot it was placed at
		if (this.lastx !== undefined) {
			this.lastx = this.x;
			this.lasty = this.y;
		}
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
	constructor() {
		super();
		this.ht = BIGGEST_INT;
	}
	// any object can be acted on, by default nothing happens
	acton(action, who, pars) {}
}

// Terrain, hangable by default.
class oGround extends oObject {
	constructor() {
		super();
		this.hangable = true;
	}
}

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
					this.t_flipx, this.t_flipy, this.ang, this.col, this.alpha);
			}
		}
	}
}

class oIaSolidGr extends oSolidGr {
	constructor() {
		super();
		this.initInteractive();
		this.pickupable = false;
	}
}
mixin(oIaSolidGr, Interactive);

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
	if (truthy(guy.visible)) {
		Hooks.particles("death spray", guy, guy.x, guy.y, {
			amount: amount / time, time: time,
			xminmax: (xminmax !== undefined && xminmax !== 0) ? xminmax : [-1, 1],
			yminmax: (yminmax !== undefined && yminmax !== 0) ? yminmax : [-1, 0],
			sizeminmax: [0.25, 1],
			colors: ["#ff0000", "#990000", "#cc0000"]
		});

		guy.visible = truthy(leavevis);

		if (soundfx !== undefined) Hooks.sound(soundfx);
	}
}

// Solid interactive things.
class oIaObject extends oObject {
	constructor() {
		super();
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

// ---------------------------------------------------------------- background objects

// Non blocking things. They never stop movement but can be hung from, climbed, or grabbed.
class oBgObject extends oBaseObject {}

class oIaBgObject extends oBgObject {
	constructor() {
		super();
		this.initInteractive();
		this.landed = true;
		this.pickupable = false;
		this.hitFloor = false;
		this.hitWall = false;
	}
}
mixin(oIaBgObject, Interactive);

class oClimbableObj extends oBgObject {
	constructor() {
		super();
		this.climbable = true;
		this.jumpoff = true;
		this.twoway = true;
	}
}

// Falling in kills, checked by the side view player.
class oPit extends oBgObject {}

// ---------------------------------------------------------------- others under the base

class oWater extends oBaseObject {}

class oFloorEffect extends oBaseObject {
	constructor() {
		super();
		this.visible = false;
	}
	// called by whoever stands on it so it can change their movement
	effect_obj(obj, acc, maxspd) {}
}

// An area that fires when a player character enters it and again when they leave, once its conditions are met.
class oTrigger extends oBaseObject {
	constructor() {
		super();
		this.visible = false;
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
	constructor() {
		super();
		this.triggerScript = [["say", "triggered", "actor", 0, -20, 50]];
		this.skippable = false;
		this.skipScript = [];
		this.trigOffScript = -1;
	}
	on_trigger() {
		Hooks.runScript(this.triggerScript, this.whotriggered, this.skippable, this.skipScript, undefined, this);
	}
	off_trigger() {
		if (this.trigOffScript !== -1) Hooks.runScript(this.trigOffScript, this.whotriggered, undefined, undefined, undefined, this);
	}
}

// An area's bounds. Walking wholly inside a connected area moves the player into it.
class oGroupBounds extends oTrigScript {
	constructor() {
		super();
		this.group = null;
		this.only_inside = 1;
	}
	on_trigger() {
		if (this.group.type === LGT_CONNECTED) game.enterArea(this.group.name);
	}
}

// Brings an area into view while the player is inside it, and takes it out after.
class oVisBounds extends oTrigScript {
	constructor() {
		super();
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

// ---------------------------------------------------------------- actors

// Anything that moves itself: contact flags, abilities and states for the movers.
class oActor extends oBaseObject {
	constructor() {
		super();
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
			this.ang, this.col, this.alpha);
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

// Shared by the player characters only.
class oChar extends oActor {
	constructor() {
		super();
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
		super.init();
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

		// every default as a freshly made one of the same class has them
		const fresh = new this.constructor();
		for (const key of Object.keys(fresh)) {
			if (REVIVE_KEEP_FIELDS.indexOf(key) < 0) this[key] = fresh[key];
		}
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
		if (truthy(this.visible)) {
			deathSpray = Hooks.particles("death spray", this, this.x, this.y);
			this.visible = leavevis === true || leavevis === 1;
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
		if (truthy(this.visible)) {
			Hooks.particles("death spray, two bursts", this, this.x, this.y);
			this.visible = leavevis === true || leavevis === 1;
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
			base = loadedObjectClass(parentName) || this.classFor(parentName, depth + 1) || oBaseObject;
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

// Every object class is a global of its own name, from these files or the world's object folders.
// Classes found once are kept here, so each name is only looked up the slow way once.
const OBJECT_TYPES = Object.create(null);

// The loaded class of an object name, or nothing. Only plain names are looked up, and only
// classes built on the base count.
function loadedObjectClass(name) {
	if (OBJECT_TYPES[name] !== undefined) return OBJECT_TYPES[name];
	if (typeof name !== "string" || !/^[A-Za-z_$][\w$]*$/.test(name)) return undefined;
	let cls;
	try {
		cls = (0, eval)("typeof " + name + " === \"function\" ? " + name + " : undefined");
	} catch (e) {
		return undefined;
	}
	if (cls !== oBaseObject && !(cls && cls.prototype instanceof oBaseObject)) return undefined;
	OBJECT_TYPES[name] = cls;
	return cls;
}

// The class for an object name a room file uses: a loaded one, else a stand in, else nothing.
function objectType(name) {
	return loadedObjectClass(name) || standins.classFor(name);
}
