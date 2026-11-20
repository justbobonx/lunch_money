// A pile of snow that squishes and puffs when something stands in it.
// In the original the puff's speed is set and then replaced by its own first update, which this keeps.
class oSnow1 extends oBaseObject {
	constructor() {
		super();
		this.spd = 0;
		this.poofed = 0;
		// settles for this many updates after someone leaves before it can puff again
		this.puffCooldown = 5;
		// its own animation speed when stepped on: this plus up to the range
		this.squishSpeedMin = 0.8;
		this.squishSpeedRange = 0.4;
		// the puff starts further in the harder they landed, up to this many frames
		this.puffFrames = 4;
		this.puffLandingScale = 4;
		this.puffSpeedMin = 0.7;
		this.puffSpeedRange = 0.5;
		this.puffSprite = "s_snow_poof";
	}

	update() {
		if (this.ifr < 1) {
			this.ifr = 0;
			this.spd = 1;
		}

		const stander = this.instancePlace(this.x, this.y, oActor);
		if (stander !== null && this.poofed === 0) {
			this.ifr = 1;
			this.spd = this.squishSpeedMin + rng.random(this.squishSpeedRange);

			const poof = game.createObject(oFxOneShot, { x: this.x, y: this.y, spi: this.puffSprite }, this.mylayer);
			poof.ifr = this.puffFrames - Math.min(Math.floor(stander.yspd * this.puffLandingScale), this.puffFrames);
			poof.spd = this.puffSpeedMin + rng.random(this.puffSpeedRange);
			this.poofed = this.puffCooldown;
		}
		if (stander === null && this.poofed > 0) {
			this.poofed--;
		}
	}
}
