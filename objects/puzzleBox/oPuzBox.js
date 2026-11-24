// The puzzle box: a minigame of small square tiles in a box over the screen, with a time bar above
// and, when it has a score to reach, a score bar to its right. A script makes one into the pop up
// layer with the kind of box to play, and placed in a room it starts as the room starts. While it is
// up the player's controls are off and it reads the menu controller; they come back as they were
// when it closes.
// The kinds of box:
//   0  colours, one hole: an arrow slides the tile next to the hole into it, until each colour is
//      one touching group
//   1  colours: arrows move the cursor, held A and an arrow turns its row or column round by one,
//      to the same end
//   2  letters, two rows: turn rows and columns as in 1 until the rows spell two words
//   3  colours hanging from the top: A shoots the next tile up the cursor's column; three or more
//      touching of a colour pop, and tiles left hanging fall out of the bottom and pop too
//   3.1  colours floating to the top: A takes the bottom tile of the cursor's column and the run of
//      its colour above it, X puts what is held back under the column; three or more pop
//   4  faces falling in from the top: A swaps the two tiles under the wide cursor; three or more in
//      a row or column pop and give back a little time
//   5  numbers: held A traces a chain of tiles; let go on a chain of two or more adding up to a
//      multiple of five and it scores and pops
//   6  letters: the same with chains of three or more spelling a word
// B pauses, and A while paused quits. Once won or lost B closes it. Closing a won box runs its win
// script, given by the script that made it or by the room it is placed in; losing or quitting runs
// nothing. Leaving the room closes it without a win.
// Times count updates, so the clock stops while the box is paused and while play is paused.

// tile size, the time bar's height and its gap above the box, and the score bar's width
const PB_TILE = 16;
const PB_TIMER_H = 5;
const PB_TIMER_GAP = 3;
const PB_SCORE_W = 5;
// the frames round the bars and the box, the bars themselves, and the empty cells behind the tiles
const PB_FRAME_SPRITE = "sSlSingleBdr2";
const PB_BAR_SPRITE = "s_timer_bg";
const PB_CELL_SPRITE = "s_pb_empty_box";
const PB_CIRCUIT_SPRITE = "s_pb_empty_circuit";
// the tiles of each set, and what a popped tile leaves behind
const PB_COLOUR_SPRITE = "s_pb_box_w";
const PB_GUY_SPRITE = "s_pb_box_guys";
const PB_LETTER_SPRITE = "s_pb_box_let";
const PB_NUMBER_SPRITE = "s_pb_box_num";
const PB_POP_SPRITE = "s_pb_box_w_pop";
const PB_POP_FADE = 0.04;
// the light that runs round a chain being traced, updates per step of its four frames
const PB_CHAIN_SPRITE = "s_pb_curs_bit_hl";
const PB_CHAIN_BLINK_UPDATES = 6;
// how far a tile moves each update, in tiles
const PB_TILE_SPEED = 0.25;
// the next tile to shoot sits this far below the cursor
const PB_NEXT_BELOW = 0.8;
// held tiles wait just under the bottom row, each this far above the last, and take this many
// updates to get there
const PB_HELD_STEP = 0.2;
const PB_HELD_UPDATES = 4;
// dropped held tiles start this far up from the bottom edge
const PB_DROP_START = 0.8;

// The colours of colour tiles, in the order more colours are added, and the letters' and numbers'
// own colours. A letter in place in a spelled box shows brighter, one out of place dimmer, and the
// answer shown on a loss in between.
const PB_COLOURS = ["#ff0000", "#00ff00", "#0000ff", "#ff8000", "#ffff00", "#aa00ff", "#00ffd5", "#ff00aa"];
const PB_LETTER_COLOURS = ["#f0c1c1", "#f0d5c1", "#f0eac1", "#e1f0c1", "#ccf0c1", "#c1f0cb", "#c1f0e0", "#c1ebf0", "#c1d6f0",
	"#c1c1f0", "#d6c1f0", "#ebc1f0", "#f0c1e0", "#f06463", "#f0a063", "#f0df63", "#c2f063", "#82f063", "#63f082", "#63f0c1",
	"#63dff0", "#63a0f0", "#6463f0", "#a463f0", "#e363f0", "#f063be"];
const PB_NUMBER_COLOURS = ["#f0c1c1", "#ecf0c1", "#c1f0ca", "#c1e3f0", "#d3c1f0", "#f06463", "#e3f063", "#63f07b", "#63c9f0", "#9663f0"];
const PB_GUY_COLOUR = "#ffffff";
const PB_IN_PLACE_SHADE = 255 / 240;
const PB_OUT_OF_PLACE_SHADE = 128 / 240;
const PB_ANSWER_SHADE = 200 / 240;

