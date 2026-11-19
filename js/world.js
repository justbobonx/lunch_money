// The world: rooms, their layers and layer groups (areas), every object and room picture,
// turning layers, areas and objects on and off, moving between rooms, and the frame's events.
// A port of the original's player side: the game object's room and layer scripts and its
// start, room loading and room switching. The global name is the original's, so every
// object reaches the world the same way the original reached its game object.
// Switching something off is the engine's deactivation: it stops running and colliding,
// and the layer drawing leaves out whole switched off layers.

// The world file lists the rooms. Without one, the test room is the whole world.
const WORLD_FILE = "assets/world.dat";
const ROOM_DIR = "assets/";
const DEFAULT_WORLD = { rooms: [{ name: "TestDev" }], startroomi: 0 };

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

// A plain picture placed in a room. It never runs or collides, it only draws, animating as it draws.
class lp_Sprite {
	constructor() {
		this.mylayer = null;
		this.spi = null;
		this.sprite_index = null;
		this.x = 0;
		this.y = 0;
		this.image_index = 0;
		this.mask_index = null;
		this.image_xscale = 1;
		this.image_yscale = 1;
		this.image_angle = 0;
		this.image_blend = "#ffffff";
		this.image_alpha = 1;
		this.image_speed = 1;
		this.name = "";
		this.visible = true;
		this.pvis = true;
		this.pdis = 0;
		// frames per second, and how many
		this.sprite_speed = 1;
		this.sprite_num = 1;
		this.tiledx = 0;
		this.tiledy = 0;
		this.exoffx = 0;
		this.exoffy = 0;
		this.z = 0;
		this.destroyed = false;
	}

	set_sprite(spri) {
		const rec = Sprites.get(spri);
		this.sprite_speed = rec ? rec.imageSpeed * GAME_FPS : 0;
		this.sprite_num = rec ? rec.frameCount : 1;
		this.sprite_xoffset = rec ? rec.ox : 0;
		this.sprite_yoffset = rec ? rec.oy : 0;
		this.sprite_width = rec ? rec.w : 0;
		this.sprite_height = rec ? rec.h : 0;
		// from the origin to the middle, unscaled
		this.sprite_cox = this.sprite_width / 2 - this.sprite_xoffset;
		this.sprite_coy = this.sprite_height / 2 - this.sprite_yoffset;
		this.mask_index = spri;
		// tells anyone checking that this is not an object
		this.object_index = -1;
		setSpritePlus(this, spri);
	}

	draw() {
		const xo = -Draw.curdrawoffx;
		const yo = -Draw.curdrawoffy;
		if (truthy(this.tiled)) Draw.layerSpriteTiled(this, xo, yo);
		else Draw.layerSprite(this, xo, yo);
		this.image_index = (this.image_index + (this.sprite_speed / GAME_FPS) * this.image_speed) % this.sprite_num;
	}

