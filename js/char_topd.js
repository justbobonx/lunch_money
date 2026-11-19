// The top down player: walking with an analog feel, hopping in height, diving into
// rolls, climbing ladders by height, pushing things and bouncing off what cannot be stood on.
// A bug for bug port: odd checks in the original are kept and called out where they are.
// Sound, effects, camera shake, the inventory and scripts are later stages and go through the hooks.

// how fast each axis speeds up per unit of stick lean
const TOPD_WALK_ACCEL = 0.3;

// above this height over the floor, air control fades
const TOPD_HIGH_ABOVE_FLOOR = 5;

// standing still this long turns us to face down
const TOPD_IDLE_FACE_DOWN_FRAMES = 600;

// a climb jump straight up gets this much extra hop
const TOPD_LADDER_JUMP_BOOST = 0.7;

// above this move speed the run sprite is used instead of the walk
const TOPD_RUN_SPRITE_SPEED = 1.4;

class oCharTopd extends oChar {
	constructor(x, y) {
		super(x, y);
		this.persistent = true;

		this.skin = "guy";

		this.ch_side = 0;
		this.ch_topd = 1;

		this.step = 0;
		this.paused = 0;

		this.facing = 0;
		this.facingy = 1;

		this.lastRjV = 0;

		this.otherstate = false;
		this.giveup = false;

		this.canJump = 1;
		this.canHang = true;
		this.canDive = true;
		this.canRoll = true;
		this.canCrawl = true;
		this.canSlide = true;
		this.canClimb = true;
		this.climbH = 2.5;
		this.canFight = 0;

		this.jumping = 0;
		this.jumped = 1;
		this.prejumpx = x;
		this.prejumpy = y;

		this.maxjumph = 1.0;
		this.jumpRunBoost = 0.2;
		this.jumph = this.maxjumph;
		this.bumpStopsJump = true;
		this.landed = false;
		// height above the floor
		this.haf = 0;

		this.divespdboost = 2;
		this.rolltime = 31;
		this.divedrop = 0;

		this.runspd = 1.333;
		this.crawlspd = 0.4;
		this.climbspd = 0.6;
		this.maxspd = 6;
		this.dropFallKillSpd = 10;

		this.climbing = false;
		this.wasclimbing = false;

		this.riding = null;
		this.ride_sprite = "ride";
		this.ride_spr_u = "";
		this.ride_spr_d = "";

		this.aiming = 0;
		this.aimdir = 0;
		this.aimdist = 17;
		this.aim_inc = 4;

		this.over_sprite = null;

		// scripts can freeze us until the stick is let go
		this.waitfornomove = 0;

		this.still = 0;
		this.stillx = 0;
		this.stilly = 0;

		this.defgrav = 0.1;
		this.grav = this.defgrav;

		this.fric = 0.3;
		this.air_fric = 0.1;

		this.dead = false;
		this.deadAmnt = 0;
		this.deadTime = 0;
		this.deadXspd = 0;
		this.deadYspd = 0;

		this.lastsx = x;
		this.lastsy = y;
		this.lastsz = this.z;

		this.xmoving = 0;
		this.ymoving = 0;
		this.moving = 0;
		this.spdis0 = 0;
		this.curspdang = 0;

		this.look_mask = null;
		this.lookObjs = [];
		this.carrying = null;
		this.drop_request = 0;
		this.drop_offx = 5;
		this.drop_offy = 4;

		// hand height per run frame, and while in the air
		this.carryofy_run = [-1, -0, -1, -0];
		this.carryofy_jump = -1;

		this.inv = new Inventory(12, "s_inv_ofm_bag", this, "Tem");
		this.inv.set_height(3);
		this.inv_list = this.inv.inv_list;

		this.climbobj = null;
		this.cur_held_i = -1;
		this.shadowSprite = null;
	}

	// sets the stand sprite, then the special top down mask and the reach mask
	init() {
		super.init();
		this.mask_index = Sprites.exists(this.skin + "_topd_mask") ? this.skin + "_topd_mask" : null;
		this.look_mask = Sprites.exists(this.skin + "_ia_bb") ? this.skin + "_ia_bb" : null;
	}

