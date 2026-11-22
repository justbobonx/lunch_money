// The engine's object classes: everything the engine files name, the shared mixins, the
// inventory, and the stand ins and name lookup for object classes. Always loaded first.

// Inventory: rows of the full inventory screen unless set, and what a drop passes on from the
// owner, a push onward and side on a lift.
const INV_DEFAULT_ROWS = 2;
const INV_DROP_PUSH = 0.3;
const INV_DROP_LIFT = 0.2;
// The quick pick wheel: updates the item button is held before it opens, the distance between
// slots, the row's nudge left and height over the owner, the squeezed item's size, the on or off
// light's place in a slot, and the pointer's height.
const QP_HOLD_UPDATES = 20;
const QP_SLOT_STEP = 13;
const QP_ROW_OFFX = 6;
const QP_ROW_ABOVE = 26;
const QP_ICON_SIZE = 10;
const QP_LIGHT_OFFSET = 7;
const QP_POINTER_ABOVE = 12;
// Its labels: the font, height of the name over the owner and of the drop question over that,
// their colours, and the dark backing strip's colour, fade and top and bottom under the text spot.
const QP_FONT = "ftTinyer";
const QP_LABEL_ABOVE = 39;
const QP_LABEL_STEP = 7;
const QP_NAME_COLOR = "#ccccee";
const QP_DROP_COLOR = "#ffddaa";
const QP_LABEL_BG_COLOR = "#000000";
const QP_LABEL_BG_ALPHA = 0.7;
const QP_LABEL_BG_TOP = 4;
const QP_LABEL_BG_BOTTOM = 10;

// Floor zones on top down slopes. A sideways slope turns this share of sideways speed into up or
// down speed, and both slopes trim speed by this much, the 45 degree cut of the original.
const FLOOR_RAMP_SHARE = 0.5;
const FLOOR_RAMP_TRIM = 0.707;

// Wandering actors: path walking speed, the default range of idle updates before a walk, the
// chance in a hundred and the spread in degrees of a walk heading back toward the stay in area's
// middle, and a walk's speed range and length range in updates.
const WANDER_PATH_SPEED = 0.8;
const WANDER_BORED_RANGE = [300, 420];
const WANDER_HOME_CHANCE = 30;
const WANDER_HOME_SPREAD = 30;
const WANDER_WALK_SPEED_MIN = 0.3;
const WANDER_WALK_SPEED_MAX = 0.4;
const WANDER_WALK_MIN = 20;
const WANDER_WALK_MAX = 60;

// The debug revive leaves these alone: where it is, its name, its layer, and whether it is gone or
// switched off.
const REVIVE_KEEP_FIELDS = ["x", "y", "name", "mylayer", "destroyed", "pdis"];

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
		// its own mask while held, as held things have none
		this.looseMask = null;
	},

	put_away(who) {},
	take_out(who) {}
};

// ---------------------------------------------------------------- inventory

// Anything that holds items: the player characters, the dog, lockers. Items sit in a list in the
// order they came in, with at most one of them out in the owner's hand. Items stay in play while
// held, hidden and without a mask, in the owner's layer, and the owner draws the one in hand.
// An inventory that stows, like a locker's, keeps its items out of play instead, in no layer and
// as they were, the way a chest keeps what is inside.
// The quick pick wheel opens over the owner while the item button is held, and a quick tap opens
// the full inventory screen.
class Inventory {
	constructor(size, bg, owner, name, inv_list) {
		this.locked = false;
		this.size = size;
		// rows of the full inventory screen, the columns follow from the size
		this.h = INV_DEFAULT_ROWS;
		this.w = Math.ceil(size / this.h);
		// the full inventory screen's backing sprite
		this.bg = bg;
		this.owner = owner;
		this.name = name;
		// keeps its items out of play, for holders with no hand
		this.stows = false;
		// the place in the list of the item in hand and of the one in hand before it, minus one for none
		this.cur_held_i = -1;
		this.last_held_i = -1;
		this.inv_list = inv_list !== undefined ? inv_list : [];
		// one press down in the wheel asks, a second drops
		this.inv_ask_drop = 0;
		// facts about particular spots, for the full inventory screen
		this.spot_overs = -1;
		// the wheel is open, and how long the item button has been held
		this.in_inv_sel = 0;
		this.bdown_time = 0;
	}

