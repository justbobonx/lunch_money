// The side view player: running, jumping, climbing ladders, hanging on ledges,
// swimming, diving, rolling, sliding and crawling, then the move and the look around.
// A bug for bug port: odd checks in the original are kept and called out where they are.
// Sound, effects, the inventory and scripts are later stages and go through the hooks.

// how fast climbing moves in every direction
const SIDE_CLIMB_SPEED = 0.5;

// how long a short tap on jump counts as short
const SIDE_SHORT_JUMP_FRAMES = 7;

// At the water's top, rising any slower than this is stopped, so only a swim boost or a jump
// breaks out of the water.
const SWIM_BREAKOUT_SPEED = 0.6;

// How far past swim speed counts as boosting. Capping the speed through an angle and back leaves
// it a hair off, so a plain comparison misreads cruising at full speed as a boost.
const SWIM_BOOST_MARGIN = 0.05;

class oCharSide extends oChar {
	constructor() {
		super();
		this.skin = "guy";
		this.skin_hang_wch = "guy_hang_wch";

		this.ch_side = 1;
		this.ch_topd = 0;

		this.paused = 0;
		this.lastRjV = 0;

		this.otherstate = false;
		this.giveup = false;

		this.canHang = true;
		this.canDive = true;
		this.canRoll = true;
		this.canCrawl = true;
		this.canSlide = true;
		this.canClimb = true;

		this.canFight = 0;
		this.punching = 0;
		this.punch_bullter = "guy_punch_bullet";

		this.jumping = 0;
		this.jumped = 1;
		// jump height lands between these two depending on running
		this.maxjumph = 1.8;
		this.jumpRunBoost = 0.2;
		this.jumph = this.maxjumph;
		this.bumpStopsJump = true;

		this.airturnspd = 0.9;

		this.runspd = 1;
		this.crawlspd = 0.3;
		this.swimspd = 0.8;
		this.swimacc = 0.1;
		this.swimboost = 2;
		this.maxspd = 6;
		// must be lower than the top fall speed to ever kill, so it never does as set
		this.dropFallKillSpd = 10;

		this.climbing = false;
		this.wasclimbing = false;

		this.hanging = false;
		// set when we slip off a hang, so the grab does not catch again until we are clear of it
		this.hangRegrabBlocked = false;
		this.hangingObj = null;
		// none, slow, normal and fast in the original were zero, four, eight and sixteen thousandths
		this.hangslipspd = 0;
		// speed at which we fall off a hang
		this.hangfallspd = 0.4;
		// when on, a jump from a hang kicks out from the wall instead of up
		this.hangjumpkickoff = 0;

		this.riding = null;
		this.ride_sprite = "ride";
		this.ride_spr_u = "";
		this.ride_spr_d = "";

		this.aiming = false;
		this.aim_inc = 2.5;
		this.aimdir = 45;

		this.still = 0;
		this.stillx = 0;
		this.stilly = 0;

		this.defgrav = 0.1;
		this.grav = this.defgrav;

		this.fric = 0.1;
		this.air_fric = 0.05;
		this.slide_fric = 0.1;
		this.swim_fric = 0.025;

		this.swim_top_dist = 4;

		this.dead = false;

		this.lookObjs = [];
		this.curlooki = -1;

		this.carrying = null;
		// hand height per run frame so the carried item bobs
		this.carryofx_run = [-5, -4, -3, -4];

		this.drop_request = 0;
		this.drop_offx = 3;
		this.drop_offy = 4;

		this.inv = new Inventory(12, "s_inv_ofm_bag", this, "Tem");
		this.inv.set_height(3);
		this.inv_list = this.inv.inv_list;

		this.in_inv_sel = 0;

		this.xmoving = 0;
		this.ymoving = 0;

		this.curswimspd = 0;
		this.climbobj = null;
		this.climbsoon = null;
		this.cur_held_i = -1;
	}

	// sets the stand sprite, the last spot stood still to where it was placed, then the hang check mask for this skin
	init() {
		super.init();
		// last spot we stood still, for saving and restoring
		this.lastsx = this.x;
		this.lastsy = this.y;
		this.skin_hang_wch = Sprites.exists(this.skin + "_hang_wch") ? this.skin + "_hang_wch" : null;
	}

	// Explosions and hits kill the main player and knock this one.
	// The knock direction mixes the hitter's sideways speed with our own vertical speed, as in the original.
	acton(action, who) {
		if (action === "explode" || action === "hit") {
			const dir = pointDirection(who.x, who.y, this.x + who.xspd, this.y + this.yspd);
			const forcex = lengthdirX(2, dir);
			const forcey = lengthdirY(2, dir);
			game.guy.kill(200, 10, [-2 + forcex, 2 + forcex], [-2 + forcey, 1 + forcey], 1, "sndSplat", this);
			this.xspd += who.xspd / 2;
			this.yspd += who.yspd / 2;
		}
	}

