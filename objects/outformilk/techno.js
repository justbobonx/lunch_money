// Placeholders for the bobbing techno floors, until their own step is ported.
class oGrTechno extends oGround {
	constructor() {
		super();
		this.hangable = false;
		this.moving = true;
		this.initMoveable();
		this.stoodon = false;
		this.step = rng.irandom(3) * 10;
		// the placed spot replaces this nudge, as it always has
		this.y += this.step * 0.1;
		this.on = 1;
	}
}
oGrTechno.ported = false;

class oGrTechnoVoid extends oGround {
	constructor() {
		super();
		this.hangable = false;
		this.moving = true;
		this.initMoveable();
		this.stoodon = false;
		this.step = rng.irandom(5) * 10;
		// the placed spot replaces this nudge, as it always has
		this.y += this.step * 0.06;
	}
}
oGrTechnoVoid.ported = false;
