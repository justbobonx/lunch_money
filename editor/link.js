// The editor's side of the link to player tabs, over the channel the player opens. On starting it
// asks who is there, then keeps a list of the player tabs from what they tell: their name, the
// room they are in, and whether this editor switched them on. Every tab starts switched off, except
// the one this editor opened itself, and the switches last only while the editor is open; nothing
// of them goes in the room or world files. After each save the switched on tabs are told which room
// was saved, and the tab this editor opened is given control shift P's drop with it. A browser
// without the channel just never lists any player.

const EdLink = {
	channel: null,
	// the player tabs in the order they were first heard from: name, room, switched on or not
	players: [],
	// the player tab this editor opened with control P, its window and name, kept until the editor
	// reloads; it is switched on whenever it is heard from anew, a refresh of it too
	opened: null,

	start() {
		if (typeof BroadcastChannel === "undefined") return;
		try {
			this.channel = new BroadcastChannel(LINK_CHANNEL_NAME);
		} catch (e) {
			return;
		}
		this.channel.onmessage = (e) => {
			const m = e.data;
			if (m === null || typeof m !== "object" || typeof m.name !== "string") return;
			const i = this.players.findIndex((p) => p.name === m.name);
			if (m.kind === LINK_BYE) {
				if (i >= 0) this.players.splice(i, 1);
			} else if (m.kind === LINK_HERE) {
				const room = typeof m.room === "string" ? m.room : "";
				if (i >= 0) this.players[i].room = room;
				else this.players.push({ name: m.name, room: room, on: this.opened !== null && m.name === this.opened.name });
			}
		};
		this.channel.postMessage({ kind: LINK_WHO });
	},

	// Tells the switched on player tabs a room was saved, when any are, and gives a drop, when there
	// is one, to the tab this editor opened while it is open, switched on or not.
	saved(name, drop) {
		const names = this.players.filter((p) => p.on).map((p) => p.name);
		const to = drop !== undefined && this.opened !== null && !this.opened.win.closed
			? { name: this.opened.name, x: drop.x, y: drop.y, layer: drop.layer } : undefined;
		if (this.channel !== null && (names.length > 0 || to !== undefined)) this.channel.postMessage({ kind: LINK_SAVED, room: name, names: names, drop: to });
	},

	// Control P, once the room is saved: the player tab this editor opened comes to the front, already
	// told of the save when switched on and given the drop with it. With none open, a new tab opens
	// in the room with a name no listed tab has, and the drop when there is one.
	play(room, drop) {
		if (this.opened !== null && !this.opened.win.closed) {
			this.opened.win.focus();
			return;
		}
		const name = linkPickName(this.players.map((p) => p.name));
		const q = new URLSearchParams();
		q.set(LINK_ROOM_PARAM, room);
		q.set(LINK_NAME_PARAM, name);
		if (drop !== undefined) {
			q.set(LINK_X_PARAM, String(drop.x));
			q.set(LINK_Y_PARAM, String(drop.y));
			q.set(LINK_LAYER_PARAM, drop.layer);
		}
		const win = window.open("index.html?" + q.toString(), "_blank");
		this.opened = win !== null ? { win: win, name: name } : null;
		if (win !== null) win.focus();
	}
};
