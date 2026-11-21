// Things to pick up, carry and use, what they shoot, and chests that hold them.

// Something to pick up and carry in hand, which does nothing when used.
class oPickupObj extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
	}
}
mixin(oPickupObj, Pickupable);

// A plain item that fits in the inventory, set up by its room entry, which does nothing when used.
class oGenItem extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
		this.holdable = true;
	}
}
mixin(oGenItem, Pickupable);

// A plain thing to hold, given by someone, with tags scripts can check.
class oHoldObject extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
		this.holdable = true;
		this.whofrom = null;
		this.tags = [];
	}
}
mixin(oHoldObject, Pickupable);
oHoldObject.defaultSprite = "sBlankPr";

// Honeycomb from the bee tree, for trading.
class oHoneycomb extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
		this.holdable = true;
		this.gname = "HONEYCOMB";
	}
}
mixin(oHoneycomb, Pickupable);
oHoneycomb.defaultSprite = "s_honeycomb";

// Unlocks the thing it names, by name or the thing itself, or anything with a lock when it names
// nothing. Used on something with a lock it tries to open it, and a key that fits is used up.
class oKey extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
		this.holdable = true;
		this.unlockObj = null;
	}

	use(who, user) {
		who = game.lookupInst(who);
		// The original only worked when a script named the lock. The player's own use passes the
		// player, so here it goes to the first thing in reach with a lock, opened by the player.
		if (who && who.locked === undefined && who.lookObjs) {
			user = who;
			who = who.lookObjs.find((obj) => obj.locked !== undefined && !obj.carriedBy);
		}
		if (!who || who.locked === undefined) return;

		const fits = this.unlockObj === null || who === game.lookupInst(this.unlockObj);
		if (fits) who.locked = false;
		who.acton("open", user);

		if (!fits) return;
		if (this.carriedBy) this.carriedBy.inv.drop_held();
		this.destroy();
	}
}
mixin(oKey, Pickupable);
oKey.defaultSprite = "sKey";

// Held down it lifts whoever holds it, puffing smoke out the back now and then.
// Its on or off switch does nothing, as in the original.
class oRocketpack extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
		this.holdable = true;
		this.itemOn = 0;
		this.gname = "ROCKET PACK";
		this.spd = 0;
		// lift added to the holder each update, and updates between puffs
		this.lift = 0.2;
		this.cooloff = 3;
		this.cooling = 0;
		// a puff starts this far behind, plus up to the spread, and this far down, plus up to the
		// spread, and follows the holder's fall so it stays with them
		this.puffBack = 4;
		this.puffDown = 3;
		this.puffSpread = 2;
		this.puffSprite = "s_poof_sm";
	}

	use(who) {
		this.spd = 1;
		who.yspd -= this.lift;

		if (this.cooling > 0) return;

		game.createObject(oFxOneShot, {
			x: this.x - (this.puffBack + rng.irandom(this.puffSpread)) * who.facing,
			y: this.y + this.puffDown + who.yspd + rng.irandom(this.puffSpread),
			spi: this.puffSprite
		}, this.mylayer);
		this.cooling = this.cooloff;
	}

	use_c(who) {
		this.use(who);
	}

	use_r(who) {
		this.spd = 0;
		this.ifr = 0;
	}

	update() {
		if (this.cooling > 0) this.cooling--;
		super.update();
	}
}
mixin(oRocketpack, Pickupable);
oRocketpack.defaultSprite = "s_rocketpack";

// What a shot or a blade touches: an actor first, never the one it came from, then anything
// solid, leaving out ground when it passes through ground.
function shotHit(shot, notWho) {
	const actors = [];
	shot.instancePlaceList(shot.x, shot.y, oActor, actors);
	const actor = actors.find((a) => a !== notWho);
	if (actor) return actor;
	const solid = shot.instancePlace(shot.x, shot.y, oObject);
	return solid && !(truthy(shot.thruground) && solid instanceof oGround) ? solid : null;
}