	// the middle of the picture, turned and stretched with it
	sprite_cx() {
		const dx = this.sprite_cox * this.image_xscale;
		const dy = this.sprite_coy * this.image_yscale;
		return Math.floor(this.x + lengthdirX(pointDistance(0, 0, dx, dy), pointDirection(0, 0, dx, dy) + this.image_angle));
	}
	sprite_cy() {
		const dx = this.sprite_cox * this.image_xscale;
		const dy = this.sprite_coy * this.image_yscale;
		return Math.floor(this.y + lengthdirY(pointDistance(0, 0, dx, dy), pointDirection(0, 0, dx, dy) + this.image_angle));
	}
}

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
	}
}

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
		// every live object in creation order, which is also the order events run in
		this.instances = [];
		this.rooms = [];
		this.roombyname = {};
		this.curroom = null;
		this.curroomi = -1;
		this.worldInfo = null;
		this.guy = null;
		// made before anything in a room, so it runs ahead of them
		this.controller = new Controller();
		this.cam = new oCamera(0, 0);
		this.allObjects = Object.create(null);
		this.obj_groups = Object.create(null);
		this.cur_areas_inview = [];
		this.goto_room = null;
		this.frames = 0;
		this.loading = 0;
		this.paused = false;
		this.curuid = 0;
		this.drawStats = DRAW_STATS_AT_START;
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

	// Reads the world file, or makes the one room world, then every room's file.
	// Gives back all the text so the sprites the rooms place can be loaded first.
	async loadFiles(readText) {
		let info = DEFAULT_WORLD;
		try {
			info = JSON.parse(await readText(WORLD_FILE));
		} catch (e) {
			console.log("no world file, playing " + DEFAULT_WORLD.rooms[0].name + " alone");
		}
		this.worldInfo = info;
		this.rooms = [];
		this.roombyname = {};
		for (const r of info.rooms) {
			const rm = new Room(r.name);
			this.rooms.push(rm);
			this.roombyname[r.name] = this.rooms.length - 1;
		}
		await Promise.all(this.rooms.map(async (rm) => {
			try {
				rm.text = await readText(ROOM_DIR + "room_" + rm.name + ".dat");
			} catch (e) {
				console.log("room file missing: " + rm.name);
			}
		}));
		return this.rooms.map((rm) => rm.text || "").join("\n");
	}

	// The room file is JSON except for setup blocks, kept as text and read on their own.
	parseRoom(text) {
		text = text.replace(/\r\n/g, "\n");
		return JSON.parse(text.replace(/»([\s\S]*?)«/g, (m, body) => JSON.stringify(body)));
	}

	// Setup blocks are hand written. When strict reading fails, trailing commas and numbers
	// with a bare leading or trailing dot are fixed outside of strings, then it is tried again.
	parseObjinit(body, name) {
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
				console.log("could not read the setup of " + name + ", it is left out");
				return null;
			}
		}
	}

	// ------------------------------------------------------------ start

	// The player start: camera reset with room limits off, the world's start room entered,
	// a top down stand in made if the room has no player, the player moved into whatever area
	// they start in, top down players lifted onto what they stand on, and the camera on them.
	start(startrmi) {
		const cam = this.cam;
		cam.reset();
		cam.roomlimit = false;
		this.paused = false;
		cam.fastjump = 1;
		this.controller.conOff = false;

		this.loading = 1;
		const info = this.worldInfo || DEFAULT_WORLD;
		if (startrmi === undefined) startrmi = info.startroomi !== undefined ? info.startroomi : 0;
		this.curuid = (info.curuid !== undefined ? hexToDec(info.curuid) : 0) + UID_PLAY_BUMP;
		this.switchRoom(startrmi);
		this.loading = 0;
		if (this.curroom === null || this.curroom.layers === null) return;

		if (this.guy === null) {
			const guy = this.createObject(oCharTopd, 0, 0, "main_char", { skin: "char" });
			const layers = this.curroom.layers;
			this.layerInsert(layers[layers.length - 1], guy);
			this.setCharAsGuy(guy);
			this.curroom.mainchar = guy;
		}
		Hooks.todo("loading the player's saved state and inventory");

		// the original takes the size from the room the editor had open, the start room
		cam.curw = this.curroom.wd;
		cam.curh = this.curroom.wd * 9 / 16;

		this.findAndGotoAreaAtGuy();

		const guy = this.guy;
		if (truthy(guy.ch_topd)) {
			guy.calcOnFloorAtWallTopd();
			if (guy.onFloorObj !== null && guy.onFloorObj.ht < BIGGEST_INT) guy.z = guy.onFloorObj.ht;
		}

		cam.setTo(guy.x, guy.y);
		this.frames = 0;
		// Kept from the original: areas brought into view while starting are forgotten here.
		this.cur_areas_inview.length = 0;
		this.last_cp = { x: guy.x, y: guy.y };
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

	// The engine's plain create: a new object joining the run order, in no layer.
	instanceCreate(cls, x, y) {
		const obj = new cls(x, y);
		this.instances.push(obj);
		return obj;
	}

	// Makes an object the way the original's levels do: named, remembering its own visibility
	// and hidden from the engine, set up from a table and started if one is given, and put in a layer.
	createObject(cls, x, y, name, initObj, layer, idx) {
		if (typeof cls === "string") cls = OBJECT_TYPES[cls];
		const obj = this.instanceCreate(cls, x, y);
		if (name === 0) name = undefined;
		obj.name = name !== undefined ? this.uniqueName(name) : this.nextUid();
		obj.spi = null;
		obj.pvis = obj.visible;
		obj.visible = false;
		obj.pdis = 0;
		obj.exoffx = 0;
		obj.exoffy = 0;
		obj.sprite_speed = 1;
		obj.sprite_num = 1;
		obj.tiledx = 0;
		obj.tiledy = 0;
		if (initObj) {
			Object.assign(obj, initObj);
			if (typeof obj.init === "function") obj.init();
		}
		if (layer !== undefined) this.layerInsert(layer, obj, idx);
		return obj;
	}

	destroyObject(o) {
		if (!o || o.destroyed) return;
		if (o.mylayer) this.layerRemove(o.mylayer, o);
		if (this.allObjects[o.name] === o) delete this.allObjects[o.name];
		o.destroyed = true;
		if (o instanceof lp_Sprite) return;
		const i = this.instances.indexOf(o);
		if (i >= 0) this.instances.splice(i, 1);
		if (typeof o.onDestroy === "function") o.onDestroy();
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
		if (!(obj instanceof lp_Sprite)) obj.deactivated = truthy(lyr.disabled);
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
			if (spr instanceof lp_Sprite) continue;
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
		if (!(obj instanceof lp_Sprite)) obj.deactivated = !truthy(enabled);
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
	// regrouped by area, then the system layers on top, then the room's own setup.
	loadRoom(rmi) {
		const rm = this.rooms[rmi];
		if (rm.text === null) return;
		const smap = this.parseRoom(rm.text);
		Hooks.todo("object definitions from the world's object file");

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
				const gi = this.parseObjinit(grp.grp_init, key);
				if (gi) Object.assign(grp, gi);
				grp.grp_init = undefined;
			}
		}

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
				const oimap = spri.objinit !== undefined ? this.parseObjinit(spri.objinit, spri.name) : null;
				const oname = spri.name;

				let cls = spri.isobj !== undefined ? OBJECT_TYPES[spri.isobj] : undefined;
				let spi = Sprites.exists(spri.spi) ? spri.spi : "sNoSprite";
				if (spri.isobj !== undefined && cls === undefined) {
					console.log("unknown object type " + spri.isobj + ", placed as a plain picture");
					spi = "sNoSprite";
				}

				let obj;
				if (cls !== undefined) {
					if (oimap && oimap.objtype !== undefined) {
						if (OBJECT_TYPES[oimap.objtype] !== undefined) cls = OBJECT_TYPES[oimap.objtype];
						else console.log("unknown replacement object type " + oimap.objtype);
					}
					// Kept from the original: an object of this name that already exists, from another
					// room or of another type, is taken over instead of a new one being made.
					if (this.allObjects[oname] !== undefined) {
						obj = this.allObjects[oname];
					} else {
						obj = this.createObject(cls, spri.x, spri.y, oname);
					}
					if (oimap && oimap.mainchar !== undefined) {
						this.setCharAsGuy(obj);
						rm.mainchar = obj;
					}
				} else {
					obj = new lp_Sprite();
					obj.spi = spi;
				}

				// the same setup for pictures and objects, the offset moves where it is
				obj.x = spri.x;
				obj.y = spri.y;
				obj.exoffx = spri.exoffx !== undefined ? spri.exoffx : 0;
				obj.exoffy = spri.exoffy !== undefined ? spri.exoffy : 0;
				obj.x += obj.exoffx;
				obj.y += obj.exoffy;
				obj.image_xscale = spri.x_sc !== undefined ? spri.x_sc : 1;
				obj.image_yscale = spri.y_sc !== undefined ? spri.y_sc : 1;
				obj.image_angle = spri.ang !== undefined ? spri.ang : 0;
				obj.image_blend = spri.col !== undefined ? "#" + spri.col : "#ffffff";
				obj.image_alpha = spri.alph !== undefined ? spri.alph : 1;
				// some files store the speed as text
				obj.image_speed = spri.spd !== undefined ? Number(spri.spd) : 1;
				obj.name = oname;
				obj.tiledx = spri.tiledx !== undefined ? spri.tiledx : 0;
				obj.tiledy = spri.tiledy !== undefined ? spri.tiledy : 0;
				obj.tile_loop = spri.tile_loop !== undefined ? spri.tile_loop : 0;

				obj.set_sprite(spi);
				// the frame has to come after the sprite
				obj.image_index = spri.ifr !== undefined ? spri.ifr : 0;

				if (oimap) Object.assign(obj, oimap);
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

				if (spri.paths !== undefined) obj.paths = spri.paths;

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
			const ri = this.parseObjinit(smap.room_init, rm.name);
			if (ri) Object.assign(rm, ri);
		}
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

	// One fixed step. Guess at the engine's order within a step: the controller reads input first,
	// a waiting room change, then begin step, step, animation, and end step with the camera first,
	// since the original made it before anything in a room.
	step() {
		Input.pollPad();
		// the controller has an ordinary step in the original, run ahead of everyone so
		// characters read this frame's buttons, which assumes it was made first
		this.controller.poll();

		if (this.goto_room !== null) {
			const g = this.goto_room;
			this.goto_room = null;
			this.gotoRoomGo(g[0], g[1], g[2], g[3], g[4]);
		}

		this.frames++;
		if (Input.pressed.Tab) this.drawStats = !this.drawStats;

		Hooks.lines.length = 0;

		// a copy, so objects made or destroyed during the step do not upset the walk
		const live = this.instances.slice();

		for (const o of live) {
			if (o.deactivated || o.destroyed || typeof o.onBeginStep !== "function") continue;
			o.onBeginStep();
		}
		for (const o of live) {
			if (o.deactivated || o.destroyed || typeof o.onStep !== "function") continue;
			o.onStep();
		}
		// animation moves on between step and end step, a guess at the engine's timing
		for (const o of live) {
			if (o.deactivated || o.destroyed || o.sprite_index === null) continue;
			const spr = Sprites.get(o.sprite_index);
			const n = Sprites.frameCount(o.sprite_index);
			o.image_index += o.image_speed * spr.imageSpeed;
			if (o.image_index >= n) o.image_index -= n * Math.floor(o.image_index / n);
			if (o.image_index < 0) o.image_index += n * Math.ceil(-o.image_index / n);
		}
		this.cam.onEndStep();
		for (const o of live) {
			if (o.deactivated || o.destroyed || typeof o.onEndStep !== "function") continue;
			o.onEndStep();
		}

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
