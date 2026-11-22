// A field of twinkling, drifting stars with an optional dark cover and shooting stars, set by its room entry.
// Like the original it all runs as it draws, and shooting stars wait in real time.
class oStarField extends oBaseObject {
	constructor() {
		super();
		this.starfield = [];
		this.sfsize = 500;
		// stars per square pixel of the field
		this.st_per_sqp = 0.005;
		this.starst = 0;

		this.star_sprite = "star1";

		// the field size until it knows its picture
		this.starfw = 255;
		this.starfh = 339;

		this.velox = 0;
		this.veloy = 0;

		this.st_color = "#c8c8ff";
		// each star's twinkle speed is picked between these
		this.twinkle_spd_min = 0.005;
		this.twinkle_spd_max = 0.02;
		// a star's depth is the least plus up to the range, deeper ones drift and stretch more
		this.depthMin = 0.1;
		this.depthRange = 0.9;
		// a star's brightness swings between the base and the base plus the swing
		this.brightnessBase = 0.1;
		this.brightnessSwing = 0.8;

		this.covercolor = "#000000";
		this.coveralpha = 1;

		this.shooters = [];
		// how often in milliseconds, zero turning them off, with up to this much more at random
		this.shooterFreq = 0;
		this.shooterFreqVar = 3000;
		this.nextShot = currentTime() + 1000;

		this.shooters_spr = "sShootingStar";
		this.sh_xspd = -6;
		this.sh_yspd = 1;
		// where they start, as a share of the field
		this.sh_stxmin = 0.3;
		this.sh_stxmax = 1;
		this.sh_stymin = 0;
		this.sh_stymax = 0.5;
		// past this x a shooting star is gone, none by default
		this.sh_endx = undefined;
		// how they fade in, each a base plus up to its random extra
		this.starta = 0;
		this.startavar = 0;
		this.startaspd = 0.04;
		this.startaspdvar = 0.08;
		this.maxa = 0.8;
		this.maxavar = 0.1;
		this.shdepth = 1;
		this.shdepthvar = 0;
		// once at full strength they fade out at the least plus up to the range per update
		this.fadeOutMin = 0.01;
		this.fadeOutRange = 0.1;

		// stretches shooting stars sideways by this times their depth, none when off
		this.warpspeed = 0;
	}

	// Takes the field's size from its stretched picture and scatters the stars.
	init() {
		super.init();
		this.starfw = this.sprite_width;
		this.starfh = this.sprite_height;

		this.sfsize = this.st_per_sqp * this.starfw * this.starfh;

		this.nextShot = currentTime() + rng.irandom(this.shooterFreqVar);

		for (let i = 0; i < this.sfsize; i++) {
			this.starfield.push({
				sprite: this.star_sprite,
				x: rng.irandom(Math.floor(this.starfw)),
				y: rng.irandom(Math.floor(this.starfh)),
				color: this.st_color,
				arot: rng.random(2 * Math.PI),
				tw_speed: rng.randomRange(this.twinkle_spd_min, this.twinkle_spd_max),
				depth: this.depthMin + rng.random(this.depthRange)
			});
		}
	}

	draw() {
		const ox = this.x - this.exoffx;
		const oy = this.y - this.exoffy;

		if (this.coveralpha > 0) {
			Draw.color = this.covercolor;
			Draw.alpha = this.coveralpha;
			Draw.rectangle(this.x, this.y, this.x + this.starfw, this.y + this.starfh, 0);
			Draw.alpha = this.alpha;
		}

		for (const star of this.starfield) {
			star.arot = (star.arot + star.tw_speed) % (2 * Math.PI);
			star.x = (star.x + this.velox * star.depth + this.starfw) % this.starfw;
			star.y = (star.y + this.veloy * star.depth + this.starfh) % this.starfh;

			// brighter and dimmer as it turns, and stretched along the drift
			const br = this.brightnessBase + this.brightnessSwing * Math.abs(Math.sin(star.arot));
			Draw.spriteExt(star.sprite, 0, ox + star.x, oy + star.y,
				1 + this.velox * star.depth, 1 + this.veloy * star.depth,
				0, star.color, br * this.alpha);
		}

		if (this.shooterFreq > 0 && currentTime() > this.nextShot) {
			const newshoo = {
				sprite: this.shooters_spr,
				x: this.starfw * rng.randomRange(this.sh_stxmin, this.sh_stxmax),
				y: this.starfh * rng.randomRange(this.sh_stymin, this.sh_stymax),
				xspd: this.sh_xspd,
				yspd: this.sh_yspd,
				a: this.starta + rng.random(this.startavar),
				aspd: this.startaspd + rng.random(this.startaspdvar),
				maxa: this.maxa + rng.random(this.maxavar),
				depth: this.shdepth + rng.random(this.shdepthvar),
				warpw: 1
			};
			if (this.warpspeed) {
				newshoo.warpw = this.warpspeed * newshoo.depth;
			}
			this.shooters.push(newshoo);

			this.nextShot = currentTime() + this.shooterFreq + rng.irandom(this.shooterFreqVar);
		}

		for (let i = 0; i < this.shooters.length; i++) {
			const shoot = this.shooters[i];

			Draw.spriteExt(shoot.sprite, 0, ox + shoot.x, oy + shoot.y, shoot.warpw, 1, 0, "#ffffff", shoot.a * this.alpha);

			shoot.a += shoot.aspd;

			if (shoot.aspd > 0 && shoot.a >= shoot.maxa) {
				// at full strength it starts fading out, and does not move this update
				shoot.aspd = -(this.fadeOutMin + rng.random(this.fadeOutRange));
			} else if (shoot.a <= 0 || (this.sh_endx !== undefined && shoot.x > this.sh_endx)) {
				this.shooters.splice(i, 1);
				i--;
			} else {
				shoot.x += shoot.xspd * shoot.depth;
				shoot.y += shoot.yspd * shoot.depth;
			}
		}

		Draw.alpha = 1;
	}
}
