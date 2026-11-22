// The jungle pieces: the log shooter, its rolling logs and the areas that eat them, and the heart.

// Placeholder: the original turns its pass flags on, then straight back off.
class oJgHeart extends oGround {
	constructor() {
		super();
		this.initMoveable();
	}
}
oJgHeart.ported = false;

// Shoots a log out of its front now and then, facing the way it is stretched; its room entry can switch it off.
class oJgLogShooter extends oGround {
	constructor() {
		super();
		this.hangable = false;
		this.landed = true;
		// updates between shots, and how long before a shot the barrel starts to open
		this.shotRate = 210;
		this.shotWarning = 40;
		this.shotSpd = 0.8;
		// the log is made this far in front, then moved to the muzzle
		this.makeOffsetX = 3;
		this.muzzleOffsetX = 6;
		// frames: closed, opening, and the first of the firing animation
		this.closedFrame = 0;
		this.openingFrame = 1;
		this.firingFrame = 2;
		// each starts at a random point in its cycle so a row of them does not fire together
		this.step = rng.irandom(this.shotRate - this.shotWarning - 1);
		this.spd = 0;
		this.ifr = this.closedFrame;
		this.on = true;
		// the firing animation stops once it comes round to the closed frame
		this.onAnimEnd = (self) => {
			self.spd = 0;
			self.ifr = self.closedFrame;
		};
	}

	update() {
		if (!this.on) return;

		this.step++;

		if (this.step === this.shotRate - this.shotWarning) {
			this.ifr = this.openingFrame;
		} else if (this.step === this.shotRate) {
			// made at the first spot so its remembered last spot is there, then moved to the muzzle
			const nextLog = game.createObject(oJgLog, { x: this.x + this.makeOffsetX * this.x_sc, y: this.y }, this.mylayer);
			nextLog.x = this.x + this.muzzleOffsetX * this.x_sc;
			nextLog.xspd = this.shotSpd * this.x_sc;

			Hooks.sound("snd8bPoofShoot");

			this.step = 0;
			this.ifr = this.firingFrame;
			this.spd = 1;
		}
	}
}

// A rolling solid log that kills the player on touch and pops when a log eater takes it.
class oJgLog extends oObject {
	constructor() {
		super();
		this.spd = 0;
		this.initMoveable();
		this.rollst = 0;
		this.on = true;
		// sideways speed lost bouncing off a wall, and its own fall
		this.wallBounceLoss = 0.1;
		this.fallGravity = 0.05;
		// a quarter turn this many times per roll, over this many updates
		this.rollUpdates = 60;
		this.rollSteps = 4;
		// hitting the player: spray amount, spray time, and how much its speed pushes the spray
		this.killSprayAmount = 20;
		this.killSprayTime = 10;
		this.killSprayPush = 0.5;
		// the pop where it is eaten sits just above it
		this.popOffsetY = -1;
	}

	update() {
		this.calcOnFloorAtWall();

		// bounce off a wall and slow a little
		if (this.atWall) {
			this.xspd = -sign(this.xspd) * Math.max(Math.abs(this.xspd) - this.wallBounceLoss, 0);
		}
		if (this.onFloor) {
			this.yspd = 0;
		} else {
			this.yspd += this.fallGravity;
		}

		if (this.onFloor && !this.onFloorL) Hooks.sound("snd8bThud");

		this.moveThroughObjects(this.xspd, this.yspd);

		if (this.on && this.instancePlace(this.x, this.y, game.guy) !== null) {
			game.guy.kill(this.killSprayAmount, this.killSprayTime,
				[-1 + this.xspd * this.killSprayPush, 1 + this.xspd * this.killSprayPush], 0, 1, "sndHit1", this);
		}

		const eater = this.instancePlace(this.x, this.y, oLogEater);
		if (eater !== null) {
			game.createObject(oFxOneShot, { x: this.x, y: this.y + this.popOffsetY, spi: eater.popType }, this.mylayer);
			if (eater.popSound >= 0) Hooks.sound(eater.popSound);
			this.destroy();
			return;
		}

		this.rollst = (this.rollst + 1) % this.rollUpdates;

		this.ang = Math.floor(this.rollst / this.rollUpdates * this.rollSteps) * 90 * sign(this.xspd);
	}
}

// Made by code, not placed by a room, so it has to bring its own sprite or it has no picture and no mask.
oJgLog.defaultSprite = "sJgLog";

// An invisible area that eats any log touching it; logs ask it which pop to show and sound to play.
class oLogEater extends oBgObject {
	constructor() {
		super();
		this.hangable = false;
		this.landed = true;
		this.popType = "sAniPop";
		this.popSound = -1;
	}
	draw() {}
}
