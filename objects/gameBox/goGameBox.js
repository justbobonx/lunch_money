// Arcade cabinets and the small screen games they play. A cabinet sits in the room; acting on it
// turns the player's controls off, pulls the view in on the screen and starts a game there. B
// closes the game and puts the view, the zoom and the controls back as they were. The kind of
// game is a room setting, and Munchie is the default.
// The games, all on a fifteen by twenty screen of single pixels, with a flickering glass drawn
// over them:
//   Munchie  eat every dot in a maze while hunters chase you; a bright dot lets you eat them for
//            a while. Clearing the board flashes the walls, runs the cabinet's win script, then
//            starts the next round a little faster. X after a death or during the flash starts
//            the current round again.
//   Spaze    move along the bottom and fire up at falling ships; a row of shields at the bottom
//            takes one hit each. There is no win; X after a death starts again.
//   DodgeEm  only the car's steering and speed so far, as in the original.
// Times and speeds count updates, so they stop while play is paused.

// the screen's size in pixels, and where it sits on the cabinet
const GB_SCREEN_W = 15;
const GB_SCREEN_H = 20;
const GB_SCREEN_X = 4;
const GB_SCREEN_Y = 4;
// the view locks this far from the cabinet's origin, zooms to this, and the move takes this many updates
const GB_CAM_X = 12;
const GB_CAM_Y = 14;
const GB_PLAY_ZOOM = 3;
const GB_CAM_TIME = 60;
// the glass over a game, how strongly it is drawn, and how the frame is picked
const GB_OVERLAY_SPRITE = "sGbOverlay";
const GB_OVERLAY_ALPHA = 0.5;
const GB_OVERLAY_ROLL = 30;
const GB_OVERLAY_MAX_FRAME = 4;
// the off screen's glass only uses the first few frames, and each of its pixels is a grey in this range
const GB_STATIC_OVERLAY_FRAMES = 3;
const GB_STATIC_GREY_MIN = 40;
const GB_STATIC_GREY_SPAN = 210;
const GB_STATIC_MAX_ALPHA = 0.6;

// Munchie: the maze picture, its wall colour and the colour they flash to after a clear
const GB_MUNCHIE_SPRITE = "sMBGMunchiePuzzle1";
const GB_MUNCHIE_WALL = "#0000ff";
const GB_MUNCHIE_WALL_FLASH = "#99ffff";
const GB_MUNCHIE_FLASH_UPDATES = 20;
const GB_MUNCHIE_WIN_WAIT = 200;
// cells: a wall, an empty path, a dot, the player's start, the hunters' door, a bright dot
const GB_MUNCHIE_WALL_CELL = 1;
const GB_MUNCHIE_DOT_CELL = 2;
const GB_MUNCHIE_START_CELL = 3;
const GB_MUNCHIE_SPAWN_CELL = 4;
const GB_MUNCHIE_POWER_CELL = 5;
const GB_MUNCHIE_PLAYER = "#ffff00";
const GB_MUNCHIE_DOT = "#666666";
const GB_MUNCHIE_DOT_DIM = "#555555";
const GB_MUNCHIE_POWER = "#66cc66";
const GB_MUNCHIE_POWER_DIM = "#55dd55";
const GB_MUNCHIE_DOT_BLINK = 5;
const GB_MUNCHIE_DOT_BLINK_STEPS = 3;
const GB_MUNCHIE_HUNTERS = ["#ff0000", "#ff5500", "#ff0055"];
const GB_MUNCHIE_HUNTER_SCARE = "#22eeee";
const GB_MUNCHIE_HUNTER_BLINK = "#aa00ff";
const GB_MUNCHIE_SCARE_STEADY = 120;
const GB_MUNCHIE_SCARE_BLINK = 20;
const GB_MUNCHIE_PLAYER_PACE = 3;
const GB_MUNCHIE_HUNTER_PACE = 12;
const GB_MUNCHIE_HUNTER_MAX = 3;
const GB_MUNCHIE_SPAWN_WAIT = 60;
const GB_MUNCHIE_POWER_TIME = 300;
const GB_MUNCHIE_POWER_PER_LEVEL = 10;
// left, right, up, down
const GB_DIR_LEFT = 1;
const GB_DIR_RIGHT = 2;
const GB_DIR_UP = 3;
const GB_DIR_DOWN = 4;
// the maze as columns of twenty, top to bottom, fifteen columns across
const GB_MUNCHIE_BOARD = [
	1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	1, 5, 0, 2, 0, 0, 1, 0, 2, 0, 0, 2, 0, 1, 0, 0, 2, 0, 5, 1,
	1, 0, 1, 1, 1, 2, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 1,
	1, 2, 1, 0, 0, 0, 1, 2, 0, 0, 2, 0, 2, 1, 0, 2, 0, 1, 2, 1,
	1, 0, 1, 2, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1,
	1, 2, 1, 0, 0, 2, 1, 0, 0, 0, 2, 1, 0, 0, 2, 0, 0, 1, 2, 1,
	1, 0, 1, 0, 1, 0, 0, 2, 1, 1, 0, 1, 2, 1, 0, 1, 2, 0, 0, 1,
	1, 2, 0, 2, 1, 1, 1, 0, 4, 1, 0, 0, 0, 1, 3, 1, 1, 1, 2, 1,
	1, 0, 1, 0, 1, 0, 0, 2, 1, 1, 0, 1, 2, 1, 0, 1, 2, 0, 0, 1,
	1, 2, 1, 0, 0, 2, 1, 0, 0, 0, 2, 1, 0, 0, 2, 0, 0, 1, 2, 1,
	1, 0, 1, 2, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1,
	1, 2, 1, 0, 0, 0, 1, 2, 0, 0, 2, 0, 2, 1, 0, 2, 0, 1, 2, 1,
	1, 0, 1, 1, 1, 2, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 1,
	1, 5, 0, 2, 0, 0, 1, 0, 2, 0, 0, 2, 0, 1, 0, 0, 2, 0, 5, 1,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1
];