	// Whether the main player can stand up here: nothing solid in the standing mask,
	// or it is a one way floor, or we were already overlapping it.
	// The last test uses the current mask again, not the standing one, as in the original.
	checkOkToStand() {
		const omi = game.guy.mask;
		game.guy.mask = "guy_stand";
		const hobj = game.guy.instancePlace(game.guy.x, game.guy.y, oObject);
		game.guy.mask = omi;
		return hobj === null || hobj.thruUp || game.guy.placeMeeting(game.guy.x, game.guy.y, hobj);
	}

	// Grabs a ledge when falling and pressing into a hangable wall, or a hangable
	// background object when pressing up. A small mask at hand height finds the edge,
	// and a second check two pixels lower makes sure it is a ledge and not a ceiling.
	// Slipping off a hang blocks the grab setup until the grab conditions fail once,
	// as in the original.
	checkSetHanging(iUp) {
		this.hangingObj = null;
		if (this.canHang) {
			const omi = this.mask;
			this.mask = this.skin_hang_wch;
			let hawt = this.instancePlace(this.x + this.facing, this.y, oObject);
			const hawb = this.instancePlace(this.x + this.facing, this.y + 2, hawt);
			const hawbt = this.instancePlace(this.x + sign(this.xspd), this.y, oBgObject);
			const hawbb = this.instancePlace(this.x + sign(this.xspd), this.y + 2, hawbt);
			this.mask = omi;

			// already inside it means we are passing through, so no hang
			if (hawt !== null && this.placeMeeting(this.x, this.y, hawt)) hawt = null;

			const hatWall = hawt !== null && hawb !== null;
			const hatbWall = hawbt !== null && hawbb !== null;

			// only hang when coming down
			const ableHang = !this.carrying && !this.onFloor && !this.diving && this.yspd >= 0;

			const presstowall = this.atWall && ((this.facing < 0 && this.con.iLeft) || (this.facing > 0 && this.con.iRight));

			if (ableHang && ((presstowall && hatWall && hawt.hangable) || (iUp && hatbWall && hawbt.hangable))) {
				if (!this.hanging && !this.hangRegrabBlocked) {
					this.yspd = Math.min(this.yspd, 0);
					this.hanging = true;
				}
				this.hangingObj = hatWall ? hawt : hawbt;
				this.hangingObjBg = this.hangingObj instanceof oBgObject;
				// always stop side movement
				this.xspd = sign(this.xspd) * 0.1;
			} else {
				this.hanging = false;
				this.hangRegrabBlocked = false;
			}
		}
	}

	// Picks the sprite from the current state, positions the carried item,
	// and when the sprite changes pushes us out of anything the new mask now overlaps.
	update_sprite() {
		let si = this.skin + "_";

		if (this.in_pose !== null) {
			si += this.in_pose;
		} else if (this.presenting) {
			si += "wow";
		} else if (this.con.conOff && this.onFloor) {
			si += "stand_pause";
		} else if (this.otherstate) {
			si += "win";
		} else if (this.dead && !this.deadfall) {
			si += "dead";
		} else if (this.punching) {
			if (this.crawling || this.sliding) {
				si += "slide_kick";
			} else if (this.onFloor) {
				si += "punch";
			} else {
				si += "jump_kick";
			}
		} else if (this.hit) {
			si += this.onFloor ? "hit_d" : "hit";
		} else if (this.riding) {
			si += this.ride_sprite;
		} else if (this.swimming) {
			if (this.moving) {
				si += "swim";
				si += this.curswimspd > this.swimspd + SWIM_BOOST_MARGIN ? "_boost" : "";
			} else {
				si += "float";
			}
		} else if (this.climbing) {
			si += this.moving ? "climb_mv" : "climb_st";
		} else if (this.diving) {
			si += "dive";
		} else if (this.hanging) {
			si += this.hangingObjBg ? "hangf" : "hang";
		} else if (!this.onFloor) {
			si += this.xmoving ? "jump" : "fall";
		} else if (this.rolling > 0) {
			si += "roll";
		} else if (this.crawling > 0) {
			if (!this.xmoving || this.carrying) {
				si += "crouch";
			} else {
				si += "crawl";
				if (this.pushing) si += "_push";
			}
		} else if (this.sliding > 0) {
			si += "slide";
		} else if (this.xmoving) {
			si += "run";
			if (this.pushing) si += "_push";
		} else {
			si += "stand";
			if (!this.carrying && this.still > 60 && this.still < 120) si += "_st";
		}

		// carry the item along in the hand
		if (this.carrying && !this.dead) {
			this.carrying.x = this.x + Math.ceil(this.facing * 2.5) + this.carrying.holdoffx * this.facing;
			if (si === this.skin + "_run") {
				this.carrying.y = this.y + this.carryofx_run[Math.floor(this.ifr)];
			} else if (si === this.skin + "_crouch") {
				this.carrying.y = this.y - 1;
			} else {
				this.carrying.y = this.y - 4;
			}
			this.carrying.y += this.carrying.holdoffy;

			this.carrying.x_sc = this.facing * Math.abs(this.carrying.x_sc);

			if (!this.presenting && this.in_pose === null) {
				si += "_carry";
			}
		}

		this.y_sc = (this.dead && this.swimming) ? -1 : 1;

		const oldsp = this.drawSprite;
		this.drawSprite = Sprites.exists(si) ? si : this.skin + "_stand";

		if (oldsp !== this.drawSprite) {
			// what we overlapped before the change
			const mos = [];
			this.instancePlaceList(this.x, this.y, oObject, mos, true);

			this.spi = this.drawSprite;

			// get pushed out of anything the new mask overlaps that the old one did not
			const nmos = [];
			this.instancePlaceList(this.x, this.y, oObject, nmos, true);
			for (const o of nmos) {
				if (mos.indexOf(o) < 0) this.pushOutOf(o);
			}
		}
	}

