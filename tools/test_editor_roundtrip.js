#!/usr/bin/env node
// Checks that the level editor saves an unchanged room back exactly as it read it. Every room file
// in assets and the world file are read the way the editor reads them, built into the editor's own
// room, taken up by the overlay as a room just opened is, so folded groups fold again, written back
// with the editor's writer and compared byte for byte. Nothing is written to disk. The player's and
// editor's scripts run here as they are, with a bare page around them.
// Then undo and redo are checked: in one room, each kind of change is made through the editor's own
// code, as the keys, the mouse and the panel make it, undone, and the room's text compared with the
// text before; then redone and compared with the text after.
//
// usage: node tools/test_editor_roundtrip.js [<lunch_money dir>]

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = process.argv[2] || path.join(__dirname, "..");
const PLAYER_SCRIPTS = ["js/utils.js", "js/sprites.js", "js/draw.js", "js/collision.js", "js/objects_movers.js",
	"js/objects.js", "js/objects_core.js", "js/input.js", "js/char_side.js", "js/char_topd.js", "js/camera.js",
	"js/weather.js", "js/world.js", "js/scripty.js"];
const EDITOR_SCRIPTS = ["editor/roomfile.js", "editor/room.js", "editor/view.js", "editor/edit.js", "editor/picker.js",
	"editor/gui.js", "editor/panel.js", "editor/editor.js"];
// the room the undo checks change, and the editor's screen size there
const UNDO_ROOM = "TestDev";
const UNDO_SCREEN_W = 1280;
const UNDO_SCREEN_H = 720;

// a drawing surface that accepts every call and draws nothing
const surface = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => surface()), set: (t, k, v) => { t[k] = v; return true; } });
const page = {
	console: { log() {}, warn() {}, error: console.error },
	setTimeout, clearTimeout, performance: { now: () => 0 },
	localStorage: { getItem: () => null, setItem() {} },
	location: { search: "", href: "" },
	addEventListener() {},
	document: { createElement: () => ({ getContext: () => surface(), width: 0, height: 0, style: {} }), getElementById: () => null, addEventListener() {} },
	navigator: { userAgent: "node" },
	Image: function () {}
};
page.window = page;
page.self = page;
vm.createContext(page);
const run = (rel) => vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), page, { filename: rel });

