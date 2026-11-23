// Reaching the game's files. The person picks the lunch_money folder once; the browser remembers that
// choice between visits, and each new visit asks again with a single click. Everything the editor
// reads goes through that folder and is read fresh every time, so a file changed on disk shows on its
// next read. Saving keeps a copy of the file as it was in the backup folder first, and the browser
// writes the new text to a side file that only takes the file's place once complete. Only Chrome and
// Edge offer this kind of folder access.

// where the chosen folder is remembered between visits
const ED_FOLDER_DB = "lunch_money_editor";
const ED_FOLDER_STORE = "handles";
const ED_FOLDER_KEY = "repo";
// asked for with writing allowed, so saving needs no second prompt
const ED_FOLDER_MODE = "readwrite";
// the picker opens where it was last used for this
const ED_FOLDER_PICKER_ID = "lunch_money";
// a file the chosen folder must hold to count as the game's folder
const ED_FOLDER_PROOF = WORLD_FILE;
// where saving keeps the files it replaced, and how many of each file it keeps, newest first
const ED_BACKUP_DIR = "assets/backup";
const ED_BACKUP_KEEP = 20;

const EdFolder = {
	handle: null,

	supported() {
		return typeof window.showDirectoryPicker === "function";
	},

	// Runs one piece of work on the remembered folder store and gives back what it asked for.
	store(mode, work) {
		return new Promise((resolve, reject) => {
			const open = indexedDB.open(ED_FOLDER_DB, 1);
			open.onupgradeneeded = () => open.result.createObjectStore(ED_FOLDER_STORE);
			open.onerror = () => reject(open.error);
			open.onsuccess = () => {
				const tx = open.result.transaction(ED_FOLDER_STORE, mode);
				const req = work(tx.objectStore(ED_FOLDER_STORE));
				tx.oncomplete = () => {
					open.result.close();
					resolve(req.result);
				};
				tx.onerror = () => reject(tx.error);
			};
		});
	},

	// the folder picked on an earlier visit, or nothing
	async remembered() {
		try {
			return (await this.store("readonly", (s) => s.get(ED_FOLDER_KEY))) || null;
		} catch (e) {
			return null;
		}
	},

	// Asks for a folder, checks it is the game's, and remembers it. Must run from a click.
	async pick() {
		const handle = await window.showDirectoryPicker({ id: ED_FOLDER_PICKER_ID, mode: ED_FOLDER_MODE });
		this.handle = handle;
		try {
			await this.fileAt(ED_FOLDER_PROOF);
		} catch (e) {
			this.handle = null;
			throw new Error("That folder has no " + ED_FOLDER_PROOF + ", so it is not the lunch_money folder.");
		}
		await this.store("readwrite", (s) => s.put(handle, ED_FOLDER_KEY));
	},

	// Takes up a remembered folder again, asking the browser for access when this visit has none yet.
	// Must run from a click, since the browser only asks then.
	async reopen(handle) {
		let state = await handle.queryPermission({ mode: ED_FOLDER_MODE });
		if (state !== "granted") state = await handle.requestPermission({ mode: ED_FOLDER_MODE });
		if (state !== "granted") throw new Error("The browser did not allow access to " + handle.name + ".");
		this.handle = handle;
	},

	// The folder a path leads to inside the game's folder, walked one folder at a time, made along
	// the way when asked, and the last part of the path.
	async dirAt(path, create) {
		const parts = path.split("/").filter((p) => p !== "" && p !== ".");
		let dir = this.handle;
		for (let i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i], { create: create });
		return { dir: dir, name: parts[parts.length - 1] };
	},

	// a file inside the folder by its path from the folder's top
	async fileAt(path) {
		const at = await this.dirAt(path, false);
		const fh = await at.dir.getFileHandle(at.name);
		return fh.getFile();
	},

	// Writes a file's new text. What it held before goes to the backup folder first, named by the
	// file and the time down to the second, counting on when two saves share a second, and only the
	// newest of a file's backups are kept.
	async save(path, text) {
		const at = await this.dirAt(path, true);
		const dot = at.name.lastIndexOf(".");
		const base = dot > 0 ? at.name.substring(0, dot) : at.name;
		const ext = dot > 0 ? at.name.substring(dot) : "";
		let old = null;
		try {
			old = await (await (await at.dir.getFileHandle(at.name)).getFile()).text();
		} catch (e) {
			old = null;
		}
		if (old !== null) {
			const bdir = (await this.dirAt(ED_BACKUP_DIR + "/" + at.name, true)).dir;
			const d = new Date();
			const two = (v) => String(v).padStart(2, "0");
			const stamp = d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + "-" + two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
			const taken = new Set();
			for await (const key of bdir.keys()) taken.add(key);
			let bname = base + "." + stamp + ext;
			for (let n = 1; taken.has(bname); n++) bname = base + "." + stamp + "-" + n + ext;
			const bw = await (await bdir.getFileHandle(bname, { create: true })).createWritable();
			await bw.write(old);
			await bw.close();
			taken.add(bname);
			// this file's backups by their time and count, oldest first, beyond the kept number removed
			const mine = [];
			const pat = /^(\d{8}-\d{6})(?:-(\d+))?$/;
			for (const key of taken) {
				if (!key.startsWith(base + ".") || !key.endsWith(ext)) continue;
				const m = pat.exec(key.substring(base.length + 1, key.length - ext.length));
				if (m !== null) mine.push({ key: key, stamp: m[1], n: m[2] === undefined ? 0 : parseInt(m[2], 10) });
			}
			mine.sort((a, b) => (a.stamp !== b.stamp ? (a.stamp < b.stamp ? -1 : 1) : a.n - b.n));
			for (const b of mine.slice(0, Math.max(0, mine.length - ED_BACKUP_KEEP))) await bdir.removeEntry(b.key);
		}
		const w = await (await at.dir.getFileHandle(at.name, { create: true })).createWritable();
		await w.write(text);
		await w.close();
	},

	// The readers the player's loaders take, all reading through the folder. They are arrow functions
	// so they can be handed over on their own.
	readText: (path) => EdFolder.fileAt(path).then((f) => f.text()),
	readJson: (path) => EdFolder.fileAt(path).then((f) => f.text()).then((t) => JSON.parse(t)),
	loadImage: (path) => EdFolder.fileAt(path).then((f) => createImageBitmap(f)),

	// A script from the folder, run as a page script so its classes become globals like the player's.
	// Its own path is named for the browser's tools so errors point at the real file.
	loadScript: (path) => EdFolder.fileAt(path).then((f) => f.text()).then((text) => new Promise((resolve, reject) => {
		const url = URL.createObjectURL(new Blob([text + "\n//# sourceURL=" + path], { type: "text/javascript" }));
		const script = document.createElement("script");
		script.onload = () => {
			URL.revokeObjectURL(url);
			resolve();
		};
		script.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error(path));
		};
		script.src = url;
		document.head.appendChild(script);
	}))
};
