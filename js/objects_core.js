// Basic building blocks any game can use: floors, walls, one way floors, ladders, ropes, crates,
// doors, triggers, signs, masks, one time effects, electric sparks, sparkle fields, particle
// emitters, bubbles, foreground water and value faders.

// Particle emitters. Each keeps at most this many particles going and drops its oldest to make room,
// standing in for the original's limit per particle sprite, which never worked. A particle that
// never stops and has no lifetime of its own still goes after this many updates. Particles with no
// sprite given are this one.
const PARTICLE_CAP = 1000;
const PARTICLE_FAILSAFE_UPDATES = 300;
const PARTICLE_DEFAULT_SPRITE = "sSolidWh";

// A swimmer's bubble: the most its count can start at, so bubbles let out together drift apart,
// the count where it starts to fade and where it is gone, how far it rises each update, and its
// sideways wobble: how wide, how many counts between restarts, and counts per half swing.
// The count goes up by two each update, as in the original.
const BUBBLE_START_MAX = 160;
const BUBBLE_FADE_AT = 600;
const BUBBLE_GONE_AT = 700;
const BUBBLE_RISE = 0.25;
const BUBBLE_WOBBLE = 0.07;
const BUBBLE_WOBBLE_RESTART = 160;
const BUBBLE_WOBBLE_HALF = 60;
// it pops once there is no water this far above it
const BUBBLE_WATER_ABOVE = 2;

// An electric spark: the frame it rests on between sparks, the wait before its first spark, which
// starts somewhere along it so sparks placed together go off apart, the wait between later sparks,
// the least and the most extra on top, all in updates, and the zap it makes.
const SPARK_REST_FRAME = 6;
const SPARK_FIRST_WAIT = 60;
const SPARK_WAIT_MIN = 5;
const SPARK_WAIT_EXTRA = 300;
const SPARK_SOUND = "sndZapLong";

// A sparkle field: the sparkles it picks from, the plain one twice as often, how many it keeps going
// at most for each square pixel of its box, and the wait in milliseconds before the next one, both
// the least wait and the most extra on top. The wait is for a box of one square pixel and shrinks
// as the box grows, so a bigger field sparkles faster.
const SPECKLER_SPRITES = ["s_teleport_sparkle", "s_teleport_sparkle", "s_teleport_sparkle_2"];
const SPECKLER_MAX_PER_PIXEL = 30 / 200;
const SPECKLER_WAIT_MS = 40 * 200;
const SPECKLER_WAIT_EXTRA_MS = 40 * 200;

// Stretchable ground: an edge strip along the top and a fill stretched over the rest, each eight pixels square.
class oFloor extends oGround {
	constructor() {
		super();
		this.hangable = true;
		this.landed = true;
		this.top_spr = "sFloorTop";
		this.mid_spr = "sFloorMid";
	}
	draw() {
		Draw.spriteExt(this.top_spr, this.ifr, this.x, this.y, this.sprite_width / 8, 1,
			this.ang, this.col, this.alpha);
		Draw.spriteExt(this.mid_spr, this.ifr, this.x, this.y + 8, this.sprite_width / 8, (this.sprite_height - 8) / 8,
			this.ang, this.col, this.alpha);
	}
}

class oSolidFloor extends oGround {}

// A hidden marker, a named spot for scripts and doors to find.
class oEmptyObject extends oBaseObject {
	constructor() {
		super();
		this.visible = false;
	}
}

// Spiky wall that hurts on touch.
class oWall extends oGround {
	constructor() {
		super();
		this.hurts = 2;
	}
	acton(action, who) {
		if (action === "touch") {
			game.guy.takeHit(this.x, this.y, this.hurts);
		}
	}
}

// Breaks when hit fast, slowing whoever broke it a little. The shards burst from the glass's spot
// along the hitter's way, carrying some of its speed, and fall slowly in the glass's layer.
class oGlass extends oGround {
	constructor() {
		super();
		this.hangable = false;
	}
	acton(action, who) {
		if (action === "hit") {
			const sd = pointDirection(0, 0, who.xspd, who.yspd);
			game.createObject(oFxParticlerOneShot, {
				x: who.x + who.xspd, y: who.y + who.yspd,
				amount: 10,
				time: 3,
				origObj: { x: this.x, y: this.y },
				dirminmax: [sd - 20, sd + 20],
				dirspdminmax: [0.2, 0.4],
				dir2minmax: [0, 360],
				dir2spdminmax: [0.3, 0.5],
				xminmax: [Math.min(who.xspd / 2, who.xspd), Math.max(who.xspd / 2, who.xspd)],
				yminmax: [Math.min(who.yspd / 2, who.yspd), Math.max(who.yspd / 2, who.yspd)],
				airspd_slow: 0.01,
				yspd_adj: 0.01,
				colors: ["#6dd0f7", "#ffffff", "#cccccc"],
				alphaminmax: [0.4, 0.9],
				deadonland: 1,
				deadontime: [40, 60]
			}, this.mylayer);
			this.destroy();
			who.xspd = sign(who.xspd) * (Math.abs(who.xspd) - 0.2);
			who.calcOnFloorAtWall();
		}
	}
}

class oGlassv extends oGlass {}

// One way floor, pass from below and the sides, drop down through it.
class oFloorThru extends oGround {
	constructor() {
		super();
		this.hangable = false;
		this.thruable = true;
		this.thruUp = true;
		this.thruLeft = true;
		this.thruRight = true;
		this.dropDown = true;
	}
}

