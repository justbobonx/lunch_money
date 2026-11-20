// The world: rooms, their layers and layer groups (areas), every object and room picture,
// turning layers, areas and objects on and off, moving between rooms, and the order of each frame.
// A port of the original's player side: the game object's room and layer scripts and its
// start, room loading and room switching. The global name is the original's, so every
// object reaches the world the same way the original reached its game object.
// Switching something off is the engine's deactivation: it stops running and colliding,
// and the layer drawing leaves out whole switched off layers.

// The world file lists the rooms. Without one the generated room list stands in for it,
// and without that the test room is the whole world.
const WORLD_FILE = "assets/world.dat";
const ROOM_DIR = "assets/";
const DEFAULT_WORLD = { rooms: [{ name: "TestDev" }], startroomi: 0 };

// The page cannot list a folder, so a generated list says which room files and which optional
// world files exist. Another generated list gives every original object's parent.
const ROOM_LIST_FILE = "assets/rooms.json";
const OBJECT_TREE_FILE = "assets/object_tree.json";

// The world file names the object folders it uses. A generated list says which files each folder
// under the object directory holds, since the page cannot list a folder either.
const OBJECT_DIR = "objects/";
const OBJECT_FILE_LIST = OBJECT_DIR + "files.json";

// The original's name for the world, which names its script and goal files.
// The goal file keeps the original's spelling.
const WORLD_NAME = "world";
const WORLD_SCRIPTS_FILE = ROOM_DIR + WORLD_NAME + "_scripts.dat";
const WORLD_GOALS_FILE = ROOM_DIR + WORLD_NAME + "_golas.dat";
// where the debug overlay remembers being on or off between visits
const DEBUG_OVERLAY_KEY = "lunch_money_debug_overlay";
const ROOM_OBJECT_DEFS_SUFFIX = "_obj_defs.dat";

// The room play starts in. It overrides the world file's own start room, which is kept as the
// fallback for a world that has no room of this name.
const START_ROOM_NAME = "TestDev";

// Names made up for objects count on from the world's last saved number, bumped well clear
// so things made during play never meet names designed into future levels.
const UID_PLAY_BUMP = 0x1000000;
const UID_DIGITS = 5;

// room width when a room does not say, its height always follows at sixteen by nine
const DEFAULT_ROOM_W = 320;
const DEFAULT_LAYER_W = 320;

// kinds of layer group, as the editor saved them
const LGT_NON = 0;
const LGT_CONNECTED = 1;
const LGT_POPUP = 3;
const LGT_EDGE = 4;

// The layers every room gets on top: effects at room size, effects at twice that, and the overlay.
// One more holds things that run without drawing and is never in a room's layer list.
const POPUP_LAYER_NAME = "_popup";
const POPUP_HD_LAYER_NAME = "_popup_hd";
const GUI_LAYER_NAME = "_gui";
const ETC_LAYER_NAME = "_etc";
const GUI_LAYER_W = 640;
const GUI_LAYER_H = 360;
const ETC_LAYER_SIZE = 10;

// A layer of a room. A dot in the name puts it in the group, or area, named before the dot.
class Layer {
	constructor(name) {
		this.lsprites = [];
		this.group = undefined;
		this.lgroup = undefined;
		this.subname = name;
		this.visible = 1;
		this.locked = 0;
		this.plx_x = 1;
		this.plx_y = 1;
		// the camera scroll when it last drew, so parallax catches up after being off
		this.lastscrox = 0;
		this.lastscroy = 0;
		this.loop_x = 0;
		this.loop_y = 0;
		this.zsort = 0;
		this.disabled = 0;
		// overlay layers neither zoom nor scroll
		this.gui = 0;
		this.wd = DEFAULT_LAYER_W;
		this.ht = DEFAULT_LAYER_W * 9 / 16;
		this.offset0 = 0;
		this.layerSurf = null;
		this.maskSurf = null;
		this.mask_list = [];
		this.set_name(name);
	}

	set_name(name) {
		this.name = name;
		const pdi = name.indexOf(".");
		if (pdi >= 0) {
			this.group = name.substring(0, pdi);
			this.subname = name.substring(pdi + 1);
		} else {
			this.group = undefined;
			this.subname = name;
		}
	}
}

// A room of the world. Its layers are made the first time it is entered and kept after.
class Room {
	constructor(name) {
		this.name = name;
		this.layers = null;
		this.wd = DEFAULT_ROOM_W;
		this.enabled = 1;
		this.lastscrox = 0;
		this.lastscroy = 0;
		this.last_layer_st = null;
		// the room file's text, read before play so switching rooms needs no waiting
		this.text = null;
		// the room's object settings file text, when it has one
		this.objDefsText = null;
	}

	// A room's own logic. Setup runs once the room is built, with everything in it made and set up.
	// Update runs every frame of play while it is the current room, before any object updates.
	// Teardown runs when the room is cleared away, before everything in it is destroyed.
	// A room named in the room types gets its own class with these filled in, any other does nothing.
	setup() {}
	update() {}
	teardown() {}
}

// Room classes by room name, for rooms with logic of their own. Each extends the room.
const ROOM_TYPES = {};

// A named set of objects switched on and off together.
class lp_Group {
	constructor(name) {
		this.name = name;
		this.spr_list = [];
		this.enabled = 1;
	}
}

