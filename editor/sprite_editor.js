// Standalone sprite editor for the loose source strips and descriptions. It opens the game folder
// through the shared folder helper, lets the artist pick any loose or unconfigured sprite image,
// edit its frame size, count, origin, collision mask and animation speed with live strip and
// frame previews, and saves the source file before updating the index and repacking packed groups.

// playback speed matches the game's step rate
const SE_GAME_FPS = 60;
// channel and page address parameter used to switch sprites from outside
const SE_CHANNEL_NAME = "lunch_money_sprite_editor";
const SE_SPRITE_PARAM = "sprite";

// folders inside the game folder
const SE_SRC_DIR = "sprites/src/";
const SE_INDEX_FILE = "sprites/src/index.json";

// starting values for an image that does not have a sprite file yet
const SE_DEFAULT_FRAMES = 1;
const SE_DEFAULT_OX = 0;
const SE_DEFAULT_OY = 0;
const SE_DEFAULT_IMAGE_SPEED = 1;

// default zoom for the full strip and the frame preview, remembered in the browser
const SE_STRIP_ZOOM_DEFAULT = 4;
const SE_PREVIEW_ZOOM_DEFAULT = 12;
const SE_STRIP_ZOOM_KEY = "lunch_money_sprite_editor_strip_zoom";
const SE_PREVIEW_ZOOM_KEY = "lunch_money_sprite_editor_preview_zoom";

// preview canvas padding and checkerboard square size
const SE_PREVIEW_PAD = 2;
const SE_CHECKER_PX = 8;

// overlay colours, strictly six-digit hex
const SE_CHECKER_LIGHT = "#2a2a36";
const SE_CHECKER_DARK = "#1e1e28";
const SE_STRIP_GRID_COLOR = "#44ccff";
const SE_STRIP_ACTIVE_COLOR = "#ffff33";
const SE_STRIP_ERROR_COLOR = "#ff4444";
const SE_STRIP_HEIGHT_COLOR = "#ffaa44";
const SE_FRAME_BORDER_COLOR = "#666688";
const SE_MASK_COLOR = "#33ff77";
const SE_MASK_FILL_ALPHA = 0.22;
const SE_ORIGIN_COLOR = "#ffff33";
const SE_ORIGIN_HALO_COLOR = "#000000";
const SE_ORIGIN_ARM_PX = 8;
const SE_LINE_SNAP = 0.5;

// preview edit modes, handle size in canvas pixels, and the two-way toggle colours
const SE_EDIT_ORIGIN = "origin";
const SE_EDIT_MASK = "mask";
const SE_MASK_HANDLE_SIZE = 8;
const SE_MASK_HANDLE_HIT = 10;
const SE_MASK_HANDLE_FILL = "#ffffff";
const SE_MASK_HANDLE_BORDER = "#000000";
const SE_MASK_MIN_SIZE = 1;
const SE_TOGGLE_ON_COLOR = "#ffff33";
const SE_TOGGLE_ON_BACK = "#262634";
const SE_TOGGLE_ON_BORDER = "#ffff33";

// playback modes, off by default
const SE_PLAY_STOP = "stop";
const SE_PLAY_LOOP = "loop";
const SE_PLAY_ONCE = "once";