// A quick lunge and slash. The jump button becomes a hop back, and holding it keeps the facing
// until it is put away, as in the original.
class oSword extends oIaBgObject {
	constructor() {
		super();
		// moves so it can break things
		this.initMoveable();
		this.initPickupable();
		this.holdable = true;
		this.gname = "SWORD";
		this.spd = 0;
		this.holdoffx = -2;
		// the slash's updates, which also count down its frames
		this.cooloff = 4;
		this.cooling = 0;
		this.lunge = 0.9;
		// the hop back: jump updates faked, back push and lift
		this.hopJumping = 8;
		this.hopBack = 1.3;
		this.hopLift = 0.5;
		this.hitFx = "sExplode1_smr";
		this.thruground = 0;
		this.restSprite = "s_sword";
		this.slashSprite = "s_sword_strike";

		// the held item's takeover of the controls, which the pickup setup leaves off
		this.over_con = (con, who) => {
			if (con.iBtnX || con.iBtnA) who.lockface = 1;
			if (!con.iBtnA) return;
			// a pretend jump that skips the real one
			if (!truthy(who.crawling) && !truthy(who.jumped)) {
				who.jumping = this.hopJumping;
				who.jumped = 1;
				who.xspd -= who.facing * this.hopBack;
				who.yspd = -this.hopLift;
			}
			con.iLeft = false;
			con.iRight = false;
			con.iBtnA = false;
		};
	}

	use(who) {
		if (this.cooling > 0) return;
		if (!truthy(who.crawling)) who.xspd = who.facing * this.lunge;
		Draw.setSprite(this, this.slashSprite);
		this.mask = this.slashSprite;
		this.nolook = true;
		this.cooling = this.cooloff;
	}

	put_away(who) {
		who.lockface = 0;
	}

	update() {
		if (this.cooling > 0) {
			const hit = shotHit(this, this.carriedBy);
			if (hit) {
				game.createObject(oFxOneShot, { x: this.x, y: this.y, spi: this.hitFx }, this.mylayer);
				hit.acton("hit", this);
			}
			// back to no mask in hand, or its own when it was let go mid slash, where the original
			// left a dropped sword with no mask, so it could not be picked up again
			if (--this.cooling === 0) {
				Draw.setSprite(this, this.restSprite);
				this.mask = this.carriedBy ? "sNoMask" : this.looseMask;
				this.nolook = false;
			}
			this.ifr = this.cooling;
		}
		super.update();
	}
}
mixin(oSword, Pickupable);
oSword.defaultSprite = "s_sword";

// Fires a bullet the way it faces, with a wait between shots.
class oGun extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
		this.holdable = true;
		this.gname = "PISTOL";
		this.spd = 0;
		this.cooloff = 8;
		this.cooling = 0;
		// the muzzle in front and up, and the bullet's speed
		this.muzzleX = 2;
		this.muzzleY = -2;
		this.shotSpd = 3;
	}

	use(who, user) {
		if (this.cooling > 0) return;
		game.createObject(oBullet, {
			x: this.x + this.muzzleX * sign(this.x_sc),
			y: this.y + this.muzzleY,
			xspd: this.shotSpd * sign(this.x_sc)
		}, this.mylayer);
		this.cooling = this.cooloff;
	}

	// the fired frame shows while it waits
	update() {
		if (this.cooling > 0) this.cooling--;
		this.ifr = Math.min(this.cooling, 1);
		super.update();
	}
}
mixin(oGun, Pickupable);
oGun.defaultSprite = "s_gun";

// Held down it aims, turning with the controls, and let go it shoots an arrow that way.
class oArBow extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
		this.holdable = true;
		// the aim starts this far up from straight ahead
		this.aimStartUp = 30;
		this.shotSpd = 3;
		// where the arrow starts, always a little right and up, as in the original
		this.nockX = 2;
		this.nockY = -1;
	}

	use(who) {
		who.aiming = true;
		who.aimdir = 90 - (90 - this.aimStartUp) * who.facing;
	}

	use_r(who) {
		who.aiming = false;
		game.createObject(oArrow, {
			x: this.x + this.nockX,
			y: this.y + this.nockY,
			xspd: lengthdirX(this.shotSpd, who.aimdir),
			yspd: lengthdirY(this.shotSpd, who.aimdir)
		}, this.mylayer);
	}

	// Put away mid aim, the original left the holder frozen aiming for good.
	put_away(who) {
		who.aiming = false;
	}
}
mixin(oArBow, Pickupable);
oArBow.defaultSprite = "s__ar_bow";

