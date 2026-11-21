// The script runner, a port of the original's scripty. A script is a list of actions, each a name
// and its values. Each update the runner works through actions until one holds, such as a wait or
// a message waiting on a button, and that one runs again next update. Branches, loops and picked
// choices run as sub scripts, returning to the script that entered them when they run out.
// An action whose name starts with a dot is skipped, which is how scripts comment lines out.

// What a plain say shows: updates before it fades and updates the fade takes.
const SAY_FADE_START = 60;
const SAY_FADE_TIME = 10;
// A message across the screen: how far above the camera's spot, how long before it fades, the
// fade, its backing colour, and its font.
const SAY_SCREEN_OFFY = -40;
const SAY_SCREEN_FADE_START = 60;
const SAY_SCREEN_FADE_TIME = 60;
const SAY_SCREEN_BG_COLOR = "#000000";
const SAY_SCREEN_FONT = "ftScreenTitle";
// How long the player shows off an item they were just given, in updates.
const PRESENT_HELD_UPDATES = 150;

// The engine calls a script may make by name, given the action's remaining values.
const SCRIPT_CALLS = {
	lp_move_obj_to_layer: (obj, lyr, idx) => game.moveObjToLayer(obj, lyr, idx),
	restore_last_layers_state: () => game.restoreLastLayersState(),
	killGuy: (amount, time, xminmax, yminmax, leavevis, soundfx) =>
		game.guy.kill(amount, time, xminmax, yminmax, leavevis, soundfx),
	killGuyDD: (amount, time, dirminmax, dirspdminmax, dir2minmax, dir2spdminmax, leavevis, soundfx) =>
		game.guy.killTwoBursts(amount, time, dirminmax, dirspdminmax, dir2minmax, dir2spdminmax, leavevis, soundfx)
};

// Actions the data uses whose systems are later stages: the spotlight, one time effects, sound,
// copying groups, and the other characters, whose giving and taking go with them. Each logs once
// and is passed over.
const SCRIPT_OPS_NOT_YET = ["setSpotlight", "add_onefx", "playBgSound", "copyGroup",
	"give", "take", "walkTo", "saveCurLoc", "use", "face"];

// A value against another by a comparison's name. On and off count as one and zero.
function scriptValIs(a, comp, b) {
	if (typeof a === "boolean") a = a ? 1 : 0;
	if (typeof b === "boolean") b = b ? 1 : 0;
	if (comp === "equ") return eq(a, b);
	if (comp === "notequ") return ne(a, b);
	if (comp === "grth") return a > b;
	if (comp === "grthequ") return a >= b;
	if (comp === "lsth") return a < b;
	if (comp === "lstheq") return a <= b;
	return false;
}