// the screen shade behind the box and over it while paused, and the paused question
const PB_SHADE_COLOUR = "#000000";
const PB_SHADE_ALPHA = 0.5;
const PB_QUIT_TEXT = "Quit?";
const PB_QUIT_FONT = "ftSmall";
const PB_QUIT_COLOUR = "#ffffff";
const PB_QUIT_ALPHA = 0.8;
// the frames' colour: won, lost, the last seconds flashing, and playing
const PB_FRAME_WIN_COLOUR = "#66ff66";
const PB_FRAME_LOSE_COLOUR = "#ff0000";
const PB_FRAME_FLASH_COLOUR = "#ff6666";
const PB_FRAME_COLOUR = "#ffffff";
// the time bar's colour above the first time, above the second, below it, and flashing; the flash
// starts below this many seconds
const PB_TIME_HIGH = 30;
const PB_TIME_LOW = 10;
const PB_TIME_HIGH_COLOUR = "#00cc00";
const PB_TIME_MID_COLOUR = "#cccc00";
const PB_TIME_LOW_COLOUR = "#ff0000";
const PB_TIME_FLASH_COLOUR = "#ff8888";
const PB_TIME_FLASH_BELOW = 5.5;
const PB_SCORE_COLOUR = "#00aaff";
// the empty cells' colour: lost, won and playing; on a loss each tile is left out one time in this many
const PB_CELL_LOSE_COLOUR = "#ff0000";
const PB_CELL_WIN_COLOUR = "#00ff00";
const PB_CELL_COLOUR = "#444444";
const PB_LOSE_FLICKER = 11;

// The note a chain leaves at the cursor: how far above, how long before it fades and how long the
// fade takes for a scoring chain and for a miss, how fast it floats up, and its colours.
const PB_NOTE_OFFY = -10;
const PB_NOTE_FADE_START = 30;
const PB_NOTE_HIT_FADE = 30;
const PB_NOTE_MISS_FADE = 10;
const PB_NOTE_RISE = -0.3;
const PB_NOTE_HIT_COLOUR = "#66ff66";
const PB_NOTE_MISS_COLOUR = "#ff3333";
// a scoring chain's tiles flash this many updates before popping
const PB_CHAIN_POP_WAIT = 10;
// number chains: they score when they add up to a multiple of this, that sum divided by it
const PB_SUM_STEP = 5;

// The words: one line for each length from three to eleven letters, each line that length's words
// in lower case run together, and every word known, in capitals between spaces.
const PB_WORDS_FILE = "assets/words_by_lcount_3_to_11.txt";
const PB_LOOKUP_FILE = "assets/word_lookup.txt";
const PB_SHORTEST_WORD = 3;
// letters drawn for word chains, as many of each as a word tile game has, and what each is worth
const PB_LETTER_BAG = "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ";
const PB_LETTER_VALUES = [1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 5, 1, 3, 1, 1, 3, 10, 1, 1, 1, 1, 4, 4, 8, 4, 10];
// the debug grid's font, its right edge in view pixels and its column and row steps
const PB_DEBUG_FONT = "ftTiny";
const PB_DEBUG_RIGHT = 319;
const PB_DEBUG_COL = 8;
const PB_DEBUG_ROW = 12;

// Each kind of box. Its tiles; its columns and rows, each a range picked from; how many kinds of
// tile, a range, or for colour sorting a most, fewer when the box is small; the lowest kind; the
// share of rows filled from the top at the start; holes; how many full sets of kinds are shuffled
// together so kinds come out evenly; the cursor's sprite, none to hide it, and where it starts; what
// the buttons do; what wins; seconds on the clock; which way tiles fall, whether they stick to each
// other and the top, whether falling out of the box pops them and whether a fall counts as a move;
// how many touching pop, after how many updates, and how they touch; whether tiles keep falling in
// from the top; seconds a popped tile gives back; the score to reach; and the cell sprite.
const PB_KINDS = {
	"0": { tiles: "colours", cols: [3, 6], rows: [2, 5], mostKinds: 8, holes: 1, cursor: null, start: "corner",
		rules: "slide", goal: "groups" },
	"1": { tiles: "colours", cols: [3, 6], rows: [2, 5], mostKinds: 6, cursor: "s_pb_curs_11", start: "middle",
		rules: "turn", goal: "groups" },
	"2": { tiles: "letters", cols: [3, 5], rows: [2, 2], kinds: [26, 26], cursor: "s_pb_curs_11", start: "middle",
		rules: "turn", goal: "phrase" },
	"3": { tiles: "colours", cols: [5, 7], rows: [8, 10], kinds: [3, 5], fill: 0.5, evenSets: 3,
		cursor: "s_pb_curs_btm_up", start: "bottom", rules: "shoot", goal: 40,
		fall: 1, sticky: true, fallPops: true, popSize: 3 },
	"3.1": { tiles: "colours", cols: [5, 7], rows: [8, 10], kinds: [6, 8], fill: 0.8, evenSets: 3,
		cursor: "s_pb_curs_btm_grab", start: "bottom", rules: "grab", goal: 40,
		fall: -1, popSize: 3, popWait: 30 },
	"4": { tiles: "guys", cols: [7, 9], rows: [7, 9], kinds: [8, 8], fill: 0, cursor: "s_pb_curs_12", start: "middle",
		wide: true, rules: "swap", goal: 100, time: 20,
		fall: 1, fallMoves: true, popSize: 3, popWait: 30, popLines: true, refill: true, popTime: 1.3 },
	"5": { tiles: "numbers", cols: [12, 14], rows: [8, 10], kinds: [10, 10], lowest: 1, cursor: "s_pb_curs_11",
		start: "middle", rules: "sum", goal: 100, fall: 1, refill: true },
	"6": { tiles: "letters", cols: [12, 14], rows: [8, 10], kinds: [26, 26], cursor: "s_pb_curs_11", start: "middle",
		rules: "word", goal: 50, fall: 1, refill: true }
};
// what a kind leaves out
const PB_KIND_DEFAULTS = { mostKinds: 0, kinds: null, lowest: 0, fill: 1, holes: 0, evenSets: 1, wide: false, time: 60,
	fall: 0, sticky: false, fallPops: false, fallMoves: false, popSize: 0, popWait: 0, popLines: false, refill: false, popTime: 0 };