// Held down it sprays flames ahead, carried along by the holder's speed.
class oFlamer extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
		this.holdable = true;
		this.gname = "FLAME THROWER";
		this.spd = 0;
		this.cooloff = 3;
		this.cooling = 0;
		// a flame starts this far ahead plus up to the spread, and this far up plus up to the spread
		this.nozzleX = 4;
		this.nozzleY = -3;
		this.nozzleSpread = 2;
		// its forward speed on top of the holder's, and the most it drifts up or down
		this.flameSpd = 1;
		this.flameDrift = 0.4;
	}

	use(who) {
		if (this.cooling > 0) return;
		this.spd = 1;
		game.createObject(oFlame, {
			x: this.x + sign(this.x_sc) * (this.nozzleX + rng.irandom(this.nozzleSpread)),
			y: this.y + this.nozzleY + rng.irandom(this.nozzleSpread),
			xspd: this.flameSpd * sign(this.x_sc) + who.xspd,
			yspd: rng.randomRange(-this.flameDrift, this.flameDrift),
			// the original set neither, so flames never turned and could burn the holder
			facing: sign(this.x_sc),
			shooter: who
		}, this.carriedBy.mylayer);
		this.cooling = this.cooloff;
	}

	use_c(who) {
		this.use(who);
	}

	use_r(who) {
		this.spd = 0;
		this.ifr = 0;
	}

	update() {
		if (this.cooling > 0) this.cooling--;
		super.update();
	}
}
mixin(oFlamer, Pickupable);
oFlamer.defaultSprite = "s_flamer";

// Held down it shows its pull area and pulls every solid thing in it, which each decide how.
class oMagnet extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
		this.holdable = true;
		this.restSprite = "s_magnet";
		this.pullSprite = "s_magnet_pull_area";
	}

	use(who) {
		Draw.setSprite(this, this.pullSprite);
		this.mask = this.pullSprite;
		const pulled = [];
		this.instancePlaceList(this.x, this.y, oObject, pulled);
		for (const obj of pulled) obj.acton("magnate", this);
	}

	use_c(who) {
		this.use(who);
	}

	// back to no mask while held; the original gave it a small blank one
	use_r(who) {
		Draw.setSprite(this, this.restSprite);
		this.mask = "sNoMask";
	}
}
mixin(oMagnet, Pickupable);
oMagnet.defaultSprite = "s_magnet";

// Lit by any action or a use, it burns down its fuse and blows up in a ring of explosions.
// Caught in an explosion it blows almost at once.
class oTnt extends oIaBgObject {
	constructor() {
		super();
		this.spd = 0;
		this.initPickupable();
		this.initMoveable();
		this.lit = 0;
		this.fusetime = 90;
		this.litFrame = 1;
		// an explosion's short fuse, which still gives a little pause
		this.chainFuse = 2;
		// the ring: how many, how far out, and how far each turns off its even share
		this.ringCount = 7;
		this.ringMin = 9;
		this.ringMax = 11;
		this.ringJitter = 8;
	}

	light() {
		this.lit = 1;
		this.ifr = this.litFrame;
		this.spd = 1;
	}

	// The ring around and one in the middle. Carried, it leaves the hand or the inventory first,
	// where the original left a destroyed thing behind.
	blow() {
		const share = 360 / this.ringCount;
		for (let i = 0; i <= this.ringCount; i++) {
			let bx = this.x;
			let by = this.y;
			if (i < this.ringCount) {
				const d = rng.random(share) + share * i + rng.randomRange(-this.ringJitter, this.ringJitter);
				const l = rng.randomRange(this.ringMin, this.ringMax);
				bx += lengthdirX(l, d);
				by += lengthdirY(l, d);
			}
			game.createObject(oExplode1, { x: bx, y: by }, this.mylayer);
		}

		if (this.carriedBy) {
			if (this.carriedBy.carrying === this) this.carriedBy.inv.drop_held();
			else this.carriedBy.inv.remove(this);
		}
		this.destroy();
	}

	acton(action, who) {
		this.light();
		if (action === "explode") this.fusetime = this.chainFuse;
	}

	use(who, user) {
		this.light();
	}

