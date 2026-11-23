// The link between the editor and player tabs. They talk over one browser channel opened by name
// on the same site, and nothing else joins them. Each player tab takes a name of its own: the one
// its page address asks for, when no other open tab has it, or else one picked at random from those
// no other tab has, after asking the others theirs. Its tab title is that name and its room. It tells
// whoever listens which room it is in once named, when its room changes and when the editor asks,
// and says goodbye when the tab closes. The editor switches player tabs on and off for itself, and
// after saving a room tells the ones switched on. One of those in that room reads the room's file
// again and carries on where it was, the way a page refresh comes back from the save; one elsewhere
// reads it then, and builds the room again from it the next time it enters it. The save can also
// carry a drop for the one tab the editor opened, a spot and a layer from control shift P: that tab
// reads the file and starts the saved room afresh with the player dropped there, wherever it was.
// The player never needs the editor: with no editor around nothing arrives, and a browser without
// the channel just leaves the link off. The editor loads this file for the channel's name, the kinds
// of message, the names and the page address it opens a player tab with, and never starts the
// player's side.

// the channel both sides open
const LINK_CHANNEL_NAME = "lunch_money_link";
// the kinds of message: the editor or a new player tab asking who is there, a player saying its
// name and where it is or goodbye, and the editor telling the players it switched on that a room
// was saved, with a drop for one of them or not
const LINK_WHO = "who";
const LINK_HERE = "here";
const LINK_BYE = "bye";
const LINK_SAVED = "saved";
// The names a player tab picks from; once every one is taken, the same names with a number after
// them, from two up, the lowest number with one free.
const LINK_NAMES = ["Bob", "Sam", "Ted", "Max", "Joe", "Gus", "Hank", "Carl"];
// how long a new player tab listens for the names of the others before picking its own, in ms
const LINK_ASK_MS = 250;
// the tab title is the name, this, then the room
const LINK_TITLE_GAP = " - ";
// The player page's address can carry the room to start in, the tab's name, and a drop: a spot in
// that room and the layer to put the player on there. The editor's control P opens a player tab
// this way, with the drop for control shift P, and it works typed by hand too. The drop is used once
// and then taken off the address, so a refresh starts as usual.
const LINK_ROOM_PARAM = "room";
const LINK_NAME_PARAM = "name";
const LINK_X_PARAM = "x";
const LINK_Y_PARAM = "y";
const LINK_LAYER_PARAM = "layer";

// A name none of the taken ones: one of the names at random, or when all are taken, one at random
// with the lowest number after it that leaves some free. Player tabs pick their own this way, and
// the editor one for a tab it opens.
function linkPickName(taken) {
	for (let n = 1; ; n++) {
		const free = LINK_NAMES.map((nm) => (n === 1 ? nm : nm + n)).filter((nm) => !taken.includes(nm));
		if (free.length > 0) return free[Math.floor(Math.random() * free.length)];
	}
}

const PlayerLink = {
	channel: null,
	// empty until picked, and until then the tab only listens for the names of the others
	name: "",
	// the room last told, so a change of room is told once
	lastRoomi: -1,

	// Opens the channel, asks the other tabs their names, then takes the one asked for when it is
	// free or else picks one, unless the browser has no such channel.
	start(target, wanted) {
		if (typeof BroadcastChannel === "undefined") return;
		try {
			this.channel = new BroadcastChannel(LINK_CHANNEL_NAME);
		} catch (e) {
			return;
		}
		const taken = [];
		this.channel.onmessage = (e) => {
			const m = e.data;
			if (m === null || typeof m !== "object") return;
			if (this.name === "") {
				if (m.kind === LINK_HERE && typeof m.name === "string") taken.push(m.name);
				return;
			}
			if (m.kind === LINK_WHO) {
				this.here();
				return;
			}
			if (m.kind !== LINK_SAVED) return;
			const d = m.drop;
			const drop = d !== null && typeof d === "object" && d.name === this.name && isFinite(d.x) && isFinite(d.y) && typeof d.layer === "string"
				? { x: d.x, y: d.y, layer: d.layer } : undefined;
			if (drop === undefined && !(Array.isArray(m.names) && m.names.includes(this.name))) return;
			const rmi = game.findRoomIndex(m.room);
			if (rmi < 0) return;
			// With a drop the saved room starts afresh with the player dropped, or as usual when the
			// layer is switched off in play. Otherwise where the player is once the file is in
			// decides: in that room it is built again and play comes back as the save keeps it,
			// anywhere else the room waits to be built again on the way in. A player who is dead
			// comes back at the room's start, as a restart does.
			game.freshenRoom(rmi).then(() => {
				if (drop !== undefined) {
					if (game.enterRoom(rmi, drop)) Save.write();
					return;
				}
				if (game.curroomi !== rmi) {
					game.rooms[rmi].textNewer = true;
					return;
				}
				const sv = Save.snapshot();
				if (game.enterRoom(rmi)) {
					Save.restore(sv);
					Save.write();
				}
			}, (err) => console.warn("room " + game.rooms[rmi].name + " sprites failed to load", err));
		};
		this.channel.postMessage({ kind: LINK_WHO });
		// the room is told on the next update once named
		setTimeout(() => {
			this.name = typeof wanted === "string" && wanted !== "" && !taken.includes(wanted) ? wanted : linkPickName(taken);
		}, LINK_ASK_MS);
		const bye = () => {
			if (this.name !== "") this.channel.postMessage({ kind: LINK_BYE, name: this.name });
		};
		target.addEventListener("pagehide", bye);
		target.addEventListener("beforeunload", bye);
	},

	// Tells the editor this tab's name and room.
	here() {
		this.channel.postMessage({ kind: LINK_HERE, name: this.name, room: game.curroom !== null ? game.curroom.name : "" });
	},

	// Each frame once named: a change of room is told and goes in the tab title, the first room too.
	update() {
		if (this.channel === null || this.name === "" || game.curroomi === this.lastRoomi) return;
		this.lastRoomi = game.curroomi;
		document.title = this.name + (game.curroom !== null ? LINK_TITLE_GAP + game.curroom.name : "");
		this.here();
	}
};