	set_height(h) {
		this.h = h;
		this.w = Math.ceil(this.size / h);
	}

	set_inv_list(inv_list) {
		this.inv_list = inv_list;
	}

	// Adds to the end of the list, remembering a spot for the full screen, the list place when none
	// is given, and can take it out into the hand.
	add(obj, pos, andswitch) {
		this.inv_list.push(obj);
		obj._inv_pos = pos !== undefined ? pos : this.inv_list.length - 1;
		if (andswitch) this.switch_held(this.inv_list.length - 1);
		return obj._inv_pos;
	}

	remove(obj) {
		this.remove_i(this.inv_list.indexOf(obj));
	}

	// A place outside the list removes nothing, as in the original. The places of the item in hand
	// and of the one before it follow the list closing up, where the original let them slip.
	remove_i(ind) {
		if (ind < 0) return;
		this.inv_list.splice(ind, 1);
		if (ind < this.cur_held_i) this.cur_held_i--;
		if (ind < this.last_held_i) this.last_held_i--;
		else if (ind === this.last_held_i) this.last_held_i = -1;
	}

	// Takes an item in, into the hand unless told not to. Not while crawl sliding, and only things
	// that can be picked up. It goes just under the owner in the owner's layer, hidden and without a
	// mask, keeping its own mask for when it is dropped. One that stows takes it out of every layer,
	// so it is off, and leaves it otherwise as it is.
	pickup(obj, inv_pos, noSwitch) {
		if (!obj.pickupable) return undefined;
		if (this.owner.crawling && this.owner.sliding > 0) return undefined;

		obj.carriedBy = this.owner;
		// out of its old place first, so the owner's place is counted without it
		if (obj.mylayer) game.layerRemove(obj.mylayer, obj);
		if (this.stows) {
			obj.mylayer = null;
			game.updateActive(obj);
			return this.add(obj, inv_pos, false);
		}
		game.layerInsert(this.owner.mylayer, obj, this.owner.mylayer.lsprites.indexOf(this.owner));

		obj.looseMask = obj.mask;
		obj.mask = "sNoMask";
		obj.visible = false;

		return this.add(obj, inv_pos, !noSwitch);
	}

	put_away_held() {
		if (!this.owner.carrying) return;
		this.owner.carrying.put_away(this.owner);
	}

	// Lets go of an item without putting it anywhere: out of the hand and the list, and unless it was
	// stowed, its own mask back and showing again, where it is.
	release(obj) {
		if (this.owner.carrying === obj) {
			this.put_away_held();
			this.owner.carrying = null;
			this.cur_held_i = -1;
		}
		this.remove(obj);
		if (!this.stows) {
			obj.mask = obj.looseMask;
			obj.visible = true;
		}
		obj.carriedBy = null;
	}

	// Lets go of the item in hand and gives it back. The owner's speed carries on into it, a push
	// onward, and side on a little lift, which only shows on things that move themselves.
	drop_held() {
		const obj = this.owner.carrying;
		if (!obj) return undefined;

		this.release(obj);
		obj.xspd = this.owner.xspd + sign(this.owner.xspd) * INV_DROP_PUSH;
		obj.yspd = this.owner.ch_side ? this.owner.yspd - INV_DROP_LIFT
			: this.owner.yspd + sign(this.owner.yspd) * INV_DROP_PUSH;
		return obj;
	}

	// Puts away whatever is in hand and takes out the item at a place. A place with nothing, or
	// with an empty placeholder, leaves the hand empty. Something that cannot go in the bag, like a
	// crate, holds the hand until it is dropped, so nothing switches while it is carried; an item
	// given then goes in the bag without coming out.
	switch_held(newi) {
		if (this.owner.carrying && !this.owner.carrying.holdable) return;
		if (this.owner.carrying) {
			this.put_away_held();
			this.owner.carrying = null;
			this.last_held_i = this.cur_held_i;
			this.cur_held_i = -1;
		} else {
			this.last_held_i = -1;
		}
		const next = this.inv_list[newi];
		if (next !== undefined && !(next instanceof oInvNone)) {
			this.owner.carrying = next;
			this.cur_held_i = newi;
			game.moveObjToLayer(next, this.owner.mylayer);
		}
	}