	// it only moves itself loose; the original moved it while carried too
	update() {
		this.calcOnFloorAtWall();
		this.applyFrictionGravity();
		if (!this.carriedBy) this.moveThroughObjectsSimple(this.xspd, this.yspd);

		if (truthy(this.lit) && --this.fusetime === 0) {
			this.blow();
			return;
		}
		super.update();
	}
}
mixin(oTnt, Pickupable);
oTnt.defaultSprite = "s_tnt";

// A ball to carry and throw; it bounces off floors until the bounce is too small, then rolls to a stop.
class oBall extends oIaBgObject {
	constructor() {
		super();
		this.initMoveable();
		this.initPickupable();
		this.spd = 0;
		// sideways speed lost hitting a wall, and kept each update on the floor
		this.wallBounceLoss = 0.1;
		this.floorSideKeep = 0.9;
		// hitting a floor: sideways speed kept, bounce kept, and the speed below which it just stops
		this.landSideKeep = 0.95;
		this.bounceKeep = 0.8;
		this.restSpeed = 0.3;
		this.fallGravity = 0.04;
		// thrown: forward speed added to the thrower's, and the lift
		this.throwForward = 1.5;
		this.throwLift = 1.2;
	}

	use(who, user) {
		if (this.carriedBy === null) return;

		const thrower = this.carriedBy;

		thrower.inv.drop_held();

		// the throw replaces the drop's speeds
		this.xspd = thrower.xspd + sign(thrower.facing) * this.throwForward;
		this.yspd = thrower.yspd - this.throwLift;
	}

	update() {
		this.calcOnFloorAtWall();

		if (truthy(this.hitWall) || truthy(this.atWall)) {
			this.xspd = -sign(this.xspd) * Math.max(Math.abs(this.xspd) - this.wallBounceLoss, 0);
		}
		if (truthy(this.hitFloor)) {
			// the original wrapped this test in an absolute value, so it only ever tests the speed
			this.yspd = this.yspd < this.restSpeed ? 0 : -sign(this.yspd) * Math.max(Math.abs(this.yspd) * this.bounceKeep, 0);
			this.xspd = sign(this.xspd) * Math.max(Math.abs(this.xspd) * this.landSideKeep, 0);
		}
		if (truthy(this.onFloor)) {
			this.xspd = sign(this.xspd) * Math.max(Math.abs(this.xspd) * this.floorSideKeep, 0);
		} else {
			this.yspd += this.fallGravity;
		}

		if (!this.carriedBy) {
			this.moveThroughObjects(this.xspd, this.yspd);
		}
	}
}
mixin(oBall, Pickupable);
oBall.defaultSprite = "sBall";

// ---------------------------------------------------------------- shots

// Flies straight, hitting the first actor or solid thing it touches with its action and a pop,
// gone off screen. Can trail smoke.
class oBullet extends oBgObject {
	constructor() {
		super();
		this.initMoveable();
		this.hitFx = "sExplode1_smr";
		this.thruground = 0;
		this.hitact = "hit";
		// one in this many updates puffs smoke, none at zero, drifting back up to its speeds
		this.smoke = 0;
		this.smoke_sp = "s_poof_sm";
		this.smoke_xspd = 0;
		this.smoke_yspd = 0;
		// how far past the view it goes before it is gone
		this.offscreenPad = 20;
	}

	update() {
		const hit = shotHit(this);
		if (hit) {
			game.createObject(oFxOneShot, { x: this.x, y: this.y, spi: this.hitFx }, this.mylayer);
			hit.acton(this.hitact, this);
			this.destroy();
			return;
		}

		if (game.cam.offScreen(this, this.offscreenPad)) {
			this.destroy();
			return;
		}

		if (this.smoke > 0 && rng.irandom(this.smoke) === 0) {
			game.createObject(oFxOneShot, {
				x: this.x + rng.irandomRange(-1, 1),
				y: this.y + rng.irandomRange(-1, 1),
				spi: this.smoke_sp,
				xspd: -rng.random(this.smoke_xspd) * sign(this.xspd),
				yspd: rng.randomRange(-this.smoke_yspd, this.smoke_yspd)
			}, this.mylayer);
		}
		this.moveIgnoringObjects(this.xspd, this.yspd);
		super.update();
	}
}
oBullet.defaultSprite = "s_bullet_sm";

