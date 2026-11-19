// Everything that puts pixels on the screen: sprites with scale, turn, tint and fade,
// tiled sprites, rectangles, text in the game's own pixel fonts, and the whole frame,
// which is the player's draw event: every room layer in order with its scroll, parallax,
// looping, depth sorting, area backdrops and masks, then the overlay on top.
// The original drew every layer to its own surface and stretched it onto the screen.
// Here a layer only gets its own offscreen canvas when it has an effect that needs one,
// which in the original is a layer mask. Every other layer draws straight to the screen
// with the same stretch, which gives the same picture.

// size of the game view in game pixels
const VIEW_W = 320;
const VIEW_H = 180;

// The canvas is the size of the original's overlay, twice the game view each way,
// so the overlay layer and the high resolution popup layer keep their own pixels.
const DISPLAY_W = 640;
const DISPLAY_H = 360;

// the overlay is laid out on this grid
const GUI_W = 640;
const GUI_H = 360;

// the original's screen was this wide, its shake and debug sizes are in these pixels
const ORIGINAL_SCREEN_W = 1920;

// the original cleared to black under every room, its saved backdrop colours are never used
const SCREEN_CLEAR_COLOR = "#000000";

// the blend colour that leaves a picture as it is
const NO_TINT = "#ffffff";

// fonts read at start, each a json glyph table and a png beside it
const FONT_DIR = "sprites/fonts/";
const FONT_NAMES = ["ftSmall", "ftTiny"];

// rooms ask for fonts that were never converted, those draw with this one instead
const FONT_FALLBACK = "ftSmall";

// the debug overlay of the original was on from the start, here it starts off, tab switches it
const DRAW_STATS_AT_START = false;

// Objects whose behavior is not ported yet get an outline and their name over their picture.
const SHOW_UNPORTED_MARKERS = true;
const UNPORTED_COLOR = "#ff00ff";
const UNPORTED_LABEL_COLOR = "#ffffff";
const UNPORTED_LABEL_FONT = "5px monospace";

// sprites missing from the converted set are a faint box of their guessed size in their blend colour
const MISSING_PICTURE_ALPHA = 0.35;

// colours of the debug overlay
const STATS_COLOR = "#ffffff";
const STATS_ALPHA = 0.8;
const STATS_ALPHA_OFF = 0.3;

// how far the debug text sits from the corner and how far apart its lines are, in overlay pixels
const STATS_X = 6;
const STATS_Y = -2;
const STATS_LINE = 10;