class oPlatform extends oGround {
	constructor() {
		super();
		this.xspd = 0;
		this.yspd = 0;
		this.rspd = 0;
		this.hangable = false;
		this.thruable = true;
		this.thruUp = true;
		this.dropDown = true;
	}
}

class oPlank extends oGround {}
class oBox extends oGround {}

class oBlankGr extends oGround {
	constructor() {
		super();
		this.visible = false;
	}
}

class oGrWall extends oGround {
	constructor() {
		super();
		this.hangable = false;
		this.landed = true;
	}
}
class oGrWall2 extends oGrWall {}

// Grass ground: can't be hung from.
class oGrGrass extends oGround {
	constructor() {
		super();
		this.hangable = false;
		this.landed = true;
	}
}
oGrGrass.defaultSprite = "sGrGrass";

class oOneWayDoor extends oGround {
	constructor() {
		super();
		this.xspd = 0;
		this.yspd = 0;
		this.rspd = 0;
		this.hangable = false;
		this.thruable = true;
		this.thruRight = true;
	}
}

// A one time animation that waits out its start delay, plays once while drifting and fading, then is gone.
class oFxOneShot extends oBaseObject {
	constructor() {
		super();
		this.delaystart = 0;
		// overrides the asset's pace
		this.ispeed = 1;
		this.xspd = 0;
		this.yspd = 0;
		// how much it fades per update
		this.aspd = 0;
		this.visible = false;
		this.spd = 0;
		this.onAnimEnd = (self) => self.destroy();
	}

	update() {
		if (this.delaystart > 0) {
			this.delaystart--;
		} else {
			this.visible = true;
			this.spd = this.ispeed;

			this.x += this.xspd;
			this.y += this.yspd;
			this.alpha -= this.aspd;
		}
	}
}

// An electric spark that rests on its still frame and every so often plays its animation once with
// a zap, then rests again for a random while. The one time kind is gone after its one spark.
// A room's placement sets its frame and speed over these, as the original's loading did, so a
// placed one sparks straight away and starts its waits from there.
class oAniSpark extends oBgObject {
	constructor() {
		super();
		this.spd = 0;
		this.ifr = SPARK_REST_FRAME;
		this.nextSpark = SPARK_FIRST_WAIT;
		this.step = rng.irandom(SPARK_FIRST_WAIT);
		this.once = false;
		this.onAnimEnd = (self) => {
			self.spd = 0;
			self.ifr = SPARK_REST_FRAME;
			if (self.once) {
				self.destroy();
				return;
			}
			self.step = 0;
			self.nextSpark = SPARK_WAIT_MIN + rng.irandom(SPARK_WAIT_EXTRA);
		};
	}

	update() {
		if (++this.step === this.nextSpark) {
			this.spd = 1;
			this.ifr = 0;
			// the original cut the zap short after a few updates and on being destroyed, which waits for sound
			Hooks.sound(SPARK_SOUND);
		}
	}
}
oAniSpark.defaultSprite = "sAniSpark";

class oAniSparkOnce extends oAniSpark {
	constructor() {
		super();
		this.once = true;
		this.nextSpark = 1;
		this.step = 0;
	}
}

// A field of sparkles over its box, like the teleport glitter. While shown it keeps adding sparkles
// at random spots, more likely near the middle, each playing its animation once just in front of it
// in its layer and then gone. Its own picture is only a marker and never drawn. Hidden, it adds
// none, and the ones already going play out.
class oSpeckler extends oBaseObject {
	constructor() {
		super();
		// updates until the next sparkle, and the sparkles still going
		this.nextspeck = 0;
		this.specks = [];
		this.maxnum = 0;
		this.wait = 0;
		this.waitextra = 0;
	}

	// The limit and the waits follow the size of the box it was given.
	init() {
		super.init();
		const size = this.sprite_width * this.sprite_height;
		const toUpdates = GAME_FPS / 1000;
		this.maxnum = SPECKLER_MAX_PER_PIXEL * size;
		this.wait = size > 0 ? SPECKLER_WAIT_MS / size * toUpdates : 0;
		this.waitextra = size > 0 ? SPECKLER_WAIT_EXTRA_MS / size * toUpdates : 0;
	}

	update() {
		if (!truthy(this.visible) || !this.mylayer) return;
		this.specks = this.specks.filter((sp) => !sp.destroyed);
		if (this.nextspeck > 0) this.nextspeck--;
		if (this.nextspeck > 0 || this.specks.length >= this.maxnum) return;

		// a spot in the box from its top left, each way the sum of two even rolls
		const w = this.sprite_width - 1;
		const h = this.sprite_height;
		const sx = rng.random(w / 2) + rng.random(w / 2);
		const sy = rng.random(h / 2) + rng.random(h / 2);
		const lyr = this.mylayer;
		this.specks.push(game.createObject(oFxOneShot, {
			x: this.x - this.exoffx + sx, y: this.y - this.exoffy + sy,
			spi: rng.choose(...SPECKLER_SPRITES), alpha: this.alpha
		}, lyr, lyr.lsprites.indexOf(this) + 1));
		// what the last wait ran over comes off the next one
		this.nextspeck += this.wait + rng.random(this.waitextra);
	}

	draw() {}
}

