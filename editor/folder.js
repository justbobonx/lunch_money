// Reaching the game's files. The person picks the lunch_money folder once; the browser remembers that
// choice between visits, and each new visit asks again with a single click. Everything the editor
// reads goes through that folder and is read fresh every time, so a file changed on disk shows on its
// next read. Only Chrome and Edge offer this kind of folder access.

// where the chosen folder is remembered between visits
const ED_FOLDER_DB = "lunch_money_editor";
const ED_FOLDER_STORE = "handles";
const ED_FOLDER_KEY = "repo";
// Asked for with writing allowed, so saving, which comes in a later phase, needs no second prompt.
const ED_FOLDER_MODE = "readwrite";
// the picker opens where it was last used for this
const ED_FOLDER_PICKER_ID = "lunch_money";
// a file the chosen folder must hold to count as the game's folder
const ED_FOLDER_PROOF = "assets/rooms.json";

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

	// A file inside the folder by its path from the folder's top, walked one folder at a time.
	async fileAt(path) {
		const parts = path.split("/").filter((p) => p !== "" && p !== ".");
		let dir = this.handle;
		for (let i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i]);
		const fh = await dir.getFileHandle(parts[parts.length - 1]);
		return fh.getFile();
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