// One function per action name, run with the runner as this and the action as its value.
// An action that is done sets nexta so the next one runs in the same update, one that holds
// leaves it off and is run again next update.
const ScriptOps = {
	// ------------------------------------------------------------ flow

	if(ca) {
		if (this.doCheck(ca[1])) this.enter_subscript(ca[2]);
		else if (ca.length > 3) this.enter_subscript(ca[3]);
		this.nexta = true;
	},

	// checks in order, the first that holds runs its actions and the rest are passed over
	choose(ca) {
		for (let i = 1; i < ca.length; i++) {
			if (this.doCheck(ca[i][0])) {
				this.enter_subscript(ca[i][1]);
				break;
			}
		}
		this.nexta = true;
	},

	// runs its actions a number of times, coming back here after each
	loop(ca) {
		if (++this.step < ca[1]) this.curai--;
		else this.step = 0;
		this.enter_subscript(ca[2]);
		this.nexta = true;
	},

	randomOne(ca) {
		this.enter_subscript(ca[1][rng.irandom(ca[1].length - 1)]);
		this.nexta = true;
	},

	// a script from the world's script file, run here as part of this one
	exec_script(ca) {
		if (game.script_defs[ca[1]] !== undefined) this.enter_subscript(game.script_defs[ca[1]]);
		this.nexta = true;
	},

	// another script started alongside this one
	runScript(ca) {
		Hooks.runScript(ca[1], this.lookup(ca[2]), undefined, undefined, undefined, this.trigger);
		this.nexta = true;
	},

	exec(ca) {
		if (SCRIPT_CALLS[ca[1]] !== undefined) SCRIPT_CALLS[ca[1]](...ca.slice(2));
		else Hooks.todo("script call " + ca[1]);
		this.nexta = true;
	},

	// a method of a named object, given the action's remaining values
	exec_obj(ca) {
		const obj = this.lookup(ca[1]);
		if (obj) {
			if (typeof obj[ca[2]] === "function") obj[ca[2]](...ca.slice(3));
			else Hooks.todo("script call " + ca[2] + " on " + obj.constructor.name);
		}
		this.nexta = true;
	},

	// ------------------------------------------------------------ waiting and controls

	wait(ca) {
		const time = Array.isArray(ca[1]) ? rng.irandomRange(ca[1][0], ca[1][1]) : ca[1];
		this.curAction = ["waiting", time];
	},

	// set by a wait, counts its updates
	// Guess: the original only finishes on hitting the count exactly, so a wait of nothing never
	// ends there. Here it ends once the count is reached.
	waiting(ca) {
		if (++this.step >= ca[1]) {
			this.nexta = true;
			this.step = 0;
		}
	},

	// set by pause, holds until someone unpauses
	paused(ca) {
		if (truthy(this.pausedone)) {
			this.nexta = true;
			this.pausedone = 0;
		}
	},

	conOff(ca) {
		game.controller.conOff = true;
		this.nexta = true;
	},

	conOn(ca) {
		game.controller.conOff = false;
		this.nexta = true;
	},

	// ------------------------------------------------------------ messages

	// Shown above the sayer, the actor when none is named, for a while and fading, not waited on.
	// Kept from the original: a sayer that cannot be found means nothing is said.
	say(ca) {
		Hooks.popMessage(this.lookup(ca.length > 2 ? ca[2] : this.actor), ca[1], ca[3], ca[4], {
			fadestart: ca.length > 5 ? ca[5] : SAY_FADE_START, fadetime: SAY_FADE_TIME,
			floatspdx: 0, floatspdy: ca.length > 6 ? ca[6] : 0, drawbg: true
		});
		this.nexta = true;
	},

	// Shown until a button moves it on, with the player's controls off meanwhile, and waited on.
	// Picked choices run as part of this script. Kept from the original: the offsets it is given
	// are not used, it always sits at the usual spot above the sayer.
	sayWfB(ca) {
		const msg = Hooks.popMessage(this.lookup(ca.length > 2 ? ca[2] : this.actor), ca[1], undefined, undefined,
			{ fadetime: 0, drawbg: true });
		if (msg === undefined) {
			this.nexta = true;
			return;
		}
		msg.conwasoff = game.controller.conOff;
		game.controller.conOff = true;
		if (ca.length > 5 && Array.isArray(ca[5])) msg.choice_list = ca[5];
		msg.call_script = this;
		msg.onDone = () => this.unpause();
		this.pause();
	},

	// with no backing, so a little lower, and drifting when given speeds
	sayNB(ca) {
		const msg = Hooks.popMessage(this.lookup(ca.length > 2 ? ca[2] : this.actor), ca[1]);
		if (msg !== undefined) {
			msg.y += 2;
			if (ca.length > 3) msg.floatspdx = ca[3];
			if (ca.length > 4) msg.floatspdy = ca[4];
		}
		this.nexta = true;
	},

	// big text over the camera's spot, all at once
	sayScr(ca) {
		const msg = Hooks.popMessage(game.cam, ca[1], 0, SAY_SCREEN_OFFY, {
			fadestart: SAY_SCREEN_FADE_START, fadetime: SAY_SCREEN_FADE_TIME,
			drawbg: false, bgcolor: SAY_SCREEN_BG_COLOR, quick_print: true
		});
		if (msg !== undefined) msg.font = SAY_SCREEN_FONT;
		this.nexta = true;
	},

	// ------------------------------------------------------------ remembered values

	// a value by name for the whole game, nothing given forgets it
	setGameState(ca) {
		if (ca[2] === undefined) delete game.gameState[String(ca[1])];
		else game.gameState[String(ca[1])] = ca[2];
		this.nexta = true;
	},

	// The original sets the value on the runner itself, where nothing reads it. Here it goes with
	// the script's other named values, so the at sign can read it.
	tempVar(ca) {
		this.temps[ca[1]] = ca[2];
		this.nexta = true;
	},

	// a game value copied into the script's own named values
	set_var_fr_st(ca) {
		this.temps[ca[1]] = game.gameState[String(ca[2])];
		this.nexta = true;
	},

	setInstState(ca) {
		game.objStateOf(ca[1])[ca[2]] = ca[3];
		this.nexta = true;
	},

	// added to, with nothing yet counting as nothing
	adjInstState(ca) {
		const st = game.objStateOf(ca[1]);
		st[ca[2]] = (st[ca[2]] !== undefined ? st[ca[2]] : 0) + ca[3];
		this.nexta = true;
	},

	// ------------------------------------------------------------ objects

	setInstVar(ca) {
		const obj = this.lookup(ca[1]);
		if (obj) obj[ca[2]] = ca[3];
		this.nexta = true;
	},

	// Added to. The original fails on a value the object lacks, here that counts as nothing.
	adjInstVar(ca) {
		const obj = this.lookup(ca[1]);
		if (obj) obj[ca[2]] = (obj[ca[2]] !== undefined ? obj[ca[2]] : 0) + ca[3];
		this.nexta = true;
	},

	// the actor remembers the update it last did something, under a name
	set_last(ca) {
		if (this.actor) this.actor[ca[1]] = game.frames;
		this.nexta = true;
	},

	// shown, hidden, or the other way round
	setVis(ca) {
		const obj = this.lookup(ca[1]);
		if (obj) obj.visible = ca[2] === "toggle" ? !truthy(obj.visible) : ca[2];
		this.nexta = true;
	},

	// switched on or off, or the other way round, which neither runs nor collides while off
	setActive(ca) {
		const obj = this.lookup(ca[1]);
		if (obj) game.setObjEnabled(obj, ca[2] === "toggle" ? !obj.active : ca[2]);
		this.nexta = true;
	},

	// one update for an object, even one switched off
	objStep(ca) {
		const obj = this.lookup(ca[1]);
		if (obj) {
			obj.update();
			if (obj.afterUpdate !== undefined) obj.afterUpdate();
		}
		this.nexta = true;
	},

	obj_set_sprite(ca) {
		const obj = this.lookup(ca[1]);
		if (obj) {
			Draw.setSprite(obj, ca[2]);
			obj.ifr = 0;
		}
		this.nexta = true;
	},

	// An object made at a spot, named when a name is given, with settings laid on, into a layer
	// by name, the actor's layer, or the pop up layer when none is given. Anything that is not a
	// layer name, like the minus one some old scripts pass to mean none, also gets the pop up layer.
	createObj(ca) {
		let lyr = ca[5];
		if (lyr === "actor") lyr = this.actor.mylayer;
		else if (typeof lyr === "string") lyr = game.findLayer(lyr);
		if (!(lyr instanceof Layer)) lyr = game.popupLayer;
		if (objectType(ca[1]) === undefined) {
			Hooks.todo("script making an unknown object " + ca[1]);
		} else {
			const cfg = { x: ca.length > 2 ? ca[2] : 0, y: ca.length > 3 ? ca[3] : 0 };
			if (ca[4] !== undefined && ca[4] !== 0) cfg.name = ca[4];
			game.createObject(ca[1], Object.assign(cfg, ca[6]), lyr);
		}
		this.nexta = true;
	},

	destroy(ca) {
		const obj = this.lookup(ca[1]);
		if (obj instanceof oBaseObject) obj.destroy();
		else if (obj) game.forgetObject(obj);
		this.nexta = true;
	},

	// by name, or the caller when it is itself
	remObj(ca) {
		const obj = ca[1] === "self" ? this.trigger : game.allObjects[ca[1]];
		if (obj instanceof oBaseObject) obj.destroy();
		else if (obj) game.forgetObject(obj);
		this.nexta = true;
	},

	// The script ends here unless the object's being there is as asked.
	// The original asked about the name itself, here the name is looked up.
	checkExists(ca) {
		const obj = this.lookup(ca[1]);
		if ((!!obj && !obj.destroyed) !== truthy(ca[2])) this.scrExit = true;
		else this.nexta = true;
	},

	// the trigger that started this never fires again
	trigOff(ca) {
		if (this.trigger) this.trigger.trigOnce = true;
		this.nexta = true;
	},

	// a value of an object eased to a new one over a number of updates
	obj_fade(ca) {
		const obj = this.lookup(ca[1]);
		if (obj) {
			game.createObject(oFader, { obj: obj, obj_var: ca[2], final_val: ca[3], time: ca[4] },
				obj.mylayer ? obj.mylayer : undefined);
		}
		this.nexta = true;
	},

	// ------------------------------------------------------------ the player

	// a knock from the middle of whoever hits
	hit(ca) {
		const by = this.lookup(ca[1]);
		if (by) game.guy.takeHit((by.bbox_left + by.bbox_right) / 2, (by.bbox_top + by.bbox_bottom) / 2, ca[2]);
		this.nexta = true;
	},

	// alive again, at the last checkpoint, where they last stood still, or at a spot
	reviveGuy(ca) {
		const guy = game.guy;
		game.reviveGuy();
		if (ca[1] === "last_cp") {
			guy.x = game.last_cp.x;
			guy.y = game.last_cp.y;
		} else if (ca[1] === "last_stand") {
			guy.x = guy.lastsx;
			guy.y = guy.lastsy;
			// only top down players remember a height
			if (guy.lastsz !== undefined) guy.z = guy.lastsz;
		} else if (ca.length > 2) {
			guy.x = ca[1];
			guy.y = ca[2];
		}
		this.nexta = true;
	},

	// a sprite drawn over the player, by name
	set_overspr(ca) {
		game.guy.over_sprite = ca[1];
		this.nexta = true;
	},

	set_weather(ca) {
		game.weather.set_weather(ca[1]);
		this.nexta = true;
	},

	// ------------------------------------------------------------ camera

	// follows someone over a time, pans to a spot over a time, or stays where it is
	lockCamTo(ca) {
		if (ca.length > 1 && typeof ca[1] === "string") game.cam.pan(this.lookup(ca[1]), ca[2]);
		else if (ca.length > 2) game.cam.lockToStatic(ca[1], ca[2], ca[3]);
		else game.cam.lockToCurrent(ca[1]);
		this.nexta = true;
	},

	zoomCamTo(ca) {
		game.cam.switchZoom(ca.length > 1 ? ca[1] : 1, ca.length > 2 ? ca[2] : 1);
		this.nexta = true;
	},

	updateCam(ca) {
		game.cam.update();
		this.nexta = true;
	},

	// ------------------------------------------------------------ the inventory

	// The actor picks up a named thing, and with one more value the player shows it off.
	pickup(ca) {
		const obj = this.lookup(ca[1]);
		if (obj && this.actor && this.actor.inv) this.actor.inv.pickup(obj);
		if (ca.length > 2) game.guy.presenting = PRESENT_HELD_UPDATES;
		this.nexta = true;
	},

	// A new object of a kind put straight into someone's hands, gone again if they cannot take it,
	// and with one more value the player shows it off.
	giveNew(ca) {
		const towho = this.lookup(ca[2]);
		if (objectType(ca[1]) === undefined) {
			Hooks.todo("script giving an unknown object " + ca[1]);
		} else if (towho && towho.inv) {
			const obj = game.createObject(ca[1], {});
			if (towho.inv.pickup(obj) === undefined) obj.destroy();
		}
		if (ca.length > 3) game.guy.presenting = PRESENT_HELD_UPDATES;
		this.nexta = true;
	},

	// Takes the item in hand away for good. The one holding it is whoever last acted on the actor,
	// as a character being given something remembers, else the actor. The original only looked at
	// the actor, which for a character being given something holds nothing.
	take_obj(ca) {
		const holder = (this.actor && this.actor.actwho) || this.actor;
		if (holder && holder.inv) {
			const obj = holder.inv.drop_held();
			if (obj) obj.destroy();
		}
		this.nexta = true;
	},

	// ------------------------------------------------------------ rooms, layers and areas

	layerViz(ca) {
		game.layerViz(ca[1], ca[2]);
		this.nexta = true;
	},

	// Kept from the original: only the first two values count, so a group that cannot be found
	// does nothing.
	groupViz(ca) {
		if (game.obj_groups[ca[1]] !== undefined) game.groupSetEnabled(game.obj_groups[ca[1]], truthy(ca[2]));
		this.nexta = true;
	},

	// Shows one level of the player's area. The level can come from the script's named values
	// with an at sign, or the game's with a dollar sign. Kept from the original: while that value
	// is missing this holds, trying again each update.
	enter_area_level(ca) {
		let lvl = ca[1];
		if (typeof lvl === "string" && lvl.charAt(0) === "@") lvl = this.temps[lvl.substring(1)];
		else if (typeof lvl === "string" && lvl.charAt(0) === "$") lvl = game.gameState[lvl.substring(1)];
		if (lvl === undefined) return;
		game.areaSetLevel(lvl);
		this.nexta = true;
	},

	// Another room, entering at a named object, then a wait of one update while it is built.
	goto_room(ca) {
		game.gotoRoom(ca[1], this.trigger, ca[2], ca[3], ca[4]);
		this.curAction = ["waiting", 1];
	},

	// The actor jumps to a named object, by default keeping their offset from the caller, as from
	// one door to another. The camera can keep its offset from the actor, or from whoever it last
	// followed, so the view does not jump.
	goto_obj(ca) {
		const actor = this.actor;
		const to = game.allObjects[ca[1]];
		const cam = game.cam;
		this.nexta = true;
		if (!actor || !to || !this.trigger) {
			console.log("scripty: goto_obj needs an actor, a caller and the object " + ca[1]);
			return;
		}
		const camofx = cam.x - actor.x;
		const camofy = cam.y - actor.y;
		const eox = actor.x - this.trigger.x;
		const eoy = actor.y - this.trigger.y;

		// arriving inside a trigger counts as already in it
		if (to.inTrigger !== undefined) {
			to.inTrigger = 1;
			to.triggered = 1;
		}

		actor.x = to.x;
		actor.y = to.y;
		actor.rx = 0;
		actor.ry = 0;
		if (truthy(ca.length > 2 ? ca[2] : 1)) {
			actor.x += eox;
			actor.y += eoy;
		}

		const syncCam = ca.length > 3 ? ca[3] : 0;
		if (truthy(syncCam)) {
			if (syncCam === 2) {
				cam.x = actor.x + cam.lastfolofx;
				cam.y = actor.y + cam.lastfolofy;
			} else {
				cam.x = actor.x + camofx;
				cam.y = actor.y + camofy;
			}
			cam.fastjump = 1;
		}
	}
};