// Spaze: the sky, the ship, its sides, the gun ready and the gun after a shot, the shot and its trail
const GB_SPAZE_START = 7;
const GB_SPAZE_SPRITE = "sMBGSpaze";
const GB_SPAZE_SHIP = "#00ffff";
const GB_SPAZE_SHIP_SIDE = "#00aacc";
const GB_SPAZE_GUN_READY = "#ccffff";
const GB_SPAZE_GUN_SHOT = "#006666";
const GB_SPAZE_SHOT = "#ffffff";
const GB_SPAZE_SHOT_TRAIL_ALPHA = 0.7;
const GB_SPAZE_SHIELD = "#aa8800";
const GB_SPAZE_SHIPS = ["#00ff00", "#00cc44", "#44cc00"];
const GB_SPAZE_SHIP_GHOST = 0.5;
const GB_SPAZE_SHIP_SHAPE = [0, 0, -1, -1, 1, -1];
const GB_SPAZE_PLAYER_PACE = 2;
const GB_SPAZE_PLAYER_MIN = 1;
const GB_SPAZE_PLAYER_MAX = 13;
const GB_SPAZE_PLAYER_ROW = 18;
const GB_SPAZE_GUN_ROW = 17;
const GB_SPAZE_SHOT_ROW = 18;
const GB_SPAZE_SHIELD_ROW = 19;
const GB_SPAZE_SHIP_MAX = 10;
const GB_SPAZE_SHIP_PACE = 15;
const GB_SPAZE_SHIP_PACE_STEP = 3;
const GB_SPAZE_SHIP_PACE_WOBBLE = 5;
const GB_SPAZE_SPAWN_BASE = 20;
const GB_SPAZE_SPAWN_EACH = 30;
const GB_SPAZE_SPAWN_PER_LEVEL = 5;
const GB_SPAZE_SPAWN_WOBBLE = 5;
const GB_SPAZE_KILLS_PER_LEVEL = 10;
const GB_SPAZE_DEATH_WEAR = 10;
const GB_SPAZE_BLAST_GROW = 0.95;
const GB_SPAZE_BLAST_STEP = 10;
const GB_SPAZE_BLAST_MAX = 5;