class oPuzBox extends oBaseObject {
	constructor() {
		super();
		// which kind of box, and the script a won box runs as it closes
		this.box_type = 0;
		this.winScript = null;
		// the kind's settings, filled in once it starts, and whether it has started
		this.kind = null;
		this.ready = false;
		this.paused = false;
		this.won = false;
		this.lost = false;
		// seconds left and the score
		this.timeLeft = 0;
		this.score = 0;
		// the board, columns of rows, a tile or nothing in each cell
		this.board = [];
		this.cols = 0;
		this.rows = 0;
		// the cursor, a tile of its own, and how far it may go
		this.cursor = null;
		this.cursorMinI = 0;
		this.cursorMaxI = 0;
		this.cursorMinJ = 0;
		this.cursorMaxJ = 0;
		// the tile waiting to be shot, the tiles held, the chain being traced and the one let go
		this.next = null;
		this.held = [];
		this.chain = [];
		this.doneChain = [];
		// the shuffled kinds tiles are dealt from, the phrase to spell, and updates to the next refill
		this.bag = [];
		this.phrase = null;
		// the controls as they were, and the room it opened in
		this.conwasoff = false;
		this.room = null;
	}

	// Switches the player's controls off, then waits for the tile pictures, and the words when the box
	// needs them, before laying out the board.
	init() {
		super.init();
		this.conwasoff = game.controller.conOff;
		game.controller.conOff = true;
		this.room = game.curroom;
		this.kind = Object.assign({}, PB_KIND_DEFAULTS, PB_KINDS[String(this.box_type)] || PB_KINDS["0"]);
		const waits = [Sprites.ensure([PB_FRAME_SPRITE, PB_BAR_SPRITE, PB_CELL_SPRITE, PB_CIRCUIT_SPRITE, PB_COLOUR_SPRITE,
			PB_GUY_SPRITE, PB_LETTER_SPRITE, PB_NUMBER_SPRITE, PB_POP_SPRITE, PB_CHAIN_SPRITE, "s_pb_curs_11", "s_pb_curs_12",
			"s_pb_curs_btm_up", "s_pb_curs_btm_grab"])];
		// the words are read once, the first time a box needs them, and kept for every box after
		const words = this.kind.goal === "phrase" || this.kind.rules === "word";
		if (words && oPuzBox.words === null) {
			oPuzBox.words = Promise.all([game.readText(PB_WORDS_FILE), game.readText(PB_LOOKUP_FILE)]).then(([byLength, lookup]) => ({
				byLength: byLength.split("\n"),
				known: new Set(lookup.split(/\s+/).filter((w) => w !== ""))
			}));
		}
		if (words) waits.push(oPuzBox.words.then((w) => { this.words = w; }));
		Promise.all(waits).then(() => {
			if (!this.destroyed) this.setup();
		}, (e) => {
			console.warn("the puzzle box could not load what it needs", e);
			if (!this.destroyed) this.destroy();
		});
	}

	// Lays out the board for its kind: its size, the kinds of tile dealt, the starting tiles from the
	// top down and any holes among them, the cursor and the clock.
	setup() {
		const k = this.kind;
		this.cols = rng.irandomRange(k.cols[0], k.cols[1]);
		this.rows = rng.irandomRange(k.rows[0], k.rows[1]);
		let kinds;
		if (k.kinds !== null) {
			kinds = rng.irandomRange(k.kinds[0], k.kinds[1]);
		} else {
			// enough cells left for groups of three on a small box
			const most = Math.min(Math.ceil(this.cols * this.rows / 3), k.mostKinds);
			kinds = rng.irandomRange(Math.min(3, most), most);
		}
		this.lowest = k.lowest;
		this.highest = kinds - 1;

		const fillRows = Math.floor(this.rows * k.fill);
		const deal = [];
		if (k.goal === "phrase") {
			// two words as wide as the box, picked whole from their line
			const line = this.words.byLength[this.cols - PB_SHORTEST_WORD];
			const count = Math.floor(line.length / this.cols);
			this.phrase = "";
			for (let w = 0; w < this.rows; w++) {
				const at = rng.irandom(count - 1) * this.cols;
				this.phrase += line.substring(at, at + this.cols);
			}
			for (const ch of this.phrase) deal.push(ch.charCodeAt(0) - 97);
		} else {
			for (let n = 0; n < this.cols * fillRows - k.holes; n++) deal.push(this.newKind());
			for (let n = 0; n < k.holes; n++) deal.push(-1);
		}
		this.board = [];
		for (let i = 0; i < this.cols; i++) this.board.push(new Array(this.rows).fill(null));
		for (let j = 0; j < fillRows; j++) {
			for (let i = 0; i < this.cols; i++) {
				const type = deal.splice(rng.irandom(deal.length - 1), 1)[0];
				if (type >= 0) this.board[i][j] = this.newTile(type, i, j);
			}
		}

		this.cursorMinI = 0;
		this.cursorMaxI = this.cols - (k.wide ? 2 : 1);
		this.cursorMinJ = k.start === "bottom" ? this.rows - 1 : 0;
		this.cursorMaxJ = this.rows - 1;
		this.cursor = this.newTile(0, 0, 0);
		this.cursor.color = NO_TINT;
		if (k.start === "middle") this.cursor.i = Math.floor(this.cols / 2);
		if (k.start === "middle") this.cursor.j = Math.floor(this.rows / 2);
		if (k.start === "bottom") {
			this.cursor.i = Math.floor(this.cols / 2);
			this.cursor.j = this.rows - 1;
		}
		this.cursor.mi = this.cursor.i;
		this.cursor.mj = this.cursor.j;
		if (k.rules === "shoot") this.next = this.newTile(this.newKind(), this.cursor.i, this.cursor.j);

		this.timeLeft = k.time;
		this.ready = true;
	}