class World {
	constructor() {
		// every live object in creation order, which is also the order they update in
		this.instances = [];
		this.rooms = [];
		this.roombyname = {};
		this.curroom = null;
		this.curroomi = -1;
		this.worldInfo = null;
		this.guy = null;
		// made before anything in a room, so it runs ahead of them
		this.controller = new Controller();
		this.cam = new oCamera();
		this.cam.configure({});
		this.cam.init();
		this.allObjects = Object.create(null);
		this.obj_groups = Object.create(null);
		this.cur_areas_inview = [];
		// scripts from the world's script file, by name
		this.script_defs = {};
		// settings for named objects, gathered from each room's object file as rooms are built
		this.object_defs = {};
		// the world's goal list, for the goal keeper that comes with a later stage
		this.goals = [];
		this.goto_room = null;
		this.frames = 0;
		this.loading = 0;
		// on while a room's own objects are being placed, so their setup waits until all of them exist
		this.placingRoom = false;
		// play paused stops every update, drawing paused stops animation, either way the frame still draws
		this.simPaused = false;
		this.drawPaused = false;
		// objects that come along when the player changes rooms, waiting to be placed in the new one
		this.carryOver = [];
		this.curuid = 0;
		// the overlay comes back the way it was last left, the starting setting only counts the first time
		let kept = null;
		try { kept = localStorage.getItem(DEBUG_OVERLAY_KEY); } catch (e) { /* nothing kept */ }
		this.drawStats = kept === null ? DRAW_STATS_AT_START : kept === "1";
		this.popupLayer = null;
		this.popupHdLayer = null;
		this.guiLayer = null;
		this.etcLayer = null;
		this.spotOn = false;
		this.last_cp = null;
		// weather is a later stage, it starts off in the original too
		this.weather = {
			on: false,
			set_weather(type) {}
		};
	}

	// ------------------------------------------------------------ files

	// Reads the world: its room list, every file in its object folders, the object parents, the world's
	// script and goal files, then every room's file and object settings, so switching rooms needs no
	// waiting. The generated room list tells which optional files exist so the page does not ask for
	// ones that are not there. Each object file counts on the progress as it arrives.
	// Gives back the text of the room play starts in so the sprites it places can be loaded first,
	// every other room's sprites load when it is entered.
	async loadFiles(readText, startName, loadScript, progress) {
		const tryRead = async (path) => {
			try {
				return await readText(path);
			} catch (e) {
				return null;
			}
		};

		const listText = await tryRead(ROOM_LIST_FILE);
		const list = listText !== null ? JSON.parse(listText) : null;

		const worldText = await tryRead(WORLD_FILE);
		let info;
		if (worldText !== null) {
			info = JSON.parse(worldText);
		} else if (list !== null) {
			console.log("no world file, using the room list");
			info = { rooms: list.rooms.map((r) => ({ name: r.name })), startroomi: 0 };
		} else {
			console.log("no world file, playing " + DEFAULT_WORLD.rooms[0].name + " alone");
			info = DEFAULT_WORLD;
		}
		this.worldInfo = info;
		this.rooms = [];
		this.roombyname = {};
		for (const r of info.rooms) {
			const rm = new (ROOM_TYPES[r.name] || Room)(r.name);
			this.rooms.push(rm);
			this.roombyname[r.name] = this.rooms.length - 1;
		}

		// Every file in the world's object folders, all at once. They only build on the two base files,
		// so the order they arrive in does not matter. Classes still missing get stand ins later.
		const folders = Array.isArray(info.object_folders) ? info.object_folders : [];
		if (folders.length > 0) {
			const filesText = await tryRead(OBJECT_FILE_LIST);
			const fileList = filesText !== null ? JSON.parse(filesText) : null;
			if (fileList === null) console.log("no object file list " + OBJECT_FILE_LIST + ", object folders not loaded");
			const paths = [];
			for (const folder of fileList !== null ? folders : []) {
				if (!Array.isArray(fileList[folder])) {
					console.log("object folder " + folder + " is not in " + OBJECT_FILE_LIST + ", run tools/build_object_list.js");
					continue;
				}
				for (const file of fileList[folder]) paths.push(OBJECT_DIR + folder + "/" + file);
			}
			progress.expect(paths.length);
			await Promise.all(paths.map(async (path) => {
				try {
					await loadScript(path);
				} catch (e) {
					console.log("object file would not load: " + path);
				}
				progress.done();
			}));
		}

		const treeText = await tryRead(OBJECT_TREE_FILE);
		if (treeText !== null) {
			standins.load(JSON.parse(treeText));
		} else {
			console.log("no object parent list, objects without a class are plain pictures");
			standins.load(null);
		}

		// optional files are only asked for when the list says they exist, or when there is no list
		const listed = (flag) => list === null || list[flag];
		this.script_defs = {};
		this.goals = [];
		const scriptText = listed("world_scripts") ? await tryRead(WORLD_SCRIPTS_FILE) : null;
		if (scriptText !== null) {
			const defs = this.parseHandWritten(scriptText, WORLD_SCRIPTS_FILE);
			if (defs) this.script_defs = defs;
		}
		const goalText = listed("world_goals") ? await tryRead(WORLD_GOALS_FILE) : null;
		if (goalText !== null) {
			const g = this.parseHandWritten(goalText, WORLD_GOALS_FILE);
			if (g && Array.isArray(g.goals)) this.goals = g.goals;
		}
		this.object_defs = {};

		await Promise.all(this.rooms.map(async (rm) => {
			rm.text = await tryRead(ROOM_DIR + "room_" + rm.name + ".dat");
			if (rm.text === null) console.log("room file missing: " + rm.name);
			const entry = list !== null ? list.rooms.find((r) => r.name === rm.name) : null;
			rm.objDefsText = (entry === null || entry.obj_defs) ? await tryRead(ROOM_DIR + rm.name + ROOM_OBJECT_DEFS_SUFFIX) : null;
		}));

		const start = this.rooms[this.findRoomIndex(startName !== undefined ? startName : START_ROOM_NAME)];
		return start && start.text ? start.text : "";
	}

	// Every sprite name a room's file places, for loading before the room is entered.
	roomSpriteNames(rmi) {
		const rm = this.rooms[rmi];
		return rm && rm.text ? spriteNamesInRoom(rm.text) : [];
	}

	// A room by number, by exact name, or failing that by name in any letter case.
	findRoomIndex(which) {
		if (typeof which === "number") return which >= 0 && which < this.rooms.length ? which : -1;
		if (this.roombyname[which] !== undefined) return this.roombyname[which];
		const lower = String(which).toLowerCase();
		return this.rooms.findIndex((rm) => rm.name.toLowerCase() === lower);
	}