// DodgeEm: the car, its start column, how far it may go, the step it takes, and how speed builds and fades
const GB_DODGE_CAR = "sMBGDodgeEm_car";
const GB_DODGE_START = 7;
const GB_DODGE_MIN = 3;
const GB_DODGE_MAX = 11;
const GB_DODGE_STEP = 2;
const GB_DODGE_PACE = 2;
const GB_DODGE_SPEED_UP = 2;
const GB_DODGE_SPEED_DOWN = 5;
const GB_DODGE_SPEED_MAX = 100;
const GB_DODGE_CAR_Y = 15;

// The snow on an idle cabinet screen: a field of random greys with a little glass over it.
class oStaticBox extends oBaseObject {
	constructor() {
		super();
		this.w = 5;
		this.h = 5;
	}

	draw() {
		Draw.alpha = this.alpha;
		for (let i = 0; i < this.w; i++) {
			for (let j = 0; j < this.h; j++) {
				const v = GB_STATIC_GREY_MIN + Math.floor(Math.random() * (GB_STATIC_GREY_SPAN + 1));
				const hx = (v < 16 ? "0" : "") + v.toString(16);
				Draw.color = "#" + hx + hx + hx;
				Draw.rectangle(this.x + i, this.y + j, this.x + i, this.y + j, 0);
			}
		}
		Draw.color = "#ffffff";
		Draw.sprite(GB_OVERLAY_SPRITE, Math.floor(Math.random() * GB_STATIC_OVERLAY_FRAMES), this.x, this.y);
		Draw.alpha = 1;
	}
}

// Shared screen for the three games: a clipped pixel, a count of updates, the wait after a
// death or a win until X starts the current round again, and the glass drawn last.
class oGbGame extends oBaseObject {
	constructor() {
		super();
		this.step = 0;
		this.level = 1;
		this.dead = false;
		this.win = 0;
		this.cabinet = null;
	}

	init() {
		Sprites.ensure(this.screenSprites());
		this.newGame();
	}

	// sprites this game needs besides the glass, which every game uses
	screenSprites() {
		return [GB_OVERLAY_SPRITE];
	}

	// a single pixel of the current colour, ignored if it falls off the screen
	drawPixel(xx, yy) {
		if (xx < 0 || xx >= GB_SCREEN_W || yy < 0 || yy >= GB_SCREEN_H) return;
		Draw.rectangle(this.x + xx, this.y + yy, this.x + xx, this.y + yy, 0);
	}

	// Starts a round. With no round given, it keeps the current one, which begins at one.
	newGame(newlev) {
		if (newlev !== undefined) this.level = newlev;
		this.dead = false;
		this.win = 0;
	}

	// called each update while the player is dead, before a restart can be taken
	afterDeath() {}

	play() {}

	picture() {}

	update() {
		this.step++;
		if (this.win) {
			this.win--;
			if (this.win === 0) this.newGame(this.level + 1);
		}
		if (this.dead) this.afterDeath();
		if (this.dead || this.win) {
			if (game.uiController.iBtnX) this.newGame();
			return;
		}
		this.play();
	}

	draw() {
		this.picture();
		Draw.color = "#ffffff";
		Draw.alpha = GB_OVERLAY_ALPHA;
		Draw.sprite(GB_OVERLAY_SPRITE, Math.min(Math.floor(Math.random() * (GB_OVERLAY_ROLL + 1)), GB_OVERLAY_MAX_FRAME), this.x, this.y);
		Draw.alpha = 1;
	}

	// a cleared Munchie board runs the cabinet's win script, if it has one
	runWin() {
		const box = this.cabinet;
		if (box && box.winScript) Hooks.runScript(box.winScript, game.guy, undefined, undefined, undefined, box);
	}
}

// Eat the dots, avoid the hunters, or eat them while a bright dot is in effect.
class oGbGameMunchie extends oGbGame {
	constructor() {
		super();
		this.board = [];
		this.dots = [];
		this.numDots = 0;
		this.me = [1, 1, 0];
		this.spawn = [0, 0];
		this.hunters = [];
		this.hunterColour = -1;
		this.power = 0;
		this.spawnWait = 0;
	}

	screenSprites() {
		return [GB_OVERLAY_SPRITE, GB_MUNCHIE_SPRITE];
	}