// A particle emitter that stays, like a chimney's smoke or a campfire's sparks: an ordinary room
// object that every so many updates lets out a handful of particles. The particles are not objects,
// just records in its own list, moved in its update and drawn in its place in the layer.
// Each one starts at the emitter with the emitter's speed, plus a push in a random direction and
// a second one, a random nudge each way, and a random size, opacity and colour from the list.
// Then each update it slows in the air, takes the wind and gravity, fades and grows or shrinks.
// Only when told to stop on objects does it look for solids: there it stops and stays, or is gone
// when told to die on landing, and a stopped one falls again once what it lay on moves away.
// It goes when its lifetime runs out, or when it has neither stopped nor run out for too long.
// Following an object, it lets out each batch from where that object is, and its particles pass
// through it. Its own picture is only a marker and never drawn.
class oFxParticler extends oBaseObject {
	constructor() {
		super();
		this.fxsprite = PARTICLE_DEFAULT_SPRITE;
		// updates between batches, a random extra on top, the countdown, and how many in a batch
		this.frate = 1;
		this.frate_randvar = 0;
		this.cfr = 0;
		this.amount = 0;
		// the two pushes, each a direction range in degrees and a speed range
		this.dirminmax = [0, 360];
		this.dirspdminmax = [0, 0];
		this.dir2minmax = [0, 360];
		this.dir2spdminmax = [0, 0];
		// the random nudge each way, and the start size and opacity ranges
		this.xminmax = [0, 0];
		this.yminmax = [0, 0];
		this.scminmax = [0.5, 0.5];
		this.alphaminmax = [1, 1];
		// size and opacity change each update
		this.scspd = 0;
		this.alphaspd = 0;
		// air drag on sideways speed, then the wind and gravity added each update
		this.airspd_slow = 0.008;
		this.xspd_adj = 0;
		this.yspd_adj = 0.02;
		this.colors = ["#ffffff"];
		// whether particles look for solids, and whether landing on one ends them
		this.stoponobjs = 1;
		this.deadonland = 0;
		// the lifetime range in updates, or none
		this.deadontime = -1;
		// the object followed, anything with a spot, or none
		this.origObj = null;
		// a one shot stops once it has let out all its batches
		this.emitting = true;
		this.particles = [];
	}

	// Moves every particle on, then lets out a batch when one is due.
	update() {
		const rec = Sprites.get(this.fxsprite);
		const frames = rec ? rec.frameCount : 1;
		const frameStep = rec ? rec.imageSpeed : 0;
		const ps = this.particles;
		let kept = 0;
		for (let i = 0; i < ps.length; i++) {
			const p = ps[i];
			let gone = false;
			if (p.go) {
				p.xspd = sign(p.xspd) * Math.max(Math.abs(p.xspd) - this.airspd_slow, 0);
				p.xspd += this.xspd_adj;
				p.yspd += this.yspd_adj;
				p.x += p.xspd;
				p.y += p.yspd;

				// only the first solid found counts, so lying in the followed object stops nothing
				if (truthy(this.stoponobjs)) {
					const hit = Collision.instancePlace.call(p, p.x, p.y, oObject);
					if (hit !== null && hit !== this.origObj) {
						if (truthy(this.deadonland)) {
							gone = true;
						} else {
							p.go = false;
							p.xspd = 0;
							p.yspd = 0;
							p.stoppedobj = hit;
						}
					}
				}

				p.alpha = clamp(p.alpha + this.alphaspd, 0, 1);
				p.x_sc = Math.max(p.x_sc + this.scspd, 0);
				p.y_sc = p.x_sc;
				// a lifetime counts down to nothing, without one the count runs on below zero to the failsafe
				p.deadontime--;
				if (p.deadontime === 0 || p.deadontime < -PARTICLE_FAILSAFE_UPDATES) gone = true;
			} else if (Collision.instancePlace.call(p, p.x, p.y, p.stoppedobj) === null) {
				p.go = true;
			}
			if (gone) continue;
			p.ifr = frames > 0 ? (p.ifr + frameStep) % frames : 0;
			ps[kept++] = p;
		}
		ps.length = kept;

		if (this.emitting && --this.cfr <= 0) this.emit();
	}

	// One batch, from the followed object's spot when there is one.
	emit() {
		const range = (mm) => mm[0] + Math.random() * (mm[1] - mm[0]);
		this.cfr = this.frate + Math.floor(Math.random() * (this.frate_randvar + 1));
		if (this.origObj !== null && this.origObj !== undefined) {
			this.x = this.origObj.x;
			this.y = this.origObj.y;
		}
		const lifetime = Array.isArray(this.deadontime) ? this.deadontime : null;
		for (let i = 0; i < this.amount; i++) {
			const d = range(this.dirminmax);
			const s = range(this.dirspdminmax);
			const d2 = range(this.dir2minmax);
			const s2 = range(this.dir2spdminmax);
			const sc = range(this.scminmax);
			this.particles.push({
				spi: this.fxsprite, ifr: 0, x: this.x, y: this.y, ang: 0,
				xspd: this.xspd + lengthdirX(s, d) + lengthdirX(s2, d2) + range(this.xminmax),
				yspd: this.yspd + lengthdirY(s, d) + lengthdirY(s2, d2) + range(this.yminmax),
				x_sc: sc, y_sc: sc,
				alpha: range(this.alphaminmax),
				col: this.colors[Math.floor(Math.random() * this.colors.length)],
				deadontime: lifetime !== null
					? lifetime[0] + Math.floor(Math.random() * (lifetime[1] - lifetime[0] + 1)) : -1,
				go: true,
				stoppedobj: null
			});
			if (this.particles.length > PARTICLE_CAP) this.particles.shift();
		}
	}