	// The next kind of tile: from the letter bag for word chains, else dealt from shuffled full sets
	// of kinds so they come out evenly.
	newKind() {
		if (this.kind.rules === "word") return PB_LETTER_BAG.charCodeAt(rng.irandom(PB_LETTER_BAG.length - 1)) - 65;
		if (this.bag.length === 0) {
			const range = this.highest + 1 - this.lowest;
			for (let n = 0; n < range * this.kind.evenSets; n++) this.bag.push(this.lowest + n % range);
		}
		return this.bag.splice(rng.irandom(this.bag.length - 1), 1)[0];
	}

	// A tile of a kind standing still in a cell, in its set's sprite and colour. A tile moves on its
	// own from where it shows towards its cell; it is active from being moved by the player or a fall
	// until the update after it lands; and while flashing it counts down to popping.
	newTile(type, i, j) {
		const sets = {
			colours: [PB_COLOUR_SPRITE, PB_COLOURS[type], 0],
			guys: [PB_GUY_SPRITE, PB_GUY_COLOUR, type],
			letters: [PB_LETTER_SPRITE, PB_LETTER_COLOURS[type], type],
			numbers: [PB_NUMBER_SPRITE, PB_NUMBER_COLOURS[type], type]
		};
		const look = sets[this.kind.tiles];
		return {
			type: type, i: i, j: j, mi: i, mj: j, spd: PB_TILE_SPEED,
			moving: false, landed: false, active: false,
			sprite: look[0], color: look[1], frame: look[2], shade: 1,
			popWait: 0, popScore: 0, onPop: null,
			checked: false, win: false, set: -1, stuck: false
		};
	}

	// A tile into a cell, moving there from where it shows; nothing into a cell empties it.
	moveTile(t, i, j) {
		this.board[i][j] = t;
		if (t === null) return;
		t.i = i;
		t.j = j;
		t.moving = t.i !== t.mi || t.j !== t.mj;
	}

	// The tiles next to one that stand still, left, up, right and down, all of them, only across or
	// only up and down, and only of its own kind when asked.
	neighbours(t, sameOnly, ways) {
		const out = [];
		for (const [di, dj] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) {
			if ((ways === "across" && dj !== 0) || (ways === "down" && di !== 0)) continue;
			const i = t.i + di;
			const j = t.j + dj;
			if (i < 0 || i >= this.cols || j < 0 || j >= this.rows) continue;
			const n = this.board[i][j];
			if (n !== null && !n.moving && (!sameOnly || n.type === t.type)) out.push(n);
		}
		return out;
	}

	// Pops a tile after a number of updates of flashing, or now when none: its cell empties, its pop
	// picture is left in its colour, the score goes up and anything it does on popping is done.
	startPop(t, wait, score, onPop) {
		t.popWait = wait;
		t.popScore = score;
		t.onPop = onPop;
		if (wait > 0) return;
		if (this.board[t.i][t.j] === t) this.board[t.i][t.j] = null;
		const fx = game.createObject(oFxOneShot, {
			x: this.x + t.i * PB_TILE, y: this.y + PB_TIMER_H + PB_TIMER_GAP + t.j * PB_TILE,
			spi: PB_POP_SPRITE, col: t.color, aspd: PB_POP_FADE
		}, this.mylayer);
		this.score += score;
		if (onPop) onPop(fx);
	}

