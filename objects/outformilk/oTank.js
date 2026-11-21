// The tank: a slow body that drives along the ground and a turret riding on top that the player
// can climb on and stand on. Now and then the turret shoots a shell that passes through ground,
// and the shot kicks the body back.

// driving: acceleration each update, the cruising speed it settles at, and the most it can go
const TANK_ACCEL = 0.05;
const TANK_CRUISE_SPEED = 0.2;
const TANK_MAX_SPEED = 2;
// updates between shots: a fixed wait plus a random extra
const TANK_FIRE_WAIT = 180;
const TANK_FIRE_EXTRA = 90;
// the turret shows its warning frames when this few updates are left before a shot
const TANK_WARN_FRAME_1 = 60;
const TANK_WARN_FRAME_2 = 30;
// the shot kicks the body back by this much speed
const TANK_RECOIL = 1;
// the turret sits this far up from the body, and bobs one pixel every this many updates
const TANK_TOP_RISE = 10;
const TANK_TOP_BOB_UPDATES = 15;
const TANK_TOP_SPRITE = "s_tank_top";
// the shell: where it leaves the turret, how fast, and how it looks
const TANK_SHELL_AHEAD = 26;
const TANK_SHELL_RISE = 2;
const TANK_SHELL_SPEED = 3;
const TANK_SHELL_SPRITE = "s_bullet_tank";
const TANK_SHELL_HIT_FX = "sExplode1";
const TANK_SHELL_SMOKE = 1;

class oTank extends oObject {
	constructor() {
		super();
		this.initMoveable();
		this.maxspd = TANK_MAX_SPEED;
		this.xspd = TANK_CRUISE_SPEED;
		this.yspd = 0;
		this.nextfire = TANK_FIRE_WAIT + rng.irandom(TANK_FIRE_EXTRA);
		// counts updates for the turret's bob
		this.ticks = 0;
		this.top = null;
	}

	// The turret is made once everything exists, just above the body in the same layer so it draws
	// over it. It is ground, so it can be climbed and stood on.
	init() {
		super.init();
		const lyr = this.mylayer;
		const idx = lyr ? lyr.lsprites.indexOf(this) + 1 : undefined;
		this.top = game.createObject(oTankTop, {
			x: this.x, y: this.y - TANK_TOP_RISE, spi: TANK_TOP_SPRITE, x_sc: this.x_sc, tank: this
		}, lyr, idx);
	}

	update() {
		const facing = sign(this.x_sc) || 1;

		// speeds up toward cruising the way it faces, so a shot's kick back wears off
		this.xspd = facing > 0 ? Math.min(this.xspd + TANK_ACCEL, TANK_CRUISE_SPEED)
			: Math.max(this.xspd - TANK_ACCEL, -TANK_CRUISE_SPEED);
		this.xspd = sign(this.xspd) * Math.min(Math.abs(this.xspd), this.maxspd);
		this.moveThroughObjectsSimple(this.xspd, this.yspd);

		this.ticks++;

		if (--this.nextfire <= 0) {
			const top = this.top;
			game.createObject(oBullet, {
				x: top.x + TANK_SHELL_AHEAD * facing,
				y: top.y - TANK_SHELL_RISE,
				xspd: TANK_SHELL_SPEED * facing,
				x_sc: facing,
				thruground: 1,
				hitFx: TANK_SHELL_HIT_FX,
				smoke: TANK_SHELL_SMOKE,
				spi: TANK_SHELL_SPRITE
			}, this.mylayer);
			this.xspd -= TANK_RECOIL * facing;
			this.nextfire = TANK_FIRE_WAIT + rng.irandom(TANK_FIRE_EXTRA);
		}
	}

	destroy() {
		super.destroy();
		if (this.top) this.top.destroy();
	}
}

// The turret follows its tank in its own update rather than being placed by the tank. The world
// notes where each mover starts its update, so moving itself here is what lets a rider standing on
// it be carried along. It updates after its tank, being made after it, so it never lags a step.
class oTankTop extends oGround {
	constructor() {
		super();
		this.initMoveable();
		this.spd = 0;
		this.tank = null;
	}

	update() {
		const tank = this.tank;
		if (!tank || tank.destroyed) return;
		this.x_sc = tank.x_sc;
		this.x = tank.x;
		this.y = tank.y - TANK_TOP_RISE + (Math.floor(tank.ticks / TANK_TOP_BOB_UPDATES) % 2 === 0 ? 1 : 0);
		// the warning frames as the next shot nears
		this.ifr = tank.nextfire < TANK_WARN_FRAME_2 ? 2 : (tank.nextfire < TANK_WARN_FRAME_1 ? 1 : 0);
	}
}
