// Ship pieces: sliding doors, wall alarms, lockers, consoles, the potted plant and the analyzer.

// A locker: how many things it holds and in how many rows, its screen's backing sprite and the name
// its screen shows unless the room gives one, and its closed and open frames.
const LOCKER_SIZE = 8;
const LOCKER_ROWS = 2;
const LOCKER_BG = "s_inv_bord_ship_metal";
const LOCKER_NAME = "Tec 1";
const LOCKER_CLOSED_FRAME = 0;
const LOCKER_OPEN_FRAME = 1;

// A console: its off and on frames, updates from switching on to its screen opening, and the pop
// that shows as it switches on, with its place from the console's spot.
const CONSOLE_OFF_FRAME = 0;
const CONSOLE_ON_FRAME = 1;
const CONSOLE_WARMUP_UPDATES = 18;
const CONSOLE_POP_SPRITE = "sAniPop";
const CONSOLE_POP_X = 9;
const CONSOLE_POP_Y = -27;

// The potted plant and the analyzer each flip between two frames when acted on. On its second
// frame the analyzer says what it is for. The height is the original's, which the waiting say
// step ignores for now, always sitting at the usual spot above the sayer.
const FLIP_FRAMES = 2;
const ANALYZER_ON_FRAME = 1;
const ANALYZER_SAY_Y = -40;
const ANALYZER_LINES = ["This would be used to analyse\nstuff you found on the planets.",
	"Maybe have a minigame\nfor the analysis."];

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
		this.mask = open ? "sNoMask" : null;
		if (animate) {
			this.spd = 1;
		} else {
			this.ifr = open ? Math.ceil(Sprites.frameCount(this.spi) / 2) : 0;
		}
	}

	update() {
		// while sliding, wait for the animation to reach its open or closed frame
		if (this.spd > 0) {
			const frames = Sprites.frameCount(this.spi);
			if ((this.open && Math.floor(this.ifr) === Math.ceil(frames / 2))
				|| (!this.open && Math.floor(this.ifr) === 0)) {
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

		if (!this.locked && senseOn) {
			if (!this.open) this.set_open(1, 1);
		} else if (this.open) {
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

// A locker that holds things out of play. The player opens it to see its inventory over their own
// in the inventory screen, and it shuts once the screen closes. Its room can name things it starts
// with, made the first time it is set up, and the name its screen shows.
class oShipLocker extends oIaObject {
	constructor() {
		super();
		this.ifr = LOCKER_CLOSED_FRAME;
		// object names it starts with, and the name its screen shows, both from the room
		this.start_items = [];
		this.inv_name = LOCKER_NAME;
		// its start things are made once, even when a room takes it over again
		this.stocked = false;
		this.inv = new Inventory(LOCKER_SIZE, LOCKER_BG, this, LOCKER_NAME);
		this.inv.set_height(LOCKER_ROWS);
		this.inv.stows = true;
	}

	// Its frames are only ever set by hand, whatever speed its room entry gives.
	init() {
		super.init();
		this.spd = 0;
		this.inv.name = this.inv_name;
		if (this.stocked) return;
		this.stocked = true;
		for (const oname of this.start_items) {
			const cls = objectType(oname);
			if (cls === undefined) continue;
			const obj = game.createObject(cls);
			if (this.inv.pickup(obj, undefined, true) === undefined) obj.destroy();
		}
	}

	// Only the player opens it, when it is shut and their hand holds nothing that cannot go in a bag.
	acton(action, who) {
		if (who !== game.guy || Math.floor(this.ifr) === LOCKER_OPEN_FRAME) return;
		if (who.carrying && !who.carrying.holdable) return;
		if (!Screens.open(new InventoryScreen([this.inv, who.inv]))) return;
		this.ifr = LOCKER_OPEN_FRAME;
	}

	// the inventory screen closed
	inv_done() {
		this.ifr = LOCKER_CLOSED_FRAME;
	}
}
oShipLocker.defaultSprite = "s_ship_locker_sm";

// A console anyone can switch on. It pops, warms up a moment, then its screen opens with its room's
// text, and closing the screen switches it off. Acting on it while it is on or warming up does
// nothing.
class oShipConsole extends oIaObject {
	constructor() {
		super();
		this.ifr = CONSOLE_OFF_FRAME;
		// what its screen types out, from the room, or the usual text when none
		this.screentext = null;
		this.warming = false;
	}

	// Its frames are only ever set by hand, whatever speed its room entry gives.
	init() {
		super.init();
		this.spd = 0;
	}

	acton(action, who) {
		if (this.warming || Math.floor(this.ifr) !== CONSOLE_OFF_FRAME) return;
		this.ifr = CONSOLE_ON_FRAME;
		this.warming = true;
		game.createObject(oFxOneShot, { x: this.x + CONSOLE_POP_X, y: this.y + CONSOLE_POP_Y, spi: CONSOLE_POP_SPRITE }, game.popupLayer);
		// another screen already up means this one never opens
		this.startTimer(CONSOLE_WARMUP_UPDATES, () => {
			this.warming = false;
			if (!Screens.open(new ConsoleScreen(this, this.screentext))) this.turnoff();
		});
	}

	turnoff() {
		this.ifr = CONSOLE_OFF_FRAME;
	}
}
oShipConsole.defaultSprite = "s_ship_bridge_console";

// A potted plant anyone can flip between its two looks. Kept from the original: it does not
// remember which look it had once the room loads again, see saved object state.
class oShipPottedPlant extends oIaObject {
	// Its frames are only ever set by hand, whatever speed its room entry gives.
	init() {
		super.init();
		this.spd = 0;
	}

	acton(action, who) {
		this.ifr = (Math.floor(this.ifr) + 1) % FLIP_FRAMES;
	}
}
oShipPottedPlant.defaultSprite = "s_ship_potted_plant";

// The science room's analyzer, a stand-in for something to come. Acting on it switches it on or
// off, and switching it on says what it would be for, waiting on a button.
class oShipAnalizer extends oIaObject {
	// Its frames are only ever set by hand, whatever speed its room entry gives.
	init() {
		super.init();
		this.spd = 0;
	}

	acton(action, who) {
		this.ifr = (Math.floor(this.ifr) + 1) % FLIP_FRAMES;
		if (this.ifr !== ANALYZER_ON_FRAME) return;
		Hooks.runScript([["sayWfB", ANALYZER_LINES, "actor", 0, ANALYZER_SAY_Y, 0, 0]], this, undefined, undefined, undefined, this);
	}
}
oShipAnalizer.defaultSprite = "ship_sci_analyizer";