	update() {
		if (this.paused) return;

		this.step++;

		// presenting an item waits for any button
		if (this.presenting) {
			if (this.con.iBtnAny) this.presenting = 0;
			return;
		}

		// won or dead: still falls and rides moving things while visible
		if (this.otherstate || this.dead) {
			if (this.visible) {
				// a dead fall already has its contact flags cleared
				this.applyFrictionGravity();
				if (this.deadfall) {
					this.moveIgnoringObjects(this.xspd, this.yspd);
				} else {
					this.calcOnFloorAtWall();
					this.moveWithObjects();
					this.moveThroughObjects(this.xspd, this.yspd);
				}
			}
			return;
		}

		// an open inventory takes the frame
		if (this.inv.qp_handle_ui(this.con)) return;

		if (this.riding) return;

		// ride along, get pushed out of anything that moved into us, then fresh contact flags
		this.moveWithObjects();
		this.pushedByObjects();
		this.calcOnFloorAtWall();

		const landed = !this.onFloorL && this.onFloor;

		// A held item can take over the controls. With nothing held the original read
		// the player's own setting here, which is always off.
		if ((this.carrying || this).over_con !== false) {
			(this.carrying || this).over_con(this.con, this);
		}

		this.charActOnObjs();

		// aiming freezes us and turns the aim within the facing half
		if (this.aiming) {
			this.xspd = 0;
			this.rx = 0;
			this.yspd = 0;
			this.ry = 0;

			if (this.con.iLeft || (this.con.iUp && this.facing > 0) || (this.con.iDown && this.facing < 0)) {
				this.aimdir += this.aim_inc;
			}
			if (this.con.iRight || (this.con.iUp && this.facing < 0) || (this.con.iDown && this.facing > 0)) {
				this.aimdir -= this.aim_inc;
			}

			this.aimdir = (this.aimdir + 360) % 360;

			if (this.facing > 0) {
				this.aimdir = this.aimdir < 180 ? clamp(this.aimdir, 0, 91) : clamp(this.aimdir, 270, 360);
			} else {
				this.aimdir = clamp(this.aimdir, 90, 270);
			}
			return;
		}

		// status updates
		this.checkStartSwimming();

		// At the top of the water when the top row of our collision box is dry. Changed from the
		// original, which tested a point a fixed distance above our spot, so with a short box the two
		// tests disagreed and a slow rise could lift the whole box out without ever counting as the top.
		const swimattop = this.swimming && this.collisionPoint(this.x, this.bbox_top, oWater, 0, 1) === null;

		if (this.jumped && (this.onFloor || this.climbing || this.hanging || this.swimming)) {
			this.jumped = 0;
		}

		// letting go of up and down, or pressing up while falling to regrab, ends the just climbed state
		if (this.wasclimbing && ((!this.con.iUp && !this.con.iDown) || (this.con.iUp && this.yspd > 0))) {
			this.wasclimbing = false;
		}

		if (this.punching) {
			this.punching--;
		}

		// the speed this frame aims for, used by running
		let curspd;

		if (this.swimming) {
			// slow first
			this.xspd = sign(this.xspd) * Math.max(Math.abs(this.xspd) - this.swim_fric, 0);
			this.yspd = sign(this.yspd) * Math.max(Math.abs(this.yspd) - this.swim_fric, 0);

			let curspdang = pointDistance(0, 0, this.xspd, this.yspd);

			this.xspd += this.swimacc * this.con.ljHp;
			this.yspd += this.swimacc * this.con.ljVp;

			const newspdang = pointDistance(0, 0, this.xspd, this.yspd);
			const goang = pointDirection(0, 0, this.xspd, this.yspd);
			// cap at swim speed unless we were already going faster
			curspdang = Math.min(newspdang, Math.max(this.swimspd, curspdang));
			this.xspd = curspdang * Math.cos(goang / 180 * Math.PI);
			this.yspd = curspdang * -Math.sin(goang / 180 * Math.PI);

			// Stop at the surface unless rising fast enough to break out or steering down, which also
			// catches us there when we fall in. Changed from the original, which stopped before adding
			// the steering, so holding up crept us out of the water.
			if (swimattop && this.yspd > -SWIM_BREAKOUT_SPEED && !(this.con.ljVp > 0)) {
				this.yspd = 0;
			}

			// drift gently when not steering and below the surface
			if (!this.con.iBtnAnyDir && !swimattop) {
				this.yspd = clamp(this.yspd - this.swimacc, -this.swimspd / 5, this.swimspd / 5);
			}
		} else if (this.climbing) {
			this.xspd = 0;
			this.yspd = 0;
			this.xspd += (this.con.iLeft ? -SIDE_CLIMB_SPEED : 0) + (this.con.iRight ? SIDE_CLIMB_SPEED : 0);
			this.yspd += (this.con.iUp ? -SIDE_CLIMB_SPEED : 0) + (this.con.iDown ? SIDE_CLIMB_SPEED : 0);

			// close to ground, unless it is a drop through floor we are inside
			const nearFloorObj = this.instancePlace(this.x + sign(this.xspd), this.y + sign(this.yspd) + 3, oGround);
			let nearFloor = nearFloorObj !== null;
			if (nearFloor && nearFloorObj.dropDown && this.placeMeeting(this.x, this.y, nearFloorObj)) {
				nearFloor = false;
			}

			// near the floor and pushing only sideways lets us step off early
			if (nearFloor && (this.con.iLeft || this.con.iRight) && !(this.con.iUp || this.con.iDown)) {
				this.climbing = false;
			}
			// no ladder above while standing on a floor ends the climb
			if (!this.placeMeeting(this.x, this.y - 1, oClimbableObj) && this.onFloor && !this.con.iDown) {
				this.climbing = false;
				this.wasclimbing = true;
			}
			// standing on a solid floor ends the climb
			if (this.onFloor && !this.onFloorObj.dropDown && !this.con.iUp) {
				this.climbing = false;
				this.wasclimbing = true;
			}

			// off the top stops, off the bottom lets go
			if (this.instancePlace(this.x, this.y + sign(this.yspd), oClimbableObj) === null) {
				if (this.con.iUp) {
					this.yspd = 0;
				} else if (this.con.iDown) {
					this.climbing = false;
				}
			}

			// no sideways off the edge, and none at all on a two way ladder unless stepping off near the floor
			const clmbo = this.instancePlace(this.x + sign(this.xspd), this.y, oClimbableObj);
			if (clmbo === null || (clmbo.twoway && !(nearFloor && !(this.con.iUp || this.con.iDown)))) {
				this.xspd = 0;
				this.rx = 0;
			}
		} else {
			// done crawling when up or off the floor, or moving while carrying, if there is room to stand
			if ((this.crawling && (!this.con.iDown || !this.onFloor)) || (this.carrying && this.xspd !== 0)) {
				if (this.checkOkToStand()) this.crawling = false;
			}

			// climb start, the ladder here is kept for others to read
			this.climbobj = this.instancePlace(this.x, this.y, oClimbableObj);
			this.climbsoon = this.instancePlace(this.x + this.facing * 2, this.y, oClimbableObj);

			const ableClimb = !this.wasclimbing && !this.carrying
				&& (this.con.iUp || this.con.iDown)
				&& !this.hit && !this.diving && this.sliding === 0 && this.rolling === 0;
			if (!this.climbing && ableClimb) {
				if (this.climbobj !== null) {
					// no starting down while standing on the ground, or up at the top
					if ((this.con.iDown && this.onFloor && !this.onFloorObj.dropDown)
						|| (this.con.iUp && !this.placeMeeting(this.x, this.y - 1, oClimbableObj))) {
						this.climbing = false;
					} else {
						this.climbing = true;
						if (this.climbobj.twoway) {
							this.x = this.climbobj.x;
							this.rx = 0;
							this.xspd = 0;
						}
					}
				}
			}

			// dive ends on the floor
			if (this.onFloor) {
				this.diving = false;
			}
			// dive starts in the air after a jump, pressing down and sideways, fast enough
			const ableDive = this.jumped && !this.onFloor && !this.carrying
				&& !this.wasclimbing && this.con.iDown
				&& (this.con.iLeft || this.con.iRight) && Math.abs(this.xspd) > 0.4;
			if (this.canDive && !this.diving && ableDive) {
				// still rising turns some of the rise into forward speed
				if (this.yspd < 0) {
					const sadj = Math.abs(this.yspd / 3);
					this.yspd += sadj;
					const minspd = Math.min(this.xspd, -this.runspd + sadj);
					const mxspd = Math.max(this.xspd, this.runspd + sadj);
					this.xspd = clamp(this.xspd + sign(this.xspd) * sadj, minspd, mxspd);
				}
				this.diving = true;
			}

			// roll starts on landing while down or diving, ends when down is released
			const ableRoll = landed && (this.con.iDown || this.diving)
				&& !this.carrying && !this.wasclimbing && Math.abs(this.xspd) > 0.3;
			if (this.canRoll && ableRoll) {
				this.rolling = this.rolltime;
			} else if (this.rolling > 0 && !this.con.iDown) {
				this.rolling = 0;
				// stuck crawling if there is no room to stand after the roll
				if (!this.checkOkToStand()) this.crawling = true;
			}
			if (this.rolling > 0) {
				this.rolling--;
				// a roll ends in a short slide
				if (this.rolling === 0 && this.canSlide) {
					this.sliding = Math.floor(this.slideTime * 0.6);
				}
			}

			// Slide when moving fast with down held.
			// The original joins the not hit wall flag and the speed with a bitwise and before
			// comparing, so only odd whole speeds pass. Kept as is.
			// Guess: the bitwise and drops the fraction of the speed first.
			if (this.canSlide && this.onFloor && (this.con.iDown || this.diving) && (this.con.iRight || this.con.iLeft)
				&& !this.carrying && this.climbobj === null && this.climbsoon === null && !this.climbing && !this.wasclimbing
				&& this.rolling === 0 && this.sliding === 0
				&& (((this.hitWall ? 0 : 1) & Math.trunc(Math.abs(this.xspd))) > 0.8)) {
				this.sliding = this.slideTime;
			}
			// crawl when slow with down held, and only crouch while carrying
			if (this.canCrawl && this.onFloor && this.con.iDown
				&& !this.climbing && !this.wasclimbing && this.rolling === 0 && this.sliding === 0
				&& Math.abs(this.xspd) <= this.crawlspd) {
				if (!this.carrying || this.xspd === 0) {
					this.crawling = true;
				}
			}

			// down must stay held to keep sliding
			if (this.sliding > 0 && (!this.con.iDown || !this.onFloor)) {
				this.sliding = 0;
				if (!this.checkOkToStand()) this.crawling = true;
			}
			// full speed for the slide time
			if (this.sliding > 1) {
				this.sliding--;
			}
			// Then slow and stop, but only once left and right are released.
			// The original takes the size of the comparison, not of the speed, kept as is.
			if (this.sliding === 1) {
				this.xspd = sign(this.xspd) * Math.max(Math.abs(this.xspd) - this.slide_fric, 0);
				if (Math.abs(this.xspd < this.slide_fric) && (!this.con.iLeft && !this.con.iRight)) {
					this.sliding = 0;
					this.crawling = true;
				}
			}

			// a hit slides to a stop, then ends when we try to move again
			if (this.hit && this.onFloor) {
				this.xspd = sign(this.xspd) * Math.max(Math.abs(this.xspd) - this.fric, 0);
				if (this.xspd === 0 && (!this.con.iLeft && !this.con.iRight && !this.con.iUp && !this.con.iDown)) {
					this.hit = 2;
				}
				if (this.hit === 2 && (this.con.iLeft || this.con.iRight || this.con.iUp || this.con.iDown || this.con.iBtnA)) {
					this.hit = 0;
				}
			}

			// run up to the top speed when not sliding, diving or rolling
			curspd = this.crawling ? this.crawlspd : this.runspd;

			const overspeed = Math.abs(this.xspd) - this.runspd;
			const dir_to_facing = (this.facing < 0 && this.con.iLeft) || (this.facing > 0 && this.con.iRight);
			const norm_run = (!this.atWall || (this.atWallObj.pushable && dir_to_facing))
				&& !this.hit && !this.diving && !this.climbing
				&& this.sliding === 0 && this.rolling === 0 && !(this.crawling && this.carrying)
				&& !this.punching;

			// turning against our motion in the air is weaker
			const dir_not_spd = (this.xspd < 0 && this.con.iRight) || (this.xspd > 0 && this.con.iLeft);
			if (!this.onFloor && dir_not_spd) {
				curspd *= this.airturnspd;
			}

			// past top running speed there is almost no control
			if (overspeed > 0) {
				curspd = this.air_fric;
			}

			// slow first, gentler while still pushing forward past top speed
			if (norm_run || overspeed > 0) {
				let slow = this.onFloor ? this.fric : this.air_fric;
				if (overspeed > 0 && dir_to_facing) {
					slow *= 0.5;
				}
				this.xspd = sign(this.xspd) * Math.max(Math.abs(this.xspd) - slow, 0);
			}

			// Hard stop when standing with nothing pressed. The check reads the speed from
			// before friction, so it only fires when we were at exactly running speed.
			if (this.onFloor && overspeed === 0 && !this.con.iLeft && !this.con.iRight) {
				this.xspd = 0;
				this.rx = 0;
			}

			// then add speed up to the top
			if (norm_run) {
				const minspd = Math.min(this.xspd, -curspd);
				const mxspd = Math.max(this.xspd, curspd);
				this.xspd += (this.con.iLeft ? -curspd : 0) + (this.con.iRight ? curspd : 0);
				this.xspd = clamp(this.xspd, minspd, mxspd);
			}

			// gravity, or the slow slip while hanging
			if (!this.onFloor) {
				if (this.hanging) {
					this.yspd += this.hangslipspd;
				} else {
					this.yspd += this.grav;
				}
			}

			if (this.hanging && this.yspd > this.hangfallspd) {
				this.hanging = false;
				this.hangRegrabBlocked = true;
			}

			this.checkSetHanging(this.con.iUp);
		}

		// many sprites show movement from the buttons even at zero speed
		this.xmoving = this.con.iLeft || this.con.iRight;
		this.ymoving = this.con.iUp || this.con.iDown;
		this.moving = this.xmoving || this.ymoving;

		// facing from the buttons, else from the speed, unless locked
		if (!this.lockface && this.rolling === 0 && !this.hit && !this.diving && !this.sliding) {
			if (this.con.iLeft) {
				this.facing = -1;
			} else if (this.con.iRight) {
				this.facing = 1;
			} else if (this.xspd !== 0) {
				this.facing = sign(this.xspd);
			}
		}

		// how long we have stayed in about the same place
		if (Math.abs(this.stillx - this.x) < 10 && Math.abs(this.stilly - this.y) < 8) {
			this.still++;
		} else {
			this.still = 0;
			this.stillx = this.x;
			this.stilly = this.y;
		}

		// landing thud, and landing too fast knocks us down
		if (landed && this.rolling === 0) {
			if (Math.abs(this.xspd) > this.runspd * 2.5) {
				this.hit = 1;
			}
			Hooks.sound("snd8bThudLil");
		}

		// touching walls and floors
		if (this.atWallObj) {
			this.atWallObj.acton("touch", this);
		}
		if (this.onFloorObj) {
			this.onFloorObj.acton("touch", this);
		}

		// Running, diving or falling fast into things hits them. Both checks add to one list,
		// so something found by both gets hit twice. Something destroyed by its first hit
		// is skipped, where the original would have failed.
		const bos = [];
		if (((this.diving || this.rolling > 0) && Math.abs(this.xspd) > 0.8) || Math.abs(this.xspd) > 3) {
			this.instancePlaceList(Math.floor(this.x + this.xspd), this.y, oObject, bos, false);
		}
		if (Math.abs(this.yspd) > 3) {
			this.instancePlaceList(this.x, Math.floor(this.y + this.yspd), oObject, bos, false);
		}
		for (const bo of bos) {
			if (bo.destroyed) continue;
			bo.acton("hit", this);
		}

		// pushing a pushable while running into it on the floor
		if (this.atWall && this.xspd !== 0 && this.sliding === 0 && this.rolling === 0 && this.onFloor
			&& this.atWallObj.pushable && !this.carrying) {
			this.atWallObj.moveThroughObjects(this.xspd * this.atWallObj.pushAdj, 0);
			this.pushing = true;
			this.atWall = false;
			this.hitWall = false;
		} else {
			this.pushing = false;
		}

		// down and jump on a drop through floor fakes a jump and falls through
		if (this.con.iBtnA && this.con.iDown && this.onFloorObj && this.onFloorObj.dropDown) {
			this.jumping = 8;
			this.jumped = 1;
			this.yspd = 1;
			this.crawling = false;
			this.dropping = true;
		} else {
			this.dropping = false;
		}

		// swim boost instead of a jump, only once slowed from the last boost
		this.curswimspd = pointDistance(0, 0, this.xspd, this.yspd);
		if (this.con.iBtnA && this.swimming && !swimattop && this.curswimspd <= this.swimspd + SWIM_BOOST_MARGIN) {
			this.xspd += this.swimboost * this.con.ljHp;
			this.yspd += this.swimboost * this.con.ljVp;

			const newspdang = pointDistance(0, 0, this.xspd, this.yspd);
			const goang = pointDirection(0, 0, this.xspd, this.yspd);
			this.curswimspd = Math.min(newspdang, Math.max(this.swimboost, this.curswimspd));
			this.xspd = lengthdirX(this.curswimspd, goang);
			this.yspd = lengthdirY(this.curswimspd, goang);

			// a trail of bubbles back the way we pushed off, drawn behind everything in our layer
			const poofang = (goang + 180) % 360;
			game.createObject(oFxParticlerOneShot, {
				x: this.x, y: this.y,
				amount: 1,
				time: 12,
				origObj: this,
				dirminmax: [poofang - 90, poofang + 90],
				dirspdminmax: [0.1, 0.3],
				stoponobjs: 0,
				airspd_slow: 0.004,
				yspd_adj: -0.006,
				alphaminmax: [0.6, 0.8],
				alphaspd: -0.01,
				deadontime: [120, 180],
				colors: ["#99ddff", "#eeeeff", "#00bbff"]
			}, this.mylayer, 0);
		} else if ((this.con.iBtnA && !this.hit && (!this.crawling || this.xspd === 0) && this.sliding === 0
			&& (this.onFloorL || this.onFloor || this.hanging || swimattop
				|| (this.climbing && this.climbobj.jumpoff)))
			|| (this.con.iBtnAd && this.jumping)) {
			// a jump starts on the first frame and keeps counting while held
			this.jumping++;

			if (this.jumping === 1) {
				this.jumped = 1;
				Hooks.sound("snd8bJump");
				// base height, a boost when moving, lower out of water and from a roll
				this.jumph = this.maxjumph + ((Math.abs(this.xspd) > 0 && !this.swimming) ? this.jumpRunBoost : 0);
				this.jumph = this.swimming ? this.jumph * 0.7 : this.jumph;
				this.jumph = this.rolling > 0 ? this.jumph * 0.8 : this.jumph;
				// always the full jump, any rise we had is assumed to be gone
				this.yspd = -this.jumph;

				// kick off a wall, lower and away from it
				if (this.atWall && this.hangjumpkickoff) {
					this.yspd = -this.jumph / 2;
					this.xspd = -this.facing * 1.4;
				}
				// jumping out of a roll adds forward speed, up to double running speed
				if (this.rolling > 0) {
					const minspd = Math.min(this.xspd, -this.runspd * 2);
					const mxspd = Math.max(this.xspd, this.runspd * 2);
					this.xspd = clamp(this.xspd + sign(this.xspd) * this.runspd, minspd, mxspd);
				}
				// jumping out of water splashes where we break the surface, the same splash as going in
				if (this.swimming) {
					this.makeSplash();
				}

				if (this.climbing) {
					// down and jump on a ladder just lets go
					if (this.con.iDown) {
						this.yspd = 0;
						this.jumping = 0;
					}
					// so we do not grab straight back on
					this.wasclimbing = 1;
				}

				// a jump ends rolling, sliding and climbing
				this.sliding = 0;
				this.rolling = 0;
				this.climbing = false;
			}
		}
		// letting go early takes some of the jump back
		if (this.jumping && !this.con.iBtnAd) {
			if (this.jumping < SIDE_SHORT_JUMP_FRAMES) {
				this.yspd += this.jumph / 2 - (this.jumping * this.grav);
			}
			this.jumping = 0;
		}

		// crawling and sliding tilt to the floor's slope, if there is room
		if (this.onFloor && (this.crawling || this.sliding > 0)) {
			const lasta = this.ang;
			this.ang = (360 + this.onFloorObj.ang) % 90;
			this.ang = this.ang > 45 ? this.ang - 90 : this.ang;

			if (lasta !== this.ang) {
				if (this.instancePlace(this.x, this.y, oObject) !== null) {
					this.ang = lasta;
					this.crawling = false;
					// the original stores false here, which reads the same as zero
					this.sliding = 0;
				} else {
					this.moveToFloor();
				}
			}
		} else {
			this.ang = 0;
		}

		// cap each axis
		this.xspd = sign(this.xspd) * Math.min(Math.abs(this.xspd), this.maxspd);
		this.yspd = sign(this.yspd) * Math.min(Math.abs(this.yspd), this.maxspd);

		// the sprite can change the mask, so it goes before the move
		this.update_sprite();

		const lx = this.x;
		const ly = this.y;
		this.moveThroughObjects(this.xspd, this.yspd);

		if (lx !== this.x || ly !== this.y) {
			Hooks.debugLine(lx, ly, this.x, this.y, this.swimming ? "#33ff33" : (this.onFloor ? "#ffff00" : "#ff8800"));
		}

		// a hard landing kills
		if (this.hitFloor && this.yspd > this.dropFallKillSpd) {
			game.guy.kill(45, 3, 0, 0, 1, "sndSplat", this);
		}

		// background things we are over, pits kill, the first pit stops the check
		const overs = [];
		this.instancePlaceList(this.x, this.y, oBgObject, overs, true);
		for (const bo of overs) {
			if (bo.constructor === oPit) {
				game.guy.killTwoBursts(200, 60, [60, 120], [0.5, 0.7], [70, 110], [0.5, 1.5], 0, undefined, this);
				break;
			}
		}
		if (this.dead) return;

		// landing or bumping a ceiling
		if (this.hitFloor) {
			if (this.yspd > 0 || this.bumpStopsJump) {
				this.yspd = 0;
			}
		}
		// a wall stops us
		if (this.hitWall && !this.pushing) {
			this.xspd = 0;
		}

		// remember the last place we stood still
		if (this.onFloor && this.xspd === 0 && this.yspd < 0.2 && this.still > 60) {
			this.lastsx = this.x;
			this.lastsy = this.y;
		}

		// look around: clear the old target, list what the reach mask touches,
		// and mark the first one that can be looked at
		if (this.curlooki >= 0 && this.lookObjs[this.curlooki] && !this.lookObjs[this.curlooki].destroyed) {
			this.lookObjs[this.curlooki].inview = false;
		}

		this.lookObjs.length = 0;
		const omi = this.mask;
		this.mask = "guy_stand_ia_bb";
		this.instancePlaceList(this.x, this.y, oIaObject, this.lookObjs, true);
		this.instancePlaceList(this.x, this.y, oIaBgObject, this.lookObjs, true);
		this.instancePlaceList(this.x, this.y, oActor, this.lookObjs, true);
		this.mask = omi;

		this.curlooki = 0;
		for (; this.curlooki < this.lookObjs.length; this.curlooki++) {
			if (!this.lookObjs[this.curlooki].nolook) {
				this.lookObjs[this.curlooki].inview = true;
				break;
			}
		}
		if (this.lookObjs.length === 0 || this.curlooki >= this.lookObjs.length) {
			this.curlooki = -1;
		}
	}