	draw() {
		for (const p of this.particles) {
			Draw.spriteExt(p.spi, p.ifr, p.x, p.y, p.x_sc, p.y_sc, 0, p.col, p.alpha);
		}
	}
}

// A burst made by something happening, like breaking glass, a death or a splash. It lets out its
// number of batches, then is gone once its last particle is, so it outlives whatever made it.
// Every room switch clears them, an effect being a moment that should not wait for the player.
class oFxParticlerOneShot extends oFxParticler {
	constructor() {
		super();
		// batches left to let out
		this.time = 1;
	}

	init() {
		super.init();
		this.emitting = this.time > 0;
	}

	update() {
		super.update();
		if (!this.emitting && this.particles.length === 0) this.destroy();
	}

	emit() {
		super.emit();
		if (--this.time <= 0) this.emitting = false;
	}
}

// A fountain's falling drops, the original's settings for a placed emitter.
class oFountain extends oFxParticler {
	constructor() {
		super();
		this.fxsprite = "s_fountain_drop";
		this.frate = 10;
		this.frate_randvar = 2;
		this.amount = 1;
		this.dirminmax = [89, 91];
		this.dirspdminmax = [0.6, 0.7];
		this.scminmax = [0.1, 0.3];
		this.scspd = 0.06;
		this.colors = ["#99ddff", "#eeeeff", "#00bbff"];
		this.alphaminmax = [0.6, 0.8];
		this.alphaspd = -0.0025;
		this.stoponobjs = 0;
		this.deadonland = 0;
		this.deadontime = [90, 95];
		this.yspd_adj = 0.015;
	}
}

// A bubble rising through water with a slight wobble, keeping the fractions of its moves so it
// steps whole pixels. It fades near the end of its count, and pops when the count runs out or the
// water above it does.
class oBubble extends oBaseObject {
	constructor() {
		super();
		this.step = rng.irandom(BUBBLE_START_MAX);
		this.rx = 0;
		this.ry = 0;
	}

	update() {
		this.step++;
		if (this.step > BUBBLE_FADE_AT) this.alpha = (BUBBLE_GONE_AT - this.step) / (BUBBLE_GONE_AT - BUBBLE_FADE_AT);
		if (this.step > BUBBLE_GONE_AT || this.instancePlace(this.x, this.y - BUBBLE_WATER_ABOVE, oWater) === null) {
			this.destroy();
			return;
		}

		// the wobble counts on once more, so the count rises two each update
		this.step++;
		const whx = this.x + this.rx + Math.sin((this.step % BUBBLE_WOBBLE_RESTART) / BUBBLE_WOBBLE_HALF * Math.PI) * BUBBLE_WOBBLE;
		this.x = round(whx);
		this.rx = whx - this.x;
		const why = this.y + this.ry - BUBBLE_RISE;
		this.y = round(why);
		this.ry = why - this.y;
	}
}
oBubble.defaultSprite = "sBubble";

// Eases one value of an object to a new one in equal steps over a number of updates, then is gone.
class oFader extends oBaseObject {
	constructor() {
		super();
		this.visible = false;
		this.obj = null;
		this.obj_var = "";
		this.cur_val = 0;
		this.final_val = 0;
		this.val_inc = 0;
		this.time = 0;
	}

	init() {
		super.init();
		this.cur_val = this.obj[this.obj_var];
		this.val_inc = (this.final_val - this.cur_val) / this.time;
	}

	update() {
		this.cur_val += this.val_inc;
		this.obj[this.obj_var] = this.cur_val;
		if (eq(this.cur_val, this.final_val)) this.destroy();
	}
}

// Loose crate: falls, slides and can be picked up.
class oCrate extends oIaObject {
	constructor() {
		super();
		this.initPickupable();
		this.holdoffx = 1;
		this.initMoveable();
	}
	update() {
		this.calcOnFloorAtWall();
		this.applyFrictionGravity();
		if (!this.carriedBy) {
			this.moveThroughObjectsSimple(this.xspd, this.yspd);
		}
	}
}
mixin(oCrate, Pickupable);

// Crate that stays put but can be picked up.
class oCrateSt extends oIaObject {
	constructor() {
		super();
		this.initPickupable();
		this.holdoffx = 1;
	}
}
mixin(oCrateSt, Pickupable);

// Big crate that gets pushed along the floor.
class oCrateBg extends oIaObject {
	constructor() {
		super();
		this.initMoveable();
		this.pushable = true;
		this.pushAdj = 0.8;
		this.spd = 0;
	}
	update() {
		this.calcOnFloorAtWall();
		if (this.atWall) {
			this.xspd = -sign(this.xspd) * Math.max(Math.abs(this.xspd) - 0.1, 0);
		}
		if (this.onFloor) {
			this.yspd = 0;
		} else {
			this.yspd += 0.05;
		}
		this.moveThroughObjects(this.xspd, this.yspd);
	}
}

