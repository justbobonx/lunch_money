// The game shell for stage one: loads the test room, runs the fixed step loop,
// follows the player with the camera and draws everything as boxes, the player from its sheet.
// Effects, sound, scripts and the inventory are stubs here that log once what was asked of them.

// steps per second, as in the original
const STEP_HZ = 60;

// size of the game view in game pixels
const VIEW_W = 320;
const VIEW_H = 180;

// the most steps run to catch up after a slow frame
const MAX_CATCHUP_STEPS = 5;

const ROOM_FILE = "assets/room_TestDev.dat";

// The saved camera bounds frame an area away from where the player starts,
// and the original start code switches room limits off, so clamping is off by default.
const CAMERA_CLAMP_TO_ROOM_BOUNDS = false;

// draw the paths the movers report, and a line of player state
const SHOW_DEBUG_LINES = false;
const SHOW_DEBUG_TEXT = true;

const BACKDROP_COLOR = "#000000";
const BOX_FILL_ALPHA = 0.35;
const DECOR_FILL_ALPHA = 0.6;
const UNPORTED_COLOR = "#ff00ff";
const LABEL_COLOR = "#ffffff";
const DEBUG_TEXT_COLOR = "#ffff66";
const LABEL_FONT = "5px monospace";

// Calls out to systems that come in later stages. Each one logs the first time it is asked.
const Hooks = {
	told: {},
	lines: [],

	todo(what) {
		if (this.told[what]) return;
		this.told[what] = true;
		console.log("not yet: " + what);
	},
	debugLine(x1, y1, x2, y2, color) {
		if (SHOW_DEBUG_LINES) this.lines.push({ x1: x1, y1: y1, x2: x2, y2: y2, color: color });
	},
	splash(who) {
		this.todo("water splash");
	},
	particles(kind, who, x, y) {
		this.todo("particles: " + kind);
		return null;
	},
	sound(name) {
		this.todo("sound " + name);
	},
	popMessage(who, text, offx, offy) {
		this.todo("pop up message");
	},
	runScript(script, who) {
		this.todo("scripts");
	}
};

// A plain picture placed in a room. It never runs or collides, it is only drawn.
class lp_Sprite {
	constructor() {
		this.x = 0;
		this.y = 0;
		this.spi = null;
		this.sprite_index = null;
		this.mask_index = null;
		this.image_index = 0;
		this.image_speed = 1;
		this.image_xscale = 1;
		this.image_yscale = 1;
		this.image_angle = 0;
		this.image_blend = "#ffffff";
		this.image_alpha = 1;
		this.pvis = true;
		this.pdis = 0;
		this.destroyed = false;
	}
	set_sprite(spri) {
		this.spi = spri;
		this.sprite_index = spri;
	}
}

class Game {
	constructor() {
		// every live object in creation order, which is also the order events run in
		this.instances = [];
		this.layers = [];
		this.room = null;
		this.guy = null;
		this.controller = new Controller();
		this.frame = 0;
		this.cam = {
			// the center of the view
			x: VIEW_W / 2,
			y: VIEW_H / 2,
			follow: null,
			shakeit(time, amount, speed) {
				Hooks.todo("camera shake");
			}
		};
		this.canvas = null;
		this.ctx = null;
		this.lastTime = 0;
		this.acc = 0;
	}

	// The room file is JSON except for object setup blocks, kept as text and read on their own.
	parseRoom(text) {
		text = text.replace(/\r\n/g, "\n");
		return JSON.parse(text.replace(/»([\s\S]*?)«/g, (m, body) => JSON.stringify(body)));
	}

	// Object setup blocks are hand written. When strict reading fails, trailing commas,
	// numbers with a bare leading or trailing dot are fixed outside of strings, then it is tried again.
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

	// Makes an object the way the room loader does: it remembers its own visibility
	// and hides itself from the engine, then joins the run order.
	createObject(cls, x, y, name) {
		const obj = new cls(x, y);
		obj.name = name;
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
		this.instances.push(obj);
		return obj;
	}

