// The farm: sheep that graze, wander and run from the player, robins and their kin that hop and
// peck and fly off when anyone comes near, the invisible pens that keep the sheep in, and tiled
// fences and walls.

// Sheep: how near a player character scares one and the push away, which grows the nearer they
// are, how near another sheep pushes it aside and how fast, the share of speed kept when a pen
// edge turns it back and the turn's random spread in degrees, and grazing: the chance in a hundred
// each idle update and the range of updates it lasts.
const SHEEP_SCARE_RADIUS = 30;
const SHEEP_FLEE_PUSH = 20;
const SHEEP_FLEE_SOFTEN = 5;
const SHEEP_CROWD_RADIUS = 6;
const SHEEP_CROWD_SPEED = 1;
const SHEEP_EDGE_SPEED_KEEP = 0.5;
const SHEEP_EDGE_SPREAD = 10;
const SHEEP_EAT_CHANCE = 1;
const SHEEP_EAT_MIN = 80;
const SHEEP_EAT_MAX = 150;

// Robins: the birds a robin may be, commonest first (the original listed robin and dove twice),
// how far from its home spot it comes back, and how near another robin shares its kind.
const ROBIN_SKINS = ["s_robin", "s_dove", "s_robin", "s_dove", "s_goldfinch", "s_bluejay", "s_cardinal"];
const ROBIN_HOME_SPREAD_X = 6;
const ROBIN_HOME_SPREAD_Y = 4;
const ROBIN_FLOCK_RADIUS = 22;
// Its idle: updates until the first choice, picked up to this many, and the wait after each
// choice; the chances in a hundred of a hop and, above that, of pecking, else it turns round.
const ROBIN_FIRST_BORED_MAX = 300;
const ROBIN_BORED_MIN = 180;
const ROBIN_BORED_MAX = 300;
const ROBIN_HOP_CHANCE = 20;
const ROBIN_EAT_CHANCE = 60;
// A hop: speed along the ground and up, the pull of gravity, and when farther than the stray
// distance from home the hop's way is turned this share toward home.
const ROBIN_HOP_SPEED = 0.3;
const ROBIN_HOP_LIFT = 0.4;
const ROBIN_HOP_GRAVITY = 0.02;
const ROBIN_HOP_STRAY = 5;
const ROBIN_HOP_HOMEWARD = 0.4;
// Pecking lasts this many updates.
const ROBIN_EAT_UPDATES = 60;
// Flying off: how near any actor scares it, the random spread on the way away in degrees, which
// is then pulled half way to straight left or right, the speed, the share of the up and down
// speed kept, the start height and climb, the climb's gain each update and its top.
const ROBIN_SCARE_RADIUS = 30;
const ROBIN_FLEE_SPREAD = 20;
const ROBIN_FLEE_SIDEWAYS = 0.5;
const ROBIN_FLY_SPEED = 1.5;
const ROBIN_FLY_Y_KEEP = 0.9;
const ROBIN_FLY_START_Z = 1;
const ROBIN_FLY_START_ZSPD = 0.1;
const ROBIN_FLY_CLIMB = 0.05;
const ROBIN_FLY_CLIMB_MAX = 1;
// Once out of view by this margin it is gone for at least this many updates, and comes back only
// when its home spot is out of view too.
const ROBIN_VIEW_MARGIN = 16;
const ROBIN_RESPAWN_UPDATES = 300;
const ROBIN_SHADOW = "s_robin_sh";

// A sheep. It runs from the nearest player character, steps away from a sheep it bumps into, and
// otherwise wanders its pen, grazing now and then while it stands. Leaving the pen pulls it back
// in; a frightened sheep stops at the edge, a wandering one turns back toward the pen's middle
// more slowly.
class oSheep extends oActor {
	constructor() {
		super();
		this.initMoveable();
		this.wander_area = true;
		// idle, walk, eat or flee, and the grazing updates left
		this.state = "idle";
		this.eatTime = 0;
		this.facing = rng.choose(-1, 1);
	}

	init() {
		super.init();
		this.wanderInit();
	}