for (const name of SCRIPT_OPS_NOT_YET) {
	ScriptOps[name] = function () {
		Hooks.todo("script action " + name);
		this.nexta = true;
	};
}

// Runs one script. Made by the script hook, which takes its first step at once, then steps every
// update in the order scripts started, until it runs out, ends early, or is destroyed.
class oScripty extends oBaseObject {
	constructor() {
		super();
		this.visible = false;
		this.script = [];
		// whoever started it, which the script calls itself
		this.trigger = null;
		this.actor = null;
		// the next action's place, and the action running
		this.curai = 0;
		this.curAction = undefined;
		// a count for the action running, such as a wait's updates or a loop's rounds
		this.step = 0;
		// the script's own named values
		this.temps = {};
		// a button can cut the script short, running the skip script instead
		this.skippable = false;
		this.skipScript = -1;
		this.nexta = false;
		this.scrExit = false;
		// called once it finishes
		this.onDone = null;
		// the scripts this one is inside, each with its place and count to go back to
		this.upScripts = [];
		this.pausedone = 0;
	}

	// holds the script until unpaused
	pause() {
		this.pausedone = 0;
		this.curAction = ["paused"];
	}

	unpause() {
		this.pausedone = 1;
	}

	// Runs actions as part of this script, coming back to where it was once they run out.
	enter_subscript(subscr) {
		if (subscr.length > 0 && !Array.isArray(subscr[0])) subscr = [subscr];
		this.upScripts.push({ script: this.script, curai: this.curai, step: this.step });
		this.script = subscr;
		this.curai = 0;
		this.step = 0;
	}