const Draw = {
	ctx: null,
	// the stretch from layer pixels to canvas pixels, set per layer
	base: { sx: 1, sy: 1, ox: 0, oy: 0 },
	// the scroll of the layer being drawn, taken off every room position
	curdrawoffx: 0,
	curdrawoffy: 0,
	// draw state, as the original kept it between calls
	color: "#ffffff",
	alpha: 1,
	font: FONT_FALLBACK,
	halign: "left",
	valign: "top",

	fonts: {},
	tintCache: {},
	toldMissingFont: {},

	// zoom of the last frame, a change rebuilds the layer canvases
	curroomzoom: 0,
	totSpriteCnt: 0,
	totSpriteDrwn: 0,
	// smoothed frames per second for the overlay
	fpsHist: 0,
	lastFrameTime: 0,

	attach(ctx) {
		this.ctx = ctx;
		ctx.imageSmoothingEnabled = false;
	},

	// Reads the font tables and pictures. A font that will not load is left out and falls back.
	async loadFonts(readJson, loadImage) {
		this.fonts = {};
		await Promise.all(FONT_NAMES.map(async (name) => {
			try {
				const f = await readJson(FONT_DIR + name + ".json");
				const image = await loadImage(FONT_DIR + f.image_file);
				this.fonts[name] = { name: name, image: image, lineHeight: f.line_height, glyphs: f.glyphs };
			} catch (e) {
				console.warn("font would not load: " + name, e);
			}
		}));
	},

	// A canvas of a size, in the page or in a worker, or none where neither exists.
	makeCanvas(w, h) {
		if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
		if (typeof document !== "undefined") {
			const c = document.createElement("canvas");
			c.width = w;
			c.height = h;
			return c;
		}
		return null;
	},

	// A part of a picture multiplied by a blend colour, made once and kept.
	// White needs no copy, so it gives null, and so does a place with no canvas to make one on.
	tinted(key, image, sx, sy, w, h, color) {
		if (!color || color.toLowerCase() === NO_TINT || !image) return null;
		const ck = key + "|" + color;
		const c = this.tintCache[ck];
		if (c && c.source === image) return c.canvas;
		const canvas = this.makeCanvas(w, h);
		if (!canvas) return null;
		const g = canvas.getContext("2d");
		g.drawImage(image, sx, sy, w, h, 0, 0, w, h);
		g.globalCompositeOperation = "multiply";
		g.fillStyle = color;
		g.fillRect(0, 0, w, h);
		// multiplying paints the see through pixels too, so put the original shape back
		g.globalCompositeOperation = "destination-in";
		g.drawImage(image, sx, sy, w, h, 0, 0, w, h);
		this.tintCache[ck] = { source: image, canvas: canvas };
		return canvas;
	},

	// starts every drawing call from the current layer's stretch
	resetTransform() {
		const b = this.base;
		this.ctx.setTransform(b.sx, 0, 0, b.sy, b.ox, b.oy);
	},

	// ------------------------------------------------------------ sprites

	// The engine's sprite draw: a frame placed by its origin at a spot in the current target,
	// stretched, turned counterclockwise in degrees, multiplied by a colour and faded.
	// Frame numbers wrap around the frame count both ways.
	spriteRaw(name, subimg, x, y, xscale, yscale, rot, col, alpha) {
		const rec = Sprites.peek(name);
		if (!rec) return;
		const n = rec.frames ? rec.frames.length : 1;
		let fi = Math.floor(subimg) % n;
		if (fi < 0) fi += n;
		const ctx = this.ctx;
		this.resetTransform();
		ctx.globalAlpha = alpha;
		ctx.translate(x, y);
		if (rot !== 0) ctx.rotate(-degToRad(rot));
		ctx.scale(xscale, yscale);
		if (rec.image && rec.frames) {
			const f = rec.frames[fi];
			const tint = this.tinted(rec.name + "|" + fi, rec.image, f[0], f[1], f[2], f[3], col);
			if (tint) ctx.drawImage(tint, -rec.ox, -rec.oy);
			else ctx.drawImage(rec.image, f[0], f[1], f[2], f[3], -rec.ox, -rec.oy, f[2], f[3]);
		} else if (rec.guessed) {
			ctx.globalAlpha = alpha * MISSING_PICTURE_ALPHA;
			ctx.fillStyle = col;
			ctx.fillRect(-rec.ox, -rec.oy, rec.w, rec.h);
		}
		ctx.globalAlpha = 1;
	},

	// The room position versions take the layer scroll off, both rounded down, as the original did.
	spriteExt(name, subimg, x, y, xscale, yscale, rot, col, alpha) {
		this.spriteRaw(name, subimg, Math.floor(x) - Math.floor(this.curdrawoffx), Math.floor(y) - Math.floor(this.curdrawoffy),
			xscale, yscale, rot, col, alpha);
	},

	// Guess: the plain sprite draw takes the current draw colour and fade, the aim dots rely on that.
	sprite(name, subimg, x, y) {
		this.spriteRaw(name, subimg, Math.floor(x) - Math.floor(this.curdrawoffx), Math.floor(y) - Math.floor(this.curdrawoffy),
			1, 1, 0, this.color, this.alpha);
	},

	// part of one frame, measured from its top left corner, without an origin or a turn
	spritePartExt(name, subimg, left, top, width, height, x, y, xscale, yscale, col, alpha) {
		const rec = Sprites.peek(name);
		if (!rec || !rec.image || !rec.frames) return;
		const n = rec.frames.length;
		let fi = Math.floor(subimg) % n;
		if (fi < 0) fi += n;
		const f = rec.frames[fi];
		const w = Math.min(width, f[2] - left);
		const h = Math.min(height, f[3] - top);
		if (w <= 0 || h <= 0) return;
		const ctx = this.ctx;
		this.resetTransform();
		ctx.globalAlpha = alpha;
		ctx.translate(Math.floor(x) - Math.floor(this.curdrawoffx), Math.floor(y) - Math.floor(this.curdrawoffy));
		ctx.scale(xscale, yscale);
		const tint = this.tinted(rec.name + "|" + fi, rec.image, f[0], f[1], f[2], f[3], col);
		if (tint) ctx.drawImage(tint, left, top, w, h, 0, 0, w, h);
		else ctx.drawImage(rec.image, f[0] + left, f[1] + top, w, h, 0, 0, w, h);
		ctx.globalAlpha = 1;
	},

	// one frame stretched to a size, ignoring its origin, in the current draw colour and fade
	spriteStretched(name, subimg, x, y, width, height) {
		const rec = Sprites.peek(name);
		if (!rec) return;
		const sx = width / rec.w;
		const sy = height / rec.h;
		this.spriteRaw(name, subimg, Math.floor(x) - Math.floor(this.curdrawoffx) + rec.ox * sx,
			Math.floor(y) - Math.floor(this.curdrawoffy) + rec.oy * sy, sx, sy, 0, this.color, this.alpha);
	},

	// an object drawn as itself, less its draw offset
	self(o) {
		this.spriteRaw(o.sprite_index, o.image_index,
			Math.floor(o.x) - Math.floor(o.exoffx) - Math.floor(this.curdrawoffx),
			Math.floor(o.y) - Math.floor(o.exoffy) - Math.floor(this.curdrawoffy),
			o.image_xscale, o.image_yscale, o.image_angle, o.image_blend, o.image_alpha);
	},

	// A layer picture or mask: its own sprite at its spot less its draw offset, moved by the
	// offsets given, with the scale given or its own.
	layerSprite(obj, xo, yo, scx, scy) {
		if (scx === undefined) scx = obj.image_xscale;
		if (scy === undefined) scy = obj.image_yscale;
		const dx = Math.floor(obj.x) - Math.floor(obj.exoffx) + Math.floor(xo);
		const dy = Math.floor(obj.y) - Math.floor(obj.exoffy) + Math.floor(yo);
		this.spriteRaw(obj.spi, obj.image_index, dx, dy, scx, scy, obj.image_angle, obj.image_blend, obj.image_alpha);
	},

	// A layer picture repeated instead of stretched, one way or both. Looping tiles slide with the
	// camera scroll so they look endless. The other way keeps the stretch.
	layerSpriteTiled(obj, xo, yo) {
		if (truthy(obj.tile_loop)) {
			xo -= truthy(obj.tiledx) ? (game.cam.scrox % obj.t_w) : 0;
			yo -= truthy(obj.tiledy) ? (game.cam.scroy % obj.t_h) : 0;
		}
		const tx = truthy(obj.tiledx);
		const ty = truthy(obj.tiledy);
		const stx = tx ? obj.t_stx : 0;
		const sty = ty ? obj.t_sty : 0;
		const jinc = tx ? obj.t_w : obj.t_spw;
		const kinc = ty ? obj.t_h : obj.t_sph;
		const flipx = tx ? obj.t_flipx : obj.image_xscale;
		const flipy = ty ? obj.t_flipy : obj.image_yscale;
		for (let j = 0; j < obj.t_spw; j += jinc) {
			for (let k = 0; k < obj.t_sph; k += kinc) {
				this.layerSprite(obj, j - stx + xo, k - sty + yo, flipx, flipy);
			}
		}
	},

	// An object's sprite repeated over its stretched size, always both ways at unit size.
	spriteTiled(o) {
		for (let j = 0; j < o.t_spw; j += o.t_w) {
			for (let k = 0; k < o.t_sph; k += o.t_h) {
				this.spriteExt(o.sprite_index, o.image_index, o.x + j - o.t_stx, o.y + k - o.t_sty,
					o.t_flipx, o.t_flipy, o.image_angle, o.image_blend, o.image_alpha);
			}
		}
	},

	// ------------------------------------------------------------ shapes

	// A box between two corners, both included, in the draw colour and fade.
	rectangle(x1, y1, x2, y2, outline) {
		const l = Math.floor(x1) - Math.floor(this.curdrawoffx);
		const t = Math.floor(y1) - Math.floor(this.curdrawoffy);
		const r = Math.floor(x2) - Math.floor(this.curdrawoffx);
		const b = Math.floor(y2) - Math.floor(this.curdrawoffy);
		const ctx = this.ctx;
		this.resetTransform();
		ctx.globalAlpha = this.alpha;
		if (truthy(outline)) {
			ctx.strokeStyle = this.color;
			ctx.lineWidth = 1;
			ctx.strokeRect(Math.min(l, r) + 0.5, Math.min(t, b) + 0.5, Math.abs(r - l), Math.abs(b - t));
		} else {
			ctx.fillStyle = this.color;
			ctx.fillRect(Math.min(l, r), Math.min(t, b), Math.abs(r - l) + 1, Math.abs(b - t) + 1);
		}
		ctx.globalAlpha = 1;
	},

	// ------------------------------------------------------------ text

	setFont(name) {
		if (!this.fonts[name] && !this.toldMissingFont[name]) {
			this.toldMissingFont[name] = true;
			console.log("font " + name + " is not converted, " + FONT_FALLBACK + " stands in");
		}
		this.font = name;
	},

	currentFont() {
		return this.fonts[this.font] || this.fonts[FONT_FALLBACK] || null;
	},

	// Splits text into the lines it draws as: at line breaks, and where a width is given,
	// between words before a line grows past it. A single word wider than that stays whole.
	textLines(font, text, width) {
		const lines = [];
		for (const para of String(text).split("\n")) {
			if (!(width > 0)) {
				lines.push(para);
				continue;
			}
			let line = "";
			for (const word of para.split(" ")) {
				const tryLine = line === "" ? word : line + " " + word;
				if (line !== "" && this.lineWidth(font, tryLine) > width) {
					lines.push(line);
					line = word;
				} else {
					line = tryLine;
				}
			}
			lines.push(line);
		}
		return lines;
	},

	// Guess: a letter missing from the font moves on by a space.
	lineWidth(font, line) {
		let w = 0;
		for (const ch of line) {
			const g = font.glyphs[ch.codePointAt(0)] || font.glyphs[32];
			if (g) w += g[4];
		}
		return w;
	},

	stringWidth(text) {
		const font = this.currentFont();
		if (!font) return 0;
		let w = 0;
		for (const line of String(text).split("\n")) w = Math.max(w, this.lineWidth(font, line));
		return w;
	},

	stringHeight(text) {
		const font = this.currentFont();
		return font ? String(text).split("\n").length * font.lineHeight : 0;
	},

	// The engine's full text draw in target pixels: lines a given distance apart, or the font's
	// own line height when that is minus one, wrapped at a width unless it is minus one,
	// stretched and turned about the spot, lined up by the current alignment,
	// in the draw colour and fade.
	// Guess: centred lines start half their width to the left, rounded down, and the same up and down.
	textRaw(x, y, text, sep, width, xscale, yscale, angle) {
		const font = this.currentFont();
		if (!font) return;
		const lh = sep === undefined || sep < 0 ? font.lineHeight : sep;
		const lines = this.textLines(font, text, width);
		const total = lines.length * lh;
		let yo = 0;
		if (this.valign === "middle") yo = -Math.floor(total / 2);
		else if (this.valign === "bottom") yo = -total;

		const image = this.tinted(font.name, font.image, 0, 0, font.image.width, font.image.height, this.color) || font.image;
		const ctx = this.ctx;
		this.resetTransform();
		ctx.globalAlpha = this.alpha;
		ctx.translate(x, y);
		if (angle) ctx.rotate(-degToRad(angle));
		ctx.scale(xscale === undefined ? 1 : xscale, yscale === undefined ? 1 : yscale);
		for (let i = 0; i < lines.length; i++) {
			const lw = this.lineWidth(font, lines[i]);
			let cx = 0;
			if (this.halign === "center") cx = -Math.floor(lw / 2);
			else if (this.halign === "right") cx = -lw;
			for (const ch of lines[i]) {
				const g = font.glyphs[ch.codePointAt(0)] || font.glyphs[32];
				if (!g) continue;
				if (g[2] > 0 && g[3] > 0) ctx.drawImage(image, g[0], g[1], g[2], g[3], cx + g[5], yo + i * lh, g[2], g[3]);
				cx += g[4];
			}
		}
		ctx.globalAlpha = 1;
	},

	// text at a room position, less the layer scroll
	text(x, y, text) {
		this.textRaw(Math.floor(x) - Math.floor(this.curdrawoffx), Math.floor(y) - Math.floor(this.curdrawoffy), text, -1, -1, 1, 1, 0);
	},

	textTransformed(x, y, text, sep, width, xscale, yscale, angle) {
		this.textRaw(Math.floor(x) - Math.floor(this.curdrawoffx), Math.floor(y) - Math.floor(this.curdrawoffy),
			text, sep, width, xscale, yscale, angle);
	},

	// Text with a drop shadow, by default one pixel down and right, black and mostly opaque.
	textShadow(x, y, text, shxo, shyo, shcolor, shalpha) {
		if (shxo === undefined) shxo = 1;
		if (shyo === undefined) shyo = 1;
		if (shcolor === undefined) shcolor = "#000000";
		if (shalpha === undefined) shalpha = 0.7;
		const c = this.color;
		const a = this.alpha;
		this.color = shcolor;
		this.alpha = shalpha;
		this.text(x + shxo, y + shyo, text);
		this.color = c;
		this.alpha = a;
		this.text(x, y, text);
	},

	// Overlay text in overlay pixels, shadowed, then the draw state back to white and opaque.
	guiText(tx, ty, text, tcolor, talpha, font) {
		if (tcolor === undefined) tcolor = "#ffffff";
		if (talpha === undefined) talpha = 1;
		this.setFont(font === undefined ? "ftSmall" : font);
		this.color = "#000000";
		this.alpha = talpha * 0.8;
		this.textRaw(tx + 1, ty + 1, text, -1, -1, 1, 1, 0);
		this.color = tcolor;
		this.alpha = talpha;
		this.textRaw(tx, ty, text, -1, -1, 1, 1, 0);
		this.color = "#ffffff";
		this.alpha = 1;
	},

	// ------------------------------------------------------------ the frame

	// The player's draw event, then the shake and the overlay.
	// Screen shake moves the room layers only, the overlay stays still, as in the original.
	// Shake uses the page's own random numbers so drawing never moves the game's seeded ones.
	frame(g) {
		const ctx = this.ctx;
		const cam = g.cam;
		const rm = g.curroom;

		let shx = 0;
		let shy = 0;
		if (cam.shake > 0) {
			cam.shake--;
			const toDisplay = DISPLAY_W / ORIGINAL_SCREEN_W;
			shx = round((Math.random() * 2 - 1) * cam.xmag) * 3 * toDisplay;
			shy = round((Math.random() * 2 - 1) * cam.ymag) * 3 * toDisplay;
		}

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "source-over";
		ctx.fillStyle = SCREEN_CLEAR_COLOR;
		ctx.fillRect(0, 0, DISPLAY_W, DISPLAY_H);
		if (!rm || rm.layers === null) return;

		// zoom: while zooming the layers are drawn at the smaller of the two zooms and stretched
		const curzoom = cam.get_cur_minzoom();
		const zoomchange = this.curroomzoom !== curzoom;
		this.curroomzoom = curzoom;
		const zoomdif = cam.curzoom - curzoom;
		let zoffw = 0;
		let zoffh = 0;
		if (zoomdif !== 0) {
			zoffw = DISPLAY_W * (zoomdif / curzoom);
			zoffh = DISPLAY_H * (zoomdif / curzoom);
		}

		this.totSpriteCnt = 0;
		this.totSpriteDrwn = 0;

		for (const lyr of rm.layers) {
			if (truthy(lyr.disabled)) continue;

			let lyrw = lyr.wd;
			let lyrh = lyr.ht;
			if (!truthy(lyr.gui)) {
				lyrw = Math.floor(lyr.wd / curzoom);
				lyrh = Math.floor(lyr.ht / curzoom);
			}

			this.curdrawoffx = Math.floor(cam.scrox + (lyr.wd - lyrw) / 2);
			this.curdrawoffy = Math.floor(cam.scroy + (lyr.ht - lyrh) / 2);

			// how far the camera moved since this layer last drew, so a layer that was off catches up
			const oxdiff = lyr.lastscrox - cam.scrox;
			const oydiff = lyr.lastscroy - cam.scroy;
			lyr.lastscrox = cam.scrox;
			lyr.lastscroy = cam.scroy;

			if (truthy(lyr.zsort)) g.zsortLayer(lyr);

			const lzoffw = truthy(lyr.gui) ? 0 : zoffw;
			const lzoffh = truthy(lyr.gui) ? 0 : zoffh;
			const destx = -Math.floor(lzoffw / 2) + shx;
			const desty = -Math.floor(lzoffh / 2) + shy;
			const destw = DISPLAY_W + lzoffw;
			const desth = DISPLAY_H + lzoffh;

			// a mask needs the layer on its own canvas, weather would too once it exists
			const buffered = lyr.mask_list.length > 0;
			let screenCtx = null;
			if (buffered) {
				if (!lyr.layerSurf || zoomchange || lyr.layerSurf.width !== lyrw || lyr.layerSurf.height !== lyrh) {
					lyr.layerSurf = this.makeCanvas(lyrw, lyrh);
				}
				screenCtx = ctx;
				this.ctx = lyr.layerSurf.getContext("2d");
				this.ctx.imageSmoothingEnabled = false;
				this.ctx.setTransform(1, 0, 0, 1, 0, 0);
				this.ctx.clearRect(0, 0, lyrw, lyrh);
				this.base = { sx: 1, sy: 1, ox: 0, oy: 0 };
			} else {
				this.base = { sx: destw / lyrw, sy: desth / lyrh, ox: destx, oy: desty };
			}

			this.color = "#ffffff";
			this.alpha = 1;

			// area backdrops go under the first layer that draws
			if (this.totSpriteCnt === 0) {
				this.totSpriteCnt++;
				this.totSpriteDrwn++;
				for (const grp of g.cur_areas_inview) {
					if (grp.bd_sprite === null) continue;
					const bnd = grp.bounds;
					const spw = grp.sp_w;
					const sprii = (g.frames * grp.sp_spd) % grp.sp_fnum;
					const dx = Math.max(this.curdrawoffx, bnd.bbox_left);
					const dy = Math.max(this.curdrawoffy, bnd.bbox_top);
					const ox = ((dx % spw) + spw) % spw;
					const oy = ((dy % spw) + spw) % spw;
					const tw = Math.min(lyrw, bnd.bbox_right - dx);
					const th = Math.min(lyrh, bnd.bbox_bottom - dy);
					// the original steps down by the width as well, so backdrops are meant to be square
					for (let j = -ox; j < tw; j += spw) {
						for (let k = -oy; k < th; k += spw) {
							this.spriteExt(grp.bd_sprite, sprii, dx + j, dy + k, 1, 1, 0, NO_TINT, 1);
						}
					}
				}
			}

			const plxXMod = 1 - lyr.plx_x;
			const plxYMod = 1 - lyr.plx_y;
			const paraxing = plxXMod !== 0 || plxYMod !== 0;
			const loopX = lyr.loop_x;
			const loopY = lyr.loop_y;
			const lpStx = cam.x - loopX / 2;
			const lpSty = cam.y - loopY / 2;

			// a copy, in case drawing an object takes something out of the layer
			for (const obj of lyr.lsprites.slice()) {
				this.totSpriteCnt++;
				// parallax and looping move the things themselves, as in the original
				if (paraxing) {
					obj.x -= oxdiff * plxXMod;
					obj.y -= oydiff * plxYMod;
				}
				if (truthy(loopX)) obj.x = lpStx + ((obj.x - lpStx + loopX) % loopX);
				if (truthy(loopY)) obj.y = lpSty + ((obj.y - lpSty + loopY) % loopY);

				if (!truthy(obj.pvis) || truthy(obj.pdis)) continue;
				this.totSpriteDrwn++;
				obj.draw();
				if (SHOW_UNPORTED_MARKERS && obj.constructor.ported === false) this.unportedMarker(obj);
			}

			if (buffered) {
				// the mask keeps only the layer pixels it covers, scaled by its own opacity
				if (!lyr.maskSurf || zoomchange || lyr.maskSurf.width !== lyrw || lyr.maskSurf.height !== lyrh) {
					lyr.maskSurf = this.makeCanvas(lyrw, lyrh);
				}
				const layerCtx = this.ctx;
				this.ctx = lyr.maskSurf.getContext("2d");
				this.ctx.imageSmoothingEnabled = false;
				this.ctx.setTransform(1, 0, 0, 1, 0, 0);
				this.ctx.clearRect(0, 0, lyrw, lyrh);
				for (const mobj of lyr.mask_list) {
					if (truthy(mobj.tiled)) this.layerSpriteTiled(mobj, -this.curdrawoffx, -this.curdrawoffy);
					else this.layerSprite(mobj, -this.curdrawoffx, -this.curdrawoffy);
				}
				layerCtx.setTransform(1, 0, 0, 1, 0, 0);
				layerCtx.globalCompositeOperation = "destination-in";
				layerCtx.drawImage(lyr.maskSurf, 0, 0);
				layerCtx.globalCompositeOperation = "source-over";

				this.ctx = screenCtx;
				ctx.setTransform(1, 0, 0, 1, 0, 0);
				ctx.globalAlpha = 1;
				ctx.drawImage(lyr.layerSurf, destx, desty, destw, desth);
			}

			if (g.weather.on) Hooks.todo("weather");
		}

		this.base = { sx: 1, sy: 1, ox: 0, oy: 0 };
		this.curdrawoffx = 0;
		this.curdrawoffy = 0;
		this.overlay(g);
	},

	// Outline and name over an object that only stands in for now.
	unportedMarker(o) {
		const s = maskShape(o, o.x, o.y - o.z);
		if (!s) return;
		const ctx = this.ctx;
		this.resetTransform();
		const l = s.l - Math.floor(this.curdrawoffx);
		const t = s.t - Math.floor(this.curdrawoffy);
		ctx.globalAlpha = 1;
		ctx.strokeStyle = UNPORTED_COLOR;
		ctx.lineWidth = 1;
		ctx.strokeRect(l + 0.5, t + 0.5, s.r - s.l, s.b - s.t);
		ctx.fillStyle = UNPORTED_LABEL_COLOR;
		ctx.font = UNPORTED_LABEL_FONT;
		ctx.fillText(o.constructor.name, l + 1, t + 6);
	},

	// The original's overlay: with stats on, frame rate and counts, the player's position, speeds and
	// state, the camera, and the paths the movers report. With stats off, just the frame rate, faint.
	overlay(g) {
		const now = (typeof performance !== "undefined") ? performance.now() : Date.now();
		if (this.lastFrameTime > 0) {
			const fps = 1000 / Math.max(1, now - this.lastFrameTime);
			this.fpsHist = round(this.fpsHist * 0.975 + Math.min(fps, GAME_FPS) * 0.025);
		}
		this.lastFrameTime = now;

		const ctx = this.ctx;
		this.base = { sx: DISPLAY_W / GUI_W, sy: DISPLAY_H / GUI_H, ox: 0, oy: 0 };
		this.halign = "left";
		this.valign = "top";
		this.setFont("ftSmall");
		this.color = STATS_COLOR;

		if (!g.drawStats) {
			this.alpha = STATS_ALPHA_OFF;
			this.textRaw(STATS_X - 1, STATS_Y, String(this.fpsHist), -1, -1, 1, 1, 0);
			this.alpha = 1;
			return;
		}

		// debug paths, in view pixels stretched to the overlay
		const toGui = GUI_W / VIEW_W;
		this.resetTransform();
		ctx.globalAlpha = 1;
		ctx.lineWidth = 1;
		for (const l of Hooks.lines) {
			ctx.strokeStyle = l.color;
			ctx.beginPath();
			ctx.moveTo((l.x1 - g.cam.scrox) * toGui + 0.5, (l.y1 - g.cam.scroy) * toGui + 0.5);
			ctx.lineTo((l.x2 - g.cam.scrox) * toGui + 0.5, (l.y2 - g.cam.scroy) * toGui + 0.5);
			ctx.stroke();
		}

		this.alpha = STATS_ALPHA;
		const guy = g.guy;
		const f1 = (v) => Number(v).toFixed(1);
		const f2 = (v) => Number(v).toFixed(2);
		const on = (v) => (truthy(v) ? 1 : 0);
		const lines = [
			this.fpsHist + "  T:" + f1(g.frames / GAME_FPS) + "  s:" + this.totSpriteCnt + "/" + this.totSpriteDrwn
				+ " (i:" + g.instances.length + ")"
		];
		if (guy) {
			lines.push(f1(guy.x) + "," + f1(guy.y) + " Xs:" + f2(guy.xspd) + " Ys:" + f2(guy.yspd)
				+ (truthy(guy.ch_topd) ? " Zs:" + f2(guy.zspd) + " Z:" + f2(guy.z) : ""));
			lines.push("F:" + on(guy.onFloor) + " Hf:" + on(guy.hitFloor) + "  W:" + (on(guy.atWall) + on(guy.atWally))
				+ " Hw:" + on(guy.hitWall) + " F:" + guy.facing + (truthy(guy.ch_topd) ? " Fy:" + guy.facingy : "")
				+ (guy.onFloorObj ? " Fo: " + guy.onFloorObj.constructor.name : "")
				+ (guy.carrying ? " carry:" + guy.carrying.gname : "")
				+ (truthy(guy.jumped) ? " jump" : "") + (truthy(guy.crawling) ? " crawl" : "")
				+ (guy.rolling > 0 ? " roll" : "") + (guy.sliding > 0 ? " slide" : "") + (truthy(guy.diving) ? " dive" : "")
				+ (truthy(guy.climbing) ? " climb" : "") + (truthy(guy.dead) ? " DEAD" : "") + (truthy(guy.hanging) ? " hang" : "")
				+ (truthy(guy.pushing) ? " push" : ""));
		}
		const cam = g.cam;
		lines.push(cam.curzoom + "  " + cam.x + "," + cam.y + "  " + (cam.curw / cam.curzoom) + "," + (cam.curh / cam.curzoom)
			+ "  " + cam.curw + "," + cam.curh);
		for (let i = 0; i < lines.length; i++) {
			this.textRaw(STATS_X, STATS_Y + i * STATS_LINE, lines[i], -1, -1, 1, 1, 0);
		}
		this.alpha = 1;
	}
};
