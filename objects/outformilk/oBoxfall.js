// A box that tumbles down, lands on the first floor it finds and shakes the camera.
// Nothing in the original ever lowers its life, so it stays where it landed unless something removes it.
class oBoxFall extends oGround {
	constructor() {
		super();
		this.initMoveable();
		this.landed = false;
		// eased aside this far when it lands on the very edge of something, and dropped a little
		this.edgeNudgeX = 5;
		this.edgeNudgeY = 1;
		// its start drift and spin
		this.drift = 0.1;
		this.spinExtra = 0.2;
		// its full life, and how many frames its picture steps through as the life runs down
		this.fullLife = 130;
		this.lifeFrames = 3;
		// the camera shake on landing: updates, sideways and up and down strength
		this.shakeUpdates = 8;
		this.shakeX = 2;
		this.shakeY = 1;
		this.xspd = rng.randomRange(-this.drift, this.drift);
		this.yspd = rng.randomRange(-this.drift, this.drift);
		this.rspd = (this.yspd / 3 + rng.random(this.spinExtra)) * (rng.random(10) < 5 ? -1 : 1);
		this.spd = 0;
		this.ifr = 0;
		this.life = this.fullLife;
	}

	update() {
		if (this.life === 0) {
			this.destroy();
			return;
		}

		if (truthy(this.landed)) return;

		this.calcOnFloorAtWall();

		if (truthy(this.onFloor)) {
			const ho = this.onFloorObj;
			if (ho !== null && this.y < ho.y) {
				if (this.x < ho.x && this.x < ho.bbox_left) {
					this.x -= this.edgeNudgeX;
					this.y += this.edgeNudgeY;
					this.rspd = Math.abs(this.rspd);
				} else if (this.x > ho.x && this.x > ho.bbox_right) {
					this.x += this.edgeNudgeX;
					this.y += this.edgeNudgeY;
					this.rspd = -Math.abs(this.rspd);
				}
				this.calcOnFloorAtWall();
			}
		}
		if (truthy(this.onFloor)) {
			Hooks.sound("sndThud");
			this.landed = true;
			game.cam.shakeit(this.shakeUpdates, this.shakeX, this.shakeY);
		}

		this.ang += this.rspd;

		this.moveThroughObjects(this.xspd, this.yspd);
	}

	// the frame follows the life left
	draw() {
		this.ifr = this.lifeFrames - Math.ceil(this.life / this.fullLife * this.lifeFrames);
		Draw.lpSprite(this);
	}
}
oBoxFall.defaultSprite = "s_box_thru";