	// Gets off a ladder at the top or bottom. Off the top moves us up by our height.
	// When not jumping, our climb height turns back into floor height.
	offLadderTopd() {
		this.climbing = false;
		// so we do not grab straight back on
		this.wasclimbing = 1;

		const isup = (this.bbox_bottom - this.z - sign(this.zspd)) < this.climbobj.bbox_top;

		this.y -= isup ? (this.z + sign(this.zspd)) : 0;

		if (truthy(this.jumping)) {
			// down and jump just drops
			if (this.con.iDown) {
				this.zspd = 0;
				this.jumping = 0;
			}
		} else {
			this.yspd = -this.zspd / 2;
			this.zspd = 0;
			this.z = 0;
			this.rz = 0;

			this.calcOnFloorAtWallTopd();
			if (this.onFloorObj !== null) {
				this.z = this.onFloorObj.ht;
				this.y += this.z;
			}
		}
	}

	// Picks the sprite from the current state with up and down variants,
	// positions the carried item, and pushes us out of anything a new mask overlaps.
	update_sprite() {
		let si = this.skin + "_";

		const dirSuffix = (this.facingy === -1 ? "_u" : "") + (this.facingy === 1 ? "_d" : "");

		if (truthy(this.presenting)) {
			si += "wow";
		} else if (truthy(this.dead)) {
			si += "dead";
		} else if (truthy(this.hit)) {
			si += truthy(this.onFloor) ? "hit_d" : "hit";
		} else if (truthy(this.riding)) {
			si += this.ride_sprite;
			si += this.facingy === -1 ? this.ride_spr_u : "";
			si += this.facingy === 1 ? this.ride_spr_d : "";
		} else if (truthy(this.swimming)) {
			if (truthy(this.moving)) {
				// looks different from the side view swim
				si += "swim_td" + dirSuffix;
			} else {
				si += "float_td";
			}
		} else if (truthy(this.diving)) {
			si += "dive" + dirSuffix;
		} else if (truthy(this.climbing)) {
			si += (ne(this.xspd, 0) || ne(this.zspd, 0)) ? "climb" : "climb_st";
		} else if (!truthy(this.onFloor)) {
			// jump on everything but a fall with no jump and no move
			if (truthy(this.jumped) || truthy(this.moving)) {
				si += "jump" + dirSuffix;
			} else {
				// falls only have an up version
				si += "fall" + (this.facingy === -1 ? "_u" : "");
			}
		} else if (this.rolling > 0) {
			si += "roll" + dirSuffix;
		} else if (truthy(this.moving)) {
			si += this.curspdang > TOPD_RUN_SPRITE_SPEED ? "run" : "walk";
			si += truthy(this.pushing) ? "_push" : "";
			si += dirSuffix;
		} else {
			si += "stand" + dirSuffix;
		}

		// carry the item along, drawn as its own object
		if (this.carrying && !truthy(this.dead)) {
			if (this.facing !== 0) {
				this.carrying.x = this.x + (2 + this.carrying.holdoffx) * this.facing;
				this.carrying.y = this.y - 2 + this.carrying.holdoffy;
			} else {
				this.carrying.x = this.x + 3 * this.facingy;
				this.carrying.y = this.y - 2 + this.carrying.holdoffy + 2 * this.facingy;
			}

			if (si.indexOf("_run") >= 0) {
				this.carrying.y += this.carryofy_run[Math.floor(this.image_index)];
			} else if (si === this.skin + "_crouch") {
				this.carrying.y += -1;
			} else if (truthy(this.jumped) || !truthy(this.onFloor)) {
				this.carrying.y += this.carryofy_jump;
			}

			this.carrying.image_xscale = (this.facing + this.facingy) * Math.abs(this.carrying.image_xscale);
		}

		// running animates with move speed
		if (si.indexOf("_run") >= 0) {
			this.image_speed = pointDistance(0, 0, this.xspd, this.yspd) / this.runspd;
		} else {
			this.image_speed = 1;
		}

		this.image_yscale = (truthy(this.dead) && truthy(this.swimming)) ? -1 : 1;

		const oldsp = this.drawSprite;
		this.drawSprite = Sprites.exists(si) ? si : this.skin + "_stand_d";

		this.shadowSprite = Sprites.exists(this.skin + "_shadow") ? this.skin + "_shadow" : null;

		if (oldsp !== this.drawSprite) {
			// restart the animation
			this.image_index = 0;

			const mos = [];
			this.instancePlaceList(this.x, this.y, oObject, mos, true);

			this.sprite_index = this.drawSprite;

			const nmos = [];
			this.instancePlaceList(this.x, this.y, oObject, nmos, true);
			for (const o of nmos) {
				if (mos.indexOf(o) < 0) this.pushOutOf(o);
			}
		}
	}

