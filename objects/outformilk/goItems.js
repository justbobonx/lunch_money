// Things to pick up, carry and use.

// Placeholder items: they keep the pickup shape, their use comes later.
class oPickupObj extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
	}
}
mixin(oPickupObj, Pickupable);
oPickupObj.ported = false;

class oHoldObject extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
	}
}
mixin(oHoldObject, Pickupable);
oHoldObject.ported = false;

// Placeholder items, each keeps its real parent and the pickup shape, their use comes later.
class oKey extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
	}
}
mixin(oKey, Pickupable);
oKey.ported = false;

class oGun extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
	}
}
mixin(oGun, Pickupable);
oGun.ported = false;

class oFlamer extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
	}
}
mixin(oFlamer, Pickupable);
oFlamer.ported = false;

class oArBow extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
	}
}
mixin(oArBow, Pickupable);
oArBow.ported = false;

class oMagnet extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
	}
}
mixin(oMagnet, Pickupable);
oMagnet.ported = false;

class oRocketpack extends oIaBgObject {
	constructor() {
		super();
		this.initPickupable();
		this.itemOn = 0;
	}
}
mixin(oRocketpack, Pickupable);
oRocketpack.ported = false;

class oSword extends oIaBgObject {
	constructor() {
		super();
		this.initMoveable();
		this.initPickupable();
	}
}
mixin(oSword, Pickupable);
oSword.ported = false;

// A ball to carry and throw; it bounces off floors until the bounce is too small, then rolls to a stop.
class oBall extends oIaBgObject {
	constructor() {
		super();
		this.initMoveable();
		this.initPickupable();
		this.spd = 0;
		// sideways speed lost hitting a wall, and kept each update on the floor
		this.wallBounceLoss = 0.1;
		this.floorSideKeep = 0.9;
		// hitting a floor: sideways speed kept, bounce kept, and the speed below which it just stops
		this.landSideKeep = 0.95;
		this.bounceKeep = 0.8;
		this.restSpeed = 0.3;
		this.fallGravity = 0.04;
		// thrown: forward speed added to the thrower's, and the lift
		this.throwForward = 1.5;
		this.throwLift = 1.2;
	}

	use(who, user) {
		if (this.carriedBy === null) return;

		const thrower = this.carriedBy;

		thrower.inv.drop_held();

		// the throw replaces the drop's speeds
		this.xspd = thrower.xspd + sign(thrower.facing) * this.throwForward;
		this.yspd = thrower.yspd - this.throwLift;
	}

	update() {
		this.calcOnFloorAtWall();

		if (truthy(this.hitWall) || truthy(this.atWall)) {
			this.xspd = -sign(this.xspd) * Math.max(Math.abs(this.xspd) - this.wallBounceLoss, 0);
		}
		if (truthy(this.hitFloor)) {
			// the original wrapped this test in an absolute value, so it only ever tests the speed
			this.yspd = this.yspd < this.restSpeed ? 0 : -sign(this.yspd) * Math.max(Math.abs(this.yspd) * this.bounceKeep, 0);
			this.xspd = sign(this.xspd) * Math.max(Math.abs(this.xspd) * this.landSideKeep, 0);
		}
		if (truthy(this.onFloor)) {
			this.xspd = sign(this.xspd) * Math.max(Math.abs(this.xspd) * this.floorSideKeep, 0);
		} else {
			this.yspd += this.fallGravity;
		}

		if (!this.carriedBy) {
			this.moveThroughObjects(this.xspd, this.yspd);
		}
	}
}
mixin(oBall, Pickupable);
oBall.defaultSprite = "sBall";
