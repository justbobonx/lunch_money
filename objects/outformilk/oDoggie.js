// A dog that follows an actor close by and fetches the ball they throw; using it toggles following.
// Kept from the original: it follows any actor, rats included.
// The inventory is a stand in, so it never really carries the ball yet.
class oDoggie extends oActor {
	constructor() {
		super();
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

		// how far the owner can be before it gives up, further when fetching, and when a return is done
		this.giveUpDistance = 100;
		this.fetchGiveUpDistance = 500;
		this.returnedDistance = 100;
		// past this it catches up faster, the boost growing by a level over each span
		this.catchUpDistance = 40;
		this.boostPerLevel = 0.2;
		this.boostSpan = 60;
		this.fetchBoostSpan = 100;
		this.minCatchUpSpeed = 1;
		this.followMinSpeed = 0.5;
		this.followMaxSpeed = 2.5;
		// near enough to stop beside the owner
		this.stopDistance = 12;
		this.acceleration = 0.3;
		// jumping for a thrown ball it is under: sideways reach and the height band above it
		this.jumpReachX = 3;
		this.jumpBandNear = -10;
		this.jumpBandFar = -30;
		this.jumpSpeed = 1.8;
		this.jumpSpeedBonus = 0.3;
		this.barkText = "BARK!";
		this.barkFadeStart = 10;
		this.barkFadeTime = 30;
		this.barkFloatY = -0.35;
		// where a carried ball sits in its mouth
		this.carryOffsetMoving = 5.5;
		this.carryOffsetStill = 4.5;
		this.carryHighY = 2;
		this.carryLowY = 3;

		this.inv = new Inventory(1, undefined, this, "Doggie");
	}

	stop() {
		this.followObj = null;
		this.fetchObject = null;
		this.fetching = 0;
		this.returning = 0;
		this.xspd = 0;
		this.barks = 1;
	}

	// Taking the ball from its mouth. Unlike the original, it leaves the dog's inventory too.
	pickup(who) {
		if (this.carrying) who.inv.pickup(this.inv.drop_held());
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
			if (this.fetchObject !== null && !this.fetching && this.fetchObject.carriedBy === null) {
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

			if (this.returning && this.locod < this.returnedDistance) {
				this.returning = 0;
			}

			let maxsp;

			// too far, stop, but further when fetching or returning
			if ((this.locod > this.giveUpDistance && !this.returning && !this.fetching)
				|| this.locod > this.fetchGiveUpDistance) {
				this.stop();
				maxsp = 0;
			} else if (this.locod > this.catchUpDistance || this.fetching || this.returning) {
				// linearly faster the farther behind
				const spdboost = 1 + this.boostPerLevel * (this.fetching
					? Math.max(this.locod / this.fetchBoostSpan, 1)
					: ((this.locod - this.catchUpDistance) / this.boostSpan));
				maxsp = Math.max(Math.abs(this.followObj.xspd) * spdboost, this.minCatchUpSpeed);
			} else {
				// close enough, just keep up
				maxsp = Math.abs(this.followObj.xspd);
			}

			maxsp = clamp(maxsp, this.followMinSpeed, this.followMaxSpeed);

			// stop when close enough unless fetching
			if (this.locod < this.stopDistance && !this.fetching) {
				this.xspd = 0;
			} else {
				this.xspd = clamp(this.xspd + sign(this.locodx) * this.acceleration, -maxsp, maxsp);
			}

			// wants to jump for a ball above it, or at a wall when falling behind
			const wannajump = (this.fetching && Math.abs(this.locodx) < this.jumpReachX
					&& this.locody < this.jumpBandNear && this.locody > this.jumpBandFar)
				|| (this.atWall && this.locod >= this.loco_lastd);

			if (wannajump && (this.onFloor || this.swimming)) {
				this.yspd = -(this.jumpSpeed + Math.min(Math.abs(this.xspd), 1) * this.jumpSpeedBonus);
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
			Hooks.popMessage(this, this.barkText, -this.facing * (2 + this.barks * 2), -2 - 8 * this.barks,
				{ fadestart: this.barkFadeStart, fadetime: this.barkFadeTime, floatspdx: 0, floatspdy: this.barkFloatY });
			this.barks--;
		}
	}

	// Picks the picture for what it is doing and sets a carried item in its mouth.
	afterUpdate() {
		let si = "sDoggie_";

		if (this.swimming) {
			si += "run";
		} else if (!this.onFloor) {
			si += "jump";
		} else if (Math.abs(this.xspd) > 0) {
			si += "run";
		} else {
			si += "stand";
		}

		if (!this.dead && this.carrying) {
			this.carrying.x = this.x + Math.ceil(this.facing * (this.xspd !== 0 ? this.carryOffsetMoving : this.carryOffsetStill));
			this.carrying.y = this.y - (this.xspd === 0 || Math.floor(this.ifr) === 0 ? this.carryHighY : this.carryLowY);
			this.carrying.x_sc = this.facing;
		}

		this.drawSprite = si;
		this.spi = si;
	}

	// the held item is hidden from the normal draw, so the dog draws it in its mouth, in front of itself
	draw() {
		super.draw();
		if (!this.dead && this.carrying) this.carrying.draw();
	}
}
oDoggie.defaultSprite = "sDoggie_stand";