function seAsciiOrder(a, b) {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

function seNumberOrNaN(text) {
	const trimmed = String(text).trim();
	if (trimmed === "") return NaN;
	return Number(trimmed);
}

const SpriteEditor = {
	// discovered sprites, each with name, group, hasJson and optional index summary
	sprites: [],
	packedGroups: new Set(),
	current: null,
	image: null,
	stripWidth: 0,
	stripHeight: 0,

	// editable fields; the mask is stored from the frame's top left, as shown and saved
	form: {
		w: 0,
		h: 0,
		frames: 1,
		ox: 0,
		oy: 0,
		maskKind: "rect",
		maskX: 0,
		maskY: 0,
		maskW: 0,
		maskH: 0,
		maskR: 0,
		maskExtra: {},
		imageSpeed: SE_DEFAULT_IMAGE_SPEED
	},
	dirty: false,
	saving: false,
	asking: false,
	errors: {},

	// preview animation state
	playMode: SE_PLAY_STOP,
	framePos: 0,
	lastTick: 0,
	hoverPixel: null,
	draggingOrigin: false,
	editMode: SE_EDIT_ORIGIN,
	maskDrag: null,

	// current zoom of the strip and the frame preview
	stripZoom: SE_STRIP_ZOOM_DEFAULT,
	previewZoom: SE_PREVIEW_ZOOM_DEFAULT,

	// pending sprite name asked by page address or channel before the folder opens
	wantedSprite: "",
	channel: null,
	el: {},

	start() {
		this.bindElements();
		this.readAddressRequest();
		this.openChannel();
		this.bindEvents();
		this.gate();
		const tick = (now) => {
			this.frame(now);
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	},

	bindElements() {
		const byId = (id) => document.getElementById(id);
		this.el = {
			gate: byId("ed_gate"),
			gateMsg: byId("ed_gate_msg"),
			reopen: byId("ed_reopen"),
			pick: byId("ed_pick"),
			ask: byId("ed_ask"),
			askMsg: byId("ed_ask_msg"),
			askButtons: byId("ed_ask_buttons"),

			search: byId("se_search"),
			groupFilter: byId("se_group_filter"),
			picker: byId("se_picker"),
			saveBtn: byId("se_save"),
			revertBtn: byId("se_revert"),
			status: byId("se_status"),

			spriteName: byId("se_name"),
			newBadge: byId("se_new_badge"),
			spriteGroup: byId("se_group"),
			packBadge: byId("se_pack_badge"),
			stripInfo: byId("se_strip_info"),
			errorBanner: byId("se_error_banner"),

			fieldW: byId("se_w"),
			fieldH: byId("se_h"),
			fieldFrames: byId("se_frames"),
			fieldOx: byId("se_ox"),
			fieldOy: byId("se_oy"),
			fieldMaskKind: byId("se_mask_kind"),
			fieldMaskX: byId("se_mask_x"),
			fieldMaskY: byId("se_mask_y"),
			fieldMaskW: byId("se_mask_w"),
			fieldMaskH: byId("se_mask_h"),
			fieldMaskR: byId("se_mask_r"),
			wrapMaskRect: byId("se_wrap_mask_wh"),
			wrapMaskR: byId("se_wrap_mask_r"),
			fieldSpeed: byId("se_image_speed"),

			stripZoom: byId("se_strip_zoom"),
			stripCanvas: byId("se_strip_canvas"),
			stripHint: byId("se_strip_hint"),

			previewZoom: byId("se_preview_zoom"),
			previewCanvas: byId("se_preview_canvas"),
			btnEditOrigin: byId("se_edit_origin"),
			btnEditMask: byId("se_edit_mask"),
			btnLoop: byId("se_btn_loop"),
			btnOnce: byId("se_btn_once"),
			btnStop: byId("se_btn_stop"),
			btnPrev: byId("se_btn_prev"),
			btnNext: byId("se_btn_next"),
			frameReadout: byId("se_frame_readout"),
			hoverReadout: byId("se_hover_readout")
		};
	},

	readAddressRequest() {
		const params = new URLSearchParams(window.location.search || "");
		const asked = params.get(SE_SPRITE_PARAM);
		if (asked) this.wantedSprite = asked.trim();
	},

	openChannel() {
		if (typeof BroadcastChannel === "undefined") return;
		try {
			this.channel = new BroadcastChannel(SE_CHANNEL_NAME);
		} catch (e) {
			return;
		}
		this.channel.onmessage = (e) => {
			const msg = e.data;
			let name = "";
			if (typeof msg === "string") name = msg;
			else if (msg !== null && typeof msg === "object") {
				if (typeof msg.sprite === "string") name = msg.sprite;
				else if (typeof msg.name === "string") name = msg.name;
			}
			name = name.trim();
			if (!name) return;
			this.blurActiveField();
			if (EdFolder.handle === null || this.sprites.length === 0) {
				this.wantedSprite = name;
				return;
			}
			this.openByQuery(name);
		};
	},

	// Drops the keyboard from whatever field has it, so a held E does not type there.
	blurActiveField() {
		const el = document.activeElement;
		if (el && el !== document.body && el !== document.documentElement && typeof el.blur === "function") el.blur();
	},

	bindEvents() {
		this.el.search.addEventListener("input", () => this.rebuildPicker());
		this.el.groupFilter.addEventListener("change", () => this.rebuildPicker());
		this.el.picker.addEventListener("change", () => {
			const key = this.el.picker.value;
			const entry = this.sprites.find((s) => s.key === key);
			if (entry) this.requestOpenSprite(entry);
		});

		this.el.saveBtn.addEventListener("click", () => this.save());
		this.el.revertBtn.addEventListener("click", () => {
			if (this.current) this.openSprite(this.current);
		});

		this.el.fieldW.addEventListener("input", () => this.onWidthInput());
		this.el.fieldFrames.addEventListener("input", () => this.onFramesInput());

		const plainFields = [
			[this.el.fieldH, "h"],
			[this.el.fieldOx, "ox"],
			[this.el.fieldOy, "oy"],
			[this.el.fieldMaskX, "maskX"],
			[this.el.fieldMaskY, "maskY"],
			[this.el.fieldMaskW, "maskW"],
			[this.el.fieldMaskH, "maskH"],
			[this.el.fieldMaskR, "maskR"],
			[this.el.fieldSpeed, "imageSpeed"]
		];
		for (const [input, key] of plainFields) {
			input.addEventListener("input", () => {
				this.form[key] = seNumberOrNaN(input.value);
				this.markDirty();
				this.refreshDerivedAndViews();
			});
		}
		this.el.fieldMaskKind.addEventListener("change", () => {
			this.form.maskKind = this.el.fieldMaskKind.value;
			if (this.form.maskKind === "circle" && !(this.form.maskR > 0)) {
				this.form.maskR = Math.max(1, Math.floor(Math.min(this.form.w || 1, this.form.h || 1) / 2));
				this.el.fieldMaskR.value = String(this.form.maskR);
			}
			this.syncMaskKindVisibility();
			this.markDirty();
			this.refreshDerivedAndViews();
		});

		this.stripZoom = this.readStoredZoom(this.el.stripZoom, SE_STRIP_ZOOM_KEY, SE_STRIP_ZOOM_DEFAULT);
		this.previewZoom = this.readStoredZoom(this.el.previewZoom, SE_PREVIEW_ZOOM_KEY, SE_PREVIEW_ZOOM_DEFAULT);
		this.el.stripZoom.value = String(this.stripZoom);
		this.el.previewZoom.value = String(this.previewZoom);

		this.el.stripZoom.addEventListener("change", () => {
			this.stripZoom = this.zoomFromPicker(this.el.stripZoom, SE_STRIP_ZOOM_DEFAULT);
			this.storeZoom(SE_STRIP_ZOOM_KEY, this.stripZoom);
			this.el.stripZoom.value = String(this.stripZoom);
			this.drawStrip();
		});
		this.el.previewZoom.addEventListener("change", () => {
			this.previewZoom = this.zoomFromPicker(this.el.previewZoom, SE_PREVIEW_ZOOM_DEFAULT);
			this.storeZoom(SE_PREVIEW_ZOOM_KEY, this.previewZoom);
			this.el.previewZoom.value = String(this.previewZoom);
			this.drawPreview();
		});

		this.el.stripCanvas.addEventListener("mousedown", (e) => this.onStripClick(e));
		this.el.previewCanvas.addEventListener("mousedown", (e) => this.onPreviewMouseDown(e));
		window.addEventListener("mousemove", (e) => this.onPreviewMouseMove(e));
		window.addEventListener("mouseup", (e) => this.onPreviewMouseUp(e));
		this.el.previewCanvas.addEventListener("mouseleave", () => {
			if (this.draggingOrigin || this.maskDrag) return;
			this.hoverPixel = null;
			this.updateHoverReadout();
			this.updatePreviewCursor(null);
		});
		this.el.btnEditOrigin.addEventListener("click", () => this.setEditMode(SE_EDIT_ORIGIN));
		this.el.btnEditMask.addEventListener("click", () => this.setEditMode(SE_EDIT_MASK));
		this.updateEditModeUi();

		this.el.btnLoop.addEventListener("click", () => this.setPlayMode(SE_PLAY_LOOP));
		this.el.btnOnce.addEventListener("click", () => this.startPlayOnce());
		this.el.btnStop.addEventListener("click", () => this.setPlayMode(SE_PLAY_STOP));
		this.el.btnPrev.addEventListener("click", () => this.stepFrame(-1));
		this.el.btnNext.addEventListener("click", () => this.stepFrame(1));

		window.addEventListener("focus", () => this.blurActiveField());
		window.addEventListener("keydown", (e) => {
			if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
				e.preventDefault();
				if (!this.el.saveBtn.disabled) this.save();
			}
		});
		window.addEventListener("beforeunload", (e) => {
			if (!this.dirty) return;
			e.preventDefault();
			e.returnValue = "";
		});
	},

	async gate() {
		if (!EdFolder.supported()) {
			this.el.gateMsg.textContent = "This browser cannot open a folder for the sprite editor. Open sprite_editor.html in Chrome or Edge.";
			this.el.pick.hidden = true;
			return;
		}
		const go = async (open) => {
			try {
				await open();
			} catch (e) {
				this.el.gateMsg.textContent = e.name === "AbortError" ? "No folder picked." : e.message;
				return;
			}
			this.el.gate.hidden = true;
			this.el.gate.style.display = "none";
			await this.loadCatalog();
		};
		const handle = await EdFolder.remembered();
		if (handle !== null) {
			this.el.reopen.textContent = "Open " + handle.name;
			this.el.reopen.hidden = false;
			this.el.reopen.onclick = () => go(() => EdFolder.reopen(handle));
		}
		this.el.pick.onclick = () => go(() => EdFolder.pick());
	},

	ask(message, choices) {
		return new Promise((resolve) => {
			this.asking = true;
			this.el.askMsg.textContent = message;
			this.el.askButtons.innerHTML = "";
			const finish = (value) => {
				this.asking = false;
				this.el.ask.close();
				resolve(value);
			};
			for (const choice of choices) {
				const btn = document.createElement("button");
				btn.textContent = choice.label;
				btn.onclick = () => finish(choice.value);
				this.el.askButtons.appendChild(btn);
			}
			this.el.ask.oncancel = (e) => {
				e.preventDefault();
				finish(null);
			};
			this.el.ask.showModal();
		});
	},

	// Reads the loose index, packed sheet list, and every source group folder so unconfigured images show as new.
	async loadCatalog() {
		this.setStatus("Scanning sprites...");
		let indexMap = {};
		try {
			const idx = await EdFolder.readJson(SE_INDEX_FILE);
			if (idx && idx.sprites) indexMap = idx.sprites;
		} catch (e) {
			indexMap = {};
		}

		const sheets = await EdPacker.readSheetsList(EdPacker.folderStore());
		this.packedGroups = new Set(sheets.map((s) => s.group));

		const found = [];
		const seenKeys = new Set();
		const srcListing = await EdFolder.list(SE_SRC_DIR);
		const groups = srcListing.dirs.slice().sort(seAsciiOrder);

		for (const group of groups) {
			const listing = await EdFolder.list(SE_SRC_DIR + group);
			const fileSet = new Set(listing.files);
			const pngs = listing.files.filter((f) => f.endsWith(".png")).sort(seAsciiOrder);
			for (const pngFile of pngs) {
				const name = pngFile.substring(0, pngFile.length - 4);
				const jsonFile = name + ".json";
				const key = group + "/" + name;
				seenKeys.add(key);
				found.push({
					key: key,
					name: name,
					group: group,
					pngPath: SE_SRC_DIR + group + "/" + pngFile,
					jsonPath: SE_SRC_DIR + group + "/" + jsonFile,
					hasJson: fileSet.has(jsonFile),
					indexRec: indexMap[name] && indexMap[name].group === group ? indexMap[name] : null
				});
			}
		}

		// include any index entry whose files sit outside the scanned folders, flagged if missing
		for (const name of Object.keys(indexMap).sort(seAsciiOrder)) {
			const rec = indexMap[name];
			const key = rec.group + "/" + name;
			if (seenKeys.has(key)) continue;
			found.push({
				key: key,
				name: name,
				group: rec.group,
				pngPath: SE_SRC_DIR + rec.group + "/" + name + ".png",
				jsonPath: SE_SRC_DIR + rec.group + "/" + name + ".json",
				hasJson: true,
				indexRec: rec
			});
		}

		found.sort((a, b) => seAsciiOrder(a.name.toLowerCase(), b.name.toLowerCase()) || seAsciiOrder(a.key, b.key));
		this.sprites = found;
		this.rebuildGroupFilter(groups);
		this.rebuildPicker();

		let initial = null;
		if (this.wantedSprite) {
			initial = this.findSprite(this.wantedSprite);
			if (!initial) this.setStatus("Sprite not found: " + this.wantedSprite, true);
			this.wantedSprite = "";
		}
		if (!initial && this.sprites.length > 0) initial = this.sprites[0];
		if (initial) await this.openSprite(initial);
		else this.setStatus("No sprites found in sprites/src.");
	},

	findSprite(query) {
		if (query.includes("/")) {
			const exact = this.sprites.find((s) => s.key === query);
			if (exact) return exact;
		}
		return this.sprites.find((s) => s.name === query) || null;
	},

	rebuildGroupFilter(groups) {
		const prev = this.el.groupFilter.value;
		this.el.groupFilter.innerHTML = "";
		const allOpt = document.createElement("option");
		allOpt.value = "";
		allOpt.textContent = "All groups (" + this.sprites.length + ")";
		this.el.groupFilter.appendChild(allOpt);
		for (const g of groups) {
			const count = this.sprites.filter((s) => s.group === g).length;
			if (count === 0) continue;
			const opt = document.createElement("option");
			opt.value = g;
			opt.textContent = g + " (" + count + (this.packedGroups.has(g) ? ", packed" : ", loose") + ")";
			this.el.groupFilter.appendChild(opt);
		}
		if (prev && [...this.el.groupFilter.options].some((o) => o.value === prev)) {
			this.el.groupFilter.value = prev;
		}
	},

	rebuildPicker() {
		const term = this.el.search.value.trim().toLowerCase();
		const group = this.el.groupFilter.value;
		const picker = this.el.picker;
		picker.innerHTML = "";

		const filtered = this.sprites.filter((s) => {
			if (group && s.group !== group) return false;
			if (term && !s.name.toLowerCase().includes(term) && !s.group.toLowerCase().includes(term)) return false;
			return true;
		});

		for (const s of filtered) {
			const opt = document.createElement("option");
			opt.value = s.key;
			opt.textContent = s.name + "  [" + s.group + "]" + (s.hasJson ? "" : " (new)");
			picker.appendChild(opt);
		}
		if (this.current && filtered.some((s) => s.key === this.current.key)) {
			picker.value = this.current.key;
		}
	},

	async requestOpenSprite(entry) {
		if (this.current && entry.key === this.current.key) return;
		if (this.dirty) {
			const choice = await this.ask("Save or discard changes to " + this.current.name + "?", [
				{ label: "Discard", value: "discard" },
				{ label: "Cancel", value: "cancel" }
			]);
			if (choice !== "discard") {
				if (this.current) this.el.picker.value = this.current.key;
				return;
			}
		}
		await this.openSprite(entry);
	},

	async openByQuery(query) {
		const entry = this.findSprite(query);
		if (!entry) {
			this.setStatus("Sprite not found: " + query, true);
			return;
		}
		// ensure the requested sprite is visible in the picker
		if (this.el.groupFilter.value !== "" && this.el.groupFilter.value !== entry.group) {
			this.el.groupFilter.value = "";
			this.rebuildPicker();
		}
		if (this.el.search.value.trim() !== "" && !entry.name.toLowerCase().includes(this.el.search.value.trim().toLowerCase())) {
			this.el.search.value = "";
			this.rebuildPicker();
		}
		await this.requestOpenSprite(entry);
	},

	async openSprite(entry) {
		this.setStatus("Loading " + entry.name + "...");
		let bitmap;
		try {
			bitmap = await EdFolder.loadImage(entry.pngPath);
		} catch (e) {
			this.setStatus("Could not load " + entry.pngPath + ": " + e.message, true);
			return;
		}

		let rec = null;
		let hasJson = false;
		try {
			rec = await EdFolder.readJson(entry.jsonPath);
			hasJson = true;
		} catch (e) {
			hasJson = false;
		}
		entry.hasJson = hasJson;

		if (this.image && typeof this.image.close === "function") this.image.close();
		this.current = entry;
		this.image = bitmap;
		this.stripWidth = bitmap.width;
		this.stripHeight = bitmap.height;

		if (rec) {
			const m = rec.mask || { kind: "rect", w: rec.w, h: rec.h, x: 0, y: 0 };
			const extra = {};
			if (m.rotates !== undefined) extra.rotates = m.rotates;
			if (m.gm_kind !== undefined) extra.gm_kind = m.gm_kind;
			this.form = {
				w: rec.w,
				h: rec.h,
				frames: rec.frames,
				ox: rec.ox,
				oy: rec.oy,
				maskKind: m.kind === "circle" ? "circle" : "rect",
				maskX: m.x,
				maskY: m.y,
				maskW: m.w !== undefined ? m.w : rec.w,
				maskH: m.h !== undefined ? m.h : rec.h,
				maskR: m.r !== undefined ? m.r : 0,
				maskExtra: extra,
				imageSpeed: rec.image_speed
			};
		} else {
			this.form = {
				w: this.stripWidth,
				h: this.stripHeight,
				frames: SE_DEFAULT_FRAMES,
				ox: SE_DEFAULT_OX,
				oy: SE_DEFAULT_OY,
				maskKind: "rect",
				maskX: 0,
				maskY: 0,
				maskW: this.stripWidth,
				maskH: this.stripHeight,
				maskR: Math.floor(Math.min(this.stripWidth, this.stripHeight) / 2),
				maskExtra: {},
				imageSpeed: SE_DEFAULT_IMAGE_SPEED
			};
		}

		this.dirty = false;
		this.playMode = SE_PLAY_STOP;
		this.framePos = 0;
		this.lastTick = 0;
		this.syncHeader();
		this.syncFieldsFromForm();
		this.refreshDerivedAndViews();
		this.setStatus(hasJson ? "Loaded " + entry.name + "." : "New sprite " + entry.name + " (not saved yet).");
		this.rebuildPicker();
	},

	syncHeader() {
		const s = this.current;
		if (!s) return;
		this.el.spriteName.textContent = s.name;
		this.el.newBadge.hidden = s.hasJson;
		this.el.spriteGroup.textContent = s.group;
		const packed = this.packedGroups.has(s.group);
		this.el.packBadge.textContent = packed ? "packed" : "loose";
		this.el.packBadge.className = "badge " + (packed ? "badge-packed" : "badge-loose");
		this.el.stripInfo.textContent = this.stripWidth + " x " + this.stripHeight + " strip";
		document.title = s.name + " - Sprite editor";
	},

	syncFieldsFromForm() {
		const f = this.form;
		this.el.fieldW.value = String(f.w);
		this.el.fieldH.value = String(f.h);
		this.el.fieldFrames.value = String(f.frames);
		this.el.fieldOx.value = String(f.ox);
		this.el.fieldOy.value = String(f.oy);
		this.el.fieldMaskKind.value = f.maskKind;
		this.el.fieldMaskX.value = String(f.maskX);
		this.el.fieldMaskY.value = String(f.maskY);
		this.el.fieldMaskW.value = String(f.maskW);
		this.el.fieldMaskH.value = String(f.maskH);
		this.el.fieldMaskR.value = String(f.maskR);
		this.el.fieldSpeed.value = String(f.imageSpeed);
		this.syncMaskKindVisibility();
	},

	syncMaskKindVisibility() {
		const isCircle = this.form.maskKind === "circle";
		this.el.wrapMaskRect.hidden = isCircle;
		this.el.wrapMaskR.hidden = !isCircle;
	},

	onWidthInput() {
		const w = seNumberOrNaN(this.el.fieldW.value);
		this.form.w = w;
		if (Number.isFinite(w) && w > 0 && this.stripWidth > 0) {
			const rawFrames = this.stripWidth / w;
			this.form.frames = Number.isInteger(rawFrames) ? rawFrames : Number(rawFrames.toFixed(3));
			this.el.fieldFrames.value = String(this.form.frames);
		} else {
			this.form.frames = NaN;
		}
		this.markDirty();
		this.refreshDerivedAndViews();
	},

	onFramesInput() {
		const n = seNumberOrNaN(this.el.fieldFrames.value);
		this.form.frames = n;
		if (Number.isFinite(n) && n > 0 && this.stripWidth > 0) {
			const rawW = this.stripWidth / n;
			this.form.w = Number.isInteger(rawW) ? rawW : Number(rawW.toFixed(3));
			this.el.fieldW.value = String(this.form.w);
		} else {
			this.form.w = NaN;
		}
		this.markDirty();
		this.refreshDerivedAndViews();
	},

	markDirty() {
		this.dirty = true;
	},

	validate() {
		const f = this.form;
		const errs = {};
		const messages = [];

		if (!Number.isInteger(f.w) || f.w < 1) {
			errs.w = true;
			messages.push("Frame width must be a whole number above zero.");
		}
		if (!Number.isInteger(f.frames) || f.frames < 1) {
			errs.frames = true;
			messages.push("Frame count must be a whole number above zero.");
		}
		if (Number.isInteger(f.w) && f.w >= 1 && this.stripWidth % f.w !== 0) {
			errs.w = true;
			errs.frames = true;
			errs.strip = true;
			messages.push("Strip width " + this.stripWidth + " does not divide evenly by frame width " + f.w + ".");
		} else if (Number.isInteger(f.frames) && f.frames >= 1 && this.stripWidth % f.frames !== 0) {
			errs.w = true;
			errs.frames = true;
			errs.strip = true;
			messages.push("Strip width " + this.stripWidth + " does not divide evenly by " + f.frames + " frames.");
		} else if (Number.isInteger(f.w) && Number.isInteger(f.frames) && f.w * f.frames !== this.stripWidth) {
			errs.w = true;
			errs.frames = true;
			errs.strip = true;
			messages.push("Width times frames must equal strip width " + this.stripWidth + ".");
		}

		if (!Number.isInteger(f.h) || f.h < 1 || f.h > this.stripHeight) {
			errs.h = true;
			messages.push("Frame height must be between 1 and " + this.stripHeight + ".");
		}
		if (!Number.isFinite(f.ox)) { errs.ox = true; messages.push("Origin x must be a number."); }
		if (!Number.isFinite(f.oy)) { errs.oy = true; messages.push("Origin y must be a number."); }
		if (!Number.isFinite(f.maskX)) { errs.maskX = true; messages.push("Mask x must be a number."); }
		if (!Number.isFinite(f.maskY)) { errs.maskY = true; messages.push("Mask y must be a number."); }
		if (f.maskKind === "circle") {
			if (!Number.isFinite(f.maskR) || f.maskR < 0) { errs.maskR = true; messages.push("Mask radius must be zero or above."); }
		} else {
			if (!Number.isFinite(f.maskW) || f.maskW < 0) { errs.maskW = true; messages.push("Mask width must be zero or above."); }
			if (!Number.isFinite(f.maskH) || f.maskH < 0) { errs.maskH = true; messages.push("Mask height must be zero or above."); }
		}
		if (!Number.isFinite(f.imageSpeed) || f.imageSpeed < 0) {
			errs.imageSpeed = true;
			messages.push("Image speed must be zero or above.");
		}

		this.errors = errs;
		this.el.fieldW.classList.toggle("invalid", !!errs.w);
		this.el.fieldH.classList.toggle("invalid", !!errs.h);
		this.el.fieldFrames.classList.toggle("invalid", !!errs.frames);
		this.el.fieldOx.classList.toggle("invalid", !!errs.ox);
		this.el.fieldOy.classList.toggle("invalid", !!errs.oy);
		this.el.fieldMaskX.classList.toggle("invalid", !!errs.maskX);
		this.el.fieldMaskY.classList.toggle("invalid", !!errs.maskY);
		this.el.fieldMaskW.classList.toggle("invalid", !!errs.maskW);
		this.el.fieldMaskH.classList.toggle("invalid", !!errs.maskH);
		this.el.fieldMaskR.classList.toggle("invalid", !!errs.maskR);
		this.el.fieldSpeed.classList.toggle("invalid", !!errs.imageSpeed);
		this.el.stripCanvas.classList.toggle("invalid-strip", !!errs.strip);

		if (messages.length > 0) {
			this.el.errorBanner.textContent = messages[0];
			this.el.errorBanner.hidden = false;
		} else {
			this.el.errorBanner.textContent = "";
			this.el.errorBanner.hidden = true;
		}
		this.el.saveBtn.disabled = this.saving || this.current === null || messages.length > 0;
		this.el.revertBtn.disabled = this.saving || this.current === null || !this.dirty;
	},

	refreshDerivedAndViews() {
		this.validate();
		const validFrames = this.validFrameCount();
		if (this.framePos >= validFrames) this.framePos = Math.max(0, validFrames - 1);
		this.drawStrip();
		this.drawPreview();
		this.updatePlaybackUi();
	},

	validFrameCount() {
		if (!this.image) return 1;
		if (Number.isInteger(this.form.frames) && this.form.frames >= 1 && !this.errors.strip) {
			return this.form.frames;
		}
		const w = this.form.w;
		if (Number.isFinite(w) && w >= 1) return Math.max(1, Math.floor(this.stripWidth / w));
		return 1;
	},

	effectiveFrameW() {
		if (Number.isFinite(this.form.w) && this.form.w >= 1) return Math.round(this.form.w);
		return Math.max(1, this.stripWidth);
	},

	effectiveFrameH() {
		if (Number.isFinite(this.form.h) && this.form.h >= 1) return Math.min(this.stripHeight, Math.round(this.form.h));
		return Math.max(1, this.stripHeight);
	},

	// a stored zoom, if it is one of the picker's values, otherwise the default
	readStoredZoom(select, key, fallback) {
		let raw = null;
		try {
			raw = localStorage.getItem(key);
		} catch (e) {
			return fallback;
		}
		return this.zoomFromValue(raw, select, fallback);
	},

	storeZoom(key, value) {
		try {
			localStorage.setItem(key, String(value));
		} catch (e) {}
	},

	zoomFromPicker(select, fallback) {
		return this.zoomFromValue(select.value, select, fallback);
	},

	zoomFromValue(raw, select, fallback) {
		const n = parseInt(raw, 10);
		if (!Number.isInteger(n) || n <= 0) return fallback;
		for (let i = 0; i < select.options.length; i++) {
			if (parseInt(select.options[i].value, 10) === n) return n;
		}
		return fallback;
	},

	drawChecker(ctx, width, height) {
		for (let y = 0; y < height; y += SE_CHECKER_PX) {
			for (let x = 0; x < width; x += SE_CHECKER_PX) {
				const even = (((x / SE_CHECKER_PX) + (y / SE_CHECKER_PX)) & 1) === 0;
				ctx.fillStyle = even ? SE_CHECKER_LIGHT : SE_CHECKER_DARK;
				ctx.fillRect(x, y, SE_CHECKER_PX, SE_CHECKER_PX);
			}
		}
	},

	drawStrip() {
		const cvs = this.el.stripCanvas;
		const ctx = cvs.getContext("2d");
		if (!this.image) {
			cvs.width = 1;
			cvs.height = 1;
			return;
		}
		const z = this.stripZoom;
		const cw = this.stripWidth * z;
		const ch = this.stripHeight * z;
		cvs.width = cw;
		cvs.height = ch;

		this.drawChecker(ctx, cw, ch);
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(this.image, 0, 0, cw, ch);

		const fw = this.form.w;
		const uneven = this.errors.strip || !Number.isInteger(fw) || fw < 1;
		const gridColor = uneven ? SE_STRIP_ERROR_COLOR : SE_STRIP_GRID_COLOR;

		// frame boundary lines across the full strip
		if (Number.isFinite(fw) && fw >= 1) {
			ctx.strokeStyle = gridColor;
			ctx.lineWidth = 1;
			for (let x = fw; x < this.stripWidth; x += fw) {
				const sx = Math.round(x * z) + SE_LINE_SNAP;
				ctx.beginPath();
				ctx.moveTo(sx, 0);
				ctx.lineTo(sx, ch);
				ctx.stroke();
			}
		}

		// cut height guide if shorter than the strip image
		const fh = this.effectiveFrameH();
		if (fh < this.stripHeight) {
			const sy = Math.round(fh * z) + SE_LINE_SNAP;
			ctx.strokeStyle = SE_STRIP_HEIGHT_COLOR;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(0, sy);
			ctx.lineTo(cw, sy);
			ctx.stroke();
		}

		// highlight the currently previewed frame
		if (Number.isFinite(fw) && fw >= 1) {
			const idx = Math.floor(this.framePos) % this.validFrameCount();
			const x0 = Math.round(idx * fw * z) + SE_LINE_SNAP;
			const rw = Math.max(1, Math.round(fw * z) - 1);
			const rh = Math.max(1, Math.round(fh * z) - 1);
			ctx.strokeStyle = uneven ? SE_STRIP_ERROR_COLOR : SE_STRIP_ACTIVE_COLOR;
			ctx.lineWidth = 1;
			ctx.strokeRect(x0, SE_LINE_SNAP, rw, rh);
		}

		this.el.stripHint.textContent = "Zoom " + z + "x" + (uneven ? " — uneven strip division" : " — click a frame to preview it");
	},

	drawPreview() {
		const cvs = this.el.previewCanvas;
		const ctx = cvs.getContext("2d");
		if (!this.image) {
			cvs.width = 1;
			cvs.height = 1;
			return;
		}
		const fw = this.effectiveFrameW();
		const fh = this.effectiveFrameH();
		const z = this.previewZoom;
		const pad = SE_PREVIEW_PAD * z;
		const cw = (fw + SE_PREVIEW_PAD * 2) * z;
		const ch = (fh + SE_PREVIEW_PAD * 2) * z;
		cvs.width = cw;
		cvs.height = ch;

		this.drawChecker(ctx, cw, ch);

		const idx = Math.floor(this.framePos) % this.validFrameCount();
		const srcX = idx * fw;
		const copyW = Math.max(0, Math.min(fw, this.stripWidth - srcX));
		const copyH = Math.max(0, Math.min(fh, this.stripHeight));
		if (copyW > 0 && copyH > 0) {
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(this.image, srcX, 0, copyW, copyH, pad, pad, copyW * z, copyH * z);
		}

		// subtle border around the frame pixels
		ctx.strokeStyle = SE_FRAME_BORDER_COLOR;
		ctx.lineWidth = 1;
		ctx.strokeRect(pad + SE_LINE_SNAP, pad + SE_LINE_SNAP, Math.max(1, fw * z - 1), Math.max(1, fh * z - 1));

		// mask overlay
		const f = this.form;
		if (f.maskKind === "circle" && Number.isFinite(f.maskX) && Number.isFinite(f.maskY) && Number.isFinite(f.maskR)) {
			const cx = pad + f.maskX * z;
			const cy = pad + f.maskY * z;
			const r = Math.max(0, f.maskR * z);
			ctx.save();
			ctx.globalAlpha = SE_MASK_FILL_ALPHA;
			ctx.fillStyle = SE_MASK_COLOR;
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
			ctx.strokeStyle = SE_MASK_COLOR;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.stroke();
		} else if (Number.isFinite(f.maskX) && Number.isFinite(f.maskY) && Number.isFinite(f.maskW) && Number.isFinite(f.maskH)) {
			const mx = pad + f.maskX * z;
			const my = pad + f.maskY * z;
			const mw = Math.max(0, f.maskW * z);
			const mh = Math.max(0, f.maskH * z);
			ctx.save();
			ctx.globalAlpha = SE_MASK_FILL_ALPHA;
			ctx.fillStyle = SE_MASK_COLOR;
			ctx.fillRect(mx, my, mw, mh);
			ctx.restore();
			if (mw > 0 && mh > 0) {
				ctx.strokeStyle = SE_MASK_COLOR;
				ctx.lineWidth = 1;
				ctx.strokeRect(mx + SE_LINE_SNAP, my + SE_LINE_SNAP, Math.max(1, mw - 1), Math.max(1, mh - 1));
			}
			if (this.editMode === SE_EDIT_MASK) this.drawMaskHandles(ctx, pad, z);
		}

		// origin crosshair
		if (Number.isFinite(f.ox) && Number.isFinite(f.oy)) {
			const ox = Math.round(pad + f.ox * z) + SE_LINE_SNAP;
			const oy = Math.round(pad + f.oy * z) + SE_LINE_SNAP;
			ctx.strokeStyle = SE_ORIGIN_HALO_COLOR;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(ox - SE_ORIGIN_ARM_PX, oy);
			ctx.lineTo(ox + SE_ORIGIN_ARM_PX, oy);
			ctx.moveTo(ox, oy - SE_ORIGIN_ARM_PX);
			ctx.lineTo(ox, oy + SE_ORIGIN_ARM_PX);
			ctx.stroke();

			ctx.strokeStyle = SE_ORIGIN_COLOR;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(ox - SE_ORIGIN_ARM_PX, oy);
			ctx.lineTo(ox + SE_ORIGIN_ARM_PX, oy);
			ctx.moveTo(ox, oy - SE_ORIGIN_ARM_PX);
			ctx.lineTo(ox, oy + SE_ORIGIN_ARM_PX);
			ctx.stroke();
		}
	},

	onStripClick(e) {
		if (!this.image) return;
		const fw = this.form.w;
		if (!Number.isFinite(fw) || fw < 1) return;
		const rect = this.el.stripCanvas.getBoundingClientRect();
		const z = this.stripZoom;
		const px = (e.clientX - rect.left) * (this.el.stripCanvas.width / rect.width) / z;
		const idx = Math.max(0, Math.min(this.validFrameCount() - 1, Math.floor(px / fw)));
		this.framePos = idx;
		this.drawStrip();
		this.drawPreview();
		this.updatePlaybackUi();
	},

	previewCanvasPos(e) {
		const cvs = this.el.previewCanvas;
		const rect = cvs.getBoundingClientRect();
		const scaleX = rect.width ? (cvs.width / rect.width) : 1;
		const scaleY = rect.height ? (cvs.height / rect.height) : 1;
		return {
			x: (e.clientX - rect.left) * scaleX,
			y: (e.clientY - rect.top) * scaleY
		};
	},

	previewPixelFromMouse(e) {
		const z = this.previewZoom;
		const p = this.previewCanvasPos(e);
		return {
			x: Math.floor(p.x / z) - SE_PREVIEW_PAD,
			y: Math.floor(p.y / z) - SE_PREVIEW_PAD
		};
	},

	setEditMode(mode) {
		if (this.editMode === mode) return;
		this.editMode = mode;
		this.draggingOrigin = false;
		this.maskDrag = null;
		this.updateEditModeUi();
		this.drawPreview();
		this.updateHoverReadout();
	},

	updateEditModeUi() {
		const onOrigin = this.editMode === SE_EDIT_ORIGIN;
		this.styleToggle(this.el.btnEditOrigin, onOrigin);
		this.styleToggle(this.el.btnEditMask, !onOrigin);
		this.updatePreviewCursor(null);
	},

	styleToggle(btn, on) {
		btn.classList.toggle("active", on);
		btn.style.borderColor = on ? SE_TOGGLE_ON_BORDER : "";
		btn.style.color = on ? SE_TOGGLE_ON_COLOR : "";
		btn.style.background = on ? SE_TOGGLE_ON_BACK : "";
	},

	maskRectValid() {
		const f = this.form;
		return f.maskKind === "rect"
			&& Number.isFinite(f.maskX) && Number.isFinite(f.maskY)
			&& Number.isFinite(f.maskW) && Number.isFinite(f.maskH);
	},

	maskCornersOnCanvas(pad, z) {
		const f = this.form;
		return {
			nw: { x: pad + f.maskX * z, y: pad + f.maskY * z },
			ne: { x: pad + (f.maskX + f.maskW) * z, y: pad + f.maskY * z },
			sw: { x: pad + f.maskX * z, y: pad + (f.maskY + f.maskH) * z },
			se: { x: pad + (f.maskX + f.maskW) * z, y: pad + (f.maskY + f.maskH) * z }
		};
	},

	drawMaskHandles(ctx, pad, z) {
		if (!this.maskRectValid()) return;
		const corners = this.maskCornersOnCanvas(pad, z);
		const half = SE_MASK_HANDLE_SIZE / 2;
		ctx.lineWidth = 1;
		for (const name of ["nw", "ne", "sw", "se"]) {
			const c = corners[name];
			const x = Math.round(c.x - half) + SE_LINE_SNAP;
			const y = Math.round(c.y - half) + SE_LINE_SNAP;
			ctx.fillStyle = SE_MASK_HANDLE_FILL;
			ctx.fillRect(x, y, SE_MASK_HANDLE_SIZE, SE_MASK_HANDLE_SIZE);
			ctx.strokeStyle = SE_MASK_HANDLE_BORDER;
			ctx.strokeRect(x, y, SE_MASK_HANDLE_SIZE, SE_MASK_HANDLE_SIZE);
		}
	},

	// which part of the mask the mouse is on, or nothing
	hitMaskPart(e) {
		if (!this.maskRectValid()) return null;
		const z = this.previewZoom;
		const pad = SE_PREVIEW_PAD * z;
		const p = this.previewCanvasPos(e);
		const hit = SE_MASK_HANDLE_HIT / 2;
		const corners = this.maskCornersOnCanvas(pad, z);
		for (const name of ["nw", "ne", "se", "sw"]) {
			const c = corners[name];
			if (Math.abs(p.x - c.x) <= hit && Math.abs(p.y - c.y) <= hit) return name;
		}
		const f = this.form;
		const mx = pad + f.maskX * z;
		const my = pad + f.maskY * z;
		const mw = f.maskW * z;
		const mh = f.maskH * z;
		if (p.x >= mx && p.x <= mx + mw && p.y >= my && p.y <= my + mh) return "move";
		return null;
	},

	updatePreviewCursor(part) {
		const cvs = this.el.previewCanvas;
		if (this.editMode === SE_EDIT_ORIGIN) {
			cvs.style.cursor = "crosshair";
			return;
		}
		if (part === "nw" || part === "se") cvs.style.cursor = "nwse-resize";
		else if (part === "ne" || part === "sw") cvs.style.cursor = "nesw-resize";
		else if (part === "move" || (this.maskDrag && this.maskDrag.kind === "move")) cvs.style.cursor = "move";
		else cvs.style.cursor = "default";
	},

	onPreviewMouseDown(e) {
		if (e.button !== 0 || !this.image) return;
		e.preventDefault();
		if (this.editMode === SE_EDIT_ORIGIN) {
			this.draggingOrigin = true;
			this.pickOriginFromMouse(e);
			return;
		}
		const part = this.hitMaskPart(e);
		if (!part) return;
		const f = this.form;
		const pix = this.previewPixelFromMouse(e);
		this.maskDrag = {
			kind: part,
			startX: pix.x,
			startY: pix.y,
			orig: { x: f.maskX, y: f.maskY, w: f.maskW, h: f.maskH }
		};
		this.updatePreviewCursor(part);
		this.moveMaskDrag(e);
	},

	onPreviewMouseMove(e) {
		if (this.draggingOrigin) {
			this.pickOriginFromMouse(e);
			return;
		}
		if (this.maskDrag) {
			this.moveMaskDrag(e);
			return;
		}
		if (e.target !== this.el.previewCanvas) return;
		this.updateHoverPixel(e);
		if (this.editMode === SE_EDIT_MASK) this.updatePreviewCursor(this.hitMaskPart(e));
		else this.updatePreviewCursor(null);
	},

	onPreviewMouseUp(e) {
		this.draggingOrigin = false;
		this.maskDrag = null;
		if (e.target === this.el.previewCanvas) this.updatePreviewCursor(this.hitMaskPart(e));
		else this.updatePreviewCursor(null);
	},

	clampMaskRect(x, y, w, h) {
		const fw = this.effectiveFrameW();
		const fh = this.effectiveFrameH();
		w = Math.max(SE_MASK_MIN_SIZE, Math.round(w));
		h = Math.max(SE_MASK_MIN_SIZE, Math.round(h));
		if (w > fw) w = fw;
		if (h > fh) h = fh;
		x = Math.round(x);
		y = Math.round(y);
		if (x < 0) x = 0;
		if (y < 0) y = 0;
		if (x + w > fw) x = fw - w;
		if (y + h > fh) y = fh - h;
		if (x < 0) x = 0;
		if (y < 0) y = 0;
		return { x: x, y: y, w: w, h: h };
	},

	applyMaskRect(rect) {
		const f = this.form;
		if (f.maskX === rect.x && f.maskY === rect.y && f.maskW === rect.w && f.maskH === rect.h) return;
		f.maskX = rect.x;
		f.maskY = rect.y;
		f.maskW = rect.w;
		f.maskH = rect.h;
		this.el.fieldMaskX.value = String(rect.x);
		this.el.fieldMaskY.value = String(rect.y);
		this.el.fieldMaskW.value = String(rect.w);
		this.el.fieldMaskH.value = String(rect.h);
		this.markDirty();
		this.validate();
		this.drawPreview();
	},

	moveMaskDrag(e) {
		if (!this.maskDrag) return;
		const pix = this.previewPixelFromMouse(e);
		this.hoverPixel = { x: pix.x, y: pix.y };
		const drag = this.maskDrag;
		const o = drag.orig;
		let x1 = o.x;
		let y1 = o.y;
		let x2 = o.x + o.w;
		let y2 = o.y + o.h;
		const px = Math.round(pix.x);
		const py = Math.round(pix.y);
		if (drag.kind === "move") {
			const dx = Math.round(pix.x - drag.startX);
			const dy = Math.round(pix.y - drag.startY);
			this.applyMaskRect(this.clampMaskRect(o.x + dx, o.y + dy, o.w, o.h));
		} else {
			const fw = this.effectiveFrameW();
			const fh = this.effectiveFrameH();
			const cx = Math.max(0, Math.min(fw, px));
			const cy = Math.max(0, Math.min(fh, py));
			if (drag.kind === "nw" || drag.kind === "sw") x1 = cx;
			if (drag.kind === "ne" || drag.kind === "se") x2 = cx;
			if (drag.kind === "nw" || drag.kind === "ne") y1 = cy;
			if (drag.kind === "sw" || drag.kind === "se") y2 = cy;
			if (x2 < x1 + SE_MASK_MIN_SIZE) {
				if (drag.kind === "nw" || drag.kind === "sw") x1 = x2 - SE_MASK_MIN_SIZE;
				else x2 = x1 + SE_MASK_MIN_SIZE;
			}
			if (y2 < y1 + SE_MASK_MIN_SIZE) {
				if (drag.kind === "nw" || drag.kind === "ne") y1 = y2 - SE_MASK_MIN_SIZE;
				else y2 = y1 + SE_MASK_MIN_SIZE;
			}
			this.applyMaskRect(this.clampMaskRect(x1, y1, x2 - x1, y2 - y1));
		}
		this.updateHoverReadout();
	},

	pickOriginFromMouse(e) {
		if (!this.image) return;
		const p = this.previewPixelFromMouse(e);
		const fw = this.effectiveFrameW();
		const fh = this.effectiveFrameH();
		const nx = Math.max(0, Math.min(fw, p.x));
		const ny = Math.max(0, Math.min(fh, p.y));
		this.hoverPixel = { x: nx, y: ny };
		if (nx !== this.form.ox || ny !== this.form.oy) {
			this.form.ox = nx;
			this.form.oy = ny;
			this.el.fieldOx.value = String(nx);
			this.el.fieldOy.value = String(ny);
			this.markDirty();
			this.validate();
			this.drawPreview();
		}
		this.updateHoverReadout();
	},

	updateHoverPixel(e) {
		if (!this.image) return;
		this.hoverPixel = this.previewPixelFromMouse(e);
		this.updateHoverReadout();
	},

	updateHoverReadout() {
		if (!this.hoverPixel) {
			this.el.hoverReadout.textContent = this.editMode === SE_EDIT_MASK
				? "Drag the mask or its corners"
				: "Click preview to set origin";
			return;
		}
		this.el.hoverReadout.textContent = "Cursor: " + this.hoverPixel.x + ", " + this.hoverPixel.y;
	},

	setPlayMode(mode) {
		this.playMode = mode;
		this.lastTick = 0;
		this.updatePlaybackUi();
	},

	startPlayOnce() {
		const total = this.validFrameCount();
		if (total <= 1) {
			this.playMode = SE_PLAY_STOP;
			this.framePos = 0;
			this.drawStrip();
			this.drawPreview();
			this.updatePlaybackUi();
			return;
		}
		if (Math.floor(this.framePos) >= total - 1) this.framePos = 0;
		this.playMode = SE_PLAY_ONCE;
		this.lastTick = 0;
		this.drawStrip();
		this.drawPreview();
		this.updatePlaybackUi();
	},

	stepFrame(delta) {
		this.playMode = SE_PLAY_STOP;
		this.lastTick = 0;
		const total = this.validFrameCount();
		const cur = Math.floor(this.framePos);
		this.framePos = ((cur + delta) % total + total) % total;
		this.drawStrip();
		this.drawPreview();
		this.updatePlaybackUi();
	},

	updatePlaybackUi() {
		const total = this.validFrameCount();
		const cur = Math.floor(this.framePos) % total;
		this.el.frameReadout.textContent = "Frame " + (cur + 1) + " / " + total;
		this.el.btnLoop.classList.toggle("active", this.playMode === SE_PLAY_LOOP);
		this.el.btnOnce.classList.toggle("active", this.playMode === SE_PLAY_ONCE);
		this.el.btnStop.classList.toggle("active", this.playMode === SE_PLAY_STOP);
	},

	frame(now) {
		if (this.playMode === SE_PLAY_STOP || !this.image) return;
		const total = this.validFrameCount();
		if (total <= 1) {
			this.setPlayMode(SE_PLAY_STOP);
			return;
		}
		if (this.lastTick === 0) {
			this.lastTick = now;
			return;
		}
		const dt = Math.min(0.1, (now - this.lastTick) / 1000);
		this.lastTick = now;
		const speed = Number.isFinite(this.form.imageSpeed) && this.form.imageSpeed >= 0 ? this.form.imageSpeed : 0;
		const prevIdx = Math.floor(this.framePos);
		let nextPos = this.framePos + speed * SE_GAME_FPS * dt;

		if (this.playMode === SE_PLAY_ONCE) {
			if (nextPos >= total - 1) {
				this.framePos = total - 1;
				this.playMode = SE_PLAY_STOP;
				this.lastTick = 0;
			} else {
				this.framePos = nextPos;
			}
		} else {
			this.framePos = nextPos % total;
		}

		const nextIdx = Math.floor(this.framePos);
		if (nextIdx !== prevIdx || this.playMode === SE_PLAY_STOP) {
			this.drawStrip();
			this.drawPreview();
			this.updatePlaybackUi();
		}
	},

	buildRecordToSave() {
		const f = this.form;
		const mask = Object.assign({}, f.maskExtra);
		if (f.maskKind === "circle") {
			mask.kind = "circle";
			mask.r = f.maskR;
			mask.x = f.maskX;
			mask.y = f.maskY;
		} else {
			mask.kind = "rect";
			mask.w = f.maskW;
			mask.h = f.maskH;
			mask.x = f.maskX;
			mask.y = f.maskY;
		}
		return {
			w: f.w,
			h: f.h,
			frames: f.frames,
			ox: f.ox,
			oy: f.oy,
			mask: mask,
			image_speed: f.imageSpeed,
			group: this.current.group
		};
	},

	async save() {
		this.validate();
		if (this.el.saveBtn.disabled || this.saving || !this.current) return;
		this.saving = true;
		this.validate();
		const entry = this.current;
		const wasPacked = this.packedGroups.has(entry.group);
		this.setStatus("Saving " + entry.name + (wasPacked ? " and repacking " + entry.group + "..." : " and updating index..."));
		try {
			const rec = this.buildRecordToSave();
			const jsonText = EdPacker.formatSourceJson(rec);
			await EdFolder.save(entry.jsonPath, jsonText);
			const result = await EdPacker.repackIfPacked(EdPacker.folderStore(), entry.group);
			entry.hasJson = true;
			this.dirty = false;
			this.syncHeader();
			this.rebuildPicker();
			if (result.packed.length > 0) {
				this.setStatus("Saved " + entry.name + ", rebuilt index, and repacked " + entry.group + " (" + result.packed.length + " sheet" + (result.packed.length === 1 ? "" : "s") + ").");
			} else {
				this.setStatus("Saved " + entry.name + " and rebuilt index (loose group " + entry.group + ").");
			}
		} catch (e) {
			this.setStatus("Save failed: " + e.message, true);
			console.error(e);
		} finally {
			this.saving = false;
			this.validate();
		}
	},

	setStatus(text, isError) {
		this.el.status.textContent = text;
		this.el.status.classList.toggle("status-err", !!isError);
	}
};