	destroyObject(o) {
		if (o.destroyed) return;
		o.destroyed = true;
		const i = this.instances.indexOf(o);
		if (i >= 0) this.instances.splice(i, 1);
		if (o.mylayer) {
			const li = o.mylayer.lsprites.indexOf(o);
			if (li >= 0) o.mylayer.lsprites.splice(li, 1);
		}
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

	// Turns a layer's objects on or off. The room itself always counts as on here.
	setLayerEnabled(lyr, enabled) {
		lyr.disabled = !enabled;
		for (const spr of lyr.lsprites) {
			if (spr instanceof lp_Sprite) continue;
			const oenabled = !lyr.disabled && !truthy(spr.pdis);
			spr.deactivated = !oenabled;
			// triggers you are standing in fire again
			if (oenabled && spr.inTrigger !== undefined && !truthy(spr.no_trig_on_reenter)) {
				spr.inTrigger = 0;
				spr.triggered = 0;
			}
		}
	}

	// Builds the room in the original's order: every layer and its things first,
	// then every object's own setup, then the layers saved as switched off.
	loadRoom(text) {
		const smap = this.parseRoom(text);
		const wd = smap.roomw !== undefined ? smap.roomw : 320;
		this.room = {
			wd: wd,
			ht: wd * 9 / 16,
			bd_color: smap.bd_color !== undefined ? "#" + smap.bd_color : BACKDROP_COLOR,
			camx: smap.camx,
			camy: smap.camy,
			camw: smap.camw,
			camh: smap.camh,
			mainchar: null
		};

		for (const laymap of smap.layers) {
			let lyr;
			// a name starting with a caret adds to the layer before it
			if (laymap.name.charAt(0) === "^") {
				lyr = this.layers[this.layers.length - 1];
			} else {
				lyr = {
					name: laymap.name,
					plx_x: laymap.plx_x !== undefined ? laymap.plx_x : 1,
					plx_y: laymap.plx_y !== undefined ? laymap.plx_y : 1,
					wd: laymap.wd !== undefined ? laymap.wd : 320,
					zsort: laymap.zsort !== undefined ? laymap.zsort : 0,
					idisabled: laymap.disabled !== undefined ? laymap.disabled : 0,
					visible: laymap.visible !== undefined ? laymap.visible : 1,
					disabled: false,
					lgroup: null,
					lsprites: []
				};
				lyr.ht = lyr.wd * 9 / 16;
				this.layers.push(lyr);
			}

			for (const spri of laymap.spriteList) {
				const oimap = spri.objinit !== undefined ? this.parseObjinit(spri.objinit, spri.name) : null;

				let cls = spri.isobj !== undefined ? OBJECT_TYPES[spri.isobj] : undefined;
				let spi = spri.spi;
				if (spri.isobj !== undefined && cls === undefined) {
					console.log("unknown object type " + spri.isobj + ", placed as a plain picture");
					spi = "sNoSprite";
				}

				let obj;
				if (cls !== undefined) {
					if (oimap && oimap.objtype !== undefined) {
						if (OBJECT_TYPES[oimap.objtype] !== undefined) {
							cls = OBJECT_TYPES[oimap.objtype];
						} else {
							console.log("unknown replacement object type " + oimap.objtype);
						}
					}
					obj = this.createObject(cls, spri.x, spri.y, spri.name);
					if (oimap && oimap.mainchar !== undefined) {
						this.setCharAsGuy(obj);
						this.room.mainchar = obj;
					}
				} else {
					obj = new lp_Sprite();
					obj.spi = spi;
				}

				// the same setup for pictures and objects, offsets move where it is
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
				obj.name = spri.name;

				obj.tiledx = spri.tiledx !== undefined ? spri.tiledx : 0;
				obj.tiledy = spri.tiledy !== undefined ? spri.tiledy : 0;
				obj.tile_loop = spri.tile_loop !== undefined ? spri.tile_loop : 0;

				obj.set_sprite(spi);

				// the frame has to come after the sprite
				obj.image_index = spri.ifr !== undefined ? spri.ifr : 0;

				if (oimap) {
					Object.assign(obj, oimap);
				}

				if (spri.groups !== undefined) {
					obj.groups = spri.groups;
					Hooks.todo("object groups");
				}

				if (obj._mask !== undefined) {
					Hooks.todo("layer masks");
				} else if (obj.st_nolayer === undefined) {
					obj.mylayer = lyr;
					lyr.lsprites.push(obj);
				} else {
					// kept out of every layer, so never active
					obj.deactivated = true;
				}
			}
		}

		// object setup runs once everything exists, so it can find things in other layers
		for (const lyr of this.layers) {
			for (const obj of lyr.lsprites) {
				if (typeof obj.init === "function") obj.init();
			}
		}

		for (const lyr of this.layers) {
			if (truthy(lyr.idisabled)) this.setLayerEnabled(lyr, false);
		}

		this.updateCamera();
	}

	updateCamera() {
		if (this.cam.follow) {
			this.cam.x = this.cam.follow.x;
			this.cam.y = this.cam.follow.y - this.cam.follow.z;
		}
		if (CAMERA_CLAMP_TO_ROOM_BOUNDS && this.room.camw !== undefined) {
			this.cam.x = clamp(this.cam.x, this.room.camx + VIEW_W / 2, this.room.camx + this.room.camw - VIEW_W / 2);
			this.cam.y = clamp(this.cam.y, this.room.camy + VIEW_H / 2, this.room.camy + this.room.camh - VIEW_H / 2);
		}
	}

	// One fixed step. The order of the original's events within a step is a guess:
	// the controller reads input first, then begin, step, animation, end step, then the camera.
	step() {
		Input.pollPad();
		// the controller has an ordinary step in the original, run ahead of everyone so
		// characters read this frame's buttons, which assumes it was created first
		this.controller.poll();

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
		// animation moves on between step and end step, a guess at the original's timing
		for (const o of live) {
			if (o.deactivated || o.destroyed || o.sprite_index === null) continue;
			const spr = Sprites.get(o.sprite_index);
			const n = Sprites.frameCount(o.sprite_index);
			o.image_index += o.image_speed * spr.imageSpeed;
			if (o.image_index >= n) o.image_index -= n * Math.floor(o.image_index / n);
			if (o.image_index < 0) o.image_index += n * Math.ceil(-o.image_index / n);
		}
		for (const o of live) {
			if (o.deactivated || o.destroyed || typeof o.onEndStep !== "function") continue;
			o.onEndStep();
		}

		this.updateCamera();
		Input.endFrame();
		this.frame++;
	}

	// Layers draw in file order, each moved by its parallax. Things with a sheet picture
	// draw it, everything else is a tinted box in its mask's shape.
	draw() {
		const ctx = this.ctx;
		const left = Math.round(this.cam.x - VIEW_W / 2);
		const top = Math.round(this.cam.y - VIEW_H / 2);

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = 1;
		ctx.fillStyle = this.room.bd_color;
		ctx.fillRect(0, 0, VIEW_W, VIEW_H);

		for (const lyr of this.layers) {
			if (!truthy(lyr.visible) || lyr.disabled) continue;
			const ox = Math.round(left * lyr.plx_x);
			const oy = Math.round(top * lyr.plx_y);
			for (const o of lyr.lsprites) {
				if (!truthy(o.pvis) || o.destroyed) continue;
				this.drawThing(ctx, o, ox, oy);
			}
		}

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = 1;
		for (const l of Hooks.lines) {
			ctx.strokeStyle = l.color;
			ctx.beginPath();
			ctx.moveTo(l.x1 - left + 0.5, l.y1 - top + 0.5);
			ctx.lineTo(l.x2 - left + 0.5, l.y2 - top + 0.5);
			ctx.stroke();
		}

		if (SHOW_DEBUG_TEXT && this.guy) {
			ctx.fillStyle = DEBUG_TEXT_COLOR;
			ctx.font = LABEL_FONT;
			ctx.fillText(Math.round(this.guy.x) + "," + Math.round(this.guy.y) + " " + this.guy.drawSprite
				+ (truthy(this.guy.onFloor) ? " floor" : ""), 2, 7);
		}
	}

	drawThing(ctx, o, ox, oy) {
		const spr = Sprites.records[o.sprite_index];
		const isObject = !(o instanceof lp_Sprite);
		// height lifts top down things off the ground
		const z = isObject ? o.z : 0;

		if (spr && spr.image && spr.frames) {
			const f = spr.frames[Math.floor(o.image_index) % spr.frames.length];
			// characters flip by facing, the mask never flips
			const flip = (o.facing !== undefined && isObject && o instanceof oChar) ? (o.facing !== 0 ? o.facing : 1) : 1;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.globalAlpha = o.image_alpha;
			ctx.translate(Math.round(o.x - ox), Math.round(o.y - z - oy));
			ctx.rotate(-degToRad(o.image_angle));
			ctx.scale(o.image_xscale * flip, o.image_yscale);
			ctx.drawImage(spr.image, f[0], f[1], f[2], f[3], -spr.ox, -spr.oy, f[2], f[3]);
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.globalAlpha = 1;
			return;
		}

		// unknown pictures have no real size, so they are left out
		if (!isObject && (!spr || spr.unknown)) return;

		const s = maskShape(o, o.x, o.y - z);
		if (!s) return;
		const unported = isObject && o.constructor.ported === false;

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = o.image_alpha * (isObject ? BOX_FILL_ALPHA : DECOR_FILL_ALPHA);
		ctx.fillStyle = o.image_blend;
		ctx.beginPath();
		if (s.circle) {
			ctx.arc(s.circle.x - ox, s.circle.y - oy, s.circle.r, 0, Math.PI * 2);
		} else if (s.poly) {
			ctx.moveTo(s.poly[0].x - ox, s.poly[0].y - oy);
			for (const p of s.poly) ctx.lineTo(p.x - ox, p.y - oy);
			ctx.closePath();
		} else {
			ctx.rect(s.l - ox, s.t - oy, s.r - s.l + 1, s.b - s.t + 1);
		}
		ctx.fill();
		if (isObject) {
			ctx.globalAlpha = o.image_alpha;
			ctx.strokeStyle = unported ? UNPORTED_COLOR : o.image_blend;
			ctx.lineWidth = 1;
			ctx.strokeRect(s.l - ox + 0.5, s.t - oy + 0.5, s.r - s.l, s.b - s.t);
		}
		if (unported) {
			ctx.globalAlpha = 1;
			ctx.fillStyle = LABEL_COLOR;
			ctx.font = LABEL_FONT;
			ctx.fillText(o.constructor.name, s.l - ox + 1, s.t - oy + 6);
		}
		ctx.globalAlpha = 1;
	}

	// Loads the sheets and the room, then runs at a fixed rate whatever the display rate.
	async start(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.ctx.imageSmoothingEnabled = false;
		Input.attach(window);

		await Sprites.load(
			(path) => fetch(path).then((r) => r.json()),
			(path) => new Promise((resolve, reject) => {
				const img = new Image();
				img.onload = () => resolve(img);
				img.onerror = reject;
				img.src = path;
			})
		);
		const text = await fetch(ROOM_FILE).then((r) => r.text());
		this.loadRoom(text);

		const stepMs = 1000 / STEP_HZ;
		const tick = (now) => {
			if (this.lastTime === 0) this.lastTime = now;
			this.acc += now - this.lastTime;
			this.lastTime = now;
			let steps = 0;
			while (this.acc >= stepMs && steps < MAX_CATCHUP_STEPS) {
				this.step();
				this.acc -= stepMs;
				steps++;
			}
			// too far behind, drop the rest rather than spiral
			if (steps === MAX_CATCHUP_STEPS) this.acc = 0;
			this.draw();
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	}
}

const game = new Game();