	update() {
		// it opened in another room
		if (game.curroom !== this.room) {
			this.destroy();
			return;
		}
		if (!this.ready) return;
		const con = game.uiController;
		const k = this.kind;
		const cols = this.cols;
		const rows = this.rows;
		const board = this.board;
		const cur = this.cursor;

		// over the screen's middle wherever the view is
		const lyr = game.popupLayer;
		this.x = game.cam.scrox + Math.floor((lyr.wd - (PB_TILE * cols + 6)) / 2);
		this.y = game.cam.scroy + Math.floor((lyr.ht - (PB_TILE * rows + 6 + PB_TIMER_H + PB_TIMER_GAP)) / 2);

		// closing once over, the win's script after; pausing and quitting while playing
		if (this.won || this.lost) {
			if (con.iBtnB) {
				this.destroy();
				if (this.won && this.winScript !== null) Hooks.runScript(this.winScript, game.guy, undefined, undefined, undefined, this);
			}
			return;
		}
		if (this.paused && con.iBtnA) {
			this.destroy();
			return;
		}
		if (con.iBtnB) this.paused = !this.paused;
		if (this.paused) return;

		// Won or lost. Colour groups win when each colour is one touching group: the first tile found
		// of a colour starts its group and spreads through every tile of that colour touching it, so
		// any tile of that colour reached later is apart from it. A moving tile counts as apart. Tiles
		// in their colour's only group are marked.
		if (k.goal === "groups") {
			const groups = {};
			for (const col of board) for (const t of col) if (t !== null) { t.checked = false; t.win = false; }
			let all = true;
			for (let j = 0; j < rows; j++) {
				for (let i = 0; i < cols; i++) {
					const t = board[i][j];
					if (t === null || t.checked) continue;
					t.checked = true;
					if (!t.moving && !groups[t.type]) {
						groups[t.type] = 1;
						t.win = true;
						const spread = [t];
						while (spread.length > 0) {
							for (const n of this.neighbours(spread.pop(), true, "all")) {
								if (n.checked) continue;
								n.checked = true;
								n.win = true;
								spread.push(n);
							}
						}
					} else {
						groups[t.type] = (groups[t.type] || 0) + 1;
						all = false;
					}
				}
			}
			for (const col of board) for (const t of col) if (t !== null && !t.moving) t.frame = groups[t.type] === 1 ? 1 : 0;
			this.won = all;
		} else if (k.goal === "phrase") {
			// each tile against the phrase's letter for its cell, in reading order
			let matches = 0;
			for (let j = 0; j < rows; j++) {
				for (let i = 0; i < cols; i++) {
					const t = board[i][j];
					if (t === null || t.moving) continue;
					const match = t.type === this.phrase.charCodeAt(j * cols + i) - 97;
					t.shade = match ? PB_IN_PLACE_SHADE : PB_OUT_OF_PLACE_SHADE;
					if (match) matches++;
				}
			}
			this.won = matches === this.phrase.length;
		} else {
			this.won = this.score >= k.goal;
		}
		this.lost = this.timeLeft < 0;
		this.timeLeft -= 1 / GAME_FPS;
		// a lost spelling shows its answer
		if (this.lost && k.goal === "phrase") {
			for (let j = 0; j < rows; j++) {
				for (let i = 0; i < cols; i++) {
					const t = board[i][j];
					if (t === null) continue;
					t.type = this.phrase.charCodeAt(j * cols + i) - 97;
					t.frame = t.type;
					t.color = PB_LETTER_COLOURS[t.type];
					t.shade = PB_ANSWER_SHADE;
				}
			}
		}

		// tiles fall in at random open top cells, one each update
		if (k.refill) {
			const open = [];
			for (let i = 0; i < cols; i++) if (board[i][0] === null) open.push(i);
			if (open.length > 0) {
				const i = open[rng.irandom(open.length - 1)];
				const t = this.newTile(this.newKind(), i, 0);
				// it slides in from above the box, starting to move with the next update
				t.mj = -1;
				board[i][0] = t;
			}
		}

		// Held A traces a chain: each tile the cursor comes to joins it, and coming back onto it puts
		// the cursor back on its last tile. Letting go keeps it to be scored.
		if (k.rules === "sum" || k.rules === "word") {
			if (!con.iBtnAd) {
				if (this.chain.length > 0) {
					this.doneChain = this.chain;
					this.chain = [];
				}
			} else {
				const t = board[cur.i][cur.j];
				if (t !== null) {
					if (this.chain.includes(t)) {
						const last = this.chain[this.chain.length - 1];
						cur.i = last.i;
						cur.j = last.j;
					} else {
						this.chain.push(t);
					}
				}
			}
		}

		// The arrows pressed, two at once going corner ways. They move the cursor, except in the
		// sliding box, which has none, and while A is held in the turning box.
		const di = (con.iRightP ? 1 : 0) - (con.iLeftP ? 1 : 0);
		const dj = (con.iDownP ? 1 : 0) - (con.iUpP ? 1 : 0);
		if (k.rules !== "slide" && !(k.rules === "turn" && con.iBtnAd)) {
			cur.i = clamp(cur.i + di, this.cursorMinI, this.cursorMaxI);
			cur.j = clamp(cur.j + dj, this.cursorMinJ, this.cursorMaxJ);
		}

		if (k.rules === "slide") {
			// Every tile with a free cell the arrow's way moves into it, the tile at the end of a line
			// moving first, but into a cell only just left only when it was free before.
			const pushed = new Set();
			const emptied = new Set();
			const push = (i, j) => {
				const ti = i + di;
				const tj = j + dj;
				if (ti < 0 || ti >= cols || tj < 0 || tj >= rows) return;
				const t = board[i][j];
				if (t === null || pushed.has(t)) return;
				pushed.add(t);
				if (board[ti][tj] !== null) push(ti, tj);
				if (board[ti][tj] === null && !emptied.has(ti + "," + tj)) {
					this.moveTile(t, ti, tj);
					board[i][j] = null;
					emptied.add(i + "," + j);
				}
			};
			for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) push(i, j);
		} else if (k.rules === "turn" && con.iBtnAd) {
			// The cursor's row or column turns round by one, the tile pushed off one end coming in at
			// the other from just outside the box.
			if (di !== 0) {
				const end = di > 0 ? cols - 1 : 0;
				const t = board[end][cur.j];
				for (let i = end; i !== cols - 1 - end; i -= di) this.moveTile(board[i - di][cur.j], i, cur.j);
				t.mi = di > 0 ? -1 : cols;
				this.moveTile(t, cols - 1 - end, cur.j);
			}
			if (dj !== 0) {
				const end = dj > 0 ? rows - 1 : 0;
				const t = board[cur.i][end];
				for (let j = end; j !== rows - 1 - end; j -= dj) this.moveTile(board[cur.i][j - dj], cur.i, j);
				t.mj = dj > 0 ? -1 : rows;
				this.moveTile(t, cur.i, rows - 1 - end);
			}
		} else if (k.rules === "shoot" && con.iBtnA) {
			// the next tile goes up the cursor's column to just under the lowest tile, if there is room
			let j = rows - 1;
			while (j >= 0 && board[cur.i][j] === null) j--;
			if (j + 1 < rows) {
				this.next.active = true;
				this.moveTile(this.next, cur.i, j + 1);
				this.next = this.newTile(this.newKind(), cur.i, j + 1);
			}
		} else if (k.rules === "grab") {
			// A takes the lowest tile of the column, then every tile above of its kind until another
			// kind, gaps and all. Pressed again while holding, it takes more, of any kind. Flashing
			// tiles are about to pop and stop the taking.
			if (con.iBtnA) {
				let kindTaken = -1;
				for (let j = rows - 1; j >= 0; j--) {
					const t = board[cur.i][j];
					if (t === null) continue;
					if (t.popWait > 0 || (kindTaken !== -1 && kindTaken !== t.type)) break;
					this.held.push(t);
					board[cur.i][j] = null;
					t.mi = cur.i;
					const to = rows - PB_HELD_STEP - this.held.length * PB_HELD_STEP;
					t.spd = (to - t.j) / PB_HELD_UPDATES;
					t.j = to;
					kindTaken = t.type;
				}
			}
			// X puts them back under the column's lowest tile, last taken nearest it, when they fit
			if (con.iBtnX) {
				let j = rows - 1;
				while (j >= 0 && board[cur.i][j] === null) j--;
				const n = this.held.length;
				if (rows - j - 1 >= n) {
					for (let h = n - 1; h >= 0; h--) {
						const t = this.held[h];
						t.mj = rows - PB_DROP_START + (n - 1 - h);
						t.active = true;
						this.moveTile(t, cur.i, ++j);
					}
					this.held.length = 0;
				}
			}
		} else if (k.rules === "swap" && con.iBtnA) {
			// the two cells under the cursor swap, unless either is flashing to pop
			const l = board[cur.i][cur.j];
			const r = board[cur.i + 1][cur.j];
			if (!((l !== null && l.popWait > 0) || (r !== null && r.popWait > 0))) {
				if (l !== null) l.active = true;
				if (r !== null) r.active = true;
				this.moveTile(l, cur.i + 1, cur.j);
				this.moveTile(r, cur.i, cur.j);
			}
		}