	newGame(newlev) {
		super.newGame(newlev);
		this.hunters = [];
		this.me = [1, 1, 0];
		this.board = GB_MUNCHIE_BOARD.slice();
		this.dots = [];
		this.numDots = 0;
		for (let xi = 0; xi < GB_SCREEN_W; xi++) {
			this.dots[xi] = [];
			for (let yi = 0; yi < GB_SCREEN_H; yi++) {
				this.dots[xi][yi] = 0;
				const bv = this.board[xi * GB_SCREEN_H + yi];
				if (bv === GB_MUNCHIE_DOT_CELL) {
					this.numDots++;
					this.dots[xi][yi] = 1;
				} else if (bv === GB_MUNCHIE_POWER_CELL) {
					this.numDots++;
					this.dots[xi][yi] = 2;
				} else if (bv === GB_MUNCHIE_START_CELL) {
					this.me[0] = xi;
					this.me[1] = yi;
				} else if (bv === GB_MUNCHIE_SPAWN_CELL) {
					this.spawn = [xi, yi];
				}
				this.board[xi * GB_SCREEN_H + yi] = bv === GB_MUNCHIE_WALL_CELL ? 1 : 0;
			}
		}
		this.power = 0;
		this.spawnWait = 0;
	}

	// the opposite of a facing
	reverseDir(dir) {
		if (dir === GB_DIR_LEFT) return GB_DIR_RIGHT;
		if (dir === GB_DIR_RIGHT) return GB_DIR_LEFT;
		if (dir === GB_DIR_UP) return GB_DIR_DOWN;
		if (dir === GB_DIR_DOWN) return GB_DIR_UP;
		return dir;
	}

	// whether the cell is a path, or the cell one step in a facing
	cellOpen(cx, cy, dir) {
		if (dir === GB_DIR_LEFT) cx -= 1;
		else if (dir === GB_DIR_RIGHT) cx += 1;
		else if (dir === GB_DIR_UP) cy -= 1;
		else if (dir === GB_DIR_DOWN) cy += 1;
		return this.board[cx * GB_SCREEN_H + cy] === 0;
	}

	// step one cell if that path is open; wrap through the sides. True when the spot changed.
	moveOnBoard(mover) {
		const cx = mover[0], cy = mover[1], dir = mover[2];
		if (dir === GB_DIR_LEFT && cx > 0 && this.cellOpen(cx - 1, cy)) mover[0] -= 1;
		if (dir === GB_DIR_RIGHT && cx < GB_SCREEN_W - 1 && this.cellOpen(cx + 1, cy)) mover[0] += 1;
		if (dir === GB_DIR_UP && cy > 0 && this.cellOpen(cx, cy - 1)) mover[1] -= 1;
		if (dir === GB_DIR_DOWN && cy < GB_SCREEN_H - 1 && this.cellOpen(cx, cy + 1)) mover[1] += 1;
		if (dir === GB_DIR_LEFT && cx === 0) mover[0] = GB_SCREEN_W - 1;
		if (dir === GB_DIR_RIGHT && cx === GB_SCREEN_W - 1) mover[0] = 0;
		return cx !== mover[0] || cy !== mover[1];
	}

	// hitting a hunter: eat it while powered, otherwise die. False if that hunter is gone.
	hitHunter(hunter) {
		if (this.me[0] === hunter[0] && this.me[1] === hunter[1]) {
			if (this.power > 0) {
				const i = this.hunters.indexOf(hunter);
				if (i >= 0) this.hunters.splice(i, 1);
				return false;
			}
			this.dead = true;
		}
		return true;
	}

	spawnHunter() {
		if (this.power > 0 || (this.spawnWait > 0 && --this.spawnWait > 0)) return;
		if (this.hunters.length < GB_MUNCHIE_HUNTER_MAX) {
			this.hunterColour = (this.hunterColour + 1) % GB_MUNCHIE_HUNTERS.length;
			this.hunters.push([this.spawn[0], this.spawn[1], rng.irandomRange(1, 4), GB_MUNCHIE_HUNTERS[this.hunterColour]]);
			this.spawnWait = GB_MUNCHIE_SPAWN_WAIT;
		}
	}

