// Keyboard and gamepad state, and the controller the player reads every frame.
// The controller is a straight port of the original: arrow keys or left stick to move,
// X jump, C grab, Z use, S drop, V start, F select, D and A shoulders, numpad aims.
// A few button lines in the original group their checks oddly, so the gamepad half
// still reads while the controller is switched off. That is kept as it was.

// stick travel ignored around the center
const STICK_DEAD_ZONE = 0.3;

// how far a stick must lean to count as a direction press
const STICK_PRESS_THRESHOLD = 0.5;

// the angle math leaves a tiny leftover on an axis the stick does not lean on; below this it is made exactly zero
const STICK_ZERO_SNAP = 0.000000001;

// standard gamepad layout positions
const PAD_FACE1 = 0;
const PAD_FACE2 = 1;
const PAD_FACE3 = 2;
const PAD_FACE4 = 3;
const PAD_SHOULDER_L = 4;
const PAD_SHOULDER_R = 5;
const PAD_TRIGGER_L = 6;
const PAD_SELECT = 8;
const PAD_START = 9;
const PAD_STICK_R = 11;

// Raw key and pad state. Presses and releases are caught as they happen,
// so a tap shorter than a frame still counts once.
const Input = {
	down: {},
	pressed: {},
	released: {},
	anyPressed: false,
	pad: null,
	padPrev: {},
	padNow: {},
	// The mouse over the game's canvas, in display pixels, and a click caught since the last read.
	// The click is cleared by whoever reads it, since the overlay that reads it draws after the step.
	mouseX: 0,
	mouseY: 0,
	mouseIn: false,
	mouseClicked: false,

	attach(target, canvas) {
		target.addEventListener("keydown", (e) => {
			if (!this.down[e.code]) {
				this.pressed[e.code] = true;
				this.anyPressed = true;
			}
			this.down[e.code] = true;
			if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
		});
		target.addEventListener("keyup", (e) => {
			this.down[e.code] = false;
			this.released[e.code] = true;
		});
		target.addEventListener("blur", () => {
			this.down = {};
		});
		if (!canvas) return;
		// the canvas is always shown at the display's shape, so its shown size maps straight
		// to display pixels whatever its real pixel count or how it is scaled
		const track = (e) => {
			const r = canvas.getBoundingClientRect();
			this.mouseX = (e.clientX - r.left) / r.width * DISPLAY_W;
			this.mouseY = (e.clientY - r.top) / r.height * DISPLAY_H;
			this.mouseIn = true;
		};
		canvas.addEventListener("mousemove", track);
		canvas.addEventListener("mousedown", (e) => {
			track(e);
			if (e.button === 0) this.mouseClicked = true;
		});
		canvas.addEventListener("mouseleave", () => {
			this.mouseIn = false;
		});
	},

	// for test harnesses and input playback
	setKey(code, isDown) {
		if (isDown && !this.down[code]) {
			this.pressed[code] = true;
			this.anyPressed = true;
		}
		if (!isDown && this.down[code]) this.released[code] = true;
		this.down[code] = isDown;
	},

	// Reads the first connected gamepad once per frame, keeping last frame's buttons for edges.
	pollPad() {
		this.padPrev = this.padNow;
		this.padNow = {};
		this.pad = null;
		if (typeof navigator === "undefined" || !navigator.getGamepads) return;
		for (const p of navigator.getGamepads()) {
			if (p && p.connected) {
				this.pad = p;
				break;
			}
		}
		if (!this.pad) return;
		for (let i = 0; i < this.pad.buttons.length; i++) {
			this.padNow[i] = this.pad.buttons[i].pressed;
		}
	},

	// called after everyone has read this frame's edges
	endFrame() {
		this.pressed = {};
		this.released = {};
		this.anyPressed = false;
	},

	key(code) { return !!this.down[code]; },
	keyPressed(code) { return !!this.pressed[code]; },
	keyReleased(code) { return !!this.released[code]; },
	axis(i) { return (this.pad && this.pad.axes.length > i) ? this.pad.axes[i] : 0; },
	button(i) { return !!this.padNow[i]; },
	buttonPressed(i) { return !!this.padNow[i] && !this.padPrev[i]; },
	buttonReleased(i) { return !this.padNow[i] && !!this.padPrev[i]; }
};