		// Touching tiles of a kind make groups; a group pops when big enough and holding a tile that
		// was just moved. Faces only count lines across, then lines up and down.
		if (k.popSize > 0) {
			for (const ways of k.popLines ? ["across", "down"] : ["all"]) {
				const sizes = [];
				for (const col of board) for (const t of col) if (t !== null) t.set = -1;
				const join = (t, set) => {
					t.set = set;
					sizes[set]++;
					for (const n of this.neighbours(t, true, ways)) if (n.set === -1) join(n, set);
				};
				for (let j = 0; j < rows; j++) {
					for (let i = 0; i < cols; i++) {
						const t = board[i][j];
						if (t === null || t.moving || t.set !== -1) continue;
						const near = this.neighbours(t, true, ways).find((n) => n.set >= 0);
						if (near !== undefined) {
							join(t, near.set);
						} else if (t.active) {
							sizes.push(0);
							join(t, sizes.length - 1);
						}
					}
				}
				const onPop = k.popTime > 0 ? () => { this.timeLeft = Math.min(this.timeLeft + k.popTime, k.time); } : null;
				for (let j = 0; j < rows; j++) {
					for (let i = 0; i < cols; i++) {
						const t = board[i][j];
						if (t !== null && t.set >= 0 && sizes[t.set] >= k.popSize) this.startPop(t, k.popWait, 1, onPop);
					}
				}
			}
		}

		// A chain let go is scored: numbers adding up to a multiple of five, two or more of them, or
		// letters spelling a known word, three or more. It leaves a note either way.
		const chain = this.doneChain;
		if ((k.rules === "sum" && chain.length > 1) || (k.rules === "word" && chain.length > 2)) {
			let text = "";
			let points = -1;
			let bonus = 0;
			if (k.rules === "sum") {
				let sum = 0;
				for (const t of chain) sum += t.type;
				text = String(sum);
				if (sum % PB_SUM_STEP === 0) {
					points = Math.floor(sum / PB_SUM_STEP);
					bonus = Math.max(chain.length - 2, 0);
				}
			} else {
				for (const t of chain) text += String.fromCharCode(t.type + 65);
				if (this.words.known.has(text)) {
					points = 0;
					for (const t of chain) points += PB_LETTER_VALUES[t.type];
					bonus = Math.ceil(points * (chain.length / 3 - 1));
				}
			}
			const at = { x: this.x + cur.i * PB_TILE, y: this.y + PB_TIMER_H + PB_TIMER_GAP + cur.j * PB_TILE };
			if (points >= 0) {
				Hooks.popMessage(at, text + ": " + points + (bonus > 0 ? " +" + bonus : ""), 0, PB_NOTE_OFFY, {
					fadestart: PB_NOTE_FADE_START, fadetime: PB_NOTE_HIT_FADE, floatspdx: 0, floatspdy: PB_NOTE_RISE,
					drawbg: false, textcolor: PB_NOTE_HIT_COLOUR
				});
				this.score += points + bonus;
				this.timeLeft = Math.min(this.timeLeft + points + bonus, k.time);
				for (const t of chain) this.startPop(t, PB_CHAIN_POP_WAIT, 0, null);
			} else {
				Hooks.popMessage(at, text, 0, PB_NOTE_OFFY, {
					fadestart: PB_NOTE_FADE_START, fadetime: PB_NOTE_MISS_FADE, floatspdx: 0, floatspdy: PB_NOTE_RISE,
					drawbg: false, textcolor: PB_NOTE_MISS_COLOUR
				});
			}
		}
		this.doneChain = [];

