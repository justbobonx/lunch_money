// Ship pieces: sliding doors and wall alarms.

// A sliding door that opens when anyone stands at its sensor, unless locked. It is solid while
// closed and can be walked through while open. Scripts can open or close it themselves.
class oShipDoor extends oSolidGr {
	constructor() {
		super();
		this.spd = 0;
		this.ifr = 0;
		this.open = false;
		this.locked = false;
		this.connected = -1;
		this.sensorMask = "s_ship_door_sensor";
	}

	// Opens or closes, playing the animation or jumping to its end. Half way through the frames is fully open.
	set_open(open, animate) {
		this.open = open;
		this.mask = truthy(open) ? "sNoMask" : null;
		if (truthy(animate)) {
			this.spd = 1;
		} else {
			this.ifr = truthy(open) ? Math.ceil(Sprites.frameCount(this.spi) / 2) : 0;
		}
	}

	update() {
		// while sliding, wait for the animation to reach its open or closed frame
		if (this.spd > 0) {
			const frames = Sprites.frameCount(this.spi);
			if ((truthy(this.open) && Math.floor(this.ifr) === Math.ceil(frames / 2))
				|| (!truthy(this.open) && Math.floor(this.ifr) === 0)) {
				this.spd = 0;
			} else {
				super.update();
				return;
			}
		}

		// the sensor is a wider mask on the same spot, so look through it for a moment
		const ownMask = this.mask;
		this.mask = this.sensorMask;
		const senseOn = this.instancePlace(this.x, this.y, oActor) !== null;
		this.mask = ownMask;

		if (!truthy(this.locked) && senseOn) {
			if (!truthy(this.open)) this.set_open(1, 1);
		} else if (truthy(this.open)) {
			this.set_open(0, 1);
		}
		super.update();
	}
}

// A wall alarm light. It has an on switch that nothing uses yet.
class oShipWallAlarm extends oBaseObject {
	constructor() {
		super();
		this.spd = 1;
		this.ifr = 0;
		this.on = false;
	}
}