// Arcs under a light gravity pointing the way it flies, sticks a little way into the wall or floor
// it hits and fades out, and pops on anything else solid it ends up in. It passes actors by.
class oArrow extends oBgObject {
	constructor() {
		super();
		this.spd = 0;
		this.initMoveable();
		this.grav = 0.03;
		// updates left stuck, and how long a stuck arrow takes to fade
		this.stuck = 0;
		this.stuck_fade = 90;
		// how far it sinks in on sticking
		this.sinkIn = 2;
		this.popFx = "sExplode1_sm";
		this.offscreenPad = 20;
		// its frames point every eighth of a turn, and the sideways speed counts a bit more
		this.directions = 8;
		this.aimXWeight = 1.2;
	}

	update() {
		if (this.stuck > 0) {
			this.alpha = --this.stuck / this.stuck_fade;
			if (this.stuck === 0) this.destroy();
			return;
		}

		this.applyFrictionGravity();
		this.moveThroughObjectsSimple(this.xspd, this.yspd);

		if (truthy(this.hitWall) || truthy(this.hitFloor)) {
			this.xspd = 0;
			this.yspd = 0;
			const into = this.hitWallObj !== null ? this.hitWallObj : this.hitFloorObj;
			this.x += this.sinkIn * sign(into.sprite_cx() - this.sprite_cx());
			this.y += this.sinkIn * sign(into.sprite_cy() - this.sprite_cy());
			this.stuck = this.stuck_fade;
			this.mask = "sNoMask";
			return;
		}

		if (this.instancePlace(this.x, this.y, oObject) !== null) {
			game.createObject(oFxOneShot, { x: this.x, y: this.y, spi: this.popFx }, this.mylayer);
			this.destroy();
			return;
		}

		if (game.cam.offScreen(this, this.offscreenPad)) {
			this.destroy();
			return;
		}

		const step = 360 / this.directions;
		this.ifr = Math.floor((pointDirection(0, 0, this.xspd * this.aimXWeight, this.yspd) + step / 2) / step) % this.directions;
		super.update();
	}
}
oArrow.defaultSprite = "s_arrow";

// A short lived flame drifting on, shrinking and fading over its last updates. It burns the
// first actor or solid thing it touches, never the one who shot it.
class oFlame extends oBgObject {
	constructor() {
		super();
		this.initMoveable();
		this.facing = 1;
		this.shooter = null;
		this.hit_action = "burn";
		this.thruground = 0;
		this.hitFx = "sExplode1_smr";
		// updates it lasts, a random amount over the least, and the last stretch it fades over
		this.flameout = 20 + rng.irandom(10);
		this.flameout_fade = 10;
		this.offscreenPad = 20;
	}

	update() {
		const hit = shotHit(this, this.shooter);
		if (hit) {
			game.createObject(oFxOneShot, { x: this.x, y: this.y, spi: this.hitFx }, this.mylayer);
			hit.acton(this.hit_action, this);
			this.destroy();
			return;
		}

		if (--this.flameout === 0 || game.cam.offScreen(this, this.offscreenPad)) {
			this.destroy();
			return;
		}

		this.moveIgnoringObjects(this.xspd, this.yspd);

		const left = Math.min(this.flameout, this.flameout_fade) / this.flameout_fade;
		this.alpha = left;
		this.x_sc = left * this.facing;
		this.y_sc = left;
		super.update();
	}
}
oFlame.defaultSprite = "s_flame";

// One blast: for its first frames it tells everything it touches it exploded, and destroys
// what is marked explodable, then plays out and is gone.
class oExplode1 extends oBaseObject {
	constructor() {
		super();
		// from this frame on it is harmless
		this.harmlessFrame = 2;
		this.onAnimEnd = (self) => self.destroy();
	}

	init() {
		super.init();
		Hooks.sound("sndBoom");
	}

	update() {
		// the original waited for exactly this frame, which a frame covering two updates can skip
		if (Math.floor(this.ifr) >= this.harmlessFrame) this.mask = "sNoMask";

		const touched = [];
		this.instancePlaceList(this.x, this.y, oObject, touched);
		this.instancePlaceList(this.x, this.y, oBgObject, touched);
		this.instancePlaceList(this.x, this.y, oActor, touched);
		for (const obj of touched) {
			if (typeof obj.acton === "function") obj.acton("explode", this);
			if (obj.explodable !== undefined) obj.destroy();
		}
		super.update();
	}
}
// the original had no sprite of its own, so the ones the dynamite made never showed or hit
oExplode1.defaultSprite = "sExplode1";