	update() {
		const runfrom = this.collisionCircle(this.x, this.y, SHEEP_SCARE_RADIUS, oChar);
		const crowd = runfrom === null ? this.collisionCircle(this.x, this.y, SHEEP_CROWD_RADIUS, oSheep) : null;
		// running or stepping aside is a one update walk, so wandering stops it after
		if (runfrom !== null || crowd !== null) {
			const from = runfrom !== null ? runfrom : crowd;
			const dir = pointDirection(from.x, from.y, this.x, this.y);
			const spd = runfrom !== null
				? SHEEP_FLEE_PUSH / (pointDistance(this.x, this.y, from.x, from.y) + SHEEP_FLEE_SOFTEN)
				: SHEEP_CROWD_SPEED;
			this.xspd = lengthdirX(spd, dir);
			this.yspd = lengthdirY(spd, dir);
			this.walkTime = 1;
		} else {
			this.wanderUpdate();
		}
		// any walk ends grazing
		if (this.walkTime > 0) this.eatTime = 0;

		this.moveThroughObjectsTopd(this.xspd, this.yspd, this.zspd);
		this.checkStayinObjs(oStayinBox);

		if (this.stayinHit !== null) {
			if (runfrom !== null) {
				this.xspd = 0;
				this.yspd = 0;
			} else {
				const dir = pointDirection(this.x, this.y, this.stayinHit.x, this.stayinHit.y)
					+ rng.randomRange(-SHEEP_EDGE_SPREAD, SHEEP_EDGE_SPREAD);
				const spd = pointDistance(0, 0, this.xspd, this.yspd) * SHEEP_EDGE_SPEED_KEEP;
				this.xspd = lengthdirX(spd, dir);
				this.yspd = lengthdirY(spd, dir);
			}
		}

		// grazing starts and counts down only while standing idle, not on the update a walk ends
		if (this.walkTime === 0 && this.idleTime > 0) {
			if (this.eatTime === 0 && rng.random(100) < SHEEP_EAT_CHANCE) {
				this.eatTime = rng.irandomRange(SHEEP_EAT_MIN, SHEEP_EAT_MAX);
			}
			if (this.eatTime > 0) this.eatTime--;
		}

		if (runfrom !== null) this.state = "flee";
		else if (this.walkTime > 0) this.state = "walk";
		else if (this.eatTime > 0) this.state = "eat";
		else this.state = "idle";

		const spi = (this.state === "flee" || this.state === "walk") ? "s_sheep_walk"
			: (this.state === "eat" ? "s_sheep_eat" : "s_sheep_stand");
		if (spi !== this.spi) {
			Draw.setSprite(this, spi);
			this.ifr = 0;
		}

		if (this.xspd !== 0) this.facing = sign(this.xspd);
	}
}
oSheep.defaultSprite = "s_sheep_stand";

// A small bird about its home spot. Sitting, it gets bored now and then and hops a little,
// homeward when it has strayed, pecks at the ground, or turns round. Any actor coming near sends
// it flying off to one side, climbing; once out of view it is gone a while, then comes back by its
// home spot, unseen, as whichever kind of bird a nearby one already is. Set to only, it is always
// the bird its room entry shows. Gone, it keeps living unseen, so it can even fly off again.
class oRobin extends oBgObject {
	constructor() {
		super();
		this.initMoveable();
		// sit, hop, eat or fly, with the updates until it is bored and of pecking left
		this.state = "sit";
		this.boredTime = 0;
		this.eatTime = 0;
		// updates left before it may come back, once gone from view
		this.goneTime = 0;
		this.skins = ROBIN_SKINS;
		this.skin = null;
		this.sitSprite = null;
		this.eatSprite = null;
		this.flySprite = null;
		// set in its room entry to keep the bird it is placed as
		this.only = false;
		this.homeX = 0;
		this.homeY = 0;
		this.friends = [];
	}

	init() {
		super.init();
		this.homeX = this.x;
		this.homeY = this.y;
		if (this.only) this.skins = [this.spi];
		this.reset();
	}

	// Back by its home spot, sitting and still, as the kind of bird the nearest robin is, or if none
	// near has one yet, a pick weighted toward the front of the list.
	reset() {
		this.x = this.homeX + rng.randomRange(-ROBIN_HOME_SPREAD_X, ROBIN_HOME_SPREAD_X);
		this.y = this.homeY + rng.randomRange(-ROBIN_HOME_SPREAD_Y, ROBIN_HOME_SPREAD_Y);
		this.z = 0;
		this.xspd = 0;
		this.yspd = 0;
		this.zspd = 0;
		this.state = "sit";
		this.eatTime = 0;
		this.facing = rng.choose(-1, 1);
		this.boredTime = rng.irandomRange(1, ROBIN_FIRST_BORED_MAX);

		this.friends.length = 0;
		this.collisionCircleList(this.x, this.y, ROBIN_FLOCK_RADIUS, oRobin, this.friends, true);
		if (this.friends.length > 0 && this.friends[0].skin !== null) {
			this.skin = this.friends[0].skin;
		} else {
			// a draw of exactly zero would land one past the end, so it is kept to the last
			const n = this.skins.length;
			this.skin = this.skins[Math.min(n - 1, Math.floor(n - Math.cbrt(rng.random(n * n * n))))];
		}
		this.sitSprite = this.skin;
		this.eatSprite = this.skin + "_eat";
		this.flySprite = this.skin + "_fly";
		Draw.setSprite(this, this.sitSprite);
	}

