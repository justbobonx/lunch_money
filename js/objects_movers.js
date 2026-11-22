// How things move through the world: speeds to whole pixel steps, hitting and passing
// through other objects, standing on floors, and getting pushed out of things.
// Positions stay whole pixels and the leftover fraction carries over in the remainders.
// Sideways is resolved before up and down, stepping back one pixel at a time.
// Anything already overlapped at the start of a move is treated as passable.
// Top down adds height, with each object's height deciding what can be walked over.
// Known quirks of the original are kept on purpose and marked where they happen.

// how many pixels a pushed object will try in one direction before it gives up on that spot
// (the original loops until free, so this is only a safety net and is set very high)
const PUSH_OUT_SAFETY_LIMIT = 100000;

// how many tries pulling back into a stay inside area, as in the original
const STAY_IN_TRIES = 100;

// Mixed onto the base object so every object can move with the same rules.
const Movers = {
	// Everything an object needs to move and be moved.
	initMoveable() {
		this.moving = true;
		this.rx = 0;
		this.ry = 0;
		this.rz = 0;
		this.grav = 0.06;
		this.fric = 0.06;
		this.air_fric = 0.006;
		this.maxspd = 6;
		this.onFloor = false;
		this.onFloorL = false;
		this.onFloorObj = null;
		this.atWall = false;
		this.atWallObj = null;
		this.hitWall = false;
		this.hitFloor = false;
		this.hitFloorObj = null;
		this.hitWallObj = null;
		this.climbH = 1;
		this.climbing = false;
		this.swimming = false;
		this.hanging = false;
		this.dropping = false;
		this.lastx = this.x;
		this.lasty = this.y;
		this.facing = 1;
		this.facingy = 0;
	},

	// Friction on the floor, a little air drag and gravity off it, floating up in water.
	applyFrictionGravity() {
		if (this.atWall || this.hitWall) {
			this.xspd = 0;
			this.rx = 0;
		}
		if (this.onFloor || this.hitFloor) {
			this.xspd = sign(this.xspd) * Math.max(Math.abs(this.xspd) - this.fric, 0);
			this.yspd = 0;
			this.ry = 0;
		} else {
			this.xspd = sign(this.xspd) * Math.max(Math.abs(this.xspd) - this.air_fric, 0);
			if (this.swimming) {
				if (this.instancePlace(this.x, this.y - 3, oWater) !== null) {
					// still water above, so drift up
					this.yspd -= 0.01;
				} else {
					// at the surface, so stay put
					this.yspd = 0;
					this.ry = 0;
				}
			} else {
				this.yspd = Math.min(this.yspd + this.grav, this.maxspd);
			}
		}
	},

	// Whether a sideways move into this object is allowed by its one way flags.
	// Direction comes from the new spot, not the speed.
	// The pass unless holding up flags only apply when the object is not the floor underfoot.
	// Objects without a controller read as not holding up, the original would have failed there.
	thruableX(hobj, nx) {
		const up = !!(this.con && this.con.iUp);
		return (nx < this.x && (hobj.thruLeft || (hobj.thruLeftNU && !up && this.onFloorObj !== hobj)))
			|| (nx > this.x && (hobj.thruRight || (hobj.thruRightNU && !up && this.onFloorObj !== hobj)));
	},

	// Whether an up or down move into this object is allowed, including dropping through.
	thruableY(hobj, ny) {
		return (ny > this.y && (hobj.thruDown || (hobj.dropDown && (this.dropping || this.climbing))))
			|| (ny < this.y && hobj.thruUp);
	},

	// The side view move. Speeds are read, never changed, hits only set the flags.
	// Sideways first with stepping up small ledges while on the floor and stepping down
	// small drops, then up and down with a one pixel slide off narrow tips when falling straight.
	moveThroughObjects(xspd, yspd) {
		const whx = this.x + this.rx + xspd;
		let nx = Math.round(whx);
		this.rx = whx - nx;

		const why = this.y + this.ry + yspd;
		let ny = Math.round(why);
		this.ry = why - ny;

		const ix = sign(nx - this.x);
		const iy = sign(ny - this.y);

		// whatever we are inside right now is assumed passable
		const inos = [];
		this.instancePlaceList(this.x, this.y, oObject, inos, 0);

		const hobjs = [];

		// sideways, including stepping up
		this.hitWall = false;
		this.instancePlaceList(nx, this.y, oObject, hobjs, 1);
		for (let hi = 0, hl = hobjs.length; hi < hl; hi++) {
			let hobj = this.instancePlace(nx, this.y, hobjs[hi]);
			while (hobj !== null && nx !== this.x) {
				if (inos.indexOf(hobj) >= 0) {
					this.hitWall = false;
					break;
				}
				if (this.thruableX(hobj, nx)) {
					this.hitWall = false;
					break;
				}

				this.hitWall = true;

				// try stepping up onto it
				if (this.onFloor) {
					const ncx = nx;
					for (let ncy = this.y - 1; ncy > this.y - this.climbH; ncy--) {
						const clo = this.instancePlace(ncx, ncy, hobj);
						if (clo === null || this.thruableX(clo, ncx)) {
							ny = ncy;
							this.y = ncy;
							this.ry = 0;
							nx = ncx;
							Hooks.debugLine(this.x, this.y, nx, ny, "#aaff66");
							this.hitWall = false;
							break;
						}
					}
				}
				if (this.instancePlace(nx, this.y, oObject) === null) {
					break;
				}
				nx -= ix;

				hobj = this.instancePlace(nx, this.y, hobj);
			}
			if (this.hitWall) break;
		}

		// stepping down a small drop while walking on the floor
		if (this.canClimb && nx !== this.x && this.onFloor
			&& this.instancePlace(this.x, this.y + this.climbH, oObject) !== null) {
			for (let ncy = this.y + this.climbH - 1; ncy > this.y; ncy--) {
				if (this.instancePlace(nx, ncy, oObject) === null) {
					this.y = ncy;
					this.ry = 0;
					ny = ncy;
					Hooks.debugLine(this.x, this.y, nx, ny, "#aaff66");
					break;
				}
			}
		}

		this.x = nx;

		// up and down, including the slide off a narrow tip
		this.hitFloor = false;
		this.hitFloorObj = null;
		hobjs.length = 0;
		this.instancePlaceList(this.x, ny, oObject, hobjs, 1);
		for (let hi = 0, hl = hobjs.length; hi < hl; hi++) {
			let hobj = hobjs[hi];
			while (hobj !== null && ny !== this.y) {
				if (inos.indexOf(hobj) >= 0) {
					this.hitFloor = false;
					break;
				}
				if (this.thruableY(hobj, ny)) {
					this.hitFloor = false;
					break;
				}

				this.hitFloor = true;
				this.hitFloorObj = hobj;
				// falling straight down onto a tip slides one pixel off it
				// (the original also asks for no sideways speed here and wonders why itself)
				if (ny > this.y && !this.hanging && Math.abs(xspd) === 0) {
					if (this.instancePlace(this.x + 1, ny, oObject) === null) {
						Hooks.debugLine(this.x, this.y, this.x + 1, this.y, "#6600aa");
						this.x += 1;
						nx = 0;
						this.hitFloor = false;
						this.onFloor = false;
						break;
					}
					if (this.instancePlace(this.x - 1, ny, oObject) === null) {
						Hooks.debugLine(this.x, this.y, this.x + 1, this.y, "#6600aa");
						this.x += -1;
						nx = 0;
						this.hitFloor = false;
						this.onFloor = false;
						break;
					}
				}

				ny -= iy;

				hobj = this.instancePlace(this.x, ny, hobj);
			}
			if (this.hitFloor) break;
		}

		this.y = ny;

		if (this.hitWall) this.rx = 0;
		if (this.hitFloor) this.ry = 0;
	},

	// The simpler side move used by loose objects like crates: one object at a time,
	// a speed slowdown on step ups that only changes the local copy and so does nothing,
	// and the tip slide without the no sideways speed condition.
	moveThroughObjectsSimple(xspd, yspd, objtype) {
		if (objtype === undefined) objtype = oObject;

		this.hitWall = false;
		this.hitWallObj = null;
		this.hitFloor = false;
		this.hitFloorObj = null;

		if (xspd === 0 && yspd === 0) return;

		const whx = this.x + this.rx + xspd;
		let nx = Math.round(whx);
		this.rx = whx - nx;

		const why = this.y + this.ry + yspd;
		let ny = Math.round(why);
		this.ry = why - ny;

		const ix = sign(nx - this.x);
		const iy = sign(ny - this.y);

		const inos = [];
		this.instancePlaceList(this.x, this.y, objtype, inos, 0);

		const up = !!(this.con && this.con.iUp);

		// sideways
		let hobj = this.instancePlace(nx, this.y, objtype);
		while (hobj !== null && nx !== this.x) {
			if (inos.indexOf(hobj) >= 0) {
				this.hitWall = false;
				break;
			}
			if (((hobj.thruLeft || (hobj.thruLeftNU && !up) && this.onFloorObj !== hobj) && nx < this.x)
				|| ((hobj.thruRight || (hobj.thruRightNU && !up) && this.onFloorObj !== hobj) && nx > this.x)) {
				this.hitWall = false;
				break;
			}

			this.hitWall = true;
			this.hitWallObj = hobj;
			if (this.onFloor) {
				const ncx = nx;
				for (let ncy = this.y - 1; ncy > this.y - this.climbH; ncy--) {
					if (this.instancePlace(ncx, ncy, objtype) === null) {
						xspd *= 1 - 0.5 * Math.sin(degToRad(pointDirection(this.x, this.y, ncx, ncy)));
						ny = ncy;
						this.y = ncy;
						this.ry = 0;
						nx = ncx;
						this.hitWall = false;
						break;
					}
				}
			}
			if (this.instancePlace(nx, this.y, objtype) === null) {
				break;
			}
			nx -= ix;

			hobj = this.instancePlace(nx, this.y, objtype);
		}

		// stepping down
		if (nx !== this.x && this.onFloor && this.instancePlace(this.x, this.y + this.climbH, objtype) !== null) {
			for (let ncy = this.y + this.climbH - 1; ncy > this.y; ncy--) {
				if (this.instancePlace(nx, ncy, objtype) === null) {
					this.y = ncy;
					this.ry = 0;
					ny = ncy;
					break;
				}
			}
		}

		this.x = nx;

		// up and down
		hobj = this.instancePlace(this.x, ny, objtype);
		while (hobj !== null && ny !== this.y) {
			if (inos.indexOf(hobj) >= 0) {
				this.hitFloor = false;
				break;
			}
			if (((hobj.thruDown || (hobj.dropDown && (this.dropping || this.climbing))) && ny > this.y)
				|| (hobj.thruUp && ny < this.y)) {
				this.hitFloor = false;
				break;
			}

			this.hitFloor = true;
			this.hitFloorObj = hobj;
			if (ny > this.y && !this.hanging) {
				if (this.instancePlace(this.x + 1, ny, objtype) === null) {
					this.x += 1;
					nx = 0;
					this.hitFloor = false;
					this.onFloor = false;
					break;
				}
				if (this.instancePlace(this.x - 1, ny, objtype) === null) {
					this.x += -1;
					nx = 0;
					this.hitFloor = false;
					this.onFloor = false;
					break;
				}
			}

			ny -= iy;

			hobj = this.instancePlace(this.x, ny, objtype);
		}
		this.y = ny;

		if (this.hitWall) this.rx = 0;
		if (this.hitFloor) this.ry = 0;
	},

	// Top down version of the sideways pass rule: anything we are at or above in height also passes.
	thruableXTopd(hobj, nx) {
		const up = !!(this.con && this.con.iUp);
		return (nx < this.x && (hobj.thruLeft || (hobj.thruLeftNU && !up && this.onFloorObj !== hobj)))
			|| (nx > this.x && (hobj.thruRight || (hobj.thruRightNU && !up && this.onFloorObj !== hobj)))
			|| this.z >= hobj.ht;
	},

	thruableYTopd(hobj, ny) {
		return (ny > this.y && hobj.thruDown)
			|| (ny < this.y && hobj.thruUp)
			|| this.z >= hobj.ht;
	},

	// The top down move: sideways, then down the map, then height.
	// Walking into a passable cliff drops us below it and gives a little hop.
	// Low objects marked to stand on are climbed onto.
	// Height lands on the tallest real object under us, or the ground at zero.
	moveThroughObjectsTopd(xspd, yspd, zspd) {
		this.hitWall = false;
		this.hitWallObj = null;
		this.hitWally = false;
		this.hitWallyObj = null;
		this.hitFloor = false;
		this.hitFloorObj = null;

		if (xspd === 0 && yspd === 0 && zspd === 0) return;

		const whx = this.x + this.rx + xspd;
		let nx = Math.round(whx);
		this.rx = whx - nx;

		const why = this.y + this.ry + yspd;
		let ny = Math.round(why);
		this.ry = why - ny;

		const ix = sign(nx - this.x);
		const iy = sign(ny - this.y);

		const inos = [];
		this.instancePlaceList(this.x, this.y, oObject, inos, 0);

		const hobjs = [];

		// sideways
		this.instancePlaceList(nx, this.y, oObject, hobjs, 1);
		for (let hi = 0, hl = hobjs.length; hi < hl; hi++) {
			let hobj = this.instancePlace(nx, this.y, hobjs[hi]);
			while (hobj !== null && nx !== this.x) {
				// walking off a cliff edge from the side
				if (hobj.thruable && this.inFallWall !== hobj) {
					// drop by the cliff height plus enough to clear below its wall
					const heightAdj = (hobj.bbox_bottom - this.y) + (this.y - this.bbox_top + 1);
					this.z += heightAdj;
					this.y += heightAdj;
					ny = this.y;
					// a little hop when just walking off
					this.zspd += this.zspd === 0 ? 0.5 : 0;
					// remember it so the down the map pass ignores it too
					inos.push(hobj);
					this.inFallWall = hobj;
					this.hitWall = false;
					break;
				}

				if (inos.indexOf(hobj) >= 0) {
					this.hitWall = false;
					break;
				}

				if (this.thruableXTopd(hobj, nx)) {
					this.hitWall = false;
					break;
				}

				if (hobj.standonable && hobj.ht - this.z < this.climbH) {
					this.z = hobj.ht;
					this.hitWall = false;
					break;
				}

				this.hitWall = true;
				this.hitWallObj = hobj;

				if (this.instancePlace(nx, this.y, oObject) === null) {
					break;
				}
				nx -= ix;

				hobj = this.instancePlace(nx, this.y, hobj);
			}
			if (this.hitWall) break;
		}

		this.x = nx;

		// down the map
		hobjs.length = 0;
		this.instancePlaceList(this.x, ny, oObject, hobjs, 1);
		for (let hi = 0, hl = hobjs.length; hi < hl; hi++) {
			let hobj = hobjs[hi];
			while (hobj !== null && ny !== this.y) {
				// falling off a cliff, only when moving down the map
				if (hobj.thruable && ny > this.y && this.inFallWall !== hobj) {
					const heightAdj = (hobj.bbox_bottom - this.y) + (this.y - this.bbox_top + 1);
					this.z += heightAdj;
					ny += heightAdj;
					this.zspd = this.zspd === 0 ? 0.5 : this.zspd;
					this.inFallWall = hobj;
					this.hitWally = false;
					break;
				}

				if (inos.indexOf(hobj) >= 0) {
					this.hitWally = false;
					break;
				}

				if (this.thruableYTopd(hobj, ny)) {
					this.hitWally = false;
					break;
				}

				// climbing onto a low object clears the sideways hit flag, not this one,
				// a quirk kept from the original
				if (hobj.standonable && hobj.ht - this.z < this.climbH) {
					this.z = hobj.ht;
					this.hitWall = false;
					break;
				}

				this.hitWally = true;
				this.hitWallyObj = hobj;

				ny -= iy;

				hobj = this.instancePlace(this.x, ny, hobj);
			}
			if (this.hitWally) break;
		}

		this.y = ny;

		// height
		const whz = this.z + this.rz + zspd;
		let nz = Math.round(whz);
		this.rz = whz - nz;

		hobjs.length = 0;
		this.instancePlaceList(this.x, this.y, oObject, hobjs, 1);
		let thisHeight = 0;
		for (let hi = 0, hl = hobjs.length; hi < hl; hi++) {
			const hobj = hobjs[hi];
			// only real heights count, not the endless height of plain objects
			if (hobj.ht > thisHeight && hobj.ht < BIGGEST_INT) {
				thisHeight = hobj.ht;
				this.hitFloorObj = hobj;
			}
		}
		if (thisHeight > nz && zspd <= 0) {
			this.hitFloor = true;
			nz = thisHeight;
		}

		this.z = nz;

		if (this.hitWall) this.rx = 0;
		if (this.hitWally) this.ry = 0;
		if (this.hitFloor) {
			this.rz = 0;
			this.inFallWall = null;
		}
	},

	// Moves by speeds ignoring every object, for background movers and the dead.
	moveIgnoringObjects(xspd, yspd, zspd) {
		if (xspd === 0 && yspd === 0 && (zspd === undefined || zspd === 0)) return;

		const whx = this.x + this.rx + xspd;
		const nx = Math.round(whx);
		this.rx = whx - nx;

		const why = this.y + this.ry + yspd;
		const ny = Math.round(why);
		this.ry = why - ny;

		this.x = nx;
		this.y = ny;

		if (zspd !== undefined) {
			const whz = this.z + this.rz + zspd;
			const nz = Math.round(whz);
			this.rz = whz - nz;
			this.z = nz;
		}
	},

	// Side view contact flags: floor one pixel below, wall one pixel ahead.
	// Things we are already inside are skipped, and one way floors are skipped while rising.
	// The wall check reads our own left pass flag instead of the wall's, a quirk kept on purpose.
	calcOnFloorAtWall() {
		const inos = [];
		this.instancePlaceList(this.x, this.y, oObject, inos, 0);

		this.onFloorL = this.onFloor;
		this.onFloor = false;
		this.onFloorObj = null;
		const ofos = [];
		this.instancePlaceList(this.x, this.y + 1, oObject, ofos, 0);
		for (const ofo of ofos) {
			if (inos.indexOf(ofo) >= 0) continue;
			if (this.yspd < 0 && ofo.thruUp) continue;
			this.onFloor = true;
			this.onFloorObj = ofo;
			break;
		}

		this.atWall = false;
		this.atWallObj = null;
		const awos = [];
		this.instancePlaceList(this.x + this.facing, this.y + this.facingy, oObject, awos, 0);
		for (const awo of awos) {
			if (inos.indexOf(awo) >= 0) continue;
			if ((this.xspd > 0 && awo.thruRight) || (this.xspd < 0 && this.thruLeft)) continue;
			this.atWall = true;
			this.atWallObj = awo;
			break;
		}
	},

	// Top down contact flags. Standing height comes from whatever we overlap,
	// with passable cliffs counting as far below. Walls only count when taller than us.
	// Both wall checks read our own pass flags for the negative direction, a quirk kept on purpose.
	calcOnFloorAtWallTopd() {
		this.onFloorL = this.onFloor;

		const inos = [];
		this.instancePlaceList(this.x, this.y, oObject, inos, 0);

		this.onFloor = false;
		this.onFloorObj = null;
		let thisHeight = 0;
		for (const ino of inos) {
			if (ino.thruable) {
				thisHeight = -10000;
				this.onFloorObj = ino;
			} else if (ino.ht >= thisHeight) {
				thisHeight = ino.ht;
				this.onFloorObj = ino;
			}
		}
		if (this.z - 1 < thisHeight && this.zspd <= 0) {
			this.onFloor = true;
		}

		this.landed = this.onFloor && !this.onFloorL;

		this.atWall = false;
		this.atWallObj = null;
		const awos = [];
		this.instancePlaceList(this.x + this.facing, this.y, oObject, awos, 0);
		for (const awo of awos) {
			if (inos.indexOf(awo) >= 0) continue;
			if ((this.xspd > 0 && awo.thruRight) || (this.xspd < 0 && this.thruLeft)) continue;
			if (awo.ht <= this.z) continue;
			this.atWall = true;
			this.atWallObj = awo;
			break;
		}

		this.atWally = false;
		this.atWallyObj = null;
		awos.length = 0;
		this.instancePlaceList(this.x, this.y + this.facingy, oObject, awos, 0);
		for (const awo of awos) {
			if (inos.indexOf(awo) >= 0) continue;
			if ((this.yspd > 0 && awo.thruDown) || (this.yspd < 0 && this.thruUp)) continue;
			if (awo.ht <= this.z) continue;
			this.atWally = true;
			this.atWallyObj = awo;
			break;
		}
	},

	// Steps us out of an object one pixel at a time: sideways if that frees us, else
	// up or down, else both. Direction is away from its center, or a given angle.
	// Returns the angle used so a caller could keep pushing the same way.
	pushOutOf(ho, pushang) {
		let nx = this.x;
		let ny = this.y;
		let xi, yi;

		if (pushang !== undefined) {
			xi = sign(lengthdirX(1, pushang));
			yi = sign(lengthdirY(1, pushang));
		} else {
			const mycx = this.sprite_cx();
			const mycy = this.sprite_cy();
			const hocx = ho.sprite_cx();
			const hocy = ho.sprite_cy();
			Hooks.debugLine(mycx, mycy, hocx, hocy, "#ffffff");
			xi = sign(mycx - hocx);
			yi = sign(mycy - hocy);

			// dead center would never move, so head for the camera instead
			if (xi === 0 && yi === 0) {
				xi = sign(game.cam.x - mycx);
				yi = sign(game.cam.y - mycy);
			}
		}

		// still no direction, just go up
		if (xi === 0 && yi === 0) yi = -1;

		for (let tries = 0; tries < PUSH_OUT_SAFETY_LIMIT; tries++) {
			if (this.instancePlace(nx + xi, ny, ho) === null) {
				nx += xi;
				break;
			}
			if (this.instancePlace(nx, ny + yi, ho) === null) {
				ny += yi;
				break;
			}
			nx += xi;
			ny += yi;
			if (this.instancePlace(nx, ny, ho) === null) break;
		}

		if (nx !== this.x || ny !== this.y) {
			Hooks.debugLine(this.x, this.y, nx, ny, "#ff22ff");
			this.x = nx;
			this.y = ny;
		}

		return pointDirection(0, 0, xi, yi);
	},

	// Gets pushed out of every solid object that moved into us, skipping passable ones
	// and ones we are above. Each object is handled once, nearest first.
	pushedByObjects(objtype) {
		if (objtype === undefined) objtype = oObject;
		const mos = [];
		const los = this.instancePlaceList(this.x, this.y, objtype, mos, true);
		for (let li = 0; li < los; li++) {
			const ho = mos[li];
			if (ho.thruable || ho.ht <= this.z) continue;
			this.pushOutOf(ho);
		}
		return los;
	},

	// Rides along with whatever moving thing we hang from or stand on.
	moveWithObjects() {
		if (this.hanging && this.hangingObj && this.hangingObj.moving) {
			this.moveWithObject(this.hangingObj);
		}
		if (this.onFloor && this.onFloorObj && this.onFloorObj.moving) {
			this.moveWithObject(this.onFloorObj);
		}
	},

	// Copies another object's last move. The remainders are not carried, as in the original.
	moveWithObject(withObj) {
		this.x += withObj.x - withObj.lastx;
		this.y += withObj.y - withObj.lasty;
	},

	limitSpeed(limit) {
		const ldir = pointDirection(0, 0, this.xspd, this.yspd);
		const lspd = Math.min(limit, pointDistance(0, 0, this.xspd, this.yspd));
		this.setXySpd(lspd, ldir);
	},

	setXySpd(spd, dir) {
		this.xspd = lengthdirX(spd, dir);
		this.yspd = lengthdirY(spd, dir);
	},

	// Moves down until clear of every object, assuming a floor is somewhere below.
	moveToFloor() {
		let ny = this.y;
		let ho = this.instancePlace(this.x, ny, oObject);
		while (ho !== null) {
			ny += 1;
			ho = this.instancePlace(this.x, ny, oObject);
		}
		Hooks.debugLine(this.x, this.y, this.x, ny, "#8866ff");
		this.y = ny;
	},

	// Whether our box at a spot sits fully inside another object's box.
	placeObjInObj(px, py, obj) {
		const lx = this.x;
		const ly = this.y;
		this.x = px;
		this.y = py;
		const found = this.bbox_left >= obj.bbox_left && this.bbox_right <= obj.bbox_right
			&& this.bbox_top >= obj.bbox_top && this.bbox_bottom <= obj.bbox_bottom;
		this.x = lx;
		this.y = ly;
		return found;
	},

	// First object of a type that we would sit fully inside at a spot.
	instancePlaceInside(px, py, obj) {
		const ins = [];
		this.instancePlaceList(px, py, obj, ins, 0);
		let found = null;
		for (let i = 0; i < ins.length && found === null; i++) {
			found = ins[i];
			if (!this.placeObjInObj(px, py, found)) found = null;
		}
		return found;
	},

	// Keeps us inside a bounding area: once inside one, leaving it pulls us back in,
	// against our speed or toward its center when standing still.
	checkStayinObjs(objtype) {
		this.stayinHit = null;

		const newstayin = this.instancePlaceInside(this.x, this.y, objtype);

		if (newstayin !== null) {
			this.cur_stayin = newstayin;
		} else if (this.cur_stayin) {
			this.stayinHit = this.cur_stayin;
			let nx = this.x;
			let ny = this.y;

			let xi = sign(-this.xspd);
			let yi = sign(-this.yspd);

			if (xi === 0 && yi === 0) {
				xi = sign(this.cur_stayin.sprite_cx() - this.x);
				yi = sign(this.cur_stayin.sprite_cy() - this.y);
				if (xi === 0 && yi === 0) xi = -1;
			}

			let tries = 0;
			while (++tries < STAY_IN_TRIES) {
				if (this.instancePlaceInside(nx + xi, ny, this.cur_stayin) === this.cur_stayin) {
					nx += xi;
					break;
				}
				if (this.instancePlaceInside(nx, ny + yi, this.cur_stayin) === this.cur_stayin) {
					ny += yi;
					break;
				}
				nx += xi;
				ny += yi;
				if (this.instancePlaceInside(nx, ny, this.cur_stayin) === this.cur_stayin) break;
			}

			if (nx !== this.x || ny !== this.y) {
				Hooks.debugLine(this.x, this.y, nx, ny, "#22cc22");
				this.x = nx;
				this.rx = 0;
				this.y = ny;
				this.ry = 0;
			}
		} else {
			// not inside anything yet, so grab whatever we overlap and pull in next time
			this.cur_stayin = this.instancePlace(this.x, this.y, objtype);
		}
	},

	// Lets a floor effect under our exact origin point change our movement.
	checkFloorFx(acc, maxspd) {
		const flfx = this.collisionPoint(this.x, this.y, oFloorEffect, 0, 1);
		if (flfx !== null) {
			flfx.effect_obj(this, acc, maxspd);
		}
	},

	// Side or top down water check. Jumping up out of the water does not count as in it.
	checkInWater() {
		this.inwaterObj = this.instancePlace(this.x, this.y, oWater);
		if (this.ch_side) {
			this.inwater = this.inwaterObj !== null && !(this.jumped && this.yspd < 0);
		} else {
			this.inwater = this.inwaterObj !== null && this.z <= 0 && this.onFloorObj === null
				&& !(this.jumped && this.yspd < 0);
		}
	},

	// Starts or stops swimming. Entering splashes, slows a side view fall, ends a dive,
	// and drops whatever is carried.
	checkStartSwimming() {
		const lastSwim = this.swimming;

		this.checkInWater();
		this.swimming = this.inwater;

		if (this.swimming && !lastSwim) {
			this.makeSplash();
			if (this.ch_side) {
				this.yspd = sign(this.yspd) * Math.min(Math.abs(this.yspd) / 1.5, 3);
			}
			this.diving = false;
			if (this.carrying) {
				this.carrying.drop();
			}
		}

		// bubbles every two seconds while swimming side view
		if (this.ch_side && this.swimming) {
			if (this.step % 120 === 0) {
				game.createObject(oBubble, { x: this.x + this.xspd, y: this.y + this.yspd - 5 }, this.mylayer);
			}
		}
	},

	// Drops thrown up where we meet the water, harder the faster we were falling. Side view they
	// start at the water's top and end on anything solid they land on, top down they start at our
	// spot and fly free.
	makeSplash() {
		const side = this.ch_side;
		game.createObject(oFxParticlerOneShot, {
			x: this.x, y: side ? this.inwaterObj.bbox_top + 2 : this.y,
			amount: 7,
			time: 4,
			dirminmax: [60, 120],
			dirspdminmax: [Math.abs(this.yspd) / 10, Math.abs(this.yspd) / 4],
			dir2minmax: [20, 160],
			dir2spdminmax: [0.3, 0.4],
			colors: ["#6dd0f7", "#ffffff", "#cccccc"],
			alphaminmax: [0.6, 0.8],
			stoponobjs: side ? 1 : 0,
			deadonland: side ? 1 : 0,
			deadontime: [10, 60]
		}, this.mylayer);
	}
};