const readText = async (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const readJson = async (rel) => JSON.parse(await readText(rel));
const loadImage = async () => ({ width: 1, height: 1 });
const loadScript = async (rel) => { run(rel); };

(async () => {
	for (const f of PLAYER_SCRIPTS) run(f);
	for (const f of EDITOR_SCRIPTS) run(f);
	vm.runInContext("this.T = { game, Sprites, Draw, EdRoom, EdFile, EdGui, Editor, EdEdit, EdView, EdPicker, EdPanel, ED_PANEL_KINDS };", page);
	const { game, Sprites, Draw, EdRoom, EdFile, EdGui, Editor, EdEdit, EdView, EdPicker, EdPanel, ED_PANEL_KINDS } = page.T;
	// a room as the editor holds it once opened, with its current layer saved as it was read
	const opened = (rmi, text) => {
		const room = EdRoom.build(rmi, text);
		Editor.room = room;
		EdGui.roomLoaded();
		return room;
	};
	await game.loadFiles(readText, undefined, loadScript, { expect() {}, done() {} });
	await Sprites.load(readJson, loadImage, [], "loose", { expect() {}, done() {} });
	await Draw.loadFonts(readJson, loadImage);

	let same = 0;
	let differ = 0;
	const report = (name, text, back) => {
		if (back === text) { same++; return; }
		differ++;
		let i = 0;
		while (back[i] === text[i]) i++;
		const line = text.slice(0, i).split("\n").length;
		console.log(name + ": differs at line " + line + "\n  file:  " + JSON.stringify(text.slice(Math.max(0, i - 60), i + 60))
			+ "\n  saved: " + JSON.stringify(back.slice(Math.max(0, i - 60), i + 60)));
	};
	game.rooms.forEach((rm, rmi) => {
		const file = "assets/room_" + rm.name + ".dat";
		if (!fs.existsSync(path.join(root, file))) return;
		const text = fs.readFileSync(path.join(root, file), "utf8");
		const room = opened(rmi, text);
		const back = EdFile.roomText(room, {
			camx: room.camx, camy: room.camy, camw: room.camw, curlyri: room.curlyri,
			last_sp_flt: room.last_sp_flt, last_ob_flt: room.last_ob_flt
		});
		report(file, text, back);
	});
	// rooms on disk the world does not list are read the same way, under the first room's slot
	for (const f of fs.readdirSync(path.join(root, "assets")).filter((n) => /^room_.*\.dat$/.test(n))) {
		if (game.rooms.some((rm) => "room_" + rm.name + ".dat" === f)) continue;
		const text = fs.readFileSync(path.join(root, "assets", f), "utf8");
		const room = opened(0, text);
		report("assets/" + f, text, EdFile.roomText(room, {
			camx: room.camx, camy: room.camy, camw: room.camw, curlyri: room.curlyri,
			last_sp_flt: room.last_sp_flt, last_ob_flt: room.last_ob_flt
		}));
	}
	const wtext = fs.readFileSync(path.join(root, "assets/world.dat"), "utf8");
	const data = EdFile.parse(wtext);
	report("assets/world.dat", wtext, EdFile.worldText({ data: data, curuid: parseInt(data.curuid, 16) },
		{ curroomi: data.curroomi, camx: data.camx, camy: data.camy, camw: data.camw }));
	console.log(same + " files saved back identical, " + differ + " differ");

	// The undo checks. The editor gets a screen and the room as opening it does, nothing selected.
	const rmi = game.rooms.findIndex((rm) => rm.name === UNDO_ROOM);
	Editor.canvas = { width: UNDO_SCREEN_W, height: UNDO_SCREEN_H, clientWidth: UNDO_SCREEN_W, clientHeight: UNDO_SCREEN_H };
	Editor.world = { curuid: parseInt(data.curuid, 16), data: data, savedRooms: game.rooms.map((rm) => rm.name) };
	Editor.adoptRoom(EdRoom.build(rmi, fs.readFileSync(path.join(root, "assets/room_" + UNDO_ROOM + ".dat"), "utf8")));
	EdEdit.reset();
	const room = Editor.room;
	const inp = Editor.inp;
	// the current layer is the editor's, not the room's, so it is left out of the comparing
	const text = () => EdFile.roomText(room, Object.assign(Editor.fileState(), { curlyri: 0 }));
	// one editor step of the mouse and keys: keys pressed this step, keys and buttons held, the mouse
	// at a room spot, then everything let go
	const step = (o) => {
		inp.keysPressed = new Set(o.press || []);
		inp.keysDown = new Set((o.press || []).concat(o.hold || []));
		inp.alt = !!o.alt;
		inp.shift = !!o.shift;
		inp.ctrl = !!o.ctrl;
		inp.down.left = !!o.left;
		if (o.at) {
			Editor.mouse.wx = o.at.x;
			Editor.mouse.wy = o.at.y;
		}
		EdView.lenses();
		if (EdEdit.keys()) EdEdit.mouse(!!o.at, o.wheel || 0);
		inp.keysPressed = new Set();
		inp.keysDown = new Set();
		inp.alt = inp.shift = inp.ctrl = inp.down.left = false;
	};
	// a plain layer with at least four upright entries of different sizes, and four of them
	const plain = room.layers.find((l) => !l.name.startsWith("^") && l.plx_x === 1 && l.plx_y === 1 && l.wd === room.roomw
		&& new Set(l.lsprites.filter((r) => r.ang === 0).map((r) => r.spi)).size >= 4);
	const firstFour = () => {
		const out = [];
		for (const r of plain.lsprites) {
			if (r.ang === 0 && !out.some((f) => f.spi === r.spi)) out.push(r);
			if (out.length === 4) break;
		}
		return out;
	};
	const pick = (recs) => {
		EdEdit.clear();
		for (const r of recs) EdEdit.select(r, false);
		Editor.curlayeri = room.layers.indexOf(recs[0].mylayer);
	};
	let passed = 0;
	let failed = 0;
	const first = text();
	let four = [];
	const check = (name, change) => {
		four = firstFour();
		const before = text();
		const steps = EdEdit.undos.length;
		change();
		const after = text();
		const why = after === before ? "changed nothing"
			: EdEdit.undos.length !== steps + 1 ? "made " + (EdEdit.undos.length - steps) + " undo steps"
			: (EdEdit.undo(true), text() !== before) ? "undo differs"
			: (EdEdit.undo(false), text() !== after) ? "redo differs" : "";
		if (why === "") passed++;
		else {
			failed++;
			console.log("undo check " + name + ": " + why);
			if (why !== "changed nothing" && process.env.UNDO_DIFF) report(name, why === "redo differs" ? after : before, text());
		}
	};
	check("nudge", () => { pick(four); step({ press: ["ArrowRight"] }); });
	check("move", () => {
		pick(four);
		const sel = EdEdit.selects;
		const at = { x: sel[0].x - sel[0].exoffx, y: sel[0].y - sel[0].exoffy };
		Editor.mouse.wx = at.x;
		Editor.mouse.wy = at.y;
		EdView.lenses();
		for (const r of sel.slice()) EdEdit.select(r, false);
		EdEdit.moving = EdEdit.movePrimed = true;
		step({ left: true, at: { x: at.x + 13, y: at.y + 7 } });
		EdEdit.moving = false;
	});
	check("copy drag", () => {
		pick(four.slice(0, 2));
		const at = { x: four[0].x, y: four[0].y };
		Editor.mouse.wx = at.x;
		Editor.mouse.wy = at.y;
		EdView.lenses();
		for (const r of EdEdit.selects.slice()) EdEdit.select(r, false);
		EdEdit.moving = EdEdit.movePrimed = EdEdit.copyPrimed = true;
		step({ left: true, at: { x: at.x + 20, y: at.y } });
		EdEdit.moving = false;
	});
	check("scale", () => {
		pick(four);
		EdEdit.updateBox();
		EdEdit.grab = { xo: 0, yo: 0 };
		EdEdit.downX = EdEdit.box.x2;
		EdEdit.downY = EdEdit.box.y2;
		EdEdit.resizing = EdEdit.resizePrimed = true;
		EdEdit.rotating = false;
		step({ left: true, at: { x: EdEdit.box.x2 + 30, y: EdEdit.box.y2 + 10 } });
		EdEdit.resizing = false;
	});
	check("turn by dragging", () => {
		pick(four);
		EdEdit.updateBox();
		EdEdit.grab = { xo: 0, yo: 0 };
		EdEdit.resizing = EdEdit.resizePrimed = EdEdit.rotating = true;
		EdEdit.rotateStAng = 0;
		step({ left: true, at: { x: EdEdit.box.x2 + 40, y: EdEdit.box.y1 } });
		EdEdit.resizing = EdEdit.rotating = false;
	});
	check("quarter turn", () => { pick(four); step({ press: ["NumpadAdd"] }); });
	check("flip", () => { pick(four); step({ press: ["NumpadSubtract"], alt: true }); });
	check("jitter", () => { pick(four); step({ press: ["KeyJ"], ctrl: true, shift: true }); });
	check("panel field", () => {
		pick(four.slice(0, 2));
		EdPanel.kind = "entry";
		EdPanel.targets = EdEdit.selects.slice();
		EdPanel.primary = EdPanel.targets[0];
		EdPanel.say = EdPanel.fill = EdPanel.table = () => {};
		const f = ED_PANEL_KINDS.entry.fields.find((x) => x.key === "start_ifr");
		EdPanel.inputs = { start_ifr: { input: { dataset: { dirty: "1" }, value: "2" } } };
		EdPanel.commitField(f);
	});
	check("panel block", () => {
		pick(four.slice(0, 2));
		EdPanel.kind = "entry";
		EdPanel.targets = EdEdit.selects.slice();
		EdPanel.primary = EdPanel.targets[0];
		EdPanel.applyBlock([{ key: "undo_check", value: 3 }], undefined, null);
	});
	check("copy paste", () => { pick(four); EdEdit.copy(false); step({ press: ["KeyV"], ctrl: true, at: { x: 50, y: 60 } }); });
	check("delete", () => { pick(four.slice(1, 3)); step({ press: ["Delete"] }); });
	let cutNames = "";
	check("cut", () => {
		pick(four.slice(0, 2));
		cutNames = EdEdit.selects.map((r) => r.name).join(" ");
		step({ press: ["KeyX"], ctrl: true });
	});
	check("paste of the cut", () => {
		EdEdit.clear();
		step({ press: ["KeyV"], ctrl: true, at: { x: 70, y: 80 } });
		const names = EdEdit.selects.map((r) => r.name).join(" ");
		if (names !== cutNames) console.log("undo check paste of the cut: names " + names + " not " + cutNames);
	});
	check("second paste of the cut", () => {
		EdEdit.clear();
		step({ press: ["KeyV"], ctrl: true, at: { x: 90, y: 80 } });
		if (EdEdit.selects.some((r) => cutNames.split(" ").includes(r.name))) console.log("undo check second paste of the cut: kept a name");
	});
	check("z order", () => { pick([plain.lsprites[0]]); step({ press: ["Home"], alt: true }); });
	check("into the next layer", () => { pick([plain.lsprites[1]]); step({ press: ["PageUp"], alt: true }); });
	check("align left", () => { pick(four); step({ press: ["ArrowLeft"], alt: true }); });
	check("align then centre across", () => {
		pick(four);
		step({ press: ["ArrowLeft"], alt: true });
		step({ press: ["ArrowDown"], hold: ["ArrowLeft"], alt: true });
		const mids = EdEdit.selects.map((r) => {
			const f = EdView.frameShape(r, r.x - r.exoffx, r.y - r.exoffy);
			return (f.l + f.r + 1) / 2;
		});
		if (EdEdit.selects.length !== 4 || Math.max(...mids) - Math.min(...mids) > 1) console.log("undo check centre: not centred " + mids.join(" "));
	});
	check("align then spread", () => {
		pick(four);
		const frame = (r) => EdView.frameShape(r, r.x - r.exoffx, r.y - r.exoffy);
		const order = four.slice().sort((a, b) => frame(a).l - frame(b).l);
		step({ press: ["ArrowLeft"], alt: true });
		step({ press: ["ArrowRight"], hold: ["ArrowLeft"], alt: true });
		const fs = order.map(frame);
		const gaps = fs.slice(1).map((f, i) => f.l - (fs[i].r + 1));
		if (Math.max(...gaps) - Math.min(...gaps) > 1) console.log("undo check spread: gaps " + gaps.join(" "));
	});
	check("start frame by wheel", () => {
		pick(room.layers.flatMap((l) => l.lsprites).filter((r) => Sprites.get(r.spi).frameCount > 1).slice(0, 2));
		step({ hold: ["KeyA"], wheel: 1 });
	});
	check("objects to plain sprites", () => {
		pick(plain.lsprites.filter((r) => r.isobj !== undefined).slice(0, 2).concat(four.slice(0, 1)));
		step({ press: ["Delete"], hold: ["KeyO"] });
	});
	check("place", () => { Editor.curlayeri = room.layers.indexOf(plain); EdEdit.push(); EdEdit.add({ spi: four[0].spi }, 10, 20, false); });
	check("room width", () => {
		EdPanel.kind = "room";
		EdPanel.targets = [room];
		EdPanel.primary = room;
		const f = ED_PANEL_KINDS.room.fields.find((x) => x.key === "roomw");
		EdPanel.inputs = { roomw: { input: { dataset: { dirty: "1" }, value: String(room.roomw + 64) } } };
		EdPanel.commitField(f);
	});
	check("layer settings", () => {
		Editor.curlayeri = room.layers.indexOf(plain);
		EdEdit.push(plain, ["zsort"]);
		plain.zsort = plain.zsort ? 0 : 1;
	});
	check("layer panel width", () => {
		EdPanel.kind = "layer";
		EdPanel.targets = [plain];
		EdPanel.primary = plain;
		const f = ED_PANEL_KINDS.layer.fields.find((x) => x.key === "wd");
		EdPanel.inputs = { wd: { input: { dataset: { dirty: "1" }, value: String(plain.wd * 2) } } };
		EdPanel.commitField(f);
	});
	check("layer move", () => { Editor.curlayeri = room.layers.indexOf(plain); EdGui.rotate(1, true); });
	check("layer add", () => { Editor.curlayeri = 0; EdGui.addLayer(); EdGui.renameLayer(room.layers[1], "undo_check", true); EdGui.edit = null; });
	check("layer rename", () => { EdGui.renameLayer(plain, "undo_check." + plain.name, false); });
	check("layer delete", () => { EdGui.renameLayer(room.layers.find((l) => l.lsprites.length === 0), "", false); });
	check("layer delete with entries", () => { EdGui.deleteLayer(plain); });
	// every step undone back to the room as read, then all redone
	const last = text();
	while (EdEdit.undos.length > 0) EdEdit.undo(true);
	const allBack = text() === first;
	while (EdEdit.redos.length > 0) EdEdit.undo(false);
	if (allBack && text() === last) passed++;
	else {
		failed++;
		console.log("undo check all the way back and forth: " + (allBack ? "redo" : "undo") + " differs");
	}
	console.log(passed + " undo checks passed, " + failed + " failed");
	process.exitCode = differ > 0 || failed > 0 ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 2; });