	play() {
		const con = game.uiController;
		if (this.step % GB_MUNCHIE_PLAYER_PACE === 0) {
			const cx = this.me[0], cy = this.me[1];
			if (con.iLeft && cx > 0 && this.board[(cx - 1) * GB_SCREEN_H + cy] === 0) this.me[2] = GB_DIR_LEFT;
			if (con.iRight && cx < GB_SCREEN_W - 1 && this.board[(cx + 1) * GB_SCREEN_H + cy] === 0) this.me[2] = GB_DIR_RIGHT;
			if (con.iUp && cy > 0 && this.board[cx * GB_SCREEN_H + cy - 1] === 0) this.me[2] = GB_DIR_UP;
			if (con.iDown && cy < GB_SCREEN_H - 1 && this.board[cx * GB_SCREEN_H + cy + 1] === 0) this.me[2] = GB_DIR_DOWN;
			this.moveOnBoard(this.me);
			for (let i = 0; i < this.hunters.length; i++) {
				if (!this.hitHunter(this.hunters[i])) i--;
			}
		}

		const hunterPace = Math.max(1, GB_MUNCHIE_HUNTER_PACE - this.level);
		if (this.step % hunterPace === 0) {
			for (let i = 0; i < this.hunters.length; i++) {
				const hunter = this.hunters[i];
				let moved = false;
				while (!moved) {
					moved = this.moveOnBoard(hunter);
					if (!moved) {
						hunter[2] = rng.irandomRange(1, 4);
					} else {
						for (let dir = 1; dir <= 4; dir++) {
							if (dir === hunter[2] || dir === this.reverseDir(hunter[2])) continue;
							if (this.cellOpen(hunter[0], hunter[1], dir) && rng.irandom(1) === 0) {
								hunter[2] = dir;
								break;
							}
						}
					}
				}
				if (!this.hitHunter(hunter)) {
					i--;
				}
			}
		}

		// after everyone has moved, a swap past each other still counts as a hit
		for (let i = 0; i < this.hunters.length; i++) {
			if (!this.hitHunter(this.hunters[i])) i--;
		}

		const dot = this.dots[this.me[0]][this.me[1]];
		if (dot > 0) {
			this.numDots--;
			if (dot === 2) this.power = Math.max(1, GB_MUNCHIE_POWER_TIME - this.level * GB_MUNCHIE_POWER_PER_LEVEL);
			this.dots[this.me[0]][this.me[1]] = 0;
		}
		this.power = this.power > 0 ? --this.power : 0;
		this.spawnHunter();
		if (this.numDots === 0) {
			this.win = GB_MUNCHIE_WIN_WAIT;
			this.step = 0;
			this.runWin();
		}
	}

	picture() {
		const flash = this.win && Math.floor(this.step / GB_MUNCHIE_FLASH_UPDATES) % 2 > 0;
		Draw.spriteExt(GB_MUNCHIE_SPRITE, 0, this.x, this.y, 1, 1, 0, flash ? GB_MUNCHIE_WALL_FLASH : GB_MUNCHIE_WALL, 1);
		const dim = Math.floor(this.step / GB_MUNCHIE_DOT_BLINK) % GB_MUNCHIE_DOT_BLINK_STEPS === 0;
		for (let xi = 0; xi < GB_SCREEN_W; xi++) {
			for (let yi = 0; yi < GB_SCREEN_H; yi++) {
				if (this.dots[xi][yi] === 1) {
					Draw.color = dim ? GB_MUNCHIE_DOT : GB_MUNCHIE_DOT_DIM;
					this.drawPixel(xi, yi);
				}
				if (this.dots[xi][yi] === 2) {
					Draw.color = dim ? GB_MUNCHIE_POWER : GB_MUNCHIE_POWER_DIM;
					this.drawPixel(xi, yi);
				}
			}
		}
		if (!this.win) {
			for (const hunter of this.hunters) {
				Draw.color = this.power > 0
					? (this.power > GB_MUNCHIE_SCARE_STEADY || (Math.floor(this.power / GB_MUNCHIE_SCARE_BLINK) % 2 === 0) ? GB_MUNCHIE_HUNTER_SCARE : GB_MUNCHIE_HUNTER_BLINK)
					: hunter[3];
				this.drawPixel(hunter[0], hunter[1]);
			}
		}
		if (!this.dead) {
			Draw.color = GB_MUNCHIE_PLAYER;
			this.drawPixel(this.me[0], this.me[1]);
		}
	}
}

