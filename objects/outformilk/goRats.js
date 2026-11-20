// The rats: the rat that chases and bites the player, and the door that lets them out.

// A rat that chases the player once near or told to, and bites at close range.
// It turns round only after getting a little past its target, so rats do not stack.
class oNpc_Chaser extends oActor {
	constructor() {
		super();
		this.initLocObj();

		this.target = null;

		this.following = false;
		this.followd = 0;

		this.max_follow_dist = 100;

		// how far past the target before it turns round, and its top speed, picked between these
		this.turnaroundMin = 8;
		this.turnaroundMax = 14;
		this.speedMin = 0.5;
		this.speedMax = 0.8;
		// close enough to bite, and close enough to start chasing
		this.biteDistance = 4;
		this.noticeDistance = 50;
		// farther than this it runs faster
		this.sprintDistance = 100;
		this.sprintBoost = 2.1;
		this.acceleration = 0.2;
		// a one in this many chance each update on the floor to hop
		this.hopOdds = 60;
		this.hopMin = -0.9;
		this.hopMax = -1.5;
		this.wallJumpSpeed = 1.6;
		this.wallJumpBonus = 0.2;
		this.biteSprayAmount = 100;
		this.biteSprayTime = 10;
		this.airFrame = 1;

		this.turnaroundd = rng.irandomRange(this.turnaroundMin, this.turnaroundMax);
		this.umxsdp = rng.randomRange(this.speedMin, this.speedMax);
	}

	// the target is found once everything exists
	init() {
		super.init();
		this.target = game.guy;
	}

	at_target(t) {
		killGuy(this.biteSprayAmount, this.biteSprayTime, [-0.6, 0.6], [-1, 1, 0.4], 1);
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

		if (this.locod < this.biteDistance) {
			this.at_target(this.target);
		}

		this.checkStartSwimming();

		this.applyFrictionGravity();

		// hop at random
		if (truthy(this.onFloor) && rng.irandom(this.hopOdds) === 0) {
			this.yspd += rng.randomRange(this.hopMin, this.hopMax);
		}

		// faster when far behind
		const maxsp = this.umxsdp * (this.locod > this.sprintDistance ? this.sprintBoost : 1);

		// not following means standing still until the target comes near
		if (!this.following) {
			this.xspd = 0;
			if (this.locod < this.noticeDistance) {
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
				this.yspd = -(this.wallJumpSpeed + Math.min(Math.abs(this.xspd), 1) * this.wallJumpBonus);
			}

			// turn round when going the wrong way, but only after getting past the target
			if (Math.abs(this.locodx) > this.turnaroundd || this.xspd === 0) {
				this.followd = sign(this.locodx);
			}
			this.xspd = clamp(this.xspd + this.followd * this.acceleration, -maxsp, maxsp);
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
			this.ifr = this.airFrame;
		} else {
			this.spd = 1;
		}
	}
}
oNpc_Chaser.defaultSprite = "sRat";

// A door that squeaks while shut and lets out a run of rats while open.
// Its own update replaces the plain door's, as in the original, so it never leads to another room.
class oRatDoor extends oDoor {
	constructor() {
		super();
		// how many rats: the least plus up to the extra
		this.ratsMin = 30;
		this.ratsExtra = 5;
		// waits between squeaks; one in this many plus one is the short kind
		this.squeakWaitMin = 40;
		this.squeakWaitShortMax = 60;
		this.squeakWaitLongMax = 300;
		this.shortWaitOdds = 3;
		this.squeaks = ["skreee", "skreee", "skrich"];
		// waits between rats, and how far its rats chase
		this.ratWaitMin = 5;
		this.ratWaitMax = 12;
		this.ratFollowDistance = 500;
		this.nextScree = 1;
		this.rats = this.ratsMin + rng.irandom(this.ratsExtra);
		this.nextRat = 60;
	}

	acton(action, who) {
		super.acton(action, who);

		if (this.rats === 0) return;

		Hooks.popMessage(0, "RUN!!!", this.x - 11, this.y - 18, { fadestart: 60, floatspdy: -0.15 });
	}

	update() {
		if (this.rats > 0 && Math.floor(this.ifr) === 0 && --this.nextScree === 0) {
			this.nextScree = rng.irandomRange(this.squeakWaitMin,
				rng.irandom(this.shortWaitOdds) === 0 ? this.squeakWaitShortMax : this.squeakWaitLongMax);

			// the original picked a spot to squeak from and then never used it, but the random numbers
			// still came out, so they are drawn here to keep the sequence
			rng.irandomRange(-10, 5);
			rng.irandomRange(-12, -4);

			const floatspdy = -0.15 - rng.random(0.1);
			const floatspdx = rng.randomRange(-0.05, 0.05);
			Hooks.popMessage(0, rng.choose(...this.squeaks), this.x - 11, this.y - 12,
				{ alpha: 0.5, floatspdy: floatspdy, floatspdx: floatspdx });
		}

		if (Math.floor(this.ifr) === 1 && this.rats > 0 && --this.nextRat === 0) {
			this.rats--;
			this.nextRat = rng.irandomRange(this.ratWaitMin, this.ratWaitMax);
			game.createObject(oNpc_Chaser, { x: this.x, y: this.y, following: true, max_follow_dist: this.ratFollowDistance },
				this.mylayer);
		}
	}
}
