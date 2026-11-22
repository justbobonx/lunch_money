// A flying bird the player can stand on or hang from; it speeds up with a rider and dips as it flaps.
// Its dip and rise follow its own animation frame, so they only advance while it is drawn.
class oBird extends oGround {
	constructor() {
		super();
		this.initMoveable();
		this.hangable = true;
		// drifts slowly while nothing rides it
		this.idleSpeed = 0.3;
		this.ridingSpeed = 2;
		// dips on every third animation frame and rises on the others
		this.dipSpeed = 0.3;
		this.riseSpeed = -0.15;
		this.dipFrameCycle = 3;
		// one trip lasts this many updates, and it only flies for the first part unless ridden
		this.loopUpdates = 400;
		this.flyUpdates = 340;
		this.xspd = this.idleSpeed;
		this.rx = 0;
		this.ry = 0;
		this.step = 0;
	}

	update() {
		let riding = false;
		let rider = this.instancePlace(this.x, this.y - 1, game.guy);

		if (rider !== null && rider.onFloor) {
			riding = true;
		} else {
			rider = this.instancePlace(this.x - 1, this.y, game.guy);
			if (rider === null) rider = this.instancePlace(this.x + 1, this.y, game.guy);
			if (rider !== null && rider.hanging) riding = true;
		}

		this.xspd = sign(this.xspd) * (riding ? this.ridingSpeed : this.idleSpeed);

		this.yspd = Math.floor(this.ifr) % this.dipFrameCycle === 0 ? this.dipSpeed : this.riseSpeed;

		this.step = (this.step + 1) % this.loopUpdates;

		if (this.step < this.flyUpdates || riding) {
			this.moveIgnoringObjects(this.xspd, this.yspd);
		}
	}
}