	// the item in hand before this one, or the newest
	switch_back() {
		this.switch_held(this.last_held_i >= 0 ? this.last_held_i : this.inv_list.length - 1);
	}

	// the item, by object or name, when it is in here
	check_for_obj(obj) {
		obj = game.lookupInst(obj);
		return obj !== undefined && this.inv_list.indexOf(obj) >= 0 ? obj : undefined;
	}

	index_of(item) {
		return this.inv_list.indexOf(item);
	}

	// the first item with a sprite
	find_spr(spr) {
		return this.inv_list.find((item) => item.spi === spr);
	}

	// the first item of a kind, by class or class name
	find_obj(obj) {
		return this.inv_list.find((item) => item.constructor === obj || item.constructor.name === obj);
	}

	len() {
		return this.inv_list.length;
	}

	// Empties it for good: every item is destroyed. Unlike the original, the hand empties too.
	clear() {
		this.put_away_held();
		for (let i = this.inv_list.length - 1; i >= 0; i--) this.inv_list.splice(i, 1)[0].destroy();
		this.owner.carrying = null;
		this.cur_held_i = -1;
		this.last_held_i = -1;
	}

	// The quick pick wheel. Holding the item button a while opens it, as long as the hand is empty
	// or holds something that fits in here, taking out the last item when the hand is empty. Left
	// and right turn it, down twice drops what is in hand and takes out the next, up switches the
	// item on or off when it has a switch. Letting go closes it. Takes the owner's frame while open.
	// A tap too short to open it opens the full inventory screen on this inventory alone, which
	// another tap closes, unless the hand holds something that cannot go in here.
	qp_handle_ui(con) {
		if (con.iBtnRd) {
			this.bdown_time++;
			if (this.bdown_time > QP_HOLD_UPDATES && !this.in_inv_sel
				&& (!this.owner.carrying || this.owner.carrying.holdable)) {
				if (this.cur_held_i < 0) this.switch_back();
				this.in_inv_sel = 1;
			}
		}

		if (con.iBtnRr) {
			this.bdown_time = 0;
			if (this.in_inv_sel) {
				this.in_inv_sel = 0;
			} else if (!this.owner.carrying || this.owner.carrying.holdable) {
				Screens.open(new InventoryScreen([this], "iBtnRr"));
			}
		}

		if (!this.in_inv_sel) return false;

		// any other choice forgets a drop that was asked
		if (con.iBtnY || con.iUpP || con.iLeftP || con.iRightP) this.inv_ask_drop = 0;

		// turning an empty wheel goes nowhere
		if (this.inv_list.length > 0) {
			let newi = this.cur_held_i;
			if (con.iRightP) newi = (this.cur_held_i - 1 + this.inv_list.length) % this.inv_list.length;
			if (con.iLeftP) newi = (this.cur_held_i + 1) % this.inv_list.length;
			if (newi !== this.cur_held_i) this.switch_held(newi);
		}

		if (this.owner.carrying) {
			if (con.iDownP) {
				if (++this.inv_ask_drop > 1) {
					// the original read the place after the drop had already cleared it, so the
					// hand stayed empty; here the next item along comes out
					const dropi = this.cur_held_i;
					this.drop_held();
					this.switch_held(Math.min(dropi, this.inv_list.length - 1));
					this.last_held_i = 0;
					this.inv_ask_drop = 0;
				}
			} else if (con.iUpP && this.owner.carrying.itemOn > -1) {
				this.owner.carrying.itemOn = (this.owner.carrying.itemOn + 1) % 2;
			}
		}

		return true;
	}