// Ships drop from the top; the gun at the bottom fires up, and shields take a hit each.
class oGbGameSpaze extends oGbGame {
	constructor() {
		super();
		this.me = GB_SPAZE_START;
		this.shot = [0, -1];
		this.shield = [];
		this.ships = [];
		this.shipColour = -1;
		this.killed = 0;
		this.spawnWait = 0;
	}

	screenSprites() {
		return [GB_OVERLAY_SPRITE, GB_SPAZE_SPRITE];
	}

	newGame(newlev) {
		super.newGame(newlev);
		this.ships = [];
		this.me = GB_SPAZE_START;
		this.shot = [0, -1];
		this.shield = [];
		for (let i = 0; i < GB_SCREEN_W; i++) this.shield[i] = 1;
		this.killed = 0;
	}

	// True when this ship is still in play. A hit, a landing, or a bump of the gun ends it.
	// The original always took it out once the check ran, typo and all, and that is kept.
	hitShip(ship) {
		let gone = 0;
		if (this.shot[1] === ship[1] && Math.abs(ship[0] - this.shot[0]) <= 1) {
			this.shot[1] = -1;
			gone = 1;
		}
		if (ship[1] === GB_SPAZE_SHIELD_ROW) {
			if (this.shield[ship[0]] === 0) {
				this.me = ship[0];
				this.dead = true;
				this.step = 0;
			} else {
				this.shield[ship[0]] = 0;
			}
			gone = 1;
		}
		if (ship[1] === GB_SPAZE_PLAYER_ROW && Math.abs(ship[0] - this.me) <= 1) {
			this.dead = true;
			this.step = 0;
			gone = 1;
		}
		if ((gone = 1)) {
			const i = this.ships.indexOf(ship);
			if (i >= 0) this.ships.splice(i, 1);
			this.killed++;
			if (Math.floor(this.killed / GB_SPAZE_KILLS_PER_LEVEL) > this.level) this.level++;
			return false;
		}
		return true;
	}

	spawnShip() {
		if (this.spawnWait > 0 && --this.spawnWait > 0) return;
		if (this.ships.length < GB_SPAZE_SHIP_MAX) {
			this.shipColour = (this.shipColour + 1) % GB_SPAZE_SHIPS.length;
			const pace = Math.max(1, GB_SPAZE_SHIP_PACE - Math.floor(this.level / GB_SPAZE_SHIP_PACE_STEP)) + rng.irandom(GB_SPAZE_SHIP_PACE_WOBBLE);
			this.ships.push([rng.irandomRange(1, 13), 0, pace, GB_SPAZE_SHIPS[this.shipColour]]);
			this.spawnWait = GB_SPAZE_SPAWN_BASE + this.ships.length * GB_SPAZE_SPAWN_EACH - this.level * GB_SPAZE_SPAWN_PER_LEVEL + rng.irandom(GB_SPAZE_SPAWN_WOBBLE);
		}
	}

	afterDeath() {
		const wear = Math.floor(this.step / GB_SPAZE_DEATH_WEAR);
		this.shield[Math.max(this.me - wear, 0)] = 0;
		this.shield[Math.min(this.me + wear, GB_SCREEN_W - 1)] = 0;
	}

	play() {
		const con = game.uiController;
		if (con.iBtnA) {
			this.shot[0] = this.me;
			this.shot[1] = GB_SPAZE_SHOT_ROW;
		}
		if (this.step % GB_SPAZE_PLAYER_PACE === 0) {
			if (con.iLeft && this.me > GB_SPAZE_PLAYER_MIN) this.me -= 1;
			else if (con.iRight && this.me < GB_SPAZE_PLAYER_MAX) this.me += 1;
		}
		if (this.shot[1] >= 0) {
			this.shot[1]--;
			for (let i = 0; i < this.ships.length; i++) {
				if (!this.hitShip(this.ships[i])) i--;
			}
		}
		for (let i = 0; i < this.ships.length; i++) {
			const ship = this.ships[i];
			if (this.step % ship[2] !== 0) continue;
			ship[1]++;
			if (!this.hitShip(ship)) i--;
		}
		this.spawnShip();
	}