// Metal crate, pulled by the magnet and knocked by hits.
class oCrateMetal extends oIaObject {
	constructor() {
		super();
		this.initMoveable();
		this.maxspd = 1;
	}
	acton(action, who) {
		if (action === "magnate") {
			this.xspd = this.xspd + (this.fric + 0.1) * sign(who.x - this.x);
			this.xspd = sign(this.xspd) * Math.min(Math.abs(this.xspd), this.maxspd);
			this.yspd = this.yspd - this.grav + 0.1 * sign(who.y - this.y);
			this.yspd = sign(this.yspd) * Math.min(Math.abs(this.yspd), this.maxspd);
		} else if (action === "hit") {
			this.xspd = this.xspd + (this.fric + 0.4) * sign(this.x - who.x);
			this.xspd = sign(this.xspd) * Math.min(Math.abs(this.xspd), this.maxspd);
			this.yspd = this.yspd + -0.2;
			this.yspd = sign(this.yspd) * Math.min(Math.abs(this.yspd), this.maxspd);
		}
	}
	update() {
		this.calcOnFloorAtWall();
		this.applyFrictionGravity();
		this.moveThroughObjectsSimple(this.xspd, this.yspd);
	}
}

class oLadder extends oClimbableObj {}

// A rope to hang from; the player hanging on it is kept on its middle.
class oRope extends oBgObject {
	constructor() {
		super();
		this.hangable = true;
	}
	update() {
		if (game.guy.hangingObj === this) {
			game.guy.x = this.x;
		}
	}
}
oRope.defaultSprite = "rope";

// A door into other layers or another room, with an invisible wall that comes and goes as it opens.
// It can open by itself when something stands at its sensor, and be locked.
class oLyrDoor extends oIaBgObject {
	constructor() {
		super();
		this.spd = 0;
		this.ifr = 0;
		this.open = false;
		this.locked = false;
		this.connected = -1;
		this.wall_obj = null;
		this.enter_lyrs = "";
		this.enter_clyr = "";
		this.locked_message = "locked";
		this.conRoom = undefined;
		this.conRoomEnter = undefined;
		this.entering = -1;
		// for coming in from other rooms
		this.inTrigger = 0;
		this.triggered = 0;
		this.open_sensor = undefined;
		this.sense_on = null;
		this.manual_override = 0;
	}

	init() {
		super.init();
		this.wall_obj = game.createObject(oBlankGr, { x: this.x, y: this.y });
		this.wall_obj.mask = this.spi;
		this.open_sensor = game.lookupInst(this.open_sensor, this);
		this.set_open(this.open, 0, 1);
	}

	// Opens or closes, playing the animation or jumping to its end. A lock stops it unless overridden.
	set_open(open, animate, lockOverride) {
		if (truthy(this.locked) && !truthy(lockOverride)) return false;
		this.open = open;
		this.wall_obj.mask = truthy(open) ? "sNoMask" : this.spi;
		if (truthy(animate)) {
			this.spd = 1;
		} else {
			this.ifr = truthy(open) ? Math.ceil(Sprites.frameCount(this.spi) / 2) : 0;
		}
		return true;
	}

	acton(action, who) {
		const didit = this.set_open(!truthy(this.open), 1);
		if (!didit && truthy(this.locked)) Hooks.say(who, this.locked_message);
		// working an automatic door by hand keeps it as left until the sensor clears
		if (this.open_sensor !== undefined && this.sense_on !== null) this.manual_override = 1;
	}

	update() {
		const frames = Sprites.frameCount(this.spi);
		if (this.spd > 0) {
			if ((truthy(this.open) && Math.floor(this.ifr) === Math.ceil(frames / 2))
				|| (!truthy(this.open) && Math.floor(this.ifr) === 0)) {
				this.spd = 0;
			} else {
				return;
			}
		}

		// coming in from another room, wait until we are clear before entering again
		if (truthy(this.inTrigger)) {
			this.inTrigger = this.instancePlace(this.x, this.y, oChar) !== null;
		} else if (truthy(this.open)) {
			const entering = this.instancePlace(this.x, this.y, oChar);
			if (entering !== null && this.enter_lyrs !== "") {
				game.saveLayersState();
				game.layerViz("*", 0);
				game.layerViz(this.enter_lyrs, 1);
				game.moveObjToLayer(entering, this.enter_clyr);
			}
			if (entering !== null && this.conRoom !== undefined) {
				game.gotoRoom(this.conRoom, this, this.conRoomEnter, 1, 1);
			}
			this.inTrigger = entering !== null;
		}

		if (this.open_sensor && !truthy(this.locked)) {
			this.sense_on = this.open_sensor.instancePlace(this.open_sensor.x, this.open_sensor.y, oActor);
			if (!truthy(this.manual_override)) {
				if (this.sense_on !== null && !truthy(this.open)) this.set_open(1, 1);
				else if (this.sense_on === null && truthy(this.open)) this.set_open(0, 1);
			}
			this.manual_override = truthy(this.manual_override) && this.sense_on !== null;
		}
	}

	// the wall goes with the door
	destroy() {
		super.destroy();
		if (this.wall_obj) this.wall_obj.destroy();
	}
}

// A door opened by hand that leads to another room when the player presses up in it.
// The original's default room is not in this room list, so it goes nowhere until its room entry gives one.
class oDoor extends oIaBgObject {
	constructor() {
		super();
		this.spd = 0;
		this.conRoom = undefined;
		this.roomEntInst = undefined;
	}

	acton(action, who) {
		this.ifr = (this.ifr + 1) % 2;
	}