	// A row of slots over the owner with the item in hand in the middle under the pointer, each
	// item squeezed into its slot with its on or off light, and the name of the item in hand
	// above, with the drop question over that once asked.
	qp_draw() {
		const n = this.inv_list.length;
		const half = Math.floor((n - 1) / 2);
		const rowx = this.owner.x - half * QP_SLOT_STEP - QP_ROW_OFFX;
		const rowy = this.owner.y - QP_ROW_ABOVE;

		for (let vi = 0; vi < n; vi++) {
			const item = this.inv_list[(vi + this.cur_held_i - half + n) % n];
			if (!item) continue;
			const ix = rowx + QP_SLOT_STEP * vi;
			Draw.sprite("s_inv_bg", 0, ix, rowy);
			Draw.spriteStretched(item.spi, 0, ix + 1, rowy + 1, QP_ICON_SIZE, QP_ICON_SIZE);
			if (item.itemOn > -1) Draw.sprite("s_inv_active", item.itemOn, ix + QP_LIGHT_OFFSET, rowy + QP_LIGHT_OFFSET);
		}
		Draw.sprite("s_inv_pointer", 0, this.owner.x, this.owner.y - QP_POINTER_ABOVE);

		if (!this.owner.carrying) return;

		const labels = [[this.owner.carrying.gname, QP_NAME_COLOR]];
		if (this.inv_ask_drop === 1) labels.push(["DROP?", QP_DROP_COLOR]);
		const tx = this.owner.x + 1;
		Draw.setFont(QP_FONT);
		Draw.halign = "center";
		for (let li = 0; li < labels.length; li++) {
			const ty = this.owner.y - QP_LABEL_ABOVE - QP_LABEL_STEP * li;
			const halfw = Math.floor(Draw.stringWidth(labels[li][0]) / 2);
			Draw.color = QP_LABEL_BG_COLOR;
			Draw.alpha = QP_LABEL_BG_ALPHA;
			Draw.rectangle(tx - halfw - 1, ty + QP_LABEL_BG_TOP, tx + halfw - 1, ty + QP_LABEL_BG_BOTTOM, 0);
			Draw.color = labels[li][1];
			Draw.alpha = 1;
			Draw.textShadow(tx, ty, labels[li][0], 0, 1);
		}
		Draw.color = "#ffffff";
		Draw.halign = "left";
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
		if (!this.tiled) {
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

// An empty spot in an inventory: it fits in one, but taking it out leaves the hand empty.
class oInvNone extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
		this.holdable = true;
	}
}
mixin(oInvNone, Pickupable);

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

// A sideways slope. Walking across it while on the ground also moves you up or down the screen,
// uphill to the right unless the room flips it.
class oFlFxRampH extends oFloorEffect {
	constructor() {
		super();
		this.up_dir = 1;
	}
	effect_obj(obj, acc, maxspd) {
		if (!obj.onFloor) return;
		obj.yspd = clamp(obj.yspd - obj.xspd * FLOOR_RAMP_SHARE * acc * this.up_dir, -maxspd, maxspd);
		obj.xspd *= FLOOR_RAMP_TRIM;
		obj.yspd *= FLOOR_RAMP_TRIM;
	}
}

// A slope going up the screen. It slows movement up and down, in the air too, as the original did.
class oFlFxRampV extends oFloorEffect {
	effect_obj(obj, acc, maxspd) {
		obj.yspd *= FLOOR_RAMP_TRIM;
	}
}

// A pad that knocks back whoever stands on it, away from its middle, with no damage.
// Only things that can take a hit are knocked.
class oFlFxHitter extends oFloorEffect {
	constructor() {
		super();
		this.hforce = 2;
	}
	effect_obj(obj, acc, maxspd) {
		if (!obj.onFloor || typeof obj.takeHit !== "function") return;
		obj.takeHit(this.sprite_cx(), this.sprite_cy(), this.hforce);
	}
}

// A pad that bounces whoever lands on it up into the air.
class oFlFxJumper extends oFloorEffect {
	constructor() {
		super();
		this.boost = 3;
	}
	effect_obj(obj, acc, maxspd) {
		if (!obj.onFloor) return;
		obj.zspd += this.boost;
	}
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
		if (tr !== null && this.only_inside && !(tr.bbox_left >= this.bbox_left && tr.bbox_right <= this.bbox_right
			&& tr.bbox_top >= this.bbox_top && tr.bbox_bottom <= this.bbox_bottom)) tr = null;
		if (tr !== null && this.check_height !== undefined && tr.z > this.ht) tr = null;