	picture() {
		Draw.sprite(GB_SPAZE_SPRITE, 0, this.x, this.y);
		if (!this.dead) {
			Draw.color = GB_SPAZE_SHIP;
			this.drawPixel(this.me, GB_SPAZE_PLAYER_ROW);
			Draw.color = GB_SPAZE_SHIP_SIDE;
			this.drawPixel(this.me - 1, GB_SPAZE_PLAYER_ROW);
			this.drawPixel(this.me + 1, GB_SPAZE_PLAYER_ROW);
			Draw.color = this.shot[1] < 0 ? GB_SPAZE_GUN_READY : GB_SPAZE_GUN_SHOT;
			this.drawPixel(this.me, GB_SPAZE_GUN_ROW);
		} else {
			const grow = Math.min(Math.floor(Math.pow(this.step, GB_SPAZE_BLAST_GROW) / GB_SPAZE_BLAST_STEP), GB_SPAZE_BLAST_MAX);
			const n = 2 + grow * 4;
			for (let i = 0; i < n; i++) {
				const len = Math.floor(Math.random() * (grow + 1));
				const dir = Math.random() * 180;
				const cx = Math.round(lengthdirX(len, dir));
				const cy = Math.round(lengthdirY(len, dir));
				const g = grow + Math.floor(Math.random() * (15 - grow + 1));
				const b = Math.floor(Math.random() * (g * (grow / 5) + 1));
				Draw.color = "rgb(255," + (g * 17) + "," + (b * grow) + ")";
				this.drawPixel(this.me - cx, 19 + cy);
			}
		}
		if (!this.win) {
			for (const ship of this.ships) {
				const cx = ship[0], cy = ship[1];
				for (let k = 0; k < GB_SPAZE_SHIP_SHAPE.length; k += 2) {
					Draw.color = ship[3];
					Draw.alpha = GB_SPAZE_SHIP_GHOST;
					this.drawPixel(cx + GB_SPAZE_SHIP_SHAPE[k], cy + GB_SPAZE_SHIP_SHAPE[k + 1] - 1);
					Draw.alpha = 1;
					this.drawPixel(cx + GB_SPAZE_SHIP_SHAPE[k], cy + GB_SPAZE_SHIP_SHAPE[k + 1]);
				}
			}
		}
		Draw.color = GB_SPAZE_SHIELD;
		for (let i = 0; i < this.shield.length; i++) {
			if (this.shield[i]) this.drawPixel(i, GB_SPAZE_SHIELD_ROW);
		}
		if (this.shot[1] >= 0) {
			if (this.shot[1] < GB_SPAZE_GUN_ROW) {
				Draw.color = GB_SPAZE_SHOT;
				Draw.alpha = GB_SPAZE_SHOT_TRAIL_ALPHA;
				this.drawPixel(this.shot[0], this.shot[1] + 1);
			}
			Draw.color = GB_SPAZE_SHOT;
			Draw.alpha = 1;
			this.drawPixel(this.shot[0], this.shot[1]);
		}
		Draw.alpha = 1;
	}
}

// Only the car so far: it slides back to the middle, A builds speed, and the speed is stored
// on the picture even though this game has none of its own.
class oGbGameDodgeEm extends oGbGame {
	constructor() {
		super();
		this.me = GB_DODGE_START;
		this.pace = 0;
	}

	screenSprites() {
		return [GB_OVERLAY_SPRITE, GB_DODGE_CAR];
	}

	newGame(newlev) {
		super.newGame(newlev);
		this.me = GB_DODGE_START;
		this.pace = 0;
	}

	play() {
		const con = game.uiController;
		if (this.step % GB_DODGE_PACE === 0) {
			if (con.iLeft && this.me > GB_DODGE_MIN) this.me -= GB_DODGE_STEP;
			else if (con.iRight && this.me < GB_DODGE_MAX) this.me += GB_DODGE_STEP;
			else if (!con.iLeft && !con.iRight) this.me = this.me - sign(this.me - GB_DODGE_START) * GB_DODGE_STEP;
			if (con.iBtnAd) this.pace = Math.min(this.pace + GB_DODGE_SPEED_UP, GB_DODGE_SPEED_MAX);
			else this.pace = Math.max(this.pace - GB_DODGE_SPEED_DOWN, 0);
			this.spd = this.pace / GB_DODGE_SPEED_MAX;
		}
	}