	update() {
		if (truthy(this.inview) && Math.floor(this.ifr) === 1 && game.guy.con.iUpP && this.conRoom !== undefined) {
			game.gotoRoom(this.conRoom, this, this.roomEntInst, 1, 1);
		}
	}
}
oDoor.defaultSprite = "sDoor";

// A solid interactive thing that runs a script when acted on, and another when picked up.
// Picking it up runs only the script; it never goes into the inventory.
class oIaObjScript extends oIaObject {
	constructor() {
		super();
		this.actonScript = null;
		this.pickupScript = null;
	}

	acton(action, who, pars) {
		if (Array.isArray(this.actonScript)) Hooks.runScript(this.actonScript, who, undefined, undefined, undefined, this);
	}

	pickup(upper) {
		if (Array.isArray(this.pickupScript)) Hooks.runScript(this.pickupScript, upper, undefined, undefined, undefined, this);
	}
}

// The same for background things, and it can be set to run its acton script only once until reset.
class oIaBgObjScript extends oIaBgObject {
	constructor() {
		super();
		this.actonScript = null;
		this.pickupScript = null;
		this.onlyOnce = 0;
		this.has_ran = 0;
	}

	reset() {
		this.has_ran = 0;
	}

	acton(action, who, pars) {
		if (Array.isArray(this.actonScript) && (!truthy(this.onlyOnce) || this.has_ran === 0)) {
			this.has_ran++;
			Hooks.runScript(this.actonScript, who, undefined, undefined, undefined, this);
		}
	}

	pickup(upper) {
		if (Array.isArray(this.pickupScript)) Hooks.runScript(this.pickupScript, upper, undefined, undefined, undefined, this);
	}
}

// A sign that shows its message when looked at, and hides it on a second look or once out of view.
class oSign extends oIaBgObject {
	constructor() {
		super();
		this.spd = 0;
		this.step = 0;
		this.message = "HI!";
		this.xoffset = 0;
		this.yoffset = -30;
		this.lookScript = 0;
		this.skippable = false;
		this.skipScript = [];
		this.center = 1;
		this.popupMsg = null;
		// how its message shows: long before fading, then a slow fade, on a backing
		this.msgFadeStart = 300;
		this.msgFadeTime = 60;
		this.msgBgColor = "#996633";
		this.msgTextColor = "#ffffff";
		// how quickly the message fades once out of view
		this.outOfViewFade = 20;
	}

	acton(action, who) {
		if (this.popupMsg !== null && !this.popupMsg.destroyed) {
			this.popupMsg.destroy();
			this.popupMsg = null;
			return;
		}

		this.popupMsg = Hooks.popMessage(this, this.message, this.xoffset, this.yoffset,
			{ fadestart: this.msgFadeStart, fadetime: this.msgFadeTime, floatspdx: 0, floatspdy: 0,
				drawbg: true, bgcolor: this.msgBgColor, textcolor: this.msgTextColor, quick_print: true }) || null;
		if (this.popupMsg !== null) this.popupMsg.tx_center = this.center;

		this.step = 0;

		if (truthy(this.lookScript)) {
			Hooks.runScript(this.lookScript, this, this.skippable, this.skipScript, undefined, this);
		}
	}

	// once out of view, the message jumps to its fade
	update() {
		if (!truthy(this.inview) && this.popupMsg !== null && !this.popupMsg.destroyed) {
			this.popupMsg.step = this.popupMsg.fadestart;
			this.popupMsg.fadetime = this.outOfViewFade;
			this.popupMsg = null;
		}
	}
}
oSign.defaultSprite = "sSign";

// Repeats its sprite at unit size over its stretched area.
class oSpriteTiler extends oBaseObject {
	init() {
		super.init();
		const rec = Sprites.get(this.spi);
		this.w = rec ? rec.w : 0;
		this.h = rec ? rec.h : 0;
	}
	draw() {
		// a zero size would never finish
		if (!(this.w > 0) || !(this.h > 0)) return;
		for (let i = 0; i < this.sprite_width; i += this.w) {
			for (let k = 0; k < this.sprite_height; k += this.h) {
				Draw.spriteExt(this.spi, this.ifr, this.x + i, this.y + k, 1, 1, 0, this.col, this.alpha);
			}
		}
	}
}
// The water's surface drawn over whatever swims in it, its animated tile repeated across its area.
// It sits beside the tiler it is built on rather than with the water, since it needs that class first.
class oWaterFg extends oSpriteTiler {}
oWaterFg.defaultSprite = "sWaterFg";

// An extra area for another trigger, passing on who entered and taking its settings.
class oTrigKid extends oTrigger {
	constructor() {
		super();
		this.trigDad = undefined;
	}
	init() {
		super.init();
		if (typeof this.trigDad === "string") this.trigDad = game.allObjects[this.trigDad];
		this.trigOnce = this.trigDad.trigOnce;
		this.check_height = this.trigDad.check_height;
	}
	on_trigger() {
		if (this.trigDad !== undefined) {
			this.trigDad.whotriggered = this.whotriggered;
			this.trigDad.on_trigger();
		}
	}
	off_trigger() {
		if (this.trigDad !== undefined) this.trigDad.off_trigger();
	}
}

// A shape that limits what some layers show to where it covers. It sits in no layer and never runs.
class oLayerMask extends oBaseObject {
	constructor() {
		super();
		this._mask = true;
		this.layer_list = [];
	}
}