// One player's controls, worked out once per frame before anyone reads them.
class Controller {
	constructor() {
		this.conOff = 0;
		this.gpnum = 0;

		this.jdz = STICK_DEAD_ZONE;
		this.jdzi = 1 - this.jdz;
		this.joyPressThresh = STICK_PRESS_THRESHOLD;

		// left stick, raw, then fixed to the angle and filled in from the arrow keys
		this.ljH = 0;
		this.ljV = 0;
		this.ljAngd = 0;
		this.ljAng = 0;
		this.ljHp = 0;
		this.ljVp = 0;
		this.lastLjV = 0;
		this.lastLjH = 0;

		// right stick
		this.rjH = 0;
		this.rjV = 0;
		this.rjAngd = 0;
		this.rjAng = 0;
		this.rjHp = 0;
		this.rjVp = 0;
		this.lastRjV = 0;
		this.lastRjH = 0;

		this.iUp = false;
		this.iUpP = false;
		this.iDown = false;
		this.iDownP = false;
		this.iLeft = false;
		this.iLeftP = false;
		this.iRight = false;
		this.iRightP = false;

		this.dirks_used = false;
		this.ljoy_used = false;

		// pressed, held and released for each action button
		this.iBtnA = false;
		this.iBtnAd = false;
		this.iBtnAr = false;
		this.iBtnB = false;
		this.iBtnBd = false;
		this.iBtnBr = 0;
		this.iBtnX = false;
		this.iBtnXd = false;
		this.iBtnXr = false;
		this.iBtnY = false;
		this.iBtnYd = false;
		this.iBtnYr = 0;

		this.iBtnSt = false;
		this.iBtnSl = false;
		this.iBtnSld = false;

		this.iBtnR = false;
		this.iBtnRd = false;
		this.iBtnRr = false;
		this.iBtnL = false;
		this.iBtnLd = false;

		this.iBtnAny = false;
		this.iBtnAnyDir = false;
		this.iBtnAnyDirP = false;
		this.shiftd = false;
	}

	// Clears the stick and direction buttons, so scripts can stop the player mid step.
	kill_jl() {
		this.iBtnAnyDir = false;
		this.iBtnAnyDirP = false;
		this.ljH = 0;
		this.ljV = 0;
		this.ljHp = 0;
		this.ljVp = 0;
		this.iUp = false;
		this.iUpP = false;
		this.iDown = false;
		this.iDownP = false;
		this.iLeft = false;
		this.iLeftP = false;
		this.iRight = false;
		this.iRightP = false;
	}

