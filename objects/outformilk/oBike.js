// A side view bike the player rides. He gets on by landing on it or looking at it, then the bike
// takes his controls: left and right pedal and brake, the jump button hops, the pick up button gets
// off. Without a rider it rolls on and slows to a stop.

// Pedaling speeds up this much each update, and twice as much when pushing against the way it rolls,
// so pedaling backwards brakes.
const BIKE_ACCEL = 0.1;
const BIKE_BRAKE_ACCEL = 0.2;
// The hop's upward speed, the top speed both across and up and down (falls are capped by it too, as
// in the original), and the pull of gravity.
const BIKE_JUMP_SPEED = 3.5;
const BIKE_MAX_SPEED = 4;
const BIKE_GRAVITY = 0.2;
// Slowing on the ground while not pedaling, and how many times harder it slows with nobody on it.
const BIKE_FRICTION = 0.05;
const BIKE_NO_RIDER_FRICTION_FACTOR = 4;
// The tallest step it rolls up.
const BIKE_CLIMB_HEIGHT = 3;
// Landing on it counts only when falling faster than this.
const BIKE_HOP_ON_FALL_SPEED = 0.8;
// The rider sits this far above the bike's spot. Any sideways offset has to be in the riding
// picture itself, or the camera jumps when the bike turns.
const BIKE_RIDER_RAISE = 5;
// Landing slower than the floor stop speed stops it, faster bounces back up by the floor share.
// Hitting a wall slower than the wall stop speed stops it, faster sends it back at the wall share
// and pops it up by the speed it comes back with.
const BIKE_FLOOR_STOP_SPEED = 0.5;
const BIKE_FLOOR_BOUNCE = 0.3;
const BIKE_WALL_STOP_SPEED = 1;
const BIKE_WALL_BOUNCE = 0.5;
// Getting off while stopped lets the rider down with this small fall. Getting off while moving
// throws him with the bike's speed, up at least the leap speed and faster than the bike is rising
// by that much, and the bike is kicked down by this share of his leap.
const BIKE_STEP_OFF_FALL = 0.1;
const BIKE_LEAP_SPEED = 1;
const BIKE_LEAP_KICK = 0.5;
// The wheels turn at the bike's sideways speed over this.
const BIKE_ANIM_SPEED_DIVISOR = 2;

class oBike extends oIaBgObject {
	constructor() {
		super();
		this.initMoveable();
		this.maxspd = BIKE_MAX_SPEED;
		this.grav = BIKE_GRAVITY;
		this.fric = BIKE_FRICTION;
		this.canClimb = true;
		this.climbH = BIKE_CLIMB_HEIGHT;
		this.spd = 0;
		// whoever is riding and the controls taken from them, both empty with nobody on
		this.rider = null;
		this.con = null;
	}

	// Takes the rider and their controls. The original got on for any action, touching and hitting
	// it too; only looking does now.
	acton(action, who) {
		if (action === "look") this.hopOn(who);
	}

	hopOn(who) {
		this.rider = who;
		this.con = who.con;
		who.riding = this;
	}

	// lets the rider go, leaving their speeds as they are
	dropRider() {
		this.rider.riding = null;
		this.rider = null;
		this.con = null;
	}

	// Runs as the original's step, with the rider placed at the end so the camera and his drawing
	// see him on the bike this same update.
	update() {
		// the wheels turn at last update's speed
		this.spd = Math.abs(this.xspd) / BIKE_ANIM_SPEED_DIVISOR;

		this.calcOnFloorAtWall();

		const con = this.con;
		const gassing = con !== null && (con.iLeft || con.iRight);

		if (!this.onFloor) {
			this.yspd += this.grav;
		} else if (!gassing) {
			const slow = this.rider === null ? this.fric * BIKE_NO_RIDER_FRICTION_FACTOR : this.fric;
			this.xspd = sign(this.xspd) * Math.max(Math.abs(this.xspd) - slow, 0);
		}

		if (con !== null) {
			if (con.iLeft) this.facing = -1;
			else if (con.iRight) this.facing = 1;

			if (gassing) {
				this.xspd += this.facing * (sign(this.xspd) !== this.facing ? BIKE_BRAKE_ACCEL : BIKE_ACCEL);
			}

			if (con.iBtnA && (this.onFloor || this.onFloorL)) {
				this.yspd = -BIKE_JUMP_SPEED;
			}

			// getting off ends the update, the bike stays where it is until the next one
			if (con.iBtnB) {
				const rider = this.rider;
				if (Math.abs(this.xspd) + Math.abs(this.yspd) === 0) {
					rider.xspd = 0;
					rider.yspd = BIKE_STEP_OFF_FALL;
				} else {
					rider.xspd = this.xspd;
					rider.yspd = Math.min(this.yspd - BIKE_LEAP_SPEED, -BIKE_LEAP_SPEED);
					this.yspd -= rider.yspd * BIKE_LEAP_KICK;
				}
				this.dropRider();
				return;
			}
		}

		this.xspd = sign(this.xspd) * Math.min(Math.abs(this.xspd), this.maxspd);
		this.yspd = sign(this.yspd) * Math.min(Math.abs(this.yspd), this.maxspd);
		this.moveThroughObjects(this.xspd, this.yspd);

		if (this.hitFloor) {
			this.yspd = Math.abs(this.yspd) < BIKE_FLOOR_STOP_SPEED ? 0 : -this.yspd * BIKE_FLOOR_BOUNCE;
		}
		if (this.hitWall) {
			this.xspd = Math.abs(this.xspd) < BIKE_WALL_STOP_SPEED ? 0 : -this.xspd * BIKE_WALL_BOUNCE;
			this.yspd = -Math.abs(this.xspd);
		}

		// The player gets on by dropping onto it fast enough from above, not by already being in it.
		const guy = game.guy;
		if (guy !== null && this.instancePlace(this.x, this.y, guy) !== null
			&& guy.yspd > BIKE_HOP_ON_FALL_SPEED && this.instancePlace(this.x, this.y + guy.yspd, guy) === null) {
			this.hopOn(guy);
		}

		// A rider who dies or is hit falls off with whatever speed the death or the knock gave him,
		// before he is placed, so one landing on it already dead or knocked never sits on it. The
		// original kept him on, pinned to the bike through his death.
		if (this.rider !== null && (this.rider.dead || this.rider.hit)) this.dropRider();

		if (this.rider !== null) {
			this.rider.facing = this.facing;
			this.rider.x = this.x;
			this.rider.y = this.y - BIKE_RIDER_RAISE;
		}
	}

	// flipped to face the way it rolls, nudged a pixel when an odd width is flipped
	draw() {
		const xoadj = (this.xodd && this.facing < 0) ? 1 : 0;
		Draw.spriteExt(this.spi, this.ifr, this.x + xoadj, this.y, this.facing, this.y_sc,
			this.ang, this.col, this.alpha);
	}
}
oBike.defaultSprite = "bike";