	// A name in an action: the player, the actor, the caller, or any object by name.
	lookup(v) {
		if (v === "main") return game.guy;
		if (v === "actor") return this.actor;
		if (v === "self") return this.trigger;
		return game.lookupInst(v, this.trigger);
	}

	// Whether a check holds. A bare number is the odds it does. The others check values of objects,
	// their state or the game's, chance, distance, or the time since something, or combine checks.
	doCheck(check) {
		if (typeof check === "number" || typeof check === "boolean") return rng.random(1) < check;
		if (!Array.isArray(check)) return false;

		const type = check[0];
		if (type === "true") return true;
		if (type === "and" || type === "or") {
			if (!Array.isArray(check[1])) return false;
			for (const c of check[1]) {
				if (this.doCheck(c) !== (type === "and")) return type === "or";
			}
			return type === "and";
		}
		if (type === "rando") return rng.random(check[2]) <= check[1];
		if (type === "instVarIs") {
			const obj = this.lookup(check[1]);
			const v = obj ? obj[check[2]] : undefined;
			return scriptValIs(v !== undefined ? v : false, check[3], check[4]);
		}
		if (type === "instStateIs") {
			const v = game.objStateOf(check[1])[check[2]];
			return scriptValIs(v !== undefined ? v : 0, check[3], check[4]);
		}
		if (type === "gameStateIs") {
			const v = game.gameState[String(check[1])];
			return scriptValIs(v !== undefined ? v : false, check[2], check[3]);
		}
		if (type === "instExists") {
			const obj = this.lookup(check[1]);
			return (!!obj && !obj.destroyed) === truthy(check[2]);
		}
		// how far from here to the nearest of a kind of object, or to a named one, edge to edge
		if (type === "objDist") {
			const cls = objectType(check[1]);
			const named = cls === undefined ? this.lookup(check[1]) : undefined;
			let dist = Infinity;
			for (const o of cls !== undefined ? game.instances : [named]) {
				if (!o || (cls !== undefined && (!(o instanceof cls) || !o.active))) continue;
				const dx = Math.max(o.bbox_left - this.x, 0, this.x - o.bbox_right);
				const dy = Math.max(o.bbox_top - this.y, 0, this.y - o.bbox_bottom);
				dist = Math.min(dist, Math.sqrt(dx * dx + dy * dy));
			}
			return scriptValIs(dist, check[2], check[3]);
		}
		// Whether the item being given is of a kind. The giver is whoever last acted on the actor,
		// as a character being given something remembers, else the actor.
		if (type === "isGive") {
			const giver = (this.actor && this.actor.actwho) || this.actor;
			return !!giver && !!giver.carrying && giver.carrying.constructor === objectType(check[1]);
		}
		// The original read the time from the runner itself, where nothing writes it. Here it is
		// the actor's, where remembering the last time puts it.
		if (type === "timeSince") {
			const last = this.actor ? this.actor[check[1]] : undefined;
			return scriptValIs(game.frames - (last !== undefined ? last : 0), check[2], check[3]);
		}
		return false;
	}