	onStep() {
		if (truthy(this.paused)) return;

		this.step++;

		if (truthy(this.presenting)) {
			if (this.con.iBtnAny) this.presenting = 0;
			return;
		}

		// dead splatters for a while, nothing else runs
		if (truthy(this.otherstate) || truthy(this.dead)) {
			if (truthy(this.dead)) {
				if (this.deadTime > 0) {
					this.deadTime--;
					for (let i = 0; i < this.deadAmnt; i++) {
						Hooks.particles("blood", this, this.x, this.y - 5);
					}
				}
			}
			return;
		}

		if (this.inv && this.inv.qp_handle_ui(this.con)) return;

		if (truthy(this.riding)) {
			this.haf = this.z - (this.onFloorObj !== null ? this.onFloorObj.ht : 0);
			return;
		}

		this.moveWithObjects();
		this.pushedByObjects();
		this.calcOnFloorAtWallTopd();

		// a held item can take over the controls, with nothing held this reads our own setting
		if ((this.carrying || this).over_con !== false) {
			(this.carrying || this).over_con(this.con, this);
		}

		this.charActOnObjs();

		if (truthy(this.aiming)) {
			this.xspd = 0;
			this.rx = 0;
			this.yspd = 0;
			this.ry = 0;
			this.aimdir = this.con.ljAngd;
			return;
		}

		if (truthy(this.waitfornomove)) {
			if (!this.con.iBtnAnyDir) {
				this.waitfornomove = 0;
			} else {
				return;
			}
		}

		if (!truthy(this.riding)) {
			this.checkStartSwimming();
		}

		if (truthy(this.jumped) && (truthy(this.onFloor) || truthy(this.climbing) || truthy(this.hanging) || truthy(this.swimming))) {
			this.jumped = 0;
		}

		// letting go of up and down, or pressing up while falling to regrab, ends the just climbed state
		if (truthy(this.wasclimbing) && ((!this.con.iUp && !this.con.iDown) || (this.con.iUp && this.zspd < 0))) {
			this.wasclimbing = false;
		}

		// the speed this frame aims for, also handed to floor effects
		let curspd;

		if (truthy(this.climbing)) {
			// climbing moves sideways and in height
			curspd = this.climbspd;
			this.xspd = (this.con.iLeft ? -curspd : 0) + (this.con.iRight ? curspd : 0);
			this.yspd = 0;
			this.zspd = (this.con.iUp ? curspd : 0) + (this.con.iDown ? -curspd : 0);

			// off the top or bottom of the ladder
			if (this.instancePlace(this.x, this.y - this.z - sign(this.zspd), oClimbableObj) === null) {
				this.offLadderTopd();
			}

			// no sideways off the edge or on a two way ladder
			const clmbo = this.instancePlace(this.x + sign(this.xspd), this.y, oClimbableObj);
			if (clmbo === null || truthy(clmbo.twoway)) {
				this.xspd = 0;
				this.rx = 0;
			}

			this.image_speed = truthy(this.climbing) ? this.zspd : 1;
		} else {
			// climb start: the ladder must be at our drawn height, then height replaces ladder distance
			this.climbobj = this.instancePlace(this.x, this.y, oClimbableObj);

			const ableClimb = !truthy(this.wasclimbing) && !this.carrying
				&& (this.con.iUp || this.con.iDown)
				&& !truthy(this.hit) && !truthy(this.diving) && this.sliding === 0 && this.rolling === 0;
			if (!truthy(this.climbing) && ableClimb) {
				if (this.climbobj !== null) {
					// not when jumping over the top of the ladder
					if (!this.placeMeeting(this.x, this.y - this.z, this.climbobj)) {
						this.climbobj = null;
					} else {
						this.climbing = true;
						if (truthy(this.climbobj.twoway)) {
							this.x = this.climbobj.x;
							this.rx = 0;
							this.xspd = 0;
						}
						// keep the drawn spot, move to the ladder foot, and turn the rest into height
						const curloc = this.y - this.z;
						const uplad = this.climbobj.bbox_bottom - this.bbox_top;
						this.y += uplad * (this.y < this.climbobj.y ? 1 : -1);
						this.ry = 0;
						this.yspd = 0;
						this.z = this.y - curloc;
						this.rz = 0;
					}
				}
			}

			// dive: jump again in the air while moving, trading rise for a burst forward
			if (!truthy(this.diving) && truthy(this.jumped) && !truthy(this.onFloor) && this.con.iBtnA && !truthy(this.spdis0)
				&& (!this.carrying || truthy(this.carrying.can_diveroll))) {
				const jdir = pointDirection(0, 0, this.xspd, this.yspd) / 180 * Math.PI;
				const spdbst = this.divespdboost * this.runspd;
				// capped a little higher so two in a row give a bit extra
				this.xspd = sign(this.xspd) * Math.min(Math.abs(this.xspd) + spdbst, spdbst * 1.2) * Math.abs(Math.cos(jdir));
				this.yspd = sign(this.yspd) * Math.min(Math.abs(this.yspd) + spdbst, spdbst * 1.2) * Math.abs(Math.sin(jdir));
				this.zspd = Math.min(this.zspd, 0);
				this.diving = true;
			}

			// landing a dive starts a roll
			const ableRoll = truthy(this.diving) && truthy(this.landed)
				&& !truthy(this.wasclimbing) && (!this.carrying || truthy(this.carrying.can_diveroll));
			if (truthy(this.canRoll) && ableRoll) {
				this.rolling = this.rolltime;
				this.diving = false;
			}
			if (this.rolling > 0) {
				this.rolling--;
			}

			// a hit slides to a stop, may die then, and ends on any input after
			if (truthy(this.hit) && truthy(this.onFloor)) {
				this.xspd = sign(this.xspd) * Math.max(Math.abs(this.xspd) - this.fric / 4, 0);
				this.yspd = sign(this.yspd) * Math.max(Math.abs(this.yspd) - this.fric / 4, 0);
				if (truthy(this.spdis0)) {
					this.hit = 2;
					if (truthy(this.hit_dead)) {
						this.hit = 0;
						this.dead = 1;
					}
				}
				if (this.hit === 2 && (this.con.iBtnAnyDir || this.con.iBtnAny)) {
					this.hit = 0;
				}
			}

			// walk and run: top speed scaled by the stick, halved while lining up a drop
			curspd = truthy(this.crawling) ? this.crawlspd : this.runspd;
			curspd *= truthy(this.drop_request) ? 0.5 : 1;
			const joy_per = pointDistance(0, 0, this.con.ljHp, this.con.ljVp);
			curspd *= joy_per > 0 ? joy_per : 1;

			this.curspdang = pointDistance(0, 0, this.xspd, this.yspd);

			// slow each axis on its own when not steering it or too fast, so turns stay sharp
			if (!truthy(this.hit) && !truthy(this.diving)) {
				let fric_slow = (truthy(this.onFloor) && this.rolling === 0) ? this.fric : this.air_fric;
				// high above the floor there is little control
				if (this.haf > TOPD_HIGH_ABOVE_FLOOR) {
					const haf_adj = 1 + Math.min((this.haf - TOPD_HIGH_ABOVE_FLOOR) / 20, 3);
					fric_slow *= haf_adj;
					curspd /= haf_adj;
				}

				if (eq(this.con.ljHp, 0) || this.curspdang > curspd) {
					this.xspd = sign(this.xspd) * Math.max(Math.abs(this.xspd) - fric_slow, 0);
				}
				if (eq(this.con.ljVp, 0) || this.curspdang > curspd) {
					this.yspd = sign(this.yspd) * Math.max(Math.abs(this.yspd) - fric_slow, 0);
				}
				this.curspdang = pointDistance(0, 0, this.xspd, this.yspd);
			}

			// falling is in height
			if (!truthy(this.onFloor)) {
				this.zspd -= this.grav;
			}

			// speed up per axis, then replace the direction with the stick's own angle
			if (!truthy(this.hit) && !truthy(this.diving) && this.sliding === 0 && this.rolling === 0 && !truthy(this.climbing)) {
				let dir_to_facing = (this.facing < 0 && this.con.iLeft) || (this.facing > 0 && this.con.iRight);
				if (!truthy(this.atWall) || (truthy(this.atWallObj.pushable) && dir_to_facing)) {
					const gospd = TOPD_WALK_ACCEL * Math.abs(this.con.ljHp);
					this.xspd += (this.con.iLeft ? -gospd : 0) + (this.con.iRight ? gospd : 0);
				}
				dir_to_facing = (this.facingy < 0 && this.con.iUp) || (this.facingy > 0 && this.con.iDown);
				if (!truthy(this.atWally) || (truthy(this.atWallyObj.pushable) && dir_to_facing)) {
					const gospd = TOPD_WALK_ACCEL * Math.abs(this.con.ljVp);
					this.yspd += (this.con.iUp ? -gospd : 0) + (this.con.iDown ? gospd : 0);
				}
				let newspdang = pointDistance(0, 0, this.xspd, this.yspd);
				let goang = pointDirection(0, 0, this.xspd, this.yspd);
				// the per axis speed up spoils angled walking, the stick angle fixes it
				if (ne(this.con.ljHp, 0) || ne(this.con.ljVp, 0)) {
					newspdang = pointDistance(0, 0, this.con.ljHp, this.con.ljVp) * curspd;
					goang = pointDirection(0, 0, this.con.ljHp, this.con.ljVp);
				}
				// cap at the top speed unless we were already going faster
				this.curspdang = Math.min(newspdang, Math.max(curspd, this.curspdang));
				this.xspd = this.curspdang * Math.cos(goang / 180 * Math.PI);
				this.yspd = this.curspdang * -Math.sin(goang / 180 * Math.PI);
			}
		}

		this.checkFloorFx(1, curspd);

		if (truthy(this.landed) && this.rolling === 0) {
			Hooks.sound("snd8bThudLil");
		}

		// pushing something we face, the other axis acts like a wall
		const pushed = (truthy(this.atWall) && truthy(this.atWallObj.pushable)) ? this.atWallObj
			: ((truthy(this.atWally) && truthy(this.atWallyObj.pushable)) ? this.atWallyObj : null);
		if (pushed !== null
			&& this.sliding === 0 && this.rolling === 0 && truthy(this.onFloor)
			&& ((ne(this.xspd, 0) && sign(this.facing) === sign(this.xspd))
				|| (ne(this.yspd, 0) && sign(this.facingy) === sign(this.yspd)))) {
			if (this.facing !== 0) {
				this.xspd *= pushed.pushAdj;
				pushed.rx = this.rx;
				this.yspd = 0;
				this.atWall = false;
			} else {
				this.yspd *= pushed.pushAdj;
				pushed.ry = this.ry;
				this.xspd = 0;
				this.atWally = false;
			}
			this.curspdang = pointDistance(0, 0, this.xspd, this.yspd);

			pushed.moveThroughObjectsTopd(this.xspd, this.yspd * 0.9, 0);
			this.pushing = true;
		} else {
			this.pushing = false;
		}

		// down and jump on a drop through floor
		if (this.con.iBtnA && this.con.iDown && this.onFloorObj && truthy(this.onFloorObj.dropDown)) {
			this.jumping = 8;
			this.jumped = 1;
			this.crawling = false;
			this.yspd = 1;
			this.dropping = true;
		} else {
			this.dropping = false;
		}

		const can_jump = this.con.iBtnA && truthy(this.canJump)
			&& (truthy(this.onFloorL) || truthy(this.onFloor) || truthy(this.hanging) || truthy(this.climbing))
			&& !truthy(this.hit) && !truthy(this.crawling) && this.sliding === 0
			&& (!this.carrying || truthy(this.carrying.can_jump));

		if (can_jump || (this.con.iBtnAd && truthy(this.jumping))) {
			this.jumping++;

			if (this.jumping === 1) {
				this.jumped = 1;
				Hooks.sound("snd8bJump");
				this.jumph = this.maxjumph + ((Math.abs(this.xspd) + Math.abs(this.yspd) > 0 && !truthy(this.swimming)) ? this.jumpRunBoost : 0);
				this.jumph = truthy(this.swimming) ? this.jumph * 0.7 : this.jumph;
				this.jumph = this.rolling > 0 ? this.jumph * 0.8 : this.jumph;
				this.zspd = this.jumph;
				// jumping out of a roll adds speed along the roll, up to double running
				if (this.rolling > 0) {
					const jdir = pointDirection(0, 0, this.xspd, this.yspd) / 180 * Math.PI;
					this.xspd = sign(this.xspd) * Math.min(Math.abs(this.xspd) + this.runspd, this.runspd * 2) * Math.abs(Math.cos(jdir));
					this.yspd = sign(this.yspd) * Math.min(Math.abs(this.yspd) + this.runspd, this.runspd * 2) * Math.abs(Math.sin(jdir));
				}
				if (truthy(this.swimming)) {
					Hooks.splash(this);
				}

				// remembered for bouncing off things we cannot stand on
				this.prejumpx = this.x;
				this.prejumpy = this.y;

				if (truthy(this.climbing)) {
					this.offLadderTopd();
					// a straight up ladder jump gets a little more, since this view is more sideways
					if (this.con.iUp && !this.con.iLeft && !this.con.iRight) {
						this.zspd += TOPD_LADDER_JUMP_BOOST;
					}
				}

				this.sliding = 0;
				this.rolling = 0;
				this.diving = 0;
			}
		}
		// the short jump pull back is switched off in the original, only the count resets
		if (truthy(this.jumping) && !this.con.iBtnAd) {
			this.jumping = 0;
		}

		// many sprites show movement from the buttons even at zero speed
		this.xmoving = this.con.iLeft || this.con.iRight;
		this.ymoving = this.con.iUp || this.con.iDown;
		this.moving = this.xmoving || this.ymoving;
		// opposite speeds on the two axes also count as stopped, as in the original
		this.spdis0 = eq(this.xspd + this.yspd, 0);

		// face along whichever stick axis leans more
		if (!truthy(this.hit) && !truthy(this.lockface) && this.rolling === 0 && !truthy(this.diving) && !truthy(this.sliding)) {
			if (ne(this.con.ljHp, 0) && Math.abs(this.con.ljHp) >= Math.abs(this.con.ljVp)) {
				this.facing = sign(this.con.ljHp);
				this.facingy = 0;
			} else if (ne(this.con.ljVp, 0)) {
				this.facing = 0;
				this.facingy = sign(this.con.ljVp);
			}
		}

		const lx = this.x;
		const ly = this.y;
		const lz = this.z;
		// down the map moves a little slower, for a hint of a tilted view
		this.moveThroughObjectsTopd(this.xspd, this.yspd * 0.9, this.zspd);
		if (this.mylayer && this.mylayer.lgroup && this.mylayer.lgroup.vbounds) {
			this.checkStayinObjs(this.mylayer.lgroup.vbounds);
		}

		if (lx !== this.x || ly !== this.y || lz !== this.z) {
			Hooks.debugLine(lx, ly, this.x, this.y - this.z, truthy(this.swimming) ? "#33ff33" : (truthy(this.onFloor) ? "#ffff00" : "#ff8800"));
		}

		this.haf = this.z - (this.onFloorObj !== null ? this.onFloorObj.ht : 0);

		// falling off a cliff ends dives and rolls
		if (this.inFallWall) {
			this.diving = 0;
			this.rolling = 0;
		}

		if (truthy(this.hitWall) && !truthy(this.pushing)) {
			this.xspd = 0;
		}
		if (truthy(this.hitWally) && !truthy(this.pushing)) {
			this.yspd = 0;
		}
		// diving or rolling into a wall shakes, hurts, and hits the wall too
		if (truthy(this.hitWall) || truthy(this.hitWally)) {
			if (truthy(this.diving) || truthy(this.rolling)) {
				const ho = this.hitWallObj ? this.hitWallObj : this.hitWallyObj;
				game.cam.shakeit(20, 1, 2);
				game.guy.takeHit(ho.x, ho.y, 2, 1);
				ho.acton("hit", this);
			}
			this.diving = 0;
			this.rolling = 0;
		}
		if (truthy(this.hitFloor)) {
			if (this.hitFloorObj === null || truthy(this.hitFloorObj.standonable)) {
				this.zspd = 0;
			} else {
				// cannot stand on it: bounce up and away, carrying on past its middle,
				// or back the way we came and hurt if we had not reached it
				const fromj = pointDirection(this.prejumpx, this.prejumpy, this.x, this.y);
				const tocent = pointDirection(this.x, this.y, this.hitFloorObj.sprite_cx(), this.hitFloorObj.sprite_cy());
				let jumpgo;
				if (Math.abs(angleDifference(fromj, tocent)) > 90) {
					jumpgo = angleAvg(fromj, tocent + 180, 0.5);
				} else {
					jumpgo = angleAvg(fromj + 180, tocent + 180, 0.5);
					this.hit = 5;
				}
				this.xspd = 1 * Math.cos(jumpgo / 180 * Math.PI);
				this.yspd = 1 * -Math.sin(jumpgo / 180 * Math.PI);
				this.zspd = 0.5;
				this.hitFloor = false;
			}
		}

		// how long we have stayed in about the same place
		if (Math.abs(this.stillx - this.x) < 3 && Math.abs(this.stilly - this.y) < 2) {
			this.still++;
		} else {
			this.still = 0;
			this.stillx = this.x;
			this.stilly = this.y;
		}

		// remember the last place we stood still, and after a long idle face down
		if (truthy(this.onFloor) && truthy(this.spdis0) && this.still > 10) {
			this.lastsx = this.x;
			this.lastsy = this.y;
			this.lastsz = this.z;
			if (this.still > TOPD_IDLE_FACE_DOWN_FRAMES && !truthy(this.drop_request)) {
				this.facing = 0;
				this.facingy = 1;
			}
		}

		// look around: the reach mask nudged ahead of us at our drawn height,
		// and the first thing found remembers us as the one looking
		for (const lo of this.lookObjs) {
			if (!lo.destroyed) lo.inview = null;
		}
		this.lookObjs.length = 0;
		const omi = this.mask_index;
		this.mask_index = this.look_mask;
		this.x += 4 * this.facing;
		this.y += 3 * this.facingy;
		this.instancePlaceList(this.x, this.y - this.z, oIaObject, this.lookObjs, true);
		this.instancePlaceList(this.x, this.y - this.z, oIaBgObject, this.lookObjs, true);
		this.instancePlaceList(this.x, this.y - this.z, oActor, this.lookObjs, true);
		this.instancePlaceList(this.x, this.y - this.z, oIaSolidGr, this.lookObjs, true);
		this.x -= 4 * this.facing;
		this.y -= 3 * this.facingy;
		this.mask_index = omi;
		if (this.lookObjs.length > 0) {
			this.lookObjs[0].inview = this;
		}
	}