	// The whole controller update, same order as the original.
	poll() {
		const off = this.conOff;
		this.gpced = !off && Input.pad !== null;

		// left stick and arrow keys
		this.ljH = this.gpced ? Input.axis(0) : 0;
		this.ljV = this.gpced ? Input.axis(1) : 0;
		this.ljH = Math.abs(this.ljH) < this.jdz ? 0 : (sign(this.ljH) * (Math.abs(this.ljH) - this.jdz) / this.jdzi);
		this.ljV = Math.abs(this.ljV) < this.jdz ? 0 : (sign(this.ljV) * (Math.abs(this.ljV) - this.jdz) / this.jdzi);
		this.ljoy_used = Math.abs(this.ljH) > 0 || Math.abs(this.ljV) > 0;

		this.dirks_used = !off && (Input.key("ArrowUp") || Input.key("ArrowDown") || Input.key("ArrowLeft") || Input.key("ArrowRight"));

		this.iUp = !off && (Input.key("ArrowUp") || this.ljV < -this.joyPressThresh);
		this.iUpP = !off && Input.keyPressed("ArrowUp") || (this.ljV < -this.joyPressThresh && this.lastLjV >= -this.joyPressThresh);
		this.iDown = !off && (Input.key("ArrowDown") || this.ljV > this.joyPressThresh);
		this.iDownP = !off && Input.keyPressed("ArrowDown") || (this.ljV > this.joyPressThresh && this.lastLjV <= this.joyPressThresh);
		this.iLeft = !off && (Input.key("ArrowLeft") || this.ljH < -this.joyPressThresh);
		this.iLeftP = !off && (Input.keyPressed("ArrowLeft") || (this.ljH < -this.joyPressThresh && this.lastLjH >= -this.joyPressThresh));
		this.iRight = !off && (Input.key("ArrowRight") || this.ljH > this.joyPressThresh);
		this.iRightP = !off && (Input.keyPressed("ArrowRight") || (this.ljH > this.joyPressThresh && this.lastLjH <= this.joyPressThresh));

		// right stick and numpad
		this.rjH = this.gpced ? Input.axis(2) : 0;
		this.rjV = this.gpced ? Input.axis(3) : 0;
		this.rjH = Math.abs(this.rjH) < this.jdz ? 0 : (sign(this.rjH) * (Math.abs(this.rjH) - this.jdz) / this.jdzi);
		this.rjV = Math.abs(this.rjV) < this.jdz ? 0 : (sign(this.rjV) * (Math.abs(this.rjV) - this.jdz) / this.jdzi);
		this.rjP = this.gpced ? Input.button(PAD_STICK_R) : 0;
		this.rjoy_used = Math.abs(this.rjH) > 0.1 || Math.abs(this.rjV) > 0.1;

		this.rdirks_used = !off && (Input.key("Numpad8") || Input.key("Numpad2") || Input.key("Numpad4") || Input.key("Numpad6"));

		this.irUp = !off && (Input.key("Numpad8") || this.rjV < -this.joyPressThresh);
		this.irDown = !off && (Input.key("Numpad2") || this.rjV > this.joyPressThresh);
		this.irLeft = !off && (Input.key("Numpad4") || this.rjH < -this.joyPressThresh);
		this.irRight = !off && (Input.key("Numpad6") || this.rjH > this.joyPressThresh);

		// action buttons
		this.iBtnA = !off && (Input.keyPressed("KeyX") || (this.gpced && Input.buttonPressed(PAD_FACE1)));
		this.iBtnAd = !off && Input.key("KeyX") || (this.gpced && Input.button(PAD_FACE1));
		this.iBtnAr = !off && Input.keyReleased("KeyX") || (this.gpced && Input.buttonReleased(PAD_FACE1));

		this.iBtnB = !off && (Input.keyPressed("KeyC") || (this.gpced && Input.buttonPressed(PAD_FACE2)));
		this.iBtnBd = !off && Input.key("KeyC") || (this.gpced && Input.button(PAD_FACE2));
		this.iBtnBr = !off && Input.keyReleased("KeyC") || (this.gpced && Input.buttonReleased(PAD_FACE2));

		this.iBtnX = !off && (Input.keyPressed("KeyZ") || (this.gpced && Input.buttonPressed(PAD_FACE3)));
		this.iBtnXd = !off && Input.key("KeyZ") || (this.gpced && Input.button(PAD_FACE3));
		this.iBtnXr = !off && Input.keyReleased("KeyZ") || (this.gpced && Input.buttonReleased(PAD_FACE3));

		this.iBtnY = !off && Input.keyPressed("KeyS") || (this.gpced && Input.buttonPressed(PAD_FACE4));
		this.iBtnYd = !off && Input.key("KeyS") || (this.gpced && Input.button(PAD_FACE4));
		this.iBtnYr = !off && Input.keyReleased("KeyS") || (this.gpced && Input.buttonReleased(PAD_FACE4));

		this.iBtnSt = !off && Input.keyPressed("KeyV") || (this.gpced && Input.buttonPressed(PAD_START));
		this.iBtnSl = !off && Input.keyPressed("KeyF") || (this.gpced && Input.buttonPressed(PAD_SELECT));
		this.iBtnSld = !off && Input.key("KeyF") || (this.gpced && Input.button(PAD_SELECT));

		this.iBtnR = !off && (Input.keyPressed("KeyD") || (this.gpced && Input.buttonPressed(PAD_SHOULDER_R)));
		this.iBtnRd = !off && Input.key("KeyD") || (this.gpced && Input.button(PAD_SHOULDER_R));
		this.iBtnRr = !off && Input.keyReleased("KeyD") || (this.gpced && Input.buttonReleased(PAD_SHOULDER_R));

		this.iBtnL = !off && (Input.keyPressed("KeyA") || (this.gpced && Input.buttonPressed(PAD_SHOULDER_L)));
		this.iBtnLd = !off && (Input.key("KeyA") || (this.gpced && Input.button(PAD_SHOULDER_L)));

		this.iBtnAny = !off && (Input.anyPressed
			|| (this.iBtnA || this.iBtnB || this.iBtnX || this.iBtnY || this.iBtnSt || this.iBtnSl));

		this.iBtnAnyDirP = !off && (this.iUpP || this.iDownP || this.iLeftP || this.iRightP);
		this.iBtnAnyDir = !off && (this.iUp || this.iDown || this.iLeft || this.iRight);

		this.lastLjV = this.ljV;
		this.lastLjH = this.ljH;

		// fill the processed stick from the keys, or fix the stick to its angle
		if (this.dirks_used) {
			this.ljAngd = pointDirection(0, 0, this.iRight - this.iLeft, this.iDown - this.iUp);
			this.ljAng = this.ljAngd / 180 * Math.PI;
			this.ljHp = this.iRight ? Math.min(1, Math.abs(Math.cos(this.ljAng))) : Math.max(-1, -Math.abs(Math.cos(this.ljAng)));
			this.ljVp = this.iDown ? Math.min(1, Math.abs(Math.sin(this.ljAng))) : Math.max(-1, -Math.abs(Math.sin(this.ljAng)));
		} else if (this.ljoy_used) {
			this.ljAngd = pointDirection(0, 0, this.ljH, this.ljV);
			this.ljAng = this.ljAngd / 180 * Math.PI;
			this.ljHp = this.ljH >= 0 ? Math.min(this.ljH, Math.abs(Math.cos(this.ljAng))) : Math.max(this.ljH, -Math.abs(Math.cos(this.ljAng)));
			this.ljVp = this.ljV >= 0 ? Math.min(this.ljV, Math.abs(Math.sin(this.ljAng))) : Math.max(this.ljV, -Math.abs(Math.sin(this.ljAng)));
		} else {
			this.ljHp = 0;
			this.ljVp = 0;
		}

		if (Math.abs(this.ljHp) < STICK_ZERO_SNAP) this.ljHp = 0;
		if (Math.abs(this.ljVp) < STICK_ZERO_SNAP) this.ljVp = 0;

		if (this.rdirks_used) {
			this.rjAngd = pointDirection(0, 0, this.irRight - this.irLeft, this.irDown - this.irUp);
			this.rjAng = this.rjAngd / 180 * Math.PI;
			this.rjHp = this.irRight ? Math.min(1, Math.abs(Math.cos(this.rjAng))) : Math.max(-1, -Math.abs(Math.cos(this.rjAng)));
			this.rjVp = this.irDown ? Math.min(1, Math.abs(Math.sin(this.rjAng))) : Math.max(-1, -Math.abs(Math.sin(this.rjAng)));
		} else if (this.rjoy_used) {
			this.rjAngd = pointDirection(0, 0, this.rjH, this.rjV);
			this.rjAng = this.rjAngd / 180 * Math.PI;
			this.rjHp = this.rjH >= 0 ? Math.min(this.rjH, Math.abs(Math.cos(this.rjAng))) : Math.max(this.rjH, -Math.abs(Math.cos(this.rjAng)));
			this.rjVp = this.rjV >= 0 ? Math.min(this.rjV, Math.abs(Math.sin(this.rjAng))) : Math.max(this.rjV, -Math.abs(Math.sin(this.rjAng)));
		} else {
			this.rjHp = 0;
			this.rjVp = 0;
		}

		if (Math.abs(this.rjHp) < STICK_ZERO_SNAP) this.rjHp = 0;
		if (Math.abs(this.rjVp) < STICK_ZERO_SNAP) this.rjVp = 0;

		this.shiftd = Input.key("ShiftLeft") || Input.key("ShiftRight") || (this.gpced && Input.button(PAD_TRIGGER_L));
	}
}