// A sign: text in one of the pixel fonts, placed, shadowed and blinking as asked.
class oText extends oBaseObject {
	constructor() {
		super();
		this.step = 0;
		this.font = "ftSmall";
		this.color = "#ffffff";
		this.text = "";
		this.blinkr = 0;
		this.xoffset = "c";
		this.yoffset = 0;
		this.shadow = true;
		this.alphash = 1;
		this.center = 1;
		this.twidth = -1;
		this.linesep = -1;
	}

	// Kept from the original: the width for centring is measured before this sign's font is set,
	// so it uses whichever font was drawn last.
	draw() {
		if (truthy(this.blinkr)) {
			this.step = (this.step + 1) % (this.blinkr * 2);
			if (this.step > this.blinkr) return;
		}
		let xo;
		if (this.xoffset === "c") xo = -Math.floor(Draw.stringWidth(this.text)) / 2;
		else if (this.xoffset < 0) xo = -Math.floor(Draw.stringWidth(this.text));
		else xo = this.xoffset;
		const yo = this.yoffset;

		Draw.setFont(this.font);
		if (truthy(this.shadow)) {
			Draw.color = "#000000";
			Draw.alpha = this.alpha * this.alphash;
			Draw.textTransformed(this.x - this.exoffx + xo + 1, this.y - this.exoffy + yo + 1, this.text,
				this.linesep, this.twidth, 1, 1, this.ang);
		}
		Draw.color = this.color;
		Draw.alpha = this.alpha;
		Draw.textTransformed(this.x - this.exoffx + xo, this.y - this.exoffy + yo, this.text,
			this.linesep, this.twidth, 1, 1, this.ang);
		Draw.alpha = 1;
	}
}

// A pop up message: text typed out above whoever said it, or a list of texts one after another,
// then held, faded and floated away. A fade time of zero waits for a button instead, and a choice
// list then lets the player pick one. A negative fade time leaves it up until someone else ends it.
// Typing is counted in updates, from the original's milliseconds, so it pauses with the game.
class oPuMsg extends oBaseObject {
	constructor() {
		super();
		// updates per millisecond, for the waits below
		const perMs = GAME_FPS / 1000;
		this.font = "ftTiny";
		// who said it, 0 for a room spot
		this.sayer = null;
		// the text showing, or null to take the next from the list
		this.text = null;
		this.text_list = null;
		this.text_li = -1;

		// each choice is its label, then the script it runs when picked
		this.choice_list = null;
		this.cur_ch_i = 0;
		this.choosing = false;
		this.color = "#eeeeee";
		this.choiceColor = "#aaaabb";
		this.choicePickedColor = "#ffff00";
		this.shadowColor = "#000000";

		this.alphac = this.alpha;
		// updates held before fading, and updates the fade takes
		this.fadestart = 30;
		this.fadetime = 30;
		// how quickly it fades once a button has dismissed it
		this.dismissFade = 10;

		this.drawbg = false;
		this.bgcolor = "#332288";
		this.alphabg = 0.8;
		this.bgSprite = "sBgBlox3";
		this.choiceBgSprite = "sBgBlox_btm_out";

		// centred on its spot, or starting just right of it
		this.center = true;
		// each line centred within the box
		this.tx_center = 0;
		this.max_width = 180;
		// lines are this share of the font's height apart
		this.lineShare = 0.9;
		// how wide a choice can be before it wraps, so in practice never
		this.choiceMaxWidth = 1000;

		this.floatspdx = 0;
		this.floatspdy = 0;

		this.step = 0;

		this.texting = true;
		this.curtext = "";
		this.curtextpos = 0;
		// waits in updates before the first letter, after each letter, after a space, a comma,
		// and the end of a sentence
		this.typeStartWait = 100 * perMs;
		this.typeLetterWait = 10 * perMs;
		this.typeSpaceWait = 40 * perMs;
		this.typeCommaWait = 70 * perMs;
		this.typeSentenceWait = 170 * perMs;
		this.textWait = this.typeStartWait;

		// the flashing arrow that says a button moves on, and how long each of its frames shows
		this.button_sp = "s_msg_done";
		this.buttonFrameUpdates = 300 * perMs;

		// whether the player's controls were already off, so they go back as they were
		this.conwasoff = false;
		// called once it is gone, so whoever is waiting on it can carry on
		this.onDone = null;
		// the script that showed it, which runs a picked choice as part of itself
		this.call_script = null;
	}

	init() {
		super.init();
		this.alphac = this.alpha;
	}

	newText(newtext) {
		this.text = newtext;
		this.endTexting();
	}

	// shows the whole text at once
	endTexting() {
		if (this.text === null) return;
		this.curtext = this.text;
		this.curtextpos = this.text.length;
	}

