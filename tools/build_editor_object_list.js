#!/usr/bin/env node
// Writes assets/editor_objects.json, every object the level editor's picker offers with the sprite
// it shows, because the page cannot read the original project. It takes each original object's own
// sprite and offers every class the port has, in its core files or its object folders, whatever
// original folder the object sat in. The original editor's and level player's own folders are only
// left out for objects the port has no class for, so the editor's own machinery stays out while
// marks placed in rooms, such as the player start, stay in. Classes the original lacks come with no
// sprite of their own. Run it again when objects are added.
//
// usage: node tools/build_editor_object_list.js <gm2_legacy dir> [<lunch_money dir>]

const fs = require("fs");
const path = require("path");

// original folders whose objects belong to the editor itself rather than to rooms, unless ported
const SKIPPED_FOLDERS = /levelEditor|levelPlayer/;
const OUT_FILE = "assets/editor_objects.json";
// where the port's classes are found: its core files and its object folders
const PORT_DIRS = ["js", "objects"];

const gmRoot = process.argv[2];
if (!gmRoot) {
	console.error("usage: node tools/build_editor_object_list.js <gm2_legacy dir> [<lunch_money dir>]");
	process.exit(1);
}
const root = process.argv[3] || path.join(__dirname, "..");

// the port's own classes, wherever they sit in its folders
const ported = new Set();
const walk = (dir) => {
	for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, ent.name);
		if (ent.isDirectory()) walk(p);
		else if (ent.name.endsWith(".js")) {
			for (const m of fs.readFileSync(p, "utf8").matchAll(/^class (\w+) extends/gm)) ported.add(m[1]);
		}
	}
};
for (const dir of PORT_DIRS) walk(path.join(root, dir));

const objects = {};
let skipped = 0;
const gmObjects = path.join(gmRoot, "objects");
for (const name of fs.readdirSync(gmObjects)) {
	const yy = path.join(gmObjects, name, name + ".yy");
	if (!fs.existsSync(yy)) continue;
	const text = fs.readFileSync(yy, "utf8");
	// the folder is the last parent named by a folder path, the sprite the one named under its id
	const folders = [...text.matchAll(/"parent":\s*\{[^}]*"path":\s*"(folders\/[^"]*)"/g)];
	const folder = folders.length > 0 ? folders[folders.length - 1][1] : "";
	if (SKIPPED_FOLDERS.test(folder) && !ported.has(name)) {
		skipped++;
		continue;
	}
	const spr = /"spriteId":\s*\{[^}]*"name":\s*"([^"]+)"/.exec(text);
	objects[name] = spr !== null ? spr[1] : null;
}

let added = 0;
for (const name of ported) {
	if (objects[name] !== undefined) continue;
	objects[name] = null;
	added++;
}

const sorted = {};
for (const name of Object.keys(objects).sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))) sorted[name] = objects[name];
const out = path.join(root, OUT_FILE);
fs.writeFileSync(out, JSON.stringify({ objects: sorted }, null, "\t") + "\n");
console.log(Object.keys(sorted).length + " objects, " + skipped + " editor objects left out, " + added + " only in the port");
console.log("wrote " + out);