// ---------------------------------------------------------------- chests

// Opens and closes when acted on, unless set to stay open, and rattles when locked. Its contents,
// either a kind of thing made on the first opening or one thing kept out of play, rise and grow
// out of it with a shine behind, to be picked up from the chest. Closed with them showing, they go
// back inside.
class oChest extends oIaBgObject {
	constructor() {
		super();
		this.spd = 0;
		this.locked = 0;
		this.open = 0;
		this.no_close = 0;
		// a kind of thing, by name, made on the first opening, or else one thing, by name, kept in
		// no layer until it comes out
		this.inv_objt = null;
		this.inventory = null;
		// what is showing now
		this.open_inv = null;
		// frames, and how long the locked rattle shows
		this.closedFrame = 0;
		this.openFrame = 1;
		this.rattleFrame = 2;
		this.rattleTime = 10;
		this.rattle = 0;
		// contents rise this far above the chest, less their own origin height, while growing, over this many updates
		this.revealRise = 14;
		this.revealTime = 20;
		this.shineSprite = "s_chest_open_shine";
	}

	openup() {
		this.open = 1;

		let invo = null;
		if (this.inv_objt !== null) {
			invo = game.createObject(this.inv_objt, { x: this.x, y: this.y }, this.mylayer);
			this.inv_objt = null;
		} else if (this.inventory !== null) {
			invo = game.lookupInst(this.inventory);
			if (invo) game.layerInsert(this.mylayer, invo);
			this.inventory = null;
		}

		if (invo) {
			this.open_inv = invo;
			const rec = Sprites.get(invo.spi);
			// centred on the chest's spot, from nothing
			invo.x = this.x + rec.ox - Math.floor(invo.sprite_width / 2);
			invo.y = this.y;
			invo.x_sc = 0;
			invo.y_sc = 0;
			// the original also took off the width here, read after it was squeezed to nothing
			game.createObject(oFader, { obj: invo, obj_var: "y", final_val: this.y - this.revealRise + rec.oy, time: this.revealTime }, this.mylayer);
			game.createObject(oFader, { obj: invo, obj_var: "x_sc", final_val: 1, time: this.revealTime }, this.mylayer);
			game.createObject(oFader, { obj: invo, obj_var: "y_sc", final_val: 1, time: this.revealTime }, this.mylayer);
		}

		this.open_more();
	}

	// anything more a kind of chest does on opening
	open_more() {}

	// Shut. What was showing goes back in, out of every layer so it is off, where the original
	// switched it off in place.
	close() {
		this.open = 0;
		if (this.open_inv === null) return;
		this.inventory = this.open_inv;
		game.layerRemove(this.open_inv.mylayer, this.open_inv);
		this.open_inv.mylayer = null;
		game.updateActive(this.open_inv);
		this.open_inv = null;
	}

	acton(action, who) {
		if (truthy(this.open)) {
			if (action !== "open" && !truthy(this.no_close)) this.close();
		} else if (truthy(this.locked)) {
			this.ifr = this.rattleFrame;
			this.rattle = this.rattleTime;
		} else {
			this.openup();
		}
	}

	// Hands over what is showing. Unlike the original, a refused pickup leaves it showing.
	pickup(who) {
		if (this.open_inv !== null && who.inv.pickup(this.open_inv) !== undefined) this.open_inv = null;
	}

	update() {
		// the rattle frame stays until its time runs out
		if (Math.floor(this.ifr) === this.rattleFrame && --this.rattle > 0) return;
		this.ifr = truthy(this.open) ? this.openFrame : this.closedFrame;
		// someone took what was showing
		if (this.open_inv !== null && this.open_inv.carriedBy) this.open_inv = null;
		super.update();
	}

	draw() {
		if (this.open_inv !== null) Draw.sprite(this.shineSprite, 0, this.x, this.y);
		super.draw();
	}
}
oChest.defaultSprite = "sChest";
