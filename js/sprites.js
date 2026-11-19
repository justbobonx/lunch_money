// Sprite records: size, origin, collision mask, animation speed and sheet frames.
// The player sheets are real conversions. Level sprites are not converted yet, so
// their sizes come from the guess table below, worked out from how TestDev places them.

const SPRITE_SHEETS = ["sprites/guy_sprites.json", "sprites/tem_sprites.json"];

// size used for any level sprite that is neither converted nor guessed
const UNKNOWN_SPRITE_SIZE = 16;

// Guessed level sprites until the real TestDev sprite sheet arrives.
// Every size here is a guess from placements in the room, and the mask is the whole image.
// The ones marked to turn with the angle are the ones TestDev places at an angle as slopes.
const SPRITE_GUESSES = {
	sFloor:         { w: 32, h: 32, ox: 0, oy: 0, rotates: true },
	sFloorMid:      { w: 8,  h: 8,  ox: 0, oy: 0, rotates: true },
	sFloorThru:     { w: 32, h: 4,  ox: 0, oy: 0, rotates: true },
	sBlankGr:       { w: 2,  h: 2,  ox: 0, oy: 0, rotates: true },
	sBlankOr:       { w: 2,  h: 2,  ox: 0, oy: 0 },
	sBlankRd:       { w: 2,  h: 2,  ox: 0, oy: 0 },
	sSolidWh:       { w: 2,  h: 2,  ox: 0, oy: 0 },
	sSolidWhRotate: { w: 2,  h: 2,  ox: 0, oy: 0, rotates: true },
	dk_block_w:     { w: 16, h: 16, ox: 0, oy: 0 },
	slime:          { w: 16, h: 16, ox: 0, oy: 0 },
	sWallsh:        { w: 4,  h: 8,  ox: 0, oy: 0 },
	glass:          { w: 4,  h: 12, ox: 0, oy: 0 },
	glassv:         { w: 12, h: 16, ox: 0, oy: 0 },
	sLadder:        { w: 6,  h: 15, ox: 3, oy: 0 },
	sBox1:          { w: 14, h: 14, ox: 0, oy: 0, rotates: true },
	s_box_thru:     { w: 14, h: 14, ox: 0, oy: 0 },
	s_terrace_thru: { w: 16, h: 16, ox: 0, oy: 0 },
	sCrate:         { w: 7,  h: 7,  ox: 0, oy: 0 },
	sCrate2:        { w: 7,  h: 7,  ox: 0, oy: 0 },
	sCrateBg:       { w: 8,  h: 8,  ox: 0, oy: 0 },
	sCrateMetal:    { w: 5,  h: 5,  ox: 0, oy: 0 },
	sPlatform:      { w: 24, h: 4,  ox: 0, oy: 0 },
	sPlank:         { w: 24, h: 3,  ox: 0, oy: 0, rotates: true },
	sGrWall:        { w: 6,  h: 38, ox: 0, oy: 0 },
	sGrWall2:       { w: 6,  h: 38, ox: 0, oy: 0 },
	sGrTechno:      { w: 16, h: 16, ox: 0, oy: 0 },
	sGrTechnoVoid:  { w: 16, h: 16, ox: 0, oy: 0 },
	sOneWayDoor:    { w: 4,  h: 16, ox: 0, oy: 0 },
	sPit:           { w: 16, h: 8,  ox: 0, oy: 0 },
	sWater:         { w: 16, h: 16, ox: 0, oy: 0 },
	sWaterFg:       { w: 32, h: 32, ox: 0, oy: 0 },
	rope:           { w: 3,  h: 18, ox: 1, oy: 0 },
	sBouncer:       { w: 16, h: 8,  ox: 0, oy: 0 },
	sChest:         { w: 12, h: 10, ox: 0, oy: 0 },
	sChest_2:       { w: 12, h: 10, ox: 0, oy: 0 },
	sChest_egg:     { w: 12, h: 10, ox: 0, oy: 0 },
	sKey:           { w: 6,  h: 4,  ox: 0, oy: 0 },
	sDoor:          { w: 12, h: 20, ox: 0, oy: 0 },
	sDoorway:       { w: 16, h: 24, ox: 0, oy: 0 },
	sSpot:          { w: 8,  h: 8,  ox: 0, oy: 0 },
	sBird:          { w: 8,  h: 8,  ox: 4, oy: 8 },
	sDoggie_stand:  { w: 13, h: 13, ox: 6, oy: 12 },
	sBall:          { w: 6,  h: 6,  ox: 3, oy: 3 },
	sAniSpark:      { w: 8,  h: 8,  ox: 4, oy: 4 },
	sJgHeart:       { w: 16, h: 16, ox: 0, oy: 0 },
	sJgLogShooter:  { w: 16, h: 16, ox: 0, oy: 0 },
	sGameBoxV:      { w: 16, h: 24, ox: 0, oy: 0 },
	s_tank:         { w: 32, h: 24, ox: 0, oy: 0 },
	bike:           { w: 16, h: 12, ox: 0, oy: 0 },
	s__ar_bow:      { w: 8,  h: 8,  ox: 4, oy: 8 },
	s_gun:          { w: 8,  h: 4,  ox: 4, oy: 4 },
	s_magnet:       { w: 8,  h: 8,  ox: 4, oy: 8 },
	s_rocketpack:   { w: 8,  h: 8,  ox: 4, oy: 8 },
	s_sword:        { w: 8,  h: 8,  ox: 4, oy: 8 },
	s_torch:        { w: 4,  h: 8,  ox: 2, oy: 8 },
	s_flamer:       { w: 8,  h: 8,  ox: 4, oy: 8 },
	s_ship_bottle_2:{ w: 8,  h: 8,  ox: 0, oy: 0 },
	_guy_placer:    { w: 13, h: 13, ox: 6, oy: 12 }
};

