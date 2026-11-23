// The editor's view: a free camera over the whole room that zooms in and out, and the room drawn
// under it as the game would show it, minus what objects do when they run. Every layer draws with
// the player's own sprite drawing, scrolled, parallaxed and looped as the game would be if its view
// sat centred where the editor is looking; layers with masks are cut by them, and area backdrops
// tile their areas. Drawing goes straight onto the screen at the zoom, so far out every sprite still
// draws, only small. On top come the editor's marks: the current layer's hit boxes and origins,
// hover and selection outlines, the selection's box and its corner grabbers, a box being dragged out,
// the picker's item at the mouse, the room's origin, and the game sized frame around the view's
// middle. Marks are drawn in screen pixels so they stay the same width and sharp at any zoom.

// The original editor zoomed in steps of a 32 by 20 view: one step at a time while close in,
// then by a tenth at a time further out, between one step and six hundred and forty.
const ED_ZOOM_UNIT = 32;
const ED_ZOOM_STEP_SWITCH = 10;
const ED_ZOOM_GROWTH = 10;
const ED_ZOOM_MIN = 1;
const ED_ZOOM_MAX = 640;

// how far past the screen edge an entry may sit and still draw, in room pixels
const ED_CULL_PAD = 2;

// what the view clears to with no room, or a room without a backdrop colour
const ED_CLEAR_COLOR = "#000000";

// Marks, with the original editor's colours. Hit boxes on the current layer, objects and pictures
// told apart, brighter when turned.
const ED_HITBOX_OBJ_COLOR = "#cc33ff";
const ED_HITBOX_SPR_COLOR = "#33ccff";
const ED_HITBOX_ALPHA = 0.3;
const ED_HITBOX_TURNED_OBJ_COLOR = "#cc00ff";
const ED_HITBOX_TURNED_SPR_COLOR = "#00ccff";
const ED_HITBOX_TURNED_ALPHA = 0.5;
// origins on the current layer, brighter when hovered or selected, and the footprint when it sits
// apart from the picture
const ED_ORIGIN_COLOR = "#66ff66";
const ED_ORIGIN_HOT_COLOR = "#88ff88";
const ED_ORIGIN_ALPHA = 0.5;
const ED_ORIGIN_HOT_ALPHA = 0.8;
const ED_ORIGIN_TURNED_ALPHA = 0.6;
const ED_FOOT_HOT_COLOR = "#88ffdd";
const ED_FOOT_HOT_ALPHA = 0.8;
// hover and selection outlines, over every layer
const ED_HOVER_COLOR = "#ff9900";
const ED_SELECT_COLOR = "#ffff00";
const ED_OUTLINE_ALPHA = 0.5;
// the room's origin
const ED_ROOM_ORIGIN_BACK_COLOR = "#000000";
const ED_ROOM_ORIGIN_BACK_ALPHA = 0.4;
const ED_ROOM_ORIGIN_COLOR = "#ff3333";
const ED_ROOM_ORIGIN_ALPHA = 0.6;
// the cross at the view's middle and the game sized frame around it
const ED_CENTER_COLOR = "#ffffff";
const ED_CENTER_ALPHA = 0.3;
const ED_FRAME_OUTER_COLOR = "#000000";
const ED_FRAME_INNER_COLOR = "#ffffff";
const ED_FRAME_ALPHA = 0.15;
// the editor's own mouse, drawn in place of the browser's arrow so its spot is exact
const ED_MOUSE_SPRITE = "sle_Mouse";
// the two letters over an object with no sprite or a sprite the game lacks, as the original's picker
const ED_LABEL_FONT = "ftTiny";
const ED_LABEL_COLOR = "#ffffff";
const ED_LABEL_ALPHA = 0.6;
const ED_LABEL_DY = -2;
// the small mark under the picker's item at the mouse, as the original's: a dark rim, a light square
// and a white middle, each a room pixel apart
const ED_MOUSE_RIM_COLOR = "#000000";
const ED_MOUSE_RIM_ALPHA = 0.2;
const ED_MOUSE_MARK_COLOR = "#ffff88";
const ED_MOUSE_MARK_ALPHA = 0.6;
const ED_MOUSE_DOT_COLOR = "#ffffff";
const ED_MOUSE_DOT_ALPHA = 0.8;
// Marks are drawn in room pixels as the original drew them, so they sit on the pixel grid: lines
// one pixel of their layer wide, hugging the pixels at a box's edge. This is the thinnest a line
// or a dot mark gets, in page pixels, so they still show when zoomed far out.
const ED_MARK_MIN_PX = 2;
// how far the cross at the view's middle reaches, in room pixels, and at least in line widths
const ED_CENTER_REACH = 1;
const ED_CENTER_MIN_REACH = 2;