		if (!this.inTrigger && tr !== null && (!this.trigOnce || this.trigtimes < 1)) {
			// Guess: the named thing in a requirement is looked up by name.
			let trigGo = true;
			if (Array.isArray(this.trigReqs)) {
				for (const req of this.trigReqs) {
					if (req[0] === "checkExists") {
						const who = game.lookupInst(req[1], this);
						if ((!!who && !who.destroyed) !== !!req[2]) {
							trigGo = false;
							break;
						}
					} else if (req[0] === "checkInstValEqu") {
						const who = game.lookupInst(req[1], this);
						if (!who || who[req[2]] !== req[3]) {
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

		if (this.inTrigger && !this.triggered && this.step++ === this.triggerWaitToStart) {
			this.on_trigger();
			this.triggered = true;
			this.trigtimes++;
		}

		if (this.inTrigger && tr === null) {
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

		// Wandering, for actors that walk about on their own. The first four names are the ones room
		// and object files set: wandering about an area at all, the path to start on by name, the
		// paths by name as flat lists of spots ending in a loop flag, and the idle range.
		this.wander_area = false;
		this.start_path = null;
		this.paths = null;
		this.bored_range = null;
		// the path being walked and the next spot's place in it
		this.wanderPath = null;
		this.pathIndex = 0;
		// idle updates before the next walk, idle updates so far, and walk updates left; walking
		// while any are left
		this.bored = 0;
		this.idleTime = 0;
		this.walkTime = 0;
	}

	// override for behavior
	acton(action, who) {}

	// Wandering setup once the room settings are in: the start path if it names one, the idle
	// range, and a random start into the first idle so a group does not set off together.
	wanderInit() {
		if (this.start_path !== null && this.paths !== null && this.paths[this.start_path] !== undefined) {
			this.wanderPath = this.paths[this.start_path];
			this.pathIndex = 0;
		}
		if (this.bored_range === null) this.bored_range = WANDER_BORED_RANGE;
		this.bored = rng.irandomRange(this.bored_range[0], this.bored_range[1]);
		this.idleTime = rng.irandomRange(0, this.bored - 1);
		this.walkTime = 0;
	}

	// One update of wandering, which only sets speeds. On a path it heads for each spot in turn
	// until our mask covers it, looping or stopping at the end. Otherwise, wandering an area, it
	// idles until bored, then walks a short way, sometimes back toward the middle of the stay in
	// area it is in, else any way. A walk counts down and stops, starting the idle again.
	wanderUpdate() {
		if (this.wanderPath !== null) {
			const px = this.wanderPath[this.pathIndex];
			const py = this.wanderPath[this.pathIndex + 1];
			if (this.collisionPoint(px, py, this, false, false) !== null) {
				this.pathIndex += 2;
				// the last entry is the loop flag
				const last = this.wanderPath.length - 1;
				if (this.pathIndex >= last) {
					if (this.wanderPath[last]) {
						this.pathIndex = 0;
					} else {
						this.wanderPath = null;
						this.xspd = 0;
						this.yspd = 0;
					}
				}
			} else {
				const dir = pointDirection(this.x, this.y, px, py);
				this.xspd = lengthdirX(WANDER_PATH_SPEED, dir);
				this.yspd = lengthdirY(WANDER_PATH_SPEED, dir);
			}
		} else if (this.wander_area && this.walkTime === 0) {
			if (this.idleTime >= this.bored) {
				const home = this.cur_stayin;
				const dir = (home !== null && rng.random(100) < WANDER_HOME_CHANCE)
					? pointDirection(this.x, this.y, home.x, home.y) + rng.randomRange(-WANDER_HOME_SPREAD, WANDER_HOME_SPREAD)
					: rng.random(360);
				const spd = rng.randomRange(WANDER_WALK_SPEED_MIN, WANDER_WALK_SPEED_MAX);
				this.xspd = lengthdirX(spd, dir);
				this.yspd = lengthdirY(spd, dir);
				this.walkTime = rng.irandomRange(WANDER_WALK_MIN, WANDER_WALK_MAX);
				this.bored = rng.irandomRange(this.bored_range[0], this.bored_range[1]);
			} else {
				this.idleTime++;
			}
		} else if (this.walkTime > 0) {
			this.walkTime--;
			if (this.walkTime === 0) {
				this.xspd = 0;
				this.yspd = 0;
				this.idleTime = 0;
			}
		}
	}

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
		const xoadj = (this.xodd && xscale < 0) ? 1 : 0;
		Draw.spriteExt(this.spi, this.ifr, this.x + xoadj, this.y, xscale, this.y_sc,
			this.ang, this.col, this.alpha);
		if (game.drawStats) {
			Draw.color = this.facing > 0 ? "#ff0000" : "#ff00ff";
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

		if (this.ch_side) {
			this.xspd = sign(this.x - hitbyx) * hitbyf * 0.8;
			this.yspd = -0.5 * hitbyf;
			this.facing = sign(this.xspd);
		} else {
			if (bounce) {
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

		if (this.carrying) this.inv.drop_held();

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

	// Dies once: halves the speeds, and when still shown, sprays blood and vanishes unless told to
	// stay shown. The amount is spread over the time in updates. The spray follows whoever did the
	// killing and passes through it, as in the original; with nobody named, scripts among them,
	// that is the player. The spray goes in the player's layer and is given back.
	kill(amount, time, xminmax, yminmax, leavevis, soundfx, killer) {
		if (this.dead) return null;
		this.dead = true;
		this.yspd = Math.max(this.yspd / 2, 0);
		this.xspd = this.xspd / 2;
		if (amount === undefined) amount = 0;
		if (time === undefined) time = 1;
		let deathSpray = null;
		if (this.visible) {
			deathSpray = game.createObject(oFxParticlerOneShot, {
				x: this.x, y: this.y,
				amount: amount / time,
				time: time,
				origObj: killer !== undefined ? killer : this,
				xminmax: (xminmax !== undefined && xminmax !== 0) ? xminmax : [-1, 1],
				yminmax: (yminmax !== undefined && yminmax !== 0) ? yminmax : [-1, 0],
				scminmax: [0.25, 1],
				colors: ["#ff0000", "#990000", "#cc0000"]
			}, this.mylayer);
			this.visible = leavevis === true || leavevis === 1;
			if (soundfx !== undefined) Hooks.sound(soundfx);
		}
		return deathSpray;
	}

	// The same death with the spray as two pushes in direction ranges, its drops dying on landing
	// or within a second or so, used by pits.
	killTwoBursts(amount, time, dirminmax, dirspdminmax, dir2minmax, dir2spdminmax, leavevis, soundfx, killer) {
		if (this.dead) return;
		this.dead = true;
		this.yspd = Math.max(this.yspd / 2, 0);
		this.xspd = this.xspd / 2;
		if (amount === undefined) amount = 0;
		if (time === undefined) time = 1;
		if (this.visible) {
			game.createObject(oFxParticlerOneShot, {
				x: this.x, y: this.y,
				amount: amount / time,
				time: time,
				origObj: killer !== undefined ? killer : this,
				dirminmax: dirminmax,
				dirspdminmax: dirspdminmax,
				dir2minmax: dir2minmax,
				dir2spdminmax: dir2spdminmax,
				scminmax: [0.25, 1],
				colors: ["#ff0000", "#990000", "#cc0000"],
				deadontime: [30, 90],
				deadonland: 1
			}, this.mylayer);
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
				if (this.ch_side) {
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
					if (this.lookObjs[0].acton("give", this, { item: this.carrying })) {
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
			// put it away, or let go of something that cannot go in the bag
			if (this.con.iBtnB) {
				if (this.carrying.holdable) this.inv.switch_held(-1);
				else this.inv.drop_held();
			}
			// an item can ask to be let go after its use; the original only cut it loose, leaving it
			// hidden, without a mask and still in the inventory
			if (this.con.iBtnX) {
				if ((this.carrying || this).use(this) === "drop") this.inv.drop_held();
			}
			if (this.con.iBtnXd) {
				(this.carrying || this).use_c(this);
			}
			if (this.con.iBtnXr) {
				(this.carrying || this).use_r(this);
			}
		} else if (this.lookObjs.length > 0) {
			// only the one thing in view is acted on, the one drawn with the outline, and not when
			// someone else is holding it
			const lobj = this.lookObjs.find((o) => o.inview);
			if (lobj && !lobj.carriedBy) {
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
		if (this.canFight && !this.punching && !this.carrying && this.con.iBtnX) {
			if (this.jumped) {
				this.punching = 10;
				// a kick pushes forward and loses some rise
				let sadj = 0;
				if (this.yspd < 0) {
					sadj = Math.abs(this.yspd / 2);
					this.yspd += sadj;
				}
				this.xspd = this.facing * Math.max(Math.abs(this.xspd) + sadj, 0.9);
			} else if (this.crawling || this.sliding) {
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