	update() {
		// Cut short by a button: the skip script runs from its start instead, with nothing to
		// return to. The original ran its first action twice and could return into what it left.
		if (truthy(this.skippable) && (game.uiController.iBtnX || game.uiController.iBtnB)) {
			this.script = Array.isArray(this.skipScript) ? this.skipScript : [];
			this.upScripts.length = 0;
			this.curai = 0;
			this.step = 0;
			this.curAction = undefined;
		}

		this.nexta = true;
		while (this.nexta) {
			this.nexta = false;

			if (this.curAction === undefined) {
				// out of actions, back into the script this one was entered from, or done
				while (this.curai >= this.script.length) {
					if (this.upScripts.length === 0) {
						this.scrExit = true;
						break;
					}
					const up = this.upScripts.pop();
					this.script = up.script;
					this.curai = up.curai;
					this.step = up.step;
				}
				if (this.scrExit) break;
				this.curAction = this.script[this.curai++];
			}

			const ca = this.curAction;
			const type = Array.isArray(ca) ? ca[0] : undefined;
			if (type === "goto") {
				// to a place by number, or to a label by name here or in the scripts this one is inside
				let to = ca[1];
				if (typeof to === "string" && to.trim() !== "" && !isNaN(Number(to))) to = Number(to);
				if (typeof to === "string") {
					const label = to;
					to = this.script.findIndex((a) => a[0] === ".>" && a[1] === label);
					for (let ui = this.upScripts.length - 1; to < 0 && ui >= 0; ui--) {
						to = this.upScripts[ui].script.findIndex((a) => a[0] === ".>" && a[1] === label);
						if (to >= 0) {
							this.script = this.upScripts[ui].script;
							this.step = 0;
							this.upScripts.length = ui;
						}
					}
					// not found, carry on from here
					if (to < 0) to = this.curai;
				}
				this.curai = to;
				this.nexta = true;
			} else if (typeof type === "string" && type.charAt(0) === ".") {
				this.nexta = true;
			} else if (ScriptOps[type] === undefined) {
				console.log("scripty: " + type + " not known.");
				this.nexta = true;
			} else {
				ScriptOps[type].call(this, ca);
			}

			if (this.nexta) this.curAction = undefined;
		}

		if (this.scrExit) {
			if (this.onDone !== null) this.onDone();
			this.destroy();
		}
	}
}