	// The held item's drop spot shown faint red while dropping, the presenting sparkle,
	// ourselves, the item in hand, and the aim dots.
	draw() {
		if (this.drop_request && this.carrying) {
			const c = this.carrying;
			Draw.spriteExt(c.spi, c.ifr, this.x + this.drop_offx * this.facing, this.y + this.drop_offy,
				c.x_sc, c.y_sc, c.ang, "#ff2222", 0.5);
		}
		if (this.presenting && this.carrying) this.drawPresenting();
		super.draw();
		if (this.carrying && !this.presenting) this.carrying.draw();
		if (this.aiming) {
			const cx = this.sprite_cx();
			const cy = this.sprite_cy();
			const bi = Math.floor(currentTime() / 100) % 4;
			for (let i = 0; i < 4; i++) {
				const d = 5 + 4 * i;
				Draw.alpha = 0.1 + ((bi + 4 - i) % 4) * 0.2;
				Draw.sprite("s_aim_dot", i, cx + 2 * this.facing + lengthdirX(d, this.aimdir), cy + lengthdirY(d, this.aimdir));
			}
			Draw.alpha = 1;
		}
		if (this.inv.in_inv_sel) this.inv.qp_draw();
	}

	// after every object has updated: the sprite again, in case collisions changed our state
	afterUpdate() {
		this.update_sprite();
	}
}
oCharSide.defaultSprite = "guy_stand";