		// Tiles, held tiles and the cursor move towards their cells. One that lands is no longer
		// active the update after, and flashing ones count down to popping.
		for (const h of this.held) h.i = cur.i;
		const movers = [];
		for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (board[i][j] !== null) movers.push(board[i][j]);
		movers.push(...this.held, cur);
		for (const t of movers) {
			const mi = t.i - t.mi;
			if (mi !== 0) t.mi += Math.min(Math.abs(mi), t.spd) * Math.sign(mi);
			const mj = t.j - t.mj;
			if (mj !== 0) t.mj += Math.min(Math.abs(mj), t.spd) * Math.sign(mj);
			const was = t.moving;
			t.moving = t.i !== t.mi || t.j !== t.mj;
			if (t.landed && !t.moving) {
				t.active = false;
				t.spd = PB_TILE_SPEED;
			}
			t.landed = was && !t.moving;
			if (t.popWait > 0 && --t.popWait === 0) this.startPop(t, 0, t.popScore, t.onPop);
		}
		if (this.next !== null) {
			this.next.mi = cur.mi;
			this.next.mj = cur.mj + PB_NEXT_BELOW;
		}

		// Falling: a tile with a free cell below moves into it, the bottom of a column first. Sticky
		// tiles hold on: those at the top, and every tile touching them through a run of others.
		// Falling out of the box pops a tile when the box says so, its pop carrying on at half speed.
		if (k.fall !== 0) {
			for (const col of board) for (const t of col) if (t !== null) { t.checked = false; t.stuck = false; }
			if (k.sticky) {
				const hold = (t) => {
					if (t.stuck) return;
					t.stuck = true;
					for (const n of this.neighbours(t, false, "all")) hold(n);
				};
				for (const col of board) {
					for (const t of col) {
						if (t === null || t.moving) continue;
						const above = t.j - k.fall;
						if (above < 0 || above >= rows) hold(t);
					}
				}
			}
			const fall = (t) => {
				if (t === null || t.moving || t.checked || t.stuck) return;
				t.checked = true;
				const tj = t.j + k.fall;
				if (tj < 0 || tj >= rows) {
					if (k.fallPops) {
						this.startPop(t, 0, 1, (fx) => {
							fx.yspd = PB_TILE_SPEED * 0.5 * PB_TILE * k.fall;
						});
					}
					return;
				}
				if (board[t.i][tj] !== null) fall(board[t.i][tj]);
				if (board[t.i][tj] === null) {
					board[t.i][t.j] = null;
					this.moveTile(t, t.i, tj);
					t.active = k.fallMoves;
				}
			};
			for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) fall(board[i][j]);
		}
	}

	draw() {
		if (!this.ready) return;
		const k = this.kind;
		const cols = this.cols;
		const rows = this.rows;
		const lyr = game.popupLayer;
		const sx = game.cam.scrox;
		const sy = game.cam.scroy;
		const top = this.y + PB_TIMER_H + PB_TIMER_GAP;
		const boxw = PB_TILE * cols + 6;
		const boxh = PB_TILE * rows + 6;
		const half = Math.floor(this.timeLeft * 2) / 2;
		const flash = half < PB_TIME_FLASH_BELOW && (half * 2) % 2 === 0;
		const over = this.won || this.lost;

		// the screen shaded, then the frames round the time bar, the score bar and the box
		Draw.color = PB_SHADE_COLOUR;
		Draw.alpha = PB_SHADE_ALPHA;
		Draw.rectangle(sx, sy, sx + lyr.wd, sy + lyr.ht, false);
		Draw.alpha = 1;
		Draw.color = this.won ? PB_FRAME_WIN_COLOUR : (this.lost ? PB_FRAME_LOSE_COLOUR : (flash ? PB_FRAME_FLASH_COLOUR : PB_FRAME_COLOUR));
		const barw = boxw - 6;
		Draw.bgSquare(this.x, this.y - 3, barw, PB_TIMER_H + PB_TIMER_GAP + 4, PB_FRAME_SPRITE);
		const scoreh = boxh - 6;
		const scorein = scoreh - 4;
		const scoring = typeof k.goal === "number";
		if (scoring) Draw.bgSquare(this.x - 6 + boxw, top, PB_SCORE_W + 6, scoreh, PB_FRAME_SPRITE);
		Draw.bgSquare(this.x - 3, top - 3, boxw, boxh, PB_FRAME_SPRITE);

		// the time bar, and the score bar filling up from the bottom
		Draw.color = this.timeLeft > PB_TIME_HIGH ? PB_TIME_HIGH_COLOUR : (this.timeLeft > PB_TIME_LOW ? PB_TIME_MID_COLOUR : PB_TIME_LOW_COLOUR);
		if (!this.won && flash) Draw.color = PB_TIME_FLASH_COLOUR;
		if (this.timeLeft > 0) Draw.bgSquare(this.x + 2, this.y - 1, Math.ceil(3 + (barw - 7) * (half / k.time)), PB_TIMER_H, PB_BAR_SPRITE);
		if (scoring) {
			Draw.color = PB_SCORE_COLOUR;
			const filled = Math.min(Math.ceil(scorein * (this.score / k.goal)), scorein);
			Draw.bgSquare(this.x - 2 + boxw, top + 2 + scorein - filled, PB_SCORE_W, filled, PB_BAR_SPRITE);
		}

		// the empty cells, then the tiles, left out now and then once lost and blinking while they
		// wait to pop; a spelled box's letters lighter or darker by whether they are in place
		const cell = k.rules === "slide" ? PB_CIRCUIT_SPRITE : PB_CELL_SPRITE;
		const cellColour = this.lost ? PB_CELL_LOSE_COLOUR : (this.won ? PB_CELL_WIN_COLOUR : PB_CELL_COLOUR);
		for (let j = 0; j < rows; j++) {
			for (let i = 0; i < cols; i++) Draw.spriteExt(cell, 0, this.x + i * PB_TILE, top + j * PB_TILE, 1, 1, 0, cellColour, 1);
		}
		const tiles = [];
		for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (this.board[i][j] !== null) tiles.push(this.board[i][j]);
		if (!over) tiles.push(...this.held);
		for (const t of tiles) {
			if (this.lost && Math.floor(Math.random() * PB_LOSE_FLICKER) === 0) continue;
			if (t.popWait > 0 && Math.floor(t.popWait / 3) % 2 !== 0) continue;
			let colour = t.color;
			if (t.shade !== 1) {
				const v = parseInt(t.color.substring(1), 16);
				const ch = (shift) => Math.min(255, Math.round(((v >> shift) & 255) * t.shade)).toString(16).padStart(2, "0");
				colour = "#" + ch(16) + ch(8) + ch(0);
			}
			Draw.spriteExt(t.sprite, t.frame, this.x + t.mi * PB_TILE, top + t.mj * PB_TILE, 1, 1, 0, colour, 1);
		}

		// the chain being traced, the next tile to shoot and the cursor, while playing
		if (!over) {
			this.chain.forEach((t, n) => {
				Draw.spriteExt(PB_CHAIN_SPRITE, Math.floor(game.frames / PB_CHAIN_BLINK_UPDATES) + n,
					this.x + t.i * PB_TILE, top + t.j * PB_TILE, 1, 1, 0, NO_TINT, 1);
			});
			if (k.cursor !== null) {
				const n = this.next;
				if (n !== null) Draw.spriteExt(n.sprite, n.frame, this.x + n.mi * PB_TILE, top + n.mj * PB_TILE, 1, 1, 0, n.color, 1);
				Draw.spriteExt(k.cursor, 0, this.x + this.cursor.mi * PB_TILE, top + this.cursor.mj * PB_TILE, 1, 1, 0, NO_TINT, 1);
			}
		}

		// with the debug overlay on, the board as kinds at the view's top right, moving tiles as x and
		// tiles holding on with a dot after, then the time, the score and the chain being traced
		if (game.drawStats) {
			Draw.setFont(PB_DEBUG_FONT);
			Draw.color = NO_TINT;
			const dx = sx + PB_DEBUG_RIGHT - PB_DEBUG_COL * cols;
			for (let j = 0; j < rows; j++) {
				for (let i = 0; i < cols; i++) {
					const t = this.board[i][j];
					const mark = t === null ? "_" : (t.moving ? "x" : String(t.type)) + (t.stuck ? "." : "");
					Draw.text(dx + i * PB_DEBUG_COL, sy + j * PB_DEBUG_ROW, mark);
				}
			}
			const lines = [half.toFixed(1) + "/" + k.time];
			if (scoring) lines.push(this.score + "/" + k.goal);
			if (this.chain.length > 0) lines.push(this.chain.map((t) => t.type).join(","));
			lines.forEach((line, n) => Draw.text(dx - 22, sy + (rows + n) * PB_DEBUG_ROW + 2, line));
		}

		// paused: the screen shaded again and the question in its middle
		if (this.paused) {
			Draw.color = PB_SHADE_COLOUR;
			Draw.alpha = PB_SHADE_ALPHA;
			Draw.rectangle(sx, sy, sx + lyr.wd, sy + lyr.ht, false);
			Draw.setFont(PB_QUIT_FONT);
			Draw.halign = "center";
			Draw.color = PB_QUIT_COLOUR;
			Draw.alpha = PB_QUIT_ALPHA;
			Draw.text(sx + lyr.wd / 2, sy + lyr.ht / 2, PB_QUIT_TEXT);
			Draw.halign = "left";
		}
		Draw.color = NO_TINT;
		Draw.alpha = 1;
	}

	// gives the player's controls back as they were before it opened
	destroy() {
		if (this.destroyed) return;
		super.destroy();
		game.controller.conOff = this.conwasoff;
	}
}
// the word lists, read the first time a box needs them
oPuzBox.words = null;
