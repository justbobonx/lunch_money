// Sprite sheet packer and loose source index builder, matching the command line packer so the
// browser sprite editor produces identical sheets, index entries and packed lists.

// largest square side a packed sheet may reach, and blank pixel gap kept between neighbouring frames
const PACK_MAX_SIDE = 2048;
const PACK_GAP = 1;

// folders and index files inside the game folder
const PACK_SPRITE_DIR = "sprites/";
const PACK_SRC_DIR = "sprites/src/";
const PACK_SHEETS_FILE = "sprites/sheets.json";
const PACK_INDEX_FILE = "sprites/src/index.json";

// standard image file header and pixel channel counts
const PACK_PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const PACK_PNG_COLOR_GRAY = 0;
const PACK_PNG_COLOR_RGB = 2;
const PACK_PNG_COLOR_PALETTE = 3;
const PACK_PNG_COLOR_GRAY_ALPHA = 4;
const PACK_PNG_COLOR_RGBA = 6;
const PACK_PNG_CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const PACK_PNG_FILTER_NONE = 0;
const PACK_PNG_FILTER_SUB = 1;
const PACK_PNG_FILTER_UP = 2;
const PACK_PNG_FILTER_AVG = 3;
const PACK_PNG_FILTER_PAETH = 4;
const PACK_CRC_POLY = 0xedb88320;
const PACK_OPAQUE_ALPHA = 255;

const PACK_CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = (c & 1) ? (PACK_CRC_POLY ^ (c >>> 1)) : (c >>> 1);
		t[n] = c >>> 0;
	}
	return t;
})();

