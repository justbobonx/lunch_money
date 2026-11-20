// Basic building blocks any game can use: floors, walls, one way floors, ladders, ropes, crates,
// doors, triggers, signs, masks and one time effects.

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
			this.ang, this.col, this.alph);
		Draw.spriteExt(this.mid_spr, this.ifr, this.x, this.y + 8, this.sprite_width / 8, (this.sprite_height - 8) / 8,
			this.ang, this.col, this.alph);
	}
}

class oSolidFloor extends oGround {}

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

// Breaks when hit fast, slowing whoever broke it a little.
class oGlass extends oGround {
	constructor() {
		super();
		this.hangable = false;
	}
	acton(action, who) {
		if (action === "hit") {
			Hooks.particles("glass break", this, who.x + who.xspd, who.y + who.yspd);
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
		this.pvis = false;
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
		this.pvis = false;
		this.spd = 0;
		this.onAnimEnd = (self) => self.destroy();
	}

	update() {
		if (this.delaystart > 0) {
			this.delaystart--;
		} else {
			this.pvis = true;
			this.spd = this.ispeed;

			this.x += this.xspd;
			this.y += this.yspd;
			this.alph -= this.aspd;
		}
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
		this.no_trig_on_reenter = 1;
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
				Draw.spriteExt(this.spi, this.ifr, this.x + i, this.y + k, 1, 1, 0, this.col, this.alph);
			}
		}
	}
}
class oWaterFg extends oSpriteTiler {}
oWaterFg.ported = false;

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
		this.alphac = 1;
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
			Draw.alpha = this.alphac * this.alphash;
			Draw.textTransformed(this.x - this.exoffx + xo + 1, this.y - this.exoffy + yo + 1, this.text,
				this.linesep, this.twidth, 1, 1, this.ang);
		}
		Draw.color = this.color;
		Draw.alpha = this.alphac;
		Draw.textTransformed(this.x - this.exoffx + xo, this.y - this.exoffy + yo, this.text,
			this.linesep, this.twidth, 1, 1, this.ang);
		Draw.alpha = 1;
	}
}

// Only marks the player start in the editor, the room swaps it for the real player.
class oGuyPlacer extends oBaseObject {}