	update() {
		const con = game.uiController;

		// nothing showing and a list, so the next one comes out
		if (this.text === null && this.text_list !== null) {
			this.text_li++;
			this.text = this.text_list[this.text_li];
			this.curtext = "";
			this.curtextpos = 0;
			this.textWait = this.typeStartWait;
		}
		this.textWait--;

		const len = this.text === null ? 0 : this.text.length;
		this.texting = this.curtextpos < len;

		if (this.texting && con.iBtnA) this.endTexting();

		// still typing, so one more letter when its wait is up and nothing else
		if (this.texting) {
			if (this.textWait <= 0) {
				this.curtextpos++;
				this.curtext = this.text.substring(0, this.curtextpos);
				const ch = this.text.charAt(this.curtextpos - 1);
				if (ch === " ") this.textWait = this.typeSpaceWait;
				else if (ch === ",") this.textWait = this.typeCommaWait;
				else if (ch === "!" || ch === "." || ch === "?") this.textWait = this.typeSentenceWait;
				else this.textWait = this.typeLetterWait;
			}
			return;
		}

		// the wait after the last letter
		if (this.textWait > 0) return;

		const moreTexts = this.text_list !== null && this.text_li < this.text_list.length - 1;
		this.choosing = !moreTexts && this.choice_list !== null;

		// the original could step one past the last choice, here it stops on it
		if (this.choosing) {
			if (con.iLeftP || con.iUpP) this.cur_ch_i = Math.max(this.cur_ch_i - 1, 0);
			if (con.iRightP || con.iDownP) this.cur_ch_i = Math.min(this.cur_ch_i + 1, this.choice_list.length - 1);
		}

		// someone else is in control
		if (this.fadetime < 0) return;

		if (this.fadetime === 0) {
			if (con.iBtnA || con.iBtnX || (!this.choosing && con.iDownP)) {
				if (moreTexts) {
					this.text = null;
				} else {
					// controls back first, in case the choice's script turns them off again
					game.controller.conOff = this.conwasoff;

					if (this.choosing) {
						const choice = this.choice_list[this.cur_ch_i];
						if (choice.length > 1 && Array.isArray(choice[1])) {
							// shown by a script, so the choice runs as part of that script, the usual case
							if (this.call_script !== null) {
								this.call_script.enter_subscript(choice[1]);
							} else {
								// run on its own, and whoever waits on this message now waits on that
								Hooks.runScript(choice[1], this.sayer !== null ? this.sayer : this, undefined, undefined, this.onDone, this);
								this.onDone = null;
							}
						}
					}

					this.fadetime = this.dismissFade;
					this.fadestart = this.step;
				}
			}
			return;
		}

		this.step++;
		if (this.step > this.fadestart) {
			this.alphac = this.alpha * ((this.fadestart + this.fadetime) - this.step) / this.fadetime;
		}

		this.x += this.floatspdx;
		this.y += this.floatspdy;

		if (this.step > this.fadestart + this.fadetime) {
			if (this.onDone !== null) this.onDone();
			this.destroy();
		}
	}

	draw() {
		if (this.text === null) return;

		Draw.setFont(this.font);
		const fht = Draw.stringHeight("M") * this.lineShare;
		Draw.halign = truthy(this.tx_center) ? "center" : "left";
		const twd = Draw.stringWidthExt(this.text, fht, this.max_width);
		let tht = Draw.stringHeightExt(this.text, fht, this.max_width);

		let tx = truthy(this.center) ? this.x - Math.floor(twd / 2) : this.x + 1;
		const ty = this.y - tht - (this.choosing ? Draw.stringHeightExt(this.choice_list[0][0], fht, this.max_width) - 2 : 0);
		const txwo = tx + (truthy(this.tx_center) ? Math.floor(twd / 2) : 0);
		const buttonFrame = Math.floor(game.frames / this.buttonFrameUpdates) % 3;

		if (truthy(this.drawbg)) {
			Draw.alpha = this.alphac * this.alphabg;
			Draw.color = this.bgcolor;
			Draw.bgSquare(tx - 3, ty + 2, twd + 5, tht - 2, this.bgSprite);
		}

		Draw.alpha = this.alphac;
		Draw.color = this.shadowColor;
		Draw.textTransformed(txwo + 1, ty + 1, this.curtext, fht, twd, 1, 1, 0);
		Draw.color = this.color;
		Draw.textTransformed(txwo, ty, this.curtext, fht, twd, 1, 1, 0);

		if (this.fadetime === 0 && !this.texting && !this.choosing) {
			Draw.sprite(this.button_sp, buttonFrame, tx + twd, ty + tht);
		}

		// the choices in a row under the text, the picked one bright with the arrow under it
		if (this.choosing) {
			tx += 3;
			tht -= 2;
			let totchwd = 0;
			for (let chi = 0; chi < this.choice_list.length; chi++) {
				const choice = this.choice_list[chi][0];
				const chwd = Draw.stringWidthExt(choice, fht, this.choiceMaxWidth);
				const chht = Draw.stringHeightExt(choice, fht, this.choiceMaxWidth);

				Draw.alpha = this.alphac * this.alphabg;
				Draw.color = this.bgcolor;
				Draw.bgSquare(tx + totchwd - 3, ty + tht + 2, chwd + 5, chht - 2, this.choiceBgSprite);

				Draw.alpha = this.alphac;
				Draw.color = this.shadowColor;
				Draw.textTransformed(tx + totchwd + 1, ty + tht + 1, choice, fht, this.choiceMaxWidth, 1, 1, 0);
				Draw.color = this.cur_ch_i === chi ? this.choicePickedColor : this.choiceColor;
				Draw.textTransformed(tx + totchwd, ty + tht, choice, fht, this.choiceMaxWidth, 1, 1, 0);
				totchwd += chwd + 7;

				if (this.cur_ch_i === chi) Draw.sprite(this.button_sp, buttonFrame, tx + totchwd - 7, ty + tht + chht);
			}
		}

		Draw.alpha = 1;
		Draw.color = "#ffffff";
		Draw.halign = "left";
	}
}

// Only marks the player start in the editor, the room swaps it for the real player.
class oGuyPlacer extends oBaseObject {}