	// The room file is JSON except for setup blocks, kept as text and read on their own.
	parseRoom(text) {
		text = text.replace(/\r\n/g, "\n");
		return JSON.parse(text.replace(/»([\s\S]*?)«/g, (m, body) => JSON.stringify(body)));
	}

	// Setup blocks and the world's script files are hand written. When strict reading fails,
	// trailing commas and numbers with a bare leading or trailing dot are fixed outside of
	// strings, then it is tried again. A file that still cannot be read is left out.
	parseHandWritten(body, name) {
		try {
			return JSON.parse(body);
		} catch (e) {
			const fixed = body.replace(/("(?:[^"\\]|\\.)*")|,(\s*[}\]])|(^|[^\d.])\.(\d)|(\d)\.(?!\d)/g,
				(m, str, close, pre, dig, lastDig) => {
					if (str !== undefined) return str;
					if (close !== undefined) return close;
					if (dig !== undefined) return pre + "0." + dig;
					return lastDig;
				});
			try {
				return JSON.parse(fixed);
			} catch (e2) {
				console.log("could not read " + name + ", it is left out");
				return null;
			}
		}
	}

	// ------------------------------------------------------------ start

	// The player start: camera reset with room limits off, the start room entered, a top down
	// stand in made if the room has no player, then the player settled into the room.
	// The start room is given by number or name. With none given it is the set start room,
	// and when the world has no room of that name, the world file's own.
	start(startrmi) {
		const cam = this.cam;
		cam.reset();
		cam.roomlimit = false;
		this.simPaused = false;
		this.drawPaused = false;
		cam.fastjump = 1;
		this.controller.conOff = false;

		this.loading = 1;
		const info = this.worldInfo || DEFAULT_WORLD;
		this.curuid = (info.curuid !== undefined ? hexToDec(info.curuid) : 0) + UID_PLAY_BUMP;
		let rmi = this.findRoomIndex(startrmi !== undefined ? startrmi : START_ROOM_NAME);
		if (rmi < 0 || this.rooms[rmi].text === null) {
			const fallback = info.startroomi !== undefined ? info.startroomi : 0;
			console.log("start room not available, using room " + fallback);
			rmi = fallback;
		}
		this.switchRoom(rmi);
		this.loading = 0;
		if (this.curroom === null || this.curroom.layers === null) return;

		if (this.guy === null) this.placeStandInGuy();
		Hooks.todo("loading the player's saved state and inventory");

		this.settleGuy();
		this.frames = 0;
		// Kept from the original: areas brought into view while starting are forgotten here.
		this.cur_areas_inview.length = 0;
		this.last_cp = { x: this.guy.x, y: this.guy.y };
	}

	// What follows entering a room with the player in it: the camera takes the room's size, the
	// player moves into whatever area they stand in, top down players are lifted onto what they
	// stand on, and the camera jumps to them.
	settleGuy() {
		const cam = this.cam;
		const guy = this.guy;
		// the original takes the size from the room the editor had open, the start room
		cam.curw = this.curroom.wd;
		cam.curh = this.curroom.wd * 9 / 16;

		this.findAndGotoAreaAtGuy();

		if (truthy(guy.ch_topd)) {
			guy.calcOnFloorAtWallTopd();
			if (guy.onFloorObj !== null && guy.onFloorObj.ht < BIGGEST_INT) guy.z = guy.onFloorObj.ht;
		}
		cam.setTo(guy.x, guy.y);
	}

	// Puts the player where a save says: the spot, the layer by name when the room has it, the way
	// they face, then settled into the room as at the start, with the camera on them.
	placeGuyAt(x, y, layerName, facing, facingy) {
		const guy = this.guy;
		const lyr = typeof layerName === "string" ? this.findLayer(layerName) : undefined;
		if (lyr !== undefined && !Array.isArray(lyr) && guy.mylayer !== lyr) this.layerInsert(lyr, guy);
		guy.x = x;
		guy.y = y;
		if (facing !== undefined) guy.facing = facing;
		if (facingy !== undefined) guy.facingy = facingy;
		this.settleGuy();
		this.last_cp = { x: guy.x, y: guy.y };
	}

	// Gives a room with no player of its own one, as the original's start does: a plain top down
	// character named as the main one.
	// The original puts it at the origin in the overlay layer, which only suits the editor.
	// Guess: here it goes in the topmost room layer that is on, at the middle of the camera
	// bounds the room was saved with, or at the origin when it has none.
	placeStandInGuy() {
		const rm = this.curroom;
		const guy = this.createObject(oCharTopd, { x: 0, y: 0, name: "main_char", skin: "char" });
		this.setCharAsGuy(guy);
		let layer = null;
		for (const lyr of rm.layers) {
			if (lyr.name.charAt(0) === "_") continue;
			if (layer === null || !truthy(lyr.disabled)) layer = lyr;
		}
		if (layer === null) layer = rm.layers[rm.layers.length - 1];
		this.layerInsert(layer, guy);
		const hasBounds = rm.camx !== undefined && rm.camw !== undefined;
		guy.x = hasBounds ? Math.floor(rm.camx + rm.camw / 2) : 0;
		guy.y = hasBounds ? Math.floor(rm.camy + rm.camh / 2) : 0;
		rm.mainchar = guy;
	}

	// A port of the original's world clearing, which it runs when play ends: every room's layers
	// and everything in them destroyed, the shared system layers dropped, the lists of names,
	// groups and object settings emptied, and the player forgotten. The rooms themselves stay
	// listed with their files so any of them can be built again. The world's script and goal
	// files are fixed data, so they stay loaded instead of being read again.
	clearWorld() {
		this.guy = null;
		// objects are destroyed, so they take what they own with them, pictures are just dropped
		const remove = (obj) => {
			if (obj instanceof oBaseObject) obj.destroy();
			else this.forgetObject(obj);
		};
		for (const rm of this.rooms) {
			if (rm.layers !== null) {
				rm.teardown();
				for (const lyr of rm.layers) {
					for (const obj of lyr.lsprites.slice()) remove(obj);
				}
			}
			rm.layers = null;
			rm.mainchar = null;
			rm.enabled = 1;
			rm.last_layer_st = null;
			rm.lastlyr = undefined;
			rm.lastx = undefined;
			rm.lasty = undefined;
		}
		// whatever was left in no layer, such as masks and objects that never run
		for (const name of Object.keys(this.allObjects)) remove(this.allObjects[name]);
		this.instances.length = 0;
		this.carryOver.length = 0;
		this.allObjects = Object.create(null);
		this.obj_groups = Object.create(null);
		this.object_defs = {};
		this.cur_areas_inview.length = 0;
		this.popupLayer = null;
		this.popupHdLayer = null;
		this.guiLayer = null;
		this.etcLayer = null;
		this.curroom = null;
		this.curroomi = -1;
		this.goto_room = null;
		this.spotOn = false;
		this.last_cp = null;
		this.weather.on = false;
	}

	// Plays from a room the way the editor's play button does: the world cleared, then the
	// start run again with this room as the start room. The player comes from the room's own
	// setup, or is made as a stand in if it has none. Starting fresh matters: a player kept from
	// another room would be of the wrong kind, since players share a name across rooms.
	// Gives back false when the room has no file, leaving everything as it was.
	enterRoom(which) {
		const rmi = this.findRoomIndex(which);
		if (rmi < 0 || this.rooms[rmi].text === null) return false;
		this.clearWorld();
		this.start(rmi);
		return this.curroom !== null && this.curroom.layers !== null;
	}

	// Reads a room's object settings file, which adds to the settings of earlier rooms.
	loadObjectDefs(rm) {
		if (rm.objDefsText === null || rm.objDefsText === undefined) return;
		const defs = this.parseHandWritten(rm.objDefsText, rm.name + ROOM_OBJECT_DEFS_SUFFIX);
		if (defs) Object.assign(this.object_defs, defs);
	}

	// ------------------------------------------------------------ names and objects

	// A name in a script: the player, the asker, or any object by name. Anything else is
	// taken as already found.
	lookupInst(v, self) {
		if (v === "main") return this.guy;
		if (v === "self" || v === "actor") return self;
		if (typeof v === "string") return this.allObjects[v];
		return v;
	}

	nextUid() {
		return (++this.curuid).toString(16).toUpperCase().padStart(UID_DIGITS, "0");
	}

	// A free name based on the one asked for: a bare number gets a fresh number,
	// a name ending in a number counts up from it, anything else gets one added.
	uniqueName(oname) {
		if (oname === "") return this.nextUid();
		if (this.allObjects[oname] === undefined) return oname;
		if (oname === hexToDec(oname).toString(16).toUpperCase()) return this.nextUid();
		let base = oname;
		let tries = 0;
		const lastus = oname.lastIndexOf("_");
		if (lastus >= 0) {
			const pfix = oname.substring(lastus + 1);
			if (/^\d*$/.test(pfix)) {
				base = oname.substring(0, lastus);
				tries = Number(pfix);
			}
		}
		for (;;) {
			const gname = base + "_" + (++tries);
			if (this.allObjects[gname] === undefined) return gname;
		}
	}

	// The one way objects are made: from a class or an object name and one config, made with its
	// defaults, the config laid on, joining the frame in creation order, put in a layer when one is
	// given, then set up. A name asked for is made unique. While a room places its own objects their
	// setup waits, since the room runs it once everything exists.
	createObject(cls, cfg, layer, idx) {
		if (typeof cls === "string") cls = objectType(cls);
		const obj = new cls();
		obj.configure(cfg === undefined ? {} : cfg);
		if (obj.name !== undefined) obj.name = this.uniqueName(obj.name);
		this.instances.push(obj);
		if (layer !== undefined) this.layerInsert(layer, obj, idx);
		if (!this.placingRoom) obj.init();
		return obj;
	}

	// Takes an object or a picture out of play for good: out of its layer, its name and the frame.
	// Objects call this from their destroy, anything else that owns them goes through that.
	forgetObject(o) {
		if (!o || o.destroyed) return;
		if (o.mylayer) this.layerRemove(o.mylayer, o);
		if (this.allObjects[o.name] === o) delete this.allObjects[o.name];
		o.destroyed = true;
		const i = this.instances.indexOf(o);
		if (i >= 0) this.instances.splice(i, 1);
	}

	// Makes this character the one the player controls and the camera follows.
	setCharAsGuy(newguy) {
		if (this.guy && this.guy !== newguy) {
			Hooks.todo("copying state between player characters");
			newguy.inv.inv_list = this.guy.inv.inv_list;
		}
		// forces the sprite to be picked again
		newguy.drawSprite = null;
		this.guy = newguy;
		this.guy.con = this.controller;
		this.cam.follow = this.guy;
	}

	reviveGuy() {
		Hooks.todo("reviving the player");
	}

	// ------------------------------------------------------------ layers

	// Puts an object in a layer, at a place in its order or on top, out of any layer it was in,
	// named if it has no name yet, and switched to match the layer.
	layerInsert(lyr, obj, idx) {
		if (obj.mylayer) this.layerRemove(obj.mylayer, obj);
		if (idx !== undefined) lyr.lsprites.splice(idx, 0, obj);
		else lyr.lsprites.push(obj);
		obj.mylsprites = lyr.lsprites;
		obj.mylayer = lyr;
		if (obj.name === undefined || obj.name === 0) obj.name = this.nextUid();
		this.allObjects[obj.name] = obj;
		if (obj instanceof oBaseObject) obj.deactivated = truthy(lyr.disabled);
	}

	layerRemove(lyr, obj) {
		const i = lyr.lsprites.indexOf(obj);
		if (i >= 0) lyr.lsprites.splice(i, 1);
	}

	// by object or name, to a layer by layer or name
	moveObjToLayer(obj, lyr, idx) {
		if (typeof obj === "string") obj = this.allObjects[obj];
		if (typeof lyr === "string") lyr = this.findLayer(lyr);
		if (lyr && !Array.isArray(lyr)) this.layerInsert(lyr, obj, idx);
	}

	// A layer of the current room by its exact name, or with a star at the end, the list of every
	// layer whose name holds the text before the star anywhere in it.
	findLayer(name) {
		const layers = this.curroom.layers;
		if (name.endsWith("*")) {
			const part = name.substring(0, name.length - 1);
			return layers.filter((lyr) => part === "" || lyr.name.indexOf(part) >= 0);
		}
		return layers.find((lyr) => lyr.name === name);
	}

	// Switches a layer on or off, or with no switch given just brings its objects in line with
	// the room and layer. Each object is on only when the room, the layer and the object are.
	// Triggers coming back on forget who was standing in them, unless told not to.
	layerSetEnabled(lyr, enabled) {
		if (enabled !== undefined) lyr.disabled = truthy(enabled) ? 0 : 1;
		const on = truthy(this.curroom.enabled) && !truthy(lyr.disabled);
		for (const spr of lyr.lsprites) {
			if (!(spr instanceof oBaseObject)) continue;
			const oenabled = on && !truthy(spr.pdis);
			spr.deactivated = !oenabled;
			if (oenabled && spr.inTrigger !== undefined && !truthy(spr.no_trig_on_reenter)) {
				spr.inTrigger = 0;
				spr.triggered = 0;
			}
		}
	}

	// Shows or hides a layer, by layer or name, or every layer a starred name finds.
	// Lists skip the layers whose names start with an underscore, the system ones.
	// Showing is switching on, a hidden layer neither draws nor runs.
	layerViz(lyr, vis) {
		if (typeof lyr === "string") lyr = this.findLayer(lyr);
		if (!lyr) return;
		if (Array.isArray(lyr)) {
			for (const l of lyr) {
				if (l.name.charAt(0) === "_") continue;
				this.layerSetEnabled(l, vis);
			}
		} else {
			this.layerSetEnabled(lyr, vis);
		}
	}

	// A whole room on or off, its one shot effects cleared first.
	roomSetEnabled(rm, enabled) {
		rm.enabled = enabled;
		Hooks.todo("clearing one shot effects on a room change");
		for (const lyr of rm.layers) this.layerSetEnabled(lyr);
	}

	// One object on or off. Off also takes it out of its layer's order, on puts it back on top.
	setObjEnabled(obj, enabled) {
		if (obj instanceof oBaseObject) obj.deactivated = !truthy(enabled);
		const pdis = !truthy(enabled);
		if (truthy(obj.pdis) !== pdis && obj.mylayer) {
			if (pdis) this.layerRemove(obj.mylayer, obj);
			else obj.mylayer.lsprites.push(obj);
		}
		obj.pdis = pdis ? 1 : 0;
	}

	groupSetEnabled(grp, enabled) {
		for (const spr of grp.spr_list.slice()) this.setObjEnabled(spr, enabled);
	}

	// Remembers every layer's shown and switched state, to put back later.
	saveLayersState() {
		const copy = this.curroom.layers.map((lyr) => ({ visible: lyr.visible, disabled: lyr.disabled }));
		this.curroom.last_layer_st = copy;
		return copy;
	}

	restoreLastLayersState() {
		const llst = this.curroom.last_layer_st;
		if (llst !== null) {
			this.setLayersState(llst);
			this.curroom.last_layer_st = null;
		}
	}

	setLayersState(copy) {
		const layers = this.curroom.layers;
		for (let li = 0; li < layers.length; li++) {
			const lyr = layers[li];
			const c = copy[li];
			lyr.visible = c.visible;
			if (truthy(lyr.disabled) !== truthy(c.disabled)) this.layerSetEnabled(lyr, !truthy(c.disabled));
		}
	}

	// Kept from the original: a persistent insertion sort by height on screen, so things lower
	// down draw in front, and equal ones keep their order.
	zsortLayer(lyr) {
		const ls = lyr.lsprites;
		for (let i = 1; i < ls.length; i++) {
			for (let j = i; j > 0; j--) {
				if (ls[j].y < ls[j - 1].y) {
					const t = ls[j];
					ls[j] = ls[j - 1];
					ls[j - 1] = t;
				} else {
					break;
				}
			}
		}
	}

	// ------------------------------------------------------------ areas

	// Brings an area into view or out. Only connected and edge areas switch their layers,
	// every kind is tracked for the backdrops.
	areaSetVis(group, enabled) {
		if (group.type === LGT_CONNECTED || group.type === LGT_EDGE) {
			this.layerViz(group.name + ".*", enabled);
		}
		if (truthy(enabled)) {
			this.cur_areas_inview.push(group);
		} else {
			const i = this.cur_areas_inview.indexOf(group);
			if (i >= 0) this.cur_areas_inview.splice(i, 1);
		}
	}

	// Shows only one level of the player's current area.
	areaSetLevel(lvl) {
		const group = this.guy.mylayer.lgroup;
		this.layerViz(group.name + ".lvl:*", 0);
		this.layerViz(group.name + ".lvl:" + lvl + "*", 1);
	}

	// Moves the player, and whatever they ride or carry, into an area's main layer.
	enterArea(grp) {
		if (typeof grp === "string") grp = this.curroom.layer_groups[grp];
		const areaLyr = this.findLayer(grp.name + ".");
		if (areaLyr === undefined) return;
		const guy = this.guy;
		this.moveObjToLayer(guy, areaLyr);
		if (guy.riding) this.moveObjToLayer(guy.riding, areaLyr);
		if (guy.carrying) this.moveObjToLayer(guy.carrying, areaLyr);
		this.curroom.bd_sprite = grp.bd_sprite !== undefined ? grp.bd_sprite : undefined;
		this.curroom.grp_bounds = grp.bounds;
		if (grp.enter_script !== undefined) Hooks.runScript(grp.enter_script);
	}

	// the connected area whose bounds hold a spot, edges included
	findGroupAt(x, y) {
		const groups = this.curroom.layer_groups;
		for (const key of Object.keys(groups)) {
			const grp = groups[key];
			if (grp.type !== LGT_CONNECTED || !grp.bounds) continue;
			const b = grp.bounds;
			if (x >= b.bbox_left && x <= b.bbox_right && y >= b.bbox_top && y <= b.bbox_bottom) return grp;
		}
		return undefined;
	}

	// On entering a room: when the player starts inside an area, move them into it
	// and switch off every other area except the system ones.
	findAndGotoAreaAtGuy() {
		const gb = this.findGroupAt(this.guy.x, this.guy.y);
		if (gb === undefined) return;
		const startGrp = gb.name;
		this.moveObjToLayer(this.guy, this.findLayer(startGrp + "."));
		for (const lyr of this.curroom.layers) {
			if (lyr.group !== undefined && lyr.group !== startGrp && lyr.group.charAt(0) !== "_") {
				this.layerViz(lyr, 0);
			}
		}
	}

	// ------------------------------------------------------------ rooms

	// Builds a room in the original's order: its areas, every layer and its things, then every
	// object's own setup, then the layers saved as switched off, then masks, then layers
	// regrouped by area, then the system layers on top, then the room's own setup block, then its setup.
	loadRoom(rmi) {
		const rm = this.rooms[rmi];
		if (rm.text === null) return;
		const smap = this.parseRoom(rm.text);
		this.loadObjectDefs(rm);

		const layers = [];
		rm.layers = layers;
		const maskList = [];

		rm.wd = smap.roomw !== undefined ? smap.roomw : DEFAULT_ROOM_W;
		rm.ht = rm.wd * 9 / 16;
		// saved but never shown by the original, which always clears to black
		rm.bd_color = smap.bd_color !== undefined ? "#" + smap.bd_color : SCREEN_CLEAR_COLOR;
		rm.bd_sprite = undefined;
		rm.camx = smap.camx;
		rm.camy = smap.camy;
		rm.camw = smap.camw;
		rm.camh = smap.camh;
		rm.mainchar = rm.mainchar || null;

		// Areas. Guess: an area saved without its own name takes its key.
		// Animation speed is kept per frame, the original stored it per second and divided when drawing.
		rm.layer_groups = smap.layer_groups || {};
		for (const key of Object.keys(rm.layer_groups)) {
			const grp = rm.layer_groups[key];
			if (grp.name === undefined) grp.name = key;
			grp.bgcolor = grp.bgcolor ? "#" + grp.bgcolor : "";
			grp.foundz = 0;
			grp.bounds = undefined;
			grp.vbounds = undefined;
			grp.bd_sprite = (grp.bd_sprite !== undefined && Sprites.exists(grp.bd_sprite)) ? grp.bd_sprite : null;
			const rec = grp.bd_sprite !== null ? Sprites.get(grp.bd_sprite) : null;
			grp.sp_w = rec ? rec.w : -1;
			grp.sp_fnum = rec ? rec.frameCount : -1;
			grp.sp_spd = rec ? rec.imageSpeed : 0;
			if (typeof grp.grp_init === "string") {
				const gi = this.parseHandWritten(grp.grp_init, key);
				if (gi) Object.assign(grp, gi);
				grp.grp_init = undefined;
			}
		}

		this.placingRoom = true;
		for (const laymap of smap.layers) {
			let lyr;
			// a name starting with a caret adds to the layer before it
			if (laymap.name.charAt(0) === "^") {
				lyr = layers[layers.length - 1];
			} else {
				lyr = new Layer(laymap.name);
				layers.push(lyr);
				lyr.plx_x = laymap.plx_x !== undefined ? laymap.plx_x : 1;
				lyr.plx_y = laymap.plx_y !== undefined ? laymap.plx_y : 1;
				lyr.loop_x = laymap.loop_x !== undefined ? laymap.loop_x : 0;
				lyr.loop_y = laymap.loop_y !== undefined ? laymap.loop_y : 0;
				lyr.zsort = laymap.zsort !== undefined ? laymap.zsort : 0;
				lyr.wd = laymap.wd !== undefined ? laymap.wd : DEFAULT_LAYER_W;
				lyr.ht = lyr.wd * 9 / 16;
				lyr.gui = laymap.gui !== undefined ? laymap.gui : 0;
				// stays on until every object has set itself up
				lyr._idisabled = laymap.disabled !== undefined ? laymap.disabled : 0;
				lyr.visible = laymap.visible !== undefined ? laymap.visible : 1;
			}

			for (const spri of laymap.spriteList) {
				const oimap = spri.objinit !== undefined ? this.parseHandWritten(spri.objinit, spri.name) : null;
				const oname = spri.name;

				let cls = spri.isobj !== undefined ? objectType(spri.isobj) : undefined;
				let spi = Sprites.exists(spri.spi) ? spri.spi : "sNoSprite";
				if (spri.isobj !== undefined && cls === undefined) {
					console.log("unknown object type " + spri.isobj + ", placed as a plain picture");
					spi = "sNoSprite";
				}

				// The entry as saved is the config, picture or object, under the same names. What it
				// leaves out takes the default, the colour gets its mark, the speed is made a number
				// since some files keep it as text, and the spot moves by the draw offset, so the thing
				// stands at its footprint and its picture draws back where it was placed.
				// Its setup block goes on top, then any settings kept for its name in the object file.
				const cfg = { name: oname };
				for (const k of LP_SAVED_FIELDS) cfg[k] = spri[k] !== undefined ? spri[k] : LP_SPRITE_DEFAULTS[k];
				cfg.spi = spi;
				if (spri.col !== undefined) cfg.col = "#" + spri.col;
				cfg.spd = Number(cfg.spd);
				cfg.x += cfg.exoffx;
				cfg.y += cfg.exoffy;
				if (spri.paths !== undefined) cfg.paths = spri.paths;
				if (oimap) Object.assign(cfg, oimap);
				if (this.object_defs[oname] !== undefined) Object.assign(cfg, this.object_defs[oname]);

				let obj;
				if (cls !== undefined) {
					if (oimap && oimap.objtype !== undefined) {
						if (objectType(oimap.objtype) !== undefined) cls = objectType(oimap.objtype);
						else console.log("unknown replacement object type " + oimap.objtype);
					}
					// Kept from the original: an object of this name that already exists, from another
					// room or of another type, is taken over instead of a new one being made.
					if (this.allObjects[oname] !== undefined) {
						obj = this.allObjects[oname];
						obj.configure(cfg);
					} else {
						obj = this.createObject(cls, cfg);
					}
					if (oimap && oimap.mainchar !== undefined) {
						this.setCharAsGuy(obj);
						rm.mainchar = obj;
					}
				} else {
					obj = new lpSprite(cfg);
				}
				Hooks.todo("saved object states");

				if (spri.groups !== undefined) {
					obj.groups = spri.groups.map((gname) => {
						let gp = this.obj_groups[gname];
						if (gp === undefined) {
							gp = new lp_Group(gname);
							this.obj_groups[gname] = gp;
						}
						gp.spr_list.push(obj);
						return gp;
					});
				}

				// area bounds find their area
				if (obj.constructor === oGroupBounds || obj.constructor === oVisBounds) {
					const grp = rm.layer_groups[obj.group];
					if (grp === undefined) {
						console.log("bounds " + oname + " name an area the room does not have: " + obj.group);
					} else {
						obj.group = grp;
						if (obj.constructor === oVisBounds) grp.vbounds = obj;
						else grp.bounds = obj;
					}
				}

				if (obj._mask !== undefined) {
					// masks sit in no layer but can still be found by name
					maskList.push(obj);
					this.allObjects[obj.name] = obj;
				} else if (obj.st_nolayer === undefined) {
					this.layerInsert(lyr, obj);
				} else {
					// in no layer means never on
					obj.deactivated = true;
					this.allObjects[obj.name] = obj;
				}
			}
		}

		this.placingRoom = false;

		// setup runs once everything exists, so it can find things in other layers
		for (const lyr of layers) {
			for (const obj of lyr.lsprites.slice()) {
				if (typeof obj.init === "function") obj.init();
			}
		}

		for (const lyr of layers) {
			if (truthy(lyr._idisabled)) this.layerSetEnabled(lyr, 0);
		}

		// Masks join the layers they name. A starred name would fail in the original and is skipped here.
		for (const mobj of maskList) {
			for (const lname of mobj.layer_list) {
				const lyr = this.findLayer(lname);
				if (lyr !== undefined && !Array.isArray(lyr)) lyr.mask_list.push(mobj);
			}
		}

		// Layers regrouped by area: in each area, the layers before its sorted layer, the sorted one,
		// then the ones after. Only one layer per area should sort. Layers in no area go last.
		if (Object.keys(rm.layer_groups).length > 0) {
			const sorted = [];
			const sti = [0, 0, 0];
			for (const lyr of layers) {
				if (lyr.group !== undefined) {
					const lgroup = rm.layer_groups[lyr.group];
					lyr.lgroup = lgroup;
					// Guess: a layer naming an area the room lacks is kept with the layers in no area.
					if (lgroup === undefined) {
						sorted.push(lyr);
					} else if (!truthy(lgroup.foundz)) {
						if (truthy(lyr.zsort)) {
							sorted.splice(sti[1], 0, lyr);
							sti[1]++;
							sti[2]++;
							lgroup.foundz = 1;
						} else {
							sorted.splice(sti[0], 0, lyr);
							sti[0]++;
							sti[1]++;
							sti[2]++;
						}
					} else {
						sorted.splice(sti[2], 0, lyr);
						sti[2]++;
					}
				} else {
					sorted.push(lyr);
				}
			}
			layers.length = 0;
			for (const lyr of sorted) layers.push(lyr);
		}

		// the system layers, shared by every room
		if (this.popupLayer === null) this.popupLayer = new Layer(POPUP_LAYER_NAME);
		layers.push(this.popupLayer);
		this.popupLayer.wd = rm.wd;
		this.popupLayer.ht = rm.ht;
		if (this.popupHdLayer === null) {
			this.popupHdLayer = new Layer(POPUP_HD_LAYER_NAME);
			this.popupHdLayer.wd = rm.wd * 2;
			this.popupHdLayer.ht = rm.ht * 2;
		}
		layers.push(this.popupHdLayer);
		// Kept from the original, which notes the overlay layer does not handle scroll or zoom right.
		if (this.guiLayer === null) {
			this.guiLayer = new Layer(GUI_LAYER_NAME);
			this.guiLayer.wd = GUI_LAYER_W;
			this.guiLayer.ht = GUI_LAYER_H;
			this.guiLayer.offset0 = 1;
		}
		layers.push(this.guiLayer);
		if (this.etcLayer === null) {
			this.etcLayer = new Layer(ETC_LAYER_NAME);
			this.etcLayer.wd = ETC_LAYER_SIZE;
			this.etcLayer.ht = ETC_LAYER_SIZE;
		}

		if (typeof smap.room_init === "string") {
			const ri = this.parseHandWritten(smap.room_init, rm.name);
			if (ri) Object.assign(rm, ri);
		}
		rm.setup();
	}

	// Leaves the current room switched off where the player was, and enters another by number or
	// name, building it the first time. A room's own enter script runs, the camera jumps.
	switchRoom(rmi) {
		console.log("room switch: " + rmi);
		if (typeof rmi === "string") rmi = this.roombyname[rmi];
		if (this.curroom) {
			this.curroom.lastlyr = this.guy.mylayer;
			this.curroom.lastx = this.guy.x;
			this.curroom.lasty = this.guy.y;
			this.takeCarryOver();
			this.roomSetEnabled(this.curroom, 0);
		}
		this.cur_areas_inview.length = 0;

		this.curroomi = rmi;
		this.curroom = this.rooms[rmi];
		if (this.curroom.layers === null) {
			this.loadRoom(rmi);
			if (this.curroom.layers === null) return;
			// switching on again fires triggers
			this.roomSetEnabled(this.curroom, 1);
		} else {
			this.setCharAsGuy(this.curroom.mainchar);
			this.roomSetEnabled(this.curroom, 1);
			this.reviveGuy();
		}

		this.weather.set_weather(0);
		this.spotOn = false;
		if (this.curroom.enter_script !== undefined) Hooks.runScript(this.curroom.enter_script, this);
		this.cam.fastjump = 1;
	}

	// Lifts everything marked to come along with the player out of the room being left, remembering
	// each one's offset from the player. The player itself moves rooms by its own rule: the room's
	// main character, taken over by name, so it is never in this list.
	takeCarryOver() {
		for (const lyr of this.curroom.layers) {
			for (const obj of lyr.lsprites.slice()) {
				if (!(obj instanceof oBaseObject) || !truthy(obj.persistent) || obj === this.guy) continue;
				this.layerRemove(lyr, obj);
				obj.mylayer = null;
				obj.carryx = obj.x - this.guy.x;
				obj.carryy = obj.y - this.guy.y;
				this.carryOver.push(obj);
			}
		}
	}

	// Puts what came along into the player's layer in the new room, at the same offsets from them.
	placeCarryOver() {
		for (const obj of this.carryOver) {
			obj.x = this.guy.x + obj.carryx;
			obj.y = this.guy.y + obj.carryy;
			this.layerInsert(this.guy.mylayer, obj);
		}
		this.carryOver.length = 0;
	}

	// A room change asked for during a frame happens at the start of the next.
	gotoRoom(toroom, leaveat, enterat, offsettoento, syncCam) {
		this.goto_room = [toroom, leaveat, enterat, offsettoento, syncCam];
	}

	// Into another room at a named object, or back where we left it, in the same layer as that
	// object, keeping our offset from the door we left by when asked, then the camera on us.
	// Kept from the original: syncing the camera is always switched off.
	gotoRoomGo(toroom, leaveat, enterat, offsettoento, syncCam) {
		let guy = this.guy;
		if (offsettoento === undefined) offsettoento = 0;
		syncCam = 0;

		let curcamofx = 0;
		let curcamofy = 0;
		if (syncCam) {
			curcamofx = this.cam.x - guy.x;
			curcamofy = this.cam.y - guy.y;
		}
		let eox = 0;
		let eoy = 0;
		if (truthy(offsettoento)) {
			eox = guy.x - leaveat.x;
			eoy = guy.y - leaveat.y;
		}

		this.switchRoom(toroom);
		guy = this.guy;
		guy.deactivated = false;

		let enterato;
		if (enterat === "last_spot" && this.curroom.lastlyr !== undefined) {
			enterato = { mylayer: this.curroom.lastlyr, x: this.curroom.lastx, y: this.curroom.lasty };
		} else {
			enterato = this.allObjects[enterat];
		}

		if (enterato) {
			this.moveObjToLayer(guy, enterato.mylayer.name, undefined);
			// coming in standing in a trigger counts as already in it
			if (enterato.inTrigger !== undefined && truthy(enterato.no_trig_on_reenter)) {
				enterato.inTrigger = 1;
				enterato.triggered = 1;
			}
			guy.x = enterato.x;
			guy.y = enterato.y;
			if (truthy(offsettoento)) {
				guy.x += eox;
				guy.y += eoy;
			}
		}

		this.placeCarryOver();
		this.findAndGotoAreaAtGuy();

		let gox = guy.x;
		let goy = guy.y;
		if (syncCam === 1) {
			gox += curcamofx;
			goy += curcamofy;
		} else if (syncCam === 2) {
			gox += this.cam.lastfolofx;
			goy += this.cam.lastfolofy;
		}
		this.cam.setTo(gox, goy);
	}

	// ------------------------------------------------------------ the frame

	// One fixed step: the controller reads input first, then a waiting room change, then while play
	// is not paused the room's own update, every object's update, and every after update, then the
	// camera. Every object updates before any settles in its after update, so an after update sees
	// where everyone ended up: carried things following their carrier, riders and followers.
	// The camera goes last so it frames where everything settled. A timer that runs out goes just
	// before its object's update.
	step() {
		Input.pollPad();
		// the controller is read ahead of everyone so characters see this frame's buttons
		this.controller.poll();

		if (this.goto_room !== null) {
			const g = this.goto_room;
			this.goto_room = null;
			this.gotoRoomGo(g[0], g[1], g[2], g[3], g[4]);
		}

		this.frames++;
		if (Input.pressed.Tab) {
			this.drawStats = !this.drawStats;
			try { localStorage.setItem(DEBUG_OVERLAY_KEY, this.drawStats ? "1" : "0"); } catch (e) { /* nothing kept */ }
		}

		Hooks.lines.length = 0;

		if (!this.simPaused) {
			if (this.curroom !== null) this.curroom.update();
			// a copy, so objects made or destroyed during the step do not upset the walk
			const live = this.instances.slice();
			for (const o of live) {
				if (o.deactivated || o.destroyed) continue;
				if (o.timers !== null) o.countDownTimers();
				if (!o.destroyed) o.update();
			}
			for (const o of live) {
				if (o.deactivated || o.destroyed || o.afterUpdate === undefined) continue;
				o.afterUpdate();
			}
		}
		this.cam.update();

		Input.endFrame();
	}

	draw() {
		Draw.frame(this);
	}
}

// the engine's reading of a hex number, ignoring anything that is not a hex digit
function hexToDec(hex) {
	let result = 0;
	for (const c of String(hex).toUpperCase()) {
		const d = "0123456789ABCDEF".indexOf(c);
		if (d >= 0) result = result * 16 + d;
	}
	return result;
}

const game = new World();