const EdView = {
	// screen pixels per room pixel
	z: 1,
	// The scroll the game's view would have, centred where the editor looks, and that middle. Kept on
	// whole pixels as the game's is.
	scrox: 0,
	scroy: 0,
	midx: 0,
	midy: 0,
	// screen sized canvases for layers with masks, made when first needed
	layerCanvas: null,
	maskCanvas: null,
	// backdrop fills by sprite and frame
	patterns: {},
	// entries looked at in the last frame, as the original counted them
	totSpriteCnt: 0,
	// the picker's item drawn at the mouse
	preview: new lpSprite({ spi: null }),

	camH() {
		const c = Editor.canvas;
		return Editor.cam.w * c.height / c.width;
	},

	// One wheel step of the original's zoom, keeping the view's middle where it is.
	zoom(wh) {
		const cam = Editor.cam;
		const camh = this.camH();
		const cursc = cam.w / ED_ZOOM_UNIT;
		const newsc = clamp(cursc < ED_ZOOM_STEP_SWITCH ? cursc + wh : Math.round(cursc * (1 + wh / ED_ZOOM_GROWTH)), ED_ZOOM_MIN, ED_ZOOM_MAX);
		const ncw = Math.round(ED_ZOOM_UNIT * newsc);
		cam.x -= (ncw - cam.w) / 2;
		cam.w = ncw;
		cam.y -= (this.camH() - camh) / 2;
	},

	// the view's middle moved to a spot, on whole pixels as the original's centring was
	centerOn(nx, ny) {
		const cam = Editor.cam;
		cam.x = Math.floor(nx - cam.w / 2);
		cam.y = Math.floor(ny - this.camH() / 2);
	},

	// The whole number scale the mouse and the grabbers draw at, given how many screen pixels a room
	// pixel covers: as the original's mouse, halfway between its own size and the zoom, so it grows
	// with the zoom but stays easy to see far out and not huge close in, its pixels on whole screen pixels.
	markScale(pix) {
		return Math.max(1, Math.round((pix + 1) / 2));
	},

	// A spot in a layer's own room pixels to view space, the room as the editor's camera sees it, and
	// back. Editing measures boxes and the mouse in view space so layers of every mapping line up.
	toView(lyr, x, y) {
		const ln = lyr.lens;
		const cam = Editor.cam;
		return { x: (ln.s * (x - ln.offx) + ln.ox) / this.z + cam.x, y: (ln.s * (y - ln.offy) + ln.oy) / this.z + cam.y };
	},

	// The mouse's spot in a layer for pointing, picking, dragging and placing. On a layer that maps
	// one to one onto the room, with no parallax and the room's width, it is the whole room pixel
	// under the mouse, so whatever the mouse moves or places stays on whole pixels; on any other
	// layer it is the exact spot.
	mouseOn(lyr) {
		const m = Editor.mouse;
		if (!lyr.lens.parax && lyr.host.wd === Editor.room.roomw) return { x: Math.floor(m.wx), y: Math.floor(m.wy) };
		return this.toLayer(lyr, m.wx, m.wy);
	},

	toLayer(lyr, wx, wy) {
		const ln = lyr.lens;
		const cam = Editor.cam;
		return { x: ((wx - cam.x) * this.z - ln.ox) / ln.s + ln.offx, y: ((wy - cam.y) * this.z - ln.oy) / ln.s + ln.offy };
	},

	// Whether entries can be picked from a layer, as the original decided: not when it is hidden and
	// not current, in a folded group, or locked; alt lets locked layers and visible folded groups
	// through.
	pickable(lyr, li, alt) {
		const room = Editor.room;
		const lg = lyr.group !== undefined ? room.lgroups[lyr.group] : undefined;
		return !((!lyr.visible && li !== Editor.curlayeri) || (lg !== undefined && lg.folded && !(lg.visible && alt))
			|| (!alt && lyr.locked));
	},

	// Works out, for this frame, the zoom, the game's scroll, and how every layer maps onto the
	// screen: its stretch, where its zero lands, and the scroll it takes off its entries. A layer
	// keeps the part of the scroll its parallax gives it, and one wider than the room shows smaller,
	// as in play. A caret layer maps as the layer it adds to.
	lenses() {
		const ed = Editor;
		const cam = ed.cam;
		const room = ed.room;
		this.z = ed.canvas.width / cam.w;
		this.midx = cam.x + cam.w / 2;
		this.midy = cam.y + this.camH() / 2;
		this.scrox = Math.floor(this.midx - room.roomw / 2);
		this.scroy = Math.floor(this.midy - room.roomh / 2);
		// the player's tiles that slide with the camera read its scroll
		game.cam.scrox = this.scrox;
		game.cam.scroy = this.scroy;
		for (const lyr of room.layers) {
			const host = lyr.host;
			lyr.lens = {
				s: this.z * room.roomw / host.wd,
				ox: this.z * (this.scrox - cam.x),
				oy: this.z * (this.scroy - cam.y),
				offx: this.scrox * host.plx_x,
				offy: this.scroy * host.plx_y,
				parax: host.plx_x !== 1 || host.plx_y !== 1,
				loop_x: host.loop_x,
				loop_y: host.loop_y,
				// how far parallax moves an entry, which looping wraps around the view's middle
				shx: this.scrox * (1 - host.plx_x),
				shy: this.scroy * (1 - host.plx_y)
			};
		}
	},

	// How far looping moves an entry this frame: in play its parallaxed spot wraps into one loop
	// length around the camera's middle. Kept on the entry for the marks drawn after it.
	loopShift(lyr, rec) {
		const ln = lyr.lens;
		rec.loopdx = 0;
		rec.loopdy = 0;
		if (ln.loop_x) {
			const p = rec.x + ln.shx;
			const st = this.midx - ln.loop_x / 2;
			rec.loopdx = st + (((p - st) % ln.loop_x) + ln.loop_x) % ln.loop_x - p;
		}
		if (ln.loop_y) {
			const p = rec.y + ln.shy;
			const st = this.midy - ln.loop_y / 2;
			rec.loopdy = st + (((p - st) % ln.loop_y) + ln.loop_y) % ln.loop_y - p;
		}
	},

	// Where an entry's picture starts in its layer, its loop shift worked out first. On a layer drawn
	// on whole pixels that is exactly where the picture draws: its place, its offset and its loop
	// shift each rounded down as the drawing rounds them. On a parallax layer it is the exact spot.
	// The hit box, the outline and the selection box all start from it.
	spot(rec) {
		const x = rec.x - rec.exoffx + rec.loopdx;
		const y = rec.y - rec.exoffy + rec.loopdy;
		if (rec.mylayer.lens.parax) return { x: x, y: y };
		return {
			x: Math.floor(rec.x) - Math.floor(rec.exoffx) + Math.floor(rec.loopdx),
			y: Math.floor(rec.y) - Math.floor(rec.exoffy) + Math.floor(rec.loopdy)
		};
	},

	// Everything under the mouse, as the original found hovers: on every layer that can be picked from,
	// bottom layer first, by each entry's collision shape at its picture's spot.
	findHovers(alt) {
		const ed = Editor;
		const room = ed.room;
		const found = [];
		room.layers.forEach((lyr, li) => {
			if (!this.pickable(lyr, li, alt)) return;
			const ln = lyr.lens;
			const mx = Math.floor((ed.mouse.devx - ln.ox) / ln.s + ln.offx);
			const my = Math.floor((ed.mouse.devy - ln.oy) / ln.s + ln.offy);
			for (const rec of lyr.lsprites) {
				if (rec.hidden) continue;
				this.loopShift(lyr, rec);
				const p = this.spot(rec);
				const shape = maskShape(rec, p.x, p.y);
				if (shape && pointInShape(shape, mx, my)) found.push(rec);
			}
		});
		return found;
	},

	// The whole room and the marks over it.
	draw() {
		const ed = Editor;
		const ctx = ed.ctx;
		const cvs = ed.canvas;
		const room = ed.room;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "source-over";
		// the room's backdrop colour as in play, when it has one
		ctx.fillStyle = room !== null && room.bd_color !== undefined ? "#" + room.bd_color : ED_CLEAR_COLOR;
		ctx.fillRect(0, 0, cvs.width, cvs.height);
		if (room === null) return;

		this.lenses();
		const cam = ed.cam;
		const z = this.z;
		const camh = this.camH();
		const minLine = Math.max(1, Math.round(ED_MARK_MIN_PX * ed.dpr));
		// a line one pixel wide on a layer showing this many screen pixels to its pixel
		const thick = (pix) => Math.max(minLine, Math.round(pix));
		Draw.targetScale = 1;
		Draw.halign = "left";
		Draw.valign = "top";

		// Screen space marks. A room spot to the screen through a layer's mapping, a filled square of a
		// size in room pixels but never smaller than the thinnest line, and a closed outline through
		// screen points of a given width. An upright box's outline lies just inside its edges on whole
		// screen pixels, so a box round a picture covers the picture's edge pixels; a turned one is
		// stroked along its edges.
		const sx = (ln, x) => ln.s * (x - ln.offx) + ln.ox;
		const sy = (ln, y) => ln.s * (y - ln.offy) + ln.oy;
		const dot = (x, y, size, color, alpha) => {
			const d = Math.max(size, minLine);
			ctx.globalAlpha = alpha;
			ctx.fillStyle = color;
			ctx.fillRect(Math.round(x - d / 2), Math.round(y - d / 2), d, d);
		};
		const outline = (points, color, alpha, w) => {
			ctx.globalAlpha = alpha;
			ctx.strokeStyle = color;
			ctx.lineWidth = w;
			const [p0, p1, p2, p3] = points;
			if (points.length === 4 && p0.y === p1.y && p1.x === p2.x && p2.y === p3.y && p3.x === p0.x) {
				const l = Math.round(Math.min(p0.x, p2.x));
				const r = Math.round(Math.max(p0.x, p2.x));
				const t = Math.round(Math.min(p0.y, p2.y));
				const b = Math.round(Math.max(p0.y, p2.y));
				// a box too small for its line inside it is filled instead
				if (r - l <= w * 2 || b - t <= w * 2) {
					ctx.fillStyle = color;
					ctx.fillRect(l, t, Math.max(r - l, w), Math.max(b - t, w));
				} else {
					ctx.strokeRect(l + w / 2, t + w / 2, r - l - w, b - t - w);
				}
				return;
			}
			ctx.beginPath();
			points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
			ctx.closePath();
			ctx.stroke();
		};
		// The four corners of an entry's picture, stretched and turned about its spot, on the screen.
		// Upright on a layer drawn on whole pixels they round to the pixels the picture covers, as its
		// hit box does.
		const corners = (ln, rec) => {
			const sr = Sprites.get(rec.spi);
			const o = this.spot(rec);
			const c = Math.cos(degToRad(rec.ang));
			const s = Math.sin(degToRad(rec.ang));
			const x0 = -sr.ox * rec.x_sc;
			const x1 = (sr.w - sr.ox) * rec.x_sc;
			const y0 = -sr.oy * rec.y_sc;
			const y1 = (sr.h - sr.oy) * rec.y_sc;
			const whole = rec.ang === 0 && !ln.parax ? Math.round : (v) => v;
			return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
				.map((p) => ({ x: sx(ln, whole(o.x + p.x * c + p.y * s)), y: sy(ln, whole(o.y - p.x * s + p.y * c)) }));
		};

		// Area backdrops under everything, tiled on the room's grid of their size over their bounds,
		// as the player tiles them. The original editor showed every area's backdrop unless the area
		// was folded away; the player only those in view. One repeating fill per area stands in for
		// the many tiles, so a far zoom stays quick; backdrops are square, so it lands the same.
		if (ed.drawBdSprites) {
			ctx.imageSmoothingEnabled = z < 1;
			for (const key of Object.keys(room.lgroups)) {
				const grp = room.lgroups[key];
				if ((grp.folded && !grp.visible) || grp.bd_sprite === null || grp.bounds === null) continue;
				const sr = Sprites.peek(grp.bd_sprite);
				if (!sr || !sr.image || !sr.frames || !(sr.w > 0)) continue;
				const fi = Math.floor(ed.frames * sr.imageSpeed) % sr.frames.length;
				const pkey = grp.bd_sprite + "|" + fi;
				if (this.patterns[pkey] === undefined || this.patterns[pkey].image !== sr.image) {
					const f = sr.frames[fi];
					const tile = Draw.makeCanvas(sr.w, sr.w);
					tile.getContext("2d").drawImage(sr.image, f[0], f[1], f[2], f[3], -sr.ox, -sr.oy, f[2], f[3]);
					this.patterns[pkey] = { image: sr.image, fill: ctx.createPattern(tile, "repeat") };
				}
				const b = maskShape(grp.bounds, grp.bounds.x, grp.bounds.y);
				if (!b) continue;
				const spw = sr.w;
				const x0 = Math.max(cam.x, b.l);
				const y0 = Math.max(cam.y, b.t);
				const x1 = Math.min(cam.x + cam.w, b.r);
				const y1 = Math.min(cam.y + camh, b.b);
				if (x1 <= x0 || y1 <= y0) continue;
				const tx = x0 - (((x0 % spw) + spw) % spw);
				const ty = y0 - (((y0 % spw) + spw) % spw);
				ctx.setTransform(z, 0, 0, z, -cam.x * z, -cam.y * z);
				ctx.globalAlpha = 1;
				ctx.fillStyle = this.patterns[pkey].fill;
				ctx.fillRect(tx, ty, Math.ceil((x1 - tx) / spw) * spw, Math.ceil((y1 - ty) / spw) * spw);
			}
			ctx.setTransform(1, 0, 0, 1, 0, 0);
		}

		// The layers, in the list's order. A folded group shows only when its header row is visible;
		// otherwise a layer hidden in the editor shows only while it is the current one.
		this.totSpriteCnt = 0;
		const labels = [];
		room.layers.forEach((lyr, li) => {
			const lg = lyr.group !== undefined ? room.lgroups[lyr.group] : undefined;
			if (lg !== undefined && lg.folded && !lg.col_head_lyr.visible) return;
			if ((lg === undefined || !lg.folded) && !lyr.visible && li !== ed.curlayeri) return;
			// sorted by height as the game sorts it, which reorders the layer's entries as the original did
			if (lyr.zsort) game.zsortLayer(lyr);

			const ln = lyr.lens;
			const buffered = lyr.mask_list.length > 0;
			let target = ctx;
			if (buffered) {
				if (this.layerCanvas === null || this.layerCanvas.width !== cvs.width || this.layerCanvas.height !== cvs.height) {
					this.layerCanvas = Draw.makeCanvas(cvs.width, cvs.height);
					this.maskCanvas = Draw.makeCanvas(cvs.width, cvs.height);
				}
				target = this.layerCanvas.getContext("2d");
				target.setTransform(1, 0, 0, 1, 0, 0);
				target.clearRect(0, 0, cvs.width, cvs.height);
			}
			Draw.ctx = target;
			target.imageSmoothingEnabled = ln.s < 1;
			Draw.base = { sx: ln.s, sy: ln.s, ox: ln.ox, oy: ln.oy };
			// a parallax layer slides by screen pixels, as in play
			Draw.subpixel = ln.parax;
			Draw.color = "#ffffff";
			Draw.alpha = 1;

			const vl = -ln.ox / ln.s + ln.offx - ED_CULL_PAD;
			const vt = -ln.oy / ln.s + ln.offy - ED_CULL_PAD;
			const vr = (cvs.width - ln.ox) / ln.s + ln.offx + ED_CULL_PAD;
			const vb = (cvs.height - ln.oy) / ln.s + ln.offy + ED_CULL_PAD;
			const marks = [];
			for (const rec of lyr.lsprites) {
				this.totSpriteCnt++;
				if (rec.hidden) continue;
				this.loopShift(lyr, rec);
				const px = rec.x - rec.exoffx + rec.loopdx;
				const py = rec.y - rec.exoffy + rec.loopdy;
				rec._in_frame = px + rec.bbox.r >= vl && px + rec.bbox.l <= vr && py + rec.bbox.b >= vt && py + rec.bbox.t <= vb;
				if (!rec._in_frame) continue;
				Draw.curdrawoffx = ln.offx - rec.loopdx;
				Draw.curdrawoffy = ln.offy - rec.loopdy;
				if (rec.look !== null) {
					rec.look.draw();
					Draw.animate(rec.look, ed.steps);
				} else {
					Draw.lpSprite(rec);
					Draw.animate(rec, ed.steps);
				}
				if (ed.showAsPlayer) continue;
				if (li === ed.curlayeri) marks.push(rec);
				if (rec.blank !== "") labels.push(rec);
			}

			// the masks keep only the layer pixels they cover, drawn at the layer's own mapping
			if (buffered) {
				const mctx = this.maskCanvas.getContext("2d");
				mctx.setTransform(1, 0, 0, 1, 0, 0);
				mctx.clearRect(0, 0, cvs.width, cvs.height);
				mctx.imageSmoothingEnabled = ln.s < 1;
				Draw.ctx = mctx;
				Draw.curdrawoffx = ln.offx;
				Draw.curdrawoffy = ln.offy;
				for (const mrec of lyr.mask_list) Draw.lpSprite(mrec);
				target.setTransform(1, 0, 0, 1, 0, 0);
				target.globalCompositeOperation = "destination-in";
				target.drawImage(this.maskCanvas, 0, 0);
				target.globalCompositeOperation = "source-over";
				ctx.setTransform(1, 0, 0, 1, 0, 0);
				ctx.globalAlpha = 1;
				ctx.drawImage(this.layerCanvas, 0, 0);
			}
			Draw.ctx = ctx;

			// The current layer's hit boxes and origins, right over the layer as the original drew them,
			// so layers above still cover them. The hit box is the collision shape at the picture's spot.
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			for (const rec of marks) {
				const isObj = rec.isobj !== undefined;
				const hot = rec.selected || rec.hover;
				const { x: ox, y: oy } = this.spot(rec);
				const turned = rec.ang !== 0;
				const shape = maskShape(rec, ox, oy);
				if (shape) {
					const l = sx(ln, shape.l);
					const t = sy(ln, shape.t);
					const r = sx(ln, shape.r + 1);
					const b = sy(ln, shape.b + 1);
					outline(shape.poly ? shape.poly.map((p) => ({ x: sx(ln, p.x), y: sy(ln, p.y) }))
						: [{ x: l, y: t }, { x: r, y: t }, { x: r, y: b }, { x: l, y: b }],
					turned ? (isObj ? ED_HITBOX_TURNED_OBJ_COLOR : ED_HITBOX_TURNED_SPR_COLOR) : (isObj ? ED_HITBOX_OBJ_COLOR : ED_HITBOX_SPR_COLOR),
					turned ? ED_HITBOX_TURNED_ALPHA : ED_HITBOX_ALPHA, thick(ln.s));
				}
				dot(sx(ln, ox), sy(ln, oy), ln.s, hot ? ED_ORIGIN_HOT_COLOR : ED_ORIGIN_COLOR,
					hot ? ED_ORIGIN_HOT_ALPHA : (turned ? ED_ORIGIN_TURNED_ALPHA : ED_ORIGIN_ALPHA));
				// the footprint, as in the original only on entries that are not turned
				if (hot && !turned && (rec.exoffx !== 0 || rec.exoffy !== 0)) {
					dot(sx(ln, rec.x + rec.loopdx), sy(ln, rec.y + rec.loopdy), ln.s, ED_FOOT_HOT_COLOR, ED_FOOT_HOT_ALPHA);
				}
			}
		});

		// Hover and selection outlines over everything, still shown when showing as the player.
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		const edit = EdEdit;
		room.layers.forEach((lyr, li) => {
			if (!lyr.visible && li !== ed.curlayeri && !ed.showAsPlayer) return;
			for (const rec of lyr.lsprites) {
				if (!rec._in_frame) continue;
				if (rec.hover || (rec.selected && (!ed.showAsPlayer || edit.boxSelect))) {
					outline(corners(lyr.lens, rec), rec.selected ? ED_SELECT_COLOR : ED_HOVER_COLOR, ED_OUTLINE_ALPHA, thick(lyr.lens.s));
				}
			}
		});

		// The selection's box while nothing is held, a single turned entry's turned with it, and the
		// grabbers at its corners, the one under the mouse brighter and still shown while it drags.
		const vx = (x) => (x - cam.x) * z;
		const vy = (y) => (y - cam.y) * z;
		const sel = edit.selects;
		const b = edit.box;
		const showgrab = !ed.showAsPlayer && !edit.moving && !edit.resizing && sel.length > 0;
		if (showgrab) {
			if (sel.length === 1 && sel[0].ang !== 0) {
				outline(corners(sel[0].mylayer.lens, sel[0]), ED_SEL_BOX_COLOR, ED_SEL_BOX_ALPHA, thick(sel[0].mylayer.lens.s));
			} else {
				outline([{ x: vx(b.x1), y: vy(b.y1) }, { x: vx(b.x2), y: vy(b.y1) }, { x: vx(b.x2), y: vy(b.y2) }, { x: vx(b.x1), y: vy(b.y2) }],
					ED_SEL_BOX_COLOR, ED_SEL_BOX_ALPHA, thick(z));
			}
		}
		if (showgrab || (edit.resizing && edit.grab !== null)) {
			const gs = this.markScale(z);
			Draw.base = { sx: 1, sy: 1, ox: 0, oy: 0 };
			Draw.curdrawoffx = 0;
			Draw.curdrawoffy = 0;
			ctx.imageSmoothingEnabled = false;
			for (const g of ED_GRABBERS) {
				const hot = g === edit.grab;
				if (!showgrab && !hot) continue;
				// a grabber being dragged follows the mouse
				const held = hot && edit.resizing;
				const gx = held ? vx(edit.grabX + ed.mouse.wx - edit.downX) : vx(g.xo < 0 ? b.x1 : b.x2);
				const gy = held ? vy(edit.grabY + ed.mouse.wy - edit.downY) : vy(g.yo < 0 ? b.y1 : b.y2);
				Draw.spriteRaw(ED_GRAB_SPRITE, 0, Math.round(gx + g.xo * gs), Math.round(gy + g.yo * gs),
					g.xo < 0 ? gs : -gs, g.yo < 0 ? gs : -gs, 0, NO_TINT, hot ? ED_GRAB_HOT_ALPHA : ED_GRAB_ALPHA);
			}
			// the grabbers leave the last one's placement on the canvas; the marks after them are in plain screen pixels
			ctx.setTransform(1, 0, 0, 1, 0, 0);
		}
		if (edit.boxSelect) {
			const m = ed.mouse;
			const x1 = vx(Math.min(edit.downX, m.wx));
			const y1 = vy(Math.min(edit.downY, m.wy));
			const x2 = vx(Math.max(edit.downX, m.wx));
			const y2 = vy(Math.max(edit.downY, m.wy));
			outline([{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }], ED_BOX_SELECT_COLOR, ED_BOX_SELECT_ALPHA, thick(z));
		}

		// The picker's item at the mouse, at the current layer's mapping, with its small mark, unless
		// the mouse is on the overlay.
		const item = EdPicker.current();
		if (item !== null && !ed.ingui && room.layers[ed.curlayeri] !== undefined) {
			const lyr = room.layers[ed.curlayeri];
			const ln = lyr.lens;
			const ml = this.mouseOn(lyr);
			const pv = this.preview;
			if (pv.spi !== item.spi) {
				Draw.setSprite(pv, item.spi);
				pv.ifr = 0;
			}
			pv.x = ml.x;
			pv.y = ml.y;
			Draw.base = { sx: ln.s, sy: ln.s, ox: ln.ox, oy: ln.oy };
			Draw.curdrawoffx = ln.offx;
			Draw.curdrawoffy = ln.offy;
			ctx.imageSmoothingEnabled = ln.s < 1;
			Draw.subpixel = true;
			Draw.lpSprite(pv);
			Draw.animate(pv, ed.steps);
			if (!ed.showAsPlayer) {
				const px = Math.floor(ml.x);
				const py = Math.floor(ml.y);
				dot(sx(ln, px + 0.5), sy(ln, py + 0.5), ln.s * 4 + 2 * ed.dpr, ED_MOUSE_RIM_COLOR, ED_MOUSE_RIM_ALPHA);
				dot(sx(ln, px + 1), sy(ln, py + 1), ln.s * 2, ED_MOUSE_MARK_COLOR, ED_MOUSE_MARK_ALPHA);
				dot(sx(ln, px + 0.5), sy(ln, py + 0.5), ln.s, ED_MOUSE_DOT_COLOR, ED_MOUSE_DOT_ALPHA);
			}
			ctx.setTransform(1, 0, 0, 1, 0, 0);
		}

		// the room's origin, then the cross at the view's middle and the frame the game would show there
		const wl = { s: z, ox: 0, oy: 0, offx: cam.x, offy: cam.y };
		// its dark rim one room pixel round the dot, and at least a screen pixel
		dot(sx(wl, 0), sy(wl, 0), Math.max(z, minLine) + 2 * Math.max(z, ed.dpr), ED_ROOM_ORIGIN_BACK_COLOR, ED_ROOM_ORIGIN_BACK_ALPHA);
		dot(sx(wl, 0), sy(wl, 0), z, ED_ROOM_ORIGIN_COLOR, ED_ROOM_ORIGIN_ALPHA);
		if (!ed.showAsPlayer) {
			const cx = Math.round(sx(wl, this.midx));
			const cy = Math.round(sy(wl, this.midy));
			const line = thick(z);
			const reach = Math.max(ED_CENTER_REACH * z, ED_CENTER_MIN_REACH * line);
			const half = Math.floor(line / 2);
			ctx.globalAlpha = ED_CENTER_ALPHA;
			ctx.fillStyle = ED_CENTER_COLOR;
			ctx.fillRect(cx - reach - half, cy - half, reach * 2 + line, line);
			// the upright bar leaves out the middle the flat one already covers, so the fade stays even
			ctx.fillRect(cx - half, cy - reach - half, line, reach);
			ctx.fillRect(cx - half, cy + line - half, line, reach);
			const l = sx(wl, this.scrox);
			const t = sy(wl, this.scroy);
			const r = sx(wl, this.scrox + room.roomw);
			const b = sy(wl, this.scroy + room.roomh);
			outline([{ x: l - line, y: t - line }, { x: r + line, y: t - line }, { x: r + line, y: b + line }, { x: l - line, y: b + line }],
				ED_FRAME_OUTER_COLOR, ED_FRAME_ALPHA, line);
			outline([{ x: l, y: t }, { x: r, y: t }, { x: r, y: b }, { x: l, y: b }], ED_FRAME_INNER_COLOR, ED_FRAME_ALPHA, line);
		}

		// two letters over markers, at the overlay's own size so they read at any zoom
		const gs = EdGui.scale;
		Draw.base = { sx: gs, sy: gs, ox: 0, oy: 0 };
		ctx.imageSmoothingEnabled = false;
		for (const rec of labels) {
			const ln = rec.mylayer.lens;
			Draw.guiText(sx(ln, rec.x - rec.exoffx + rec.loopdx) / gs, sy(ln, rec.y - rec.exoffy + rec.loopdy) / gs + ED_LABEL_DY,
				rec.blank, ED_LABEL_COLOR, ED_LABEL_ALPHA, ED_LABEL_FONT);
		}
		ctx.globalAlpha = 1;
		Draw.subpixel = false;
		Draw.curdrawoffx = 0;
		Draw.curdrawoffy = 0;
	},

	// The editor's mouse, over everything, in place of the browser's hidden arrow, always at a whole
	// number scale so it stays sharp. Over the overlay it is at the overlay's scale on the overlay
	// pixel under the mouse; over the room it grows with the current layer's zoom and its middle sits
	// on the middle of that layer's pixel under the mouse, so the pixel being pointed at is exact. As in the original it
	// hides while a selection moves and over a grabber, which shows full strength instead, and over
	// the room a picked item's preview stands in for it.
	drawMouse() {
		const ed = Editor;
		if (!ed.mouseIn) return;
		const edit = EdEdit;
		const room = ed.room;
		const m = ed.mouse;
		let k = EdGui.scale;
		let x = Math.floor(m.gx) * k + Math.floor(k / 2);
		let y = Math.floor(m.gy) * k + Math.floor(k / 2);
		if (!ed.ingui && room !== null) {
			if (edit.moving || edit.grab !== null || EdPicker.current() !== null) return;
			const lyr = room.layers[ed.curlayeri];
			if (lyr !== undefined && lyr.lens !== undefined) {
				const ln = lyr.lens;
				k = this.markScale(ln.s);
				const ml = this.mouseOn(lyr);
				x = Math.floor(ln.s * (Math.floor(ml.x) + 0.5 - ln.offx) + ln.ox);
				y = Math.floor(ln.s * (Math.floor(ml.y) + 0.5 - ln.offy) + ln.oy);
			} else {
				x = Math.floor(m.devx);
				y = Math.floor(m.devy);
			}
		}
		const ctx = ed.ctx;
		Draw.ctx = ctx;
		Draw.targetScale = 1;
		Draw.base = { sx: 1, sy: 1, ox: 0, oy: 0 };
		ctx.imageSmoothingEnabled = false;
		// the sprite's middle texel lands on the spot, its texels on whole screen pixels
		Draw.spriteRaw(ED_MOUSE_SPRITE, 0, x - Math.floor(k / 2), y - Math.floor(k / 2), k, k, 0, NO_TINT, 1);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
	}
};
