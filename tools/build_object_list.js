#!/usr/bin/env node
// Writes objects/object_file_map.json, the list of object files in each folder under objects/, because the page
// cannot list a folder. Run it after adding, moving or removing an object file. The two base files
// sit at the top of objects/ and are not listed, since the page always loads them.
//
// usage: node tools/build_object_list.js [<lunch_money dir>]

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || path.join(__dirname, "..");
const objectsDir = path.join(root, "objects");

const list = {};
const folders = fs.readdirSync(objectsDir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
for (const folder of folders) {
	if (!folder.isDirectory()) continue;
	list[folder.name] = fs.readdirSync(path.join(objectsDir, folder.name))
		.filter((name) => name.endsWith(".js"))
		.sort();
}

const out = path.join(objectsDir, "object_file_map.json");
fs.writeFileSync(out, JSON.stringify(list, null, "\t") + "\n");
for (const folder of Object.keys(list)) console.log(folder + ": " + list[folder].length + " files");
console.log("wrote " + out);
