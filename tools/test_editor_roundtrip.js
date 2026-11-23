#!/usr/bin/env node
// Checks that the level editor saves an unchanged room back exactly as it read it. Every room file
// in assets and the world file are read the way the editor reads them, built into the editor's own
// room, taken up by the overlay as a room just opened is, so folded groups fold again, written back
// with the editor's writer and compared byte for byte. Nothing is written to disk. The player's and
// editor's scripts run here as they are, with a bare page and a stand-in for the editor around them.
//
// usage: node tools/test_editor_roundtrip.js [<lunch_money dir>]

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = process.argv[2] || path.join(__dirname, "..");
const PLAYER_SCRIPTS = ["js/utils.js", "js/sprites.js", "js/draw.js", "js/collision.js", "js/objects_movers.js",
	"js/objects.js", "js/objects_core.js", "js/input.js", "js/char_side.js", "js/char_topd.js", "js/camera.js",
	"js/weather.js", "js/world.js", "js/scripty.js"];
const EDITOR_SCRIPTS = ["editor/roomfile.js", "editor/room.js", "editor/gui.js"];

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
	vm.runInContext("var Editor = { room: null, curlayeri: 0 }; this.T = { game, Sprites, Draw, EdRoom, EdFile, EdGui, Editor };", page);
	const { game, Sprites, Draw, EdRoom, EdFile, EdGui, Editor } = page.T;
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
	process.exitCode = differ > 0 ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 2; });