	// The look box when debugging, the item in hand behind us when facing up, the aim dots,
	// the drop spot tinted, the presenting sparkle, our shadow, ourselves lifted by our height,
	// anything drawn over us, and the item in front when facing any other way.
	onDraw() {
		if (game.drawStats) {
			Draw.alpha = 0.3;
			Draw.color = "#ff3300";
			const omi = this.mask_index;
			this.mask_index = this.look_mask;
			this.x += 4 * this.facing;
			this.y += 3 * this.facingy;
			Draw.rectangle(this.bbox_left, this.bbox_top - this.z, this.bbox_right, this.bbox_bottom - this.z, 0);
			this.x -= 4 * this.facing;
			this.y -= 3 * this.facingy;
			this.mask_index = omi;
			Draw.alpha = 1;
		}

		const drawCarry = this.carrying && !truthy(this.presenting) && !truthy(this.diving) && !truthy(this.rolling);
		if (drawCarry && this.facingy < 0) this.drawCarriedAtHeight();

		if (truthy(this.aiming)) {
			const cx = this.sprite_cx();
			const cy = this.sprite_cy();
			const bi = Math.floor(currentTime() / 100) % 4;
			const aimdisti = Math.floor((this.aimdist - 5) / 3);
			const aimdists = this.aimdist - aimdisti * 3;
			for (let i = 0; i < 4; i++) {
				const d = aimdists + aimdisti * i;
				Draw.alpha = 0.2 + ((bi + 4 - i) % 4) * 0.2;
				Draw.sprite("s_aim_dot", i, cx + lengthdirX(d, this.aimdir), cy + lengthdirY(d, this.aimdir));
			}
			Draw.alpha = 1;
		}

		// Approximation: the original paints the drop spot through a tint shader in orange when it can
		// be given, red when not. Here the picture is multiplied by those colours.
		if (truthy(this.drop_request) && this.carrying) {
			const c = this.carrying;
			const tcol = (this.lookObjs.length > 0 && truthy(this.lookObjs[0].cangive)) ? "#ff9900" : "#ff3300";
			Draw.spriteExt(c.sprite_index, c.image_index, this.x + this.drop_offx * this.facing, this.y + this.drop_offy * this.facingy,
				c.image_xscale, c.image_yscale, c.image_angle, tcol, 0.6);
		}

		if (truthy(this.presenting) && this.carrying) this.drawPresenting();

		const xscale = this.facing === 0 ? 1 : this.facing;
		const xoadj = (truthy(this.xodd) && xscale < 0) ? 1 : 0;
		if (this.shadowSprite !== null && !truthy(this.swimming) && !this.riding) {
			Draw.spriteExt(this.shadowSprite, this.image_index, this.x + xoadj, this.y - this.z + this.haf,
				xscale, this.image_yscale, this.image_angle, this.image_blend, this.image_alpha);
		}
		this.y -= this.z;
		super.onDraw();
		this.y += this.z;

		if (this.over_sprite !== null && this.over_sprite !== undefined) {
			Draw.spriteExt(this.over_sprite, this.image_index, this.x, this.y - this.z + this.haf,
				xscale, this.image_yscale, this.image_angle, this.image_blend, this.image_alpha);
		}

		if (drawCarry && (this.facing !== 0 || this.facingy > 0)) this.drawCarriedAtHeight();

		if (this.inv && this.inv.in_inv_sel) this.inv.qp_draw();
	}

	// the item in hand drawn lifted by our height
	drawCarriedAtHeight() {
		this.carrying.y -= this.z;
		this.carrying.draw();
		this.carrying.y += this.z;
	}

	onEndStep() {
		this.update_sprite();
	}
}
oCharTopd.defaultSprite = "guy_stand";
OBJECT_TYPES.oCharTopd = oCharTopd;