	picture() {
		Draw.sprite(GB_DODGE_CAR, 0, this.x + this.me, this.y + GB_DODGE_CAR_Y);
	}
}

// The cabinet in the room. Acting on it starts the chosen game on its screen; B leaves.
class oGameBoxV extends oIaBgObject {
	constructor() {
		super();
		this.gamename = "oGbGameMunchie";
		this.winScript = null;
		this.on = false;
		this.mygame = null;
		this.offstatic = null;
		this.startScript = null;
		this.wasConOff = false;
		this.wasZoom = 1;
		this.wasStatic = false;
		this.wasFollow = null;
		this.wasX = 0;
		this.wasY = 0;
	}

	init() {
		Sprites.ensure([this.spi || "sGameBoxV", GB_OVERLAY_SPRITE]);
		this.startScript = [
			["conOff"],
			["lockCamTo", this.x + GB_CAM_X, this.y + GB_CAM_Y, GB_CAM_TIME],
			["zoomCamTo", GB_PLAY_ZOOM, GB_CAM_TIME]
		];
		this.offstatic = game.createObject(oStaticBox, {
			x: this.x + GB_SCREEN_X, y: this.y + GB_SCREEN_Y,
			w: GB_SCREEN_W, h: GB_SCREEN_H
		}, this.mylayer);
	}

	// remember the view and the controls so leaving can put them back
	saveView() {
		this.wasConOff = game.controller.conOff;
		this.wasZoom = game.cam.tarz;
		if (game.cam.follow === game.cam.staticCam) {
			this.wasStatic = true;
			this.wasFollow = null;
			this.wasX = game.cam.staticCam.x;
			this.wasY = game.cam.staticCam.y;
		} else {
			this.wasStatic = false;
			this.wasFollow = game.cam.follow;
		}
	}

	restoreView() {
		const end = [];
		end.push(this.wasConOff ? ["conOff"] : ["conOn"]);
		if (this.wasStatic) end.push(["lockCamTo", this.wasX, this.wasY, GB_CAM_TIME]);
		else if (this.wasFollow === game.guy) end.push(["lockCamTo", "actor", GB_CAM_TIME]);
		else if (this.wasFollow && this.wasFollow.name) end.push(["lockCamTo", this.wasFollow.name, GB_CAM_TIME]);
		else end.push(["lockCamTo", "actor", GB_CAM_TIME]);
		end.push(["zoomCamTo", this.wasZoom, GB_CAM_TIME]);
		Hooks.runScript(end, game.guy, undefined, undefined, undefined, this);
	}

	acton(action, who) {
		if (this.on) return;
		this.on = true;
		this.saveView();
		Hooks.runScript(this.startScript, game.guy, undefined, undefined, undefined, this);
		this.mygame = game.createObject(this.gamename, {
			x: this.x + GB_SCREEN_X, y: this.y + GB_SCREEN_Y,
			cabinet: this
		}, this.mylayer);
	}

	leave() {
		if (!this.on) return;
		this.on = false;
		if (this.mygame && !this.mygame.destroyed) this.mygame.destroy();
		this.mygame = null;
		this.restoreView();
	}

	update() {
		if (this.offstatic && !this.offstatic.destroyed) {
			this.offstatic.x = this.x + GB_SCREEN_X;
			this.offstatic.y = this.y + GB_SCREEN_Y;
			this.offstatic.alpha = Math.random() * GB_STATIC_MAX_ALPHA;
			this.offstatic.visible = !this.on;
		}
		if (this.on && game.uiController.iBtnB) this.leave();
	}

	destroy() {
		if (this.destroyed) return;
		this.leave();
		if (this.offstatic && !this.offstatic.destroyed) this.offstatic.destroy();
		this.offstatic = null;
		super.destroy();
	}
}

oGameBoxV.defaultSprite = "sGameBoxV";
oGbGameSpaze.defaultSprite = "sMBGSpaze";