// Holds every sprite record by name and the loaded sheet images.
const Sprites = {
	records: {},

	// Loads the converted sheets, then fills in the guessed level sprites.
	// The reader is handed in so the same code runs in the page and in a test harness.
	async load(readJson, loadImage) {
		for (const path of SPRITE_SHEETS) {
			const sheet = await readJson(path);
			const dir = path.substring(0, path.lastIndexOf("/") + 1);
			const image = await loadImage(dir + sheet.image_file);
			for (const name of Object.keys(sheet.sprites)) {
				const s = sheet.sprites[name];
				this.records[name] = {
					name: name, w: s.w, h: s.h, ox: s.ox, oy: s.oy,
					mask: s.mask, imageSpeed: s.image_speed, frames: s.frames,
					image: image, guessed: false
				};
			}
		}
		for (const name of Object.keys(SPRITE_GUESSES)) {
			if (this.records[name]) continue;
			const g = SPRITE_GUESSES[name];
			this.records[name] = {
				name: name, w: g.w, h: g.h, ox: g.ox, oy: g.oy,
				mask: { kind: "rect", w: g.w, h: g.h, x: -g.ox, y: -g.oy, rotates: !!g.rotates },
				imageSpeed: 1, frames: null, image: null, guessed: true
			};
		}
		// the no mask sprite exists so carried things stop colliding
		this.records.sNoMask = { name: "sNoMask", w: 1, h: 1, ox: 0, oy: 0, mask: null, imageSpeed: 0, frames: null, image: null, guessed: false };
	},

	exists(name) {
		return name !== null && name !== undefined && this.records[name] !== undefined;
	},

	// Every level sprite gets a record, unknown names get the default square so they still collide.
	get(name) {
		if (name === null || name === undefined) return null;
		let s = this.records[name];
		if (!s) {
			const n = UNKNOWN_SPRITE_SIZE;
			s = this.records[name] = {
				name: name, w: n, h: n, ox: 0, oy: 0,
				mask: { kind: "rect", w: n, h: n, x: 0, y: 0 },
				imageSpeed: 1, frames: null, image: null, guessed: true, unknown: true
			};
		}
		return s;
	},

	// number of animation frames, one for sprites without a sheet
	frameCount(name) {
		const s = this.records[name];
		return (s && s.frames) ? s.frames.length : 1;
	}
};