	update() {
		if (!this.visible) {
			this.goneTime--;
			if (this.goneTime <= 0 && !game.cam.onScreen(this, ROBIN_VIEW_MARGIN)) this.visible = true;
		}

		const runfrom = this.state === "fly" ? null : this.collisionCircle(this.x, this.y, ROBIN_SCARE_RADIUS, oActor);
		if (runfrom !== null) {
			// away from it with a little spread, then pulled half way to straight left or right
			let dir = angleAdd(pointDirection(runfrom.x, runfrom.y, this.x, this.y),
				rng.randomRange(-ROBIN_FLEE_SPREAD, ROBIN_FLEE_SPREAD));
			dir = angleAvg(dir, (dir > 90 && dir < 270) ? 180 : 0, ROBIN_FLEE_SIDEWAYS);
			this.state = "fly";
			this.eatTime = 0;
			Draw.setSprite(this, this.flySprite);
			this.ifr = 0;
			this.xspd = lengthdirX(ROBIN_FLY_SPEED, dir);
			this.yspd = lengthdirY(ROBIN_FLY_SPEED, dir);
			this.z = ROBIN_FLY_START_Z;
			this.zspd = ROBIN_FLY_START_ZSPD;
		} else if (this.state !== "fly" && --this.boredTime === 0) {
			const choice = rng.random(100);
			if (choice < ROBIN_HOP_CHANCE) {
				let dir = rng.random(360);
				if (pointDistance(this.homeX, this.homeY, this.x, this.y) > ROBIN_HOP_STRAY) {
					dir = angleAvg(dir, pointDirection(this.x, this.y, this.homeX, this.homeY), ROBIN_HOP_HOMEWARD);
				}
				this.state = "hop";
				this.xspd = lengthdirX(ROBIN_HOP_SPEED, dir);
				this.yspd = lengthdirY(ROBIN_HOP_SPEED, dir);
				this.zspd = ROBIN_HOP_LIFT;
				Draw.setSprite(this, this.flySprite);
				this.ifr = 0;
			} else if (choice < ROBIN_EAT_CHANCE) {
				this.state = "eat";
				this.eatTime = ROBIN_EAT_UPDATES;
				Draw.setSprite(this, this.eatSprite);
				this.ifr = 0;
			} else {
				this.facing = -this.facing;
			}
			this.boredTime = this.eatTime + rng.irandomRange(ROBIN_BORED_MIN, ROBIN_BORED_MAX);
		}

		if (this.state === "hop") {
			this.x += this.xspd;
			this.y += this.yspd;
			this.z += this.zspd;
			this.zspd -= ROBIN_HOP_GRAVITY;
			if (this.z <= 0) {
				this.state = "sit";
				Draw.setSprite(this, this.sitSprite);
				this.z = 0;
				this.xspd = 0;
				this.yspd = 0;
				this.zspd = 0;
			}
		} else if (this.state === "fly") {
			this.x += this.xspd;
			this.y += this.yspd * ROBIN_FLY_Y_KEEP;
			this.zspd = Math.min(this.zspd + ROBIN_FLY_CLIMB, ROBIN_FLY_CLIMB_MAX);
			this.z += this.zspd;
			// gone once neither it nor its shadow is in view
			if (!game.cam.onScreen(this, ROBIN_VIEW_MARGIN) && !game.cam.onScreenAtHeight(this, ROBIN_VIEW_MARGIN)) {
				this.visible = false;
				this.goneTime = ROBIN_RESPAWN_UPDATES;
				this.reset();
				return;
			}
		} else if (this.state === "eat") {
			this.eatTime--;
			if (this.eatTime === 0) {
				this.state = "sit";
				Draw.setSprite(this, this.sitSprite);
			}
		}

		if (this.xspd !== 0) this.facing = sign(this.xspd);
	}

	// its shadow on the ground while off it, and itself lifted by its height
	draw() {
		if (this.state === "hop" || this.state === "fly") {
			Draw.spriteExt(ROBIN_SHADOW, 0, this.x, this.y, 1, 1, 0, NO_TINT, 1);
		}
		Draw.spriteExt(this.spi, this.ifr, this.x - this.exoffx, this.y - this.exoffy - this.z,
			this.facing, this.y_sc, this.ang, this.col, this.alpha);
	}
}
oRobin.defaultSprite = "s_robin";

// An invisible pen: an area that things checking it stay inside once they are in, the sheep and
// the top down player. Never drawn.
class oStayinBox extends oBaseObject {
	constructor() {
		super();
		this.visible = false;
	}

	draw() {}
}
oStayinBox.defaultSprite = "sBlankGrCtr";

// Ground drawn tiled when its room entry asks, the same as solid ground.
class oSolidGrTiled extends oSolidGr {}
oSolidGrTiled.defaultSprite = "sSolidWhRotate";