function packCrc32(bytes, start, end) {
	let c = 0xffffffff;
	for (let i = start; i < end; i++) c = PACK_CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function packReadU32(bytes, at) {
	return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
}

function packWriteU32(out, at, val) {
	out[at] = (val >>> 24) & 0xff;
	out[at + 1] = (val >>> 16) & 0xff;
	out[at + 2] = (val >>> 8) & 0xff;
	out[at + 3] = val & 0xff;
}

function packPaeth(a, b, c) {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	if (pa <= pb && pa <= pc) return a;
	if (pb <= pc) return b;
	return c;
}

async function packZlib(bytes, decompress) {
	const stream = decompress ? new DecompressionStream("deflate") : new CompressionStream("deflate");
	const writer = stream.writable.getWriter();
	writer.write(bytes);
	writer.close();
	return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

function packAsciiOrder(a, b) {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

// Writes an object in the compact line-per-entry format used by packed sheet descriptions.
function packFormatSheetJson(val) {
	if (Array.isArray(val)) {
		if (val.length === 0) return "[]";
		return "[\n" + val.map(packFormatSheetJson).join(",\n") + "\n]";
	}
	if (val !== null && typeof val === "object") {
		const keys = Object.keys(val);
		if (keys.length === 0) return "{}";
		return "{\n" + keys.map((k) => JSON.stringify(k) + ":" + packFormatSheetJson(val[k])).join(",\n") + "\n}";
	}
	return JSON.stringify(val);
}

// Orders source sprite fields consistently when writing loose sprite files.
function packOrderSourceRecord(rec) {
	const m = rec.mask || { kind: "rect", w: rec.w, h: rec.h, x: 0, y: 0 };
	let mask;
	if (m.kind === "circle") {
		mask = { kind: "circle", r: m.r, x: m.x, y: m.y };
	} else {
		mask = { kind: "rect", w: m.w, h: m.h, x: m.x, y: m.y };
	}
	if (m.rotates !== undefined) mask.rotates = m.rotates;
	if (m.gm_kind !== undefined) mask.gm_kind = m.gm_kind;
	return {
		w: rec.w,
		h: rec.h,
		frames: rec.frames,
		ox: rec.ox,
		oy: rec.oy,
		mask: mask,
		image_speed: rec.image_speed,
		group: rec.group
	};
}

function packMakeChunk(type, payload) {
	const chunk = new Uint8Array(12 + payload.length);
	packWriteU32(chunk, 0, payload.length);
	for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
	chunk.set(payload, 8);
	packWriteU32(chunk, 8 + payload.length, packCrc32(chunk, 4, 8 + payload.length));
	return chunk;
}

const EdPacker = {
	// Reads a lossless image from raw bytes into width, height and tight four-channel pixel bytes.
	async decodePng(bytes) {
		for (let i = 0; i < PACK_PNG_SIG.length; i++) {
			if (bytes[i] !== PACK_PNG_SIG[i]) throw new Error("Not a valid PNG image.");
		}
		let pos = 8;
		let width = 0;
		let height = 0;
		let bitDepth = 0;
		let colorType = 0;
		let interlace = 0;
		let palette = null;
		let trns = null;
		const idatParts = [];
		let idatLen = 0;

		while (pos + 12 <= bytes.length) {
			const len = packReadU32(bytes, pos);
			const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
			const dataStart = pos + 8;
			const dataEnd = dataStart + len;
			if (dataEnd + 4 > bytes.length) throw new Error("Truncated PNG image.");
			if (type === "IHDR") {
				width = packReadU32(bytes, dataStart);
				height = packReadU32(bytes, dataStart + 4);
				bitDepth = bytes[dataStart + 8];
				colorType = bytes[dataStart + 9];
				interlace = bytes[dataStart + 12];
			} else if (type === "PLTE") {
				palette = bytes.subarray(dataStart, dataEnd);
			} else if (type === "tRNS") {
				trns = bytes.subarray(dataStart, dataEnd);
			} else if (type === "IDAT") {
				const part = bytes.subarray(dataStart, dataEnd);
				idatParts.push(part);
				idatLen += part.length;
			} else if (type === "IEND") {
				break;
			}
			pos = dataEnd + 4;
		}
		if (interlace !== 0) throw new Error("Interlaced PNG images are not supported.");
		const channels = PACK_PNG_CHANNELS[colorType];
		if (!channels) throw new Error("Unsupported PNG colour type.");
		if (bitDepth !== 8 && bitDepth !== 16 && !(colorType === PACK_PNG_COLOR_PALETTE && (bitDepth === 1 || bitDepth === 2 || bitDepth === 4))) {
			throw new Error("Unsupported PNG bit depth.");
		}

		const compressed = new Uint8Array(idatLen);
		let off = 0;
		for (const p of idatParts) {
			compressed.set(p, off);
			off += p.length;
		}
		const raw = await packZlib(compressed, true);

		const bpp = Math.max(1, Math.ceil((bitDepth * channels) / 8));
		const stride = Math.ceil((width * bitDepth * channels) / 8);
		const pixels = new Uint8Array(height * stride);
		for (let y = 0; y < height; y++) {
			const rowStart = y * (1 + stride);
			const filter = raw[rowStart];
			const dst = y * stride;
			const prev = (y - 1) * stride;
			for (let x = 0; x < stride; x++) {
				const v = raw[rowStart + 1 + x];
				const a = x >= bpp ? pixels[dst + x - bpp] : 0;
				const b = y > 0 ? pixels[prev + x] : 0;
				const c = (x >= bpp && y > 0) ? pixels[prev + x - bpp] : 0;
				let out = v;
				if (filter === PACK_PNG_FILTER_SUB) out = (v + a) & 0xff;
				else if (filter === PACK_PNG_FILTER_UP) out = (v + b) & 0xff;
				else if (filter === PACK_PNG_FILTER_AVG) out = (v + ((a + b) >> 1)) & 0xff;
				else if (filter === PACK_PNG_FILTER_PAETH) out = (v + packPaeth(a, b, c)) & 0xff;
				else if (filter !== PACK_PNG_FILTER_NONE) throw new Error("Unknown PNG row filter.");
				pixels[dst + x] = out;
			}
		}

		const rgba = new Uint8Array(width * height * 4);
		if (colorType === PACK_PNG_COLOR_RGBA && bitDepth === 8) {
			rgba.set(pixels);
			return { width: width, height: height, data: rgba };
		}
		for (let y = 0; y < height; y++) {
			const row = y * stride;
			for (let x = 0; x < width; x++) {
				const out = (y * width + x) * 4;
				if (colorType === PACK_PNG_COLOR_RGBA) {
					const s = row + x * 8;
					rgba[out] = pixels[s];
					rgba[out + 1] = pixels[s + 2];
					rgba[out + 2] = pixels[s + 4];
					rgba[out + 3] = pixels[s + 6];
				} else if (colorType === PACK_PNG_COLOR_RGB) {
					const step = bitDepth === 16 ? 6 : 3;
					const ch = bitDepth === 16 ? 2 : 1;
					const s = row + x * step;
					const r = pixels[s];
					const g = pixels[s + ch];
					const b = pixels[s + ch * 2];
					const keyHit = trns && bitDepth === 8 && r === trns[1] && g === trns[3] && b === trns[5];
					rgba[out] = r;
					rgba[out + 1] = g;
					rgba[out + 2] = b;
					rgba[out + 3] = keyHit ? 0 : PACK_OPAQUE_ALPHA;
				} else if (colorType === PACK_PNG_COLOR_GRAY) {
					const step = bitDepth === 16 ? 2 : 1;
					const v = pixels[row + x * step];
					const keyHit = trns && bitDepth === 8 && v === trns[1];
					rgba[out] = v;
					rgba[out + 1] = v;
					rgba[out + 2] = v;
					rgba[out + 3] = keyHit ? 0 : PACK_OPAQUE_ALPHA;
				} else if (colorType === PACK_PNG_COLOR_GRAY_ALPHA) {
					const step = bitDepth === 16 ? 4 : 2;
					const ch = bitDepth === 16 ? 2 : 1;
					const v = pixels[row + x * step];
					rgba[out] = v;
					rgba[out + 1] = v;
					rgba[out + 2] = v;
					rgba[out + 3] = pixels[row + x * step + ch];
				} else if (colorType === PACK_PNG_COLOR_PALETTE) {
					let idx;
					if (bitDepth === 8) {
						idx = pixels[row + x];
					} else {
						const perByte = 8 / bitDepth;
						const b = pixels[row + Math.floor(x / perByte)];
						const shift = 8 - bitDepth * ((x % perByte) + 1);
						idx = (b >> shift) & ((1 << bitDepth) - 1);
					}
					const p = idx * 3;
					rgba[out] = palette ? palette[p] : 0;
					rgba[out + 1] = palette ? palette[p + 1] : 0;
					rgba[out + 2] = palette ? palette[p + 2] : 0;
					rgba[out + 3] = (trns && idx < trns.length) ? trns[idx] : PACK_OPAQUE_ALPHA;
				}
			}
		}
		return { width: width, height: height, data: rgba };
	},

	// Encodes tight four-channel pixel bytes into a lossless PNG image.
	async encodePng(width, height, rgba) {
		const stride = width * 4;
		const scan = new Uint8Array(height * (1 + stride));
		for (let y = 0; y < height; y++) {
			const rowOut = y * (1 + stride);
			const rowIn = y * stride;
			scan[rowOut] = PACK_PNG_FILTER_SUB;
			for (let x = 0; x < stride; x++) {
				const left = x >= 4 ? rgba[rowIn + x - 4] : 0;
				scan[rowOut + 1 + x] = (rgba[rowIn + x] - left) & 0xff;
			}
		}
		const compressed = await packZlib(scan, false);
		const ihdr = new Uint8Array(13);
		packWriteU32(ihdr, 0, width);
		packWriteU32(ihdr, 4, height);
		ihdr[8] = 8;
		ihdr[9] = PACK_PNG_COLOR_RGBA;
		ihdr[10] = 0;
		ihdr[11] = 0;
		ihdr[12] = 0;

		const cIhdr = packMakeChunk("IHDR", ihdr);
		const cIdat = packMakeChunk("IDAT", compressed);
		const cIend = packMakeChunk("IEND", new Uint8Array(0));
		const out = new Uint8Array(PACK_PNG_SIG.length + cIhdr.length + cIdat.length + cIend.length);
		let at = 0;
		out.set(PACK_PNG_SIG, at);
		at += PACK_PNG_SIG.length;
		out.set(cIhdr, at);
		at += cIhdr.length;
		out.set(cIdat, at);
		at += cIdat.length;
		out.set(cIend, at);
		return out;
	},

	// File adapter backed by the editor folder handle so reads and writes go through its backups.
	folderStore() {
		return {
			listDirs: (dir) => EdFolder.list(dir).then((r) => r.dirs),
			listFiles: (dir) => EdFolder.list(dir).then((r) => r.files),
			readText: (path) => EdFolder.readText(path),
			readBytes: (path) => EdFolder.readBytes(path),
			writeText: (path, text) => EdFolder.save(path, text),
			writeBytes: (path, bytes) => EdFolder.save(path, bytes),
			removeFile: (path) => EdFolder.remove(path)
		};
	},

	formatSourceJson(rec) {
		return JSON.stringify(packOrderSourceRecord(rec), null, 1);
	},

	// Reads every loose sprite group that has both a sprite description and a strip image.
	async readSourceGroups(store) {
		const groups = {};
		const dirNames = (await store.listDirs(PACK_SRC_DIR)).slice().sort(packAsciiOrder);
		for (const group of dirNames) {
			const gdir = PACK_SRC_DIR + group + "/";
			const files = (await store.listFiles(gdir)).slice().sort(packAsciiOrder);
			const fileSet = new Set(files);
			const sprites = {};
			for (const fn of files) {
				if (!fn.endsWith(".json")) continue;
				const name = fn.substring(0, fn.length - 5);
				const pngName = name + ".png";
				if (!fileSet.has(pngName)) {
					console.warn("no png for", gdir + fn);
					continue;
				}
				const rec = JSON.parse(await store.readText(gdir + fn));
				sprites[name] = { rec: rec, pngPath: gdir + pngName };
			}
			if (Object.keys(sprites).length > 0) groups[group] = sprites;
		}
		return groups;
	},

	// Rebuilds the loose sprite index from all loose source groups.
	async writeIndex(store, groups) {
		const index = {};
		for (const group of Object.keys(groups)) {
			const sprites = groups[group];
			for (const name of Object.keys(sprites)) {
				const rec = sprites[name].rec;
				if (index[name]) console.warn("sprite name", name, "is in both", index[name].group, "and", group);
				index[name] = {
					w: rec.w,
					h: rec.h,
					frames: rec.frames,
					ox: rec.ox,
					oy: rec.oy,
					mask: rec.mask,
					image_speed: rec.image_speed,
					group: group
				};
			}
		}
		await store.writeText(PACK_INDEX_FILE, JSON.stringify({ sprites: index }));
		return index;
	},

	// Lays out a group's frames on shelves in sprite name order, spilling onto numbered sheets.
	packGroup(group, sprites) {
		const sheets = [[]];
		const placements = [{}];
		let x = 0;
		let y = 0;
		let rowH = 0;
		for (const name of Object.keys(sprites).sort(packAsciiOrder)) {
			const rec = sprites[name].rec;
			const w = rec.w;
			const h = rec.h;
			const n = rec.frames;
			if (w > PACK_MAX_SIDE || h > PACK_MAX_SIDE) throw new Error(name + " is larger than a sheet");

			let tx = x;
			let ty = y;
			let trow = rowH;
			let frames = [];
			for (let i = 0; i < n; i++) {
				if (tx + w > PACK_MAX_SIDE) {
					tx = 0;
					ty += trow + PACK_GAP;
					trow = 0;
				}
				frames.push([tx, ty, w, h]);
				tx += w + PACK_GAP;
				trow = Math.max(trow, h);
			}
			if (ty + trow > PACK_MAX_SIDE && sheets[sheets.length - 1].length > 0) {
				sheets.push([]);
				placements.push({});
				x = 0;
				y = 0;
				rowH = 0;
				tx = 0;
				ty = 0;
				trow = 0;
				frames = [];
				for (let i = 0; i < n; i++) {
					if (tx + w > PACK_MAX_SIDE) {
						tx = 0;
						ty += trow + PACK_GAP;
						trow = 0;
					}
					frames.push([tx, ty, w, h]);
					tx += w + PACK_GAP;
					trow = Math.max(trow, h);
				}
				if (ty + trow > PACK_MAX_SIDE) throw new Error(name + " does not fit in one sheet");
			}
			x = tx;
			y = ty;
			rowH = trow;
			sheets[sheets.length - 1].push(name);
			placements[placements.length - 1][name] = frames;
		}
		const out = [];
		for (let i = 0; i < sheets.length; i++) {
			const label = i === 0 ? group : group + "_" + (i + 1);
			out.push({ label: label, names: sheets[i], placements: placements[i] });
		}
		return out;
	},

	// Cuts frames from a group's source strips, pastes them into one sheet image, and writes both files.
	async writeSheet(store, label, names, placements, sprites) {
		let width = 0;
		let height = 0;
		for (const n of names) {
			for (const f of placements[n]) {
				if (f[0] + f[2] > width) width = f[0] + f[2];
				if (f[1] + f[3] > height) height = f[1] + f[3];
			}
		}
		const sheetRgba = new Uint8Array(width * height * 4);
		const records = {};
		for (const name of names) {
			const rec = sprites[name].rec;
			const strip = await this.decodePng(await store.readBytes(sprites[name].pngPath));
			const frames = placements[name];
			for (let i = 0; i < frames.length; i++) {
				const f = frames[i];
				const sx0 = i * rec.w;
				const copyW = Math.max(0, Math.min(rec.w, strip.width - sx0, width - f[0]));
				const copyH = Math.max(0, Math.min(rec.h, strip.height, height - f[1]));
				for (let py = 0; py < copyH; py++) {
					const srcRow = (py * strip.width + sx0) * 4;
					const dstRow = ((f[1] + py) * width + f[0]) * 4;
					sheetRgba.set(strip.data.subarray(srcRow, srcRow + copyW * 4), dstRow);
				}
			}
			records[name] = {
				w: rec.w,
				h: rec.h,
				ox: rec.ox,
				oy: rec.oy,
				mask: rec.mask,
				image_speed: rec.image_speed,
				frames: frames
			};
		}
		const pngBytes = await this.encodePng(width, height, sheetRgba);
		const jsonText = packFormatSheetJson({ image_file: label + ".png", sprites: records });
		await store.writeBytes(PACK_SPRITE_DIR + label + ".png", pngBytes);
		await store.writeText(PACK_SPRITE_DIR + label + ".json", jsonText);
		return { width: width, height: height };
	},

	async readSheetsList(store) {
		try {
			return JSON.parse(await store.readText(PACK_SHEETS_FILE)).sheets || [];
		} catch (e) {
			return [];
		}
	},

	// Rebuilds the source index, packs requested groups, unpacks dropped ones, and updates the sheets list.
	async pack(store, opts) {
		const options = opts || {};
		const groups = await this.readSourceGroups(store);
		const index = await this.writeIndex(store, groups);
		const current = await this.readSheetsList(store);

		const want = new Set(options.all ? Object.keys(groups) : (options.groups || []));
		const unpack = new Set(options.unpack || []);
		const missing = [...want].filter((g) => !groups[g]).sort(packAsciiOrder);
		if (missing.length > 0) throw new Error("Unknown sprite groups: " + missing.join(", "));

		const redo = new Set([...want, ...unpack]);
		const keep = [];
		const droppedBases = [];
		for (const s of current) {
			if (redo.has(s.group) || !groups[s.group]) {
				droppedBases.push(s.file.substring(0, s.file.length - 5));
			} else {
				keep.push(s);
			}
		}

		const packedEntries = [];
		const writtenBases = new Set();
		const toPack = [...want].filter((g) => !unpack.has(g)).sort(packAsciiOrder);
		for (const g of toPack) {
			for (const sheet of this.packGroup(g, groups[g])) {
				const size = await this.writeSheet(store, sheet.label, sheet.names, sheet.placements, groups[g]);
				writtenBases.add(sheet.label);
				packedEntries.push({
					file: sheet.label + ".json",
					group: g,
					sprites: sheet.names.length,
					size: [size.width, size.height]
				});
			}
		}

		for (const base of droppedBases) {
			if (writtenBases.has(base)) continue;
			await store.removeFile(PACK_SPRITE_DIR + base + ".png");
			await store.removeFile(PACK_SPRITE_DIR + base + ".json");
		}

		const sheets = [...keep, ...packedEntries].sort((a, b) => packAsciiOrder(a.file, b.file));
		await store.writeText(PACK_SHEETS_FILE, JSON.stringify({ sheets: sheets }, null, 1));
		return { index: index, sheets: sheets, packed: packedEntries };
	},

	// Rebuilds the source index and repacks this group only when it is already in the packed list.
	async repackIfPacked(store, group) {
		const current = await this.readSheetsList(store);
		const isPacked = current.some((s) => s.group === group);
		return this.pack(store, { groups: isPacked ? [group] : [] });
	}
};

if (typeof module !== "undefined" && module.exports) module.exports = EdPacker;
