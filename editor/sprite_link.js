// Opening the sprite editor from the room editor: an E click on a palette cell, or on an
// entry in the room, asks the named tab to show that sprite, leaving this editor in front
// when that tab is already open.

// the same channel the sprite editor already listens on, and the fixed name of its tab
const ED_SPRITE_EDITOR_CHANNEL = "lunch_money_sprite_editor";
const ED_SPRITE_EDITOR_WINDOW = "lunch_money_sprite_editor";
const ED_SPRITE_EDITOR_PAGE = "sprite_editor.html";
const ED_SPRITE_EDITOR_PARAM = "sprite";
// the status line when the clicked object or entry has no picture of its own
const ED_SPRITE_EDITOR_NO_SPRITE = " that has no sprite";

const EdSpriteLink = {
	channel: null,
	win: null,

	// Opens the sprite editor for a name. A tab already open is only asked to switch, so focus
	// stays here and more E clicks can follow; otherwise a new tab opens with the name in the
	// page address. The blank stand-in and a missing name are refused, so an object with no
	// sprite is left alone.
	open(name) {
		if (name === null || name === undefined || name === "" || name === ED_BLANK_SPRITE) {
			Editor.debugtxt = ED_SPRITE_EDITOR_NO_SPRITE;
			return;
		}
		if (this.channel === null && typeof BroadcastChannel !== "undefined") {
			try {
				this.channel = new BroadcastChannel(ED_SPRITE_EDITOR_CHANNEL);
			} catch (e) {}
		}
		const url = ED_SPRITE_EDITOR_PAGE + "?" + ED_SPRITE_EDITOR_PARAM + "=" + encodeURIComponent(name);
		if (this.win !== null && !this.win.closed) {
			if (this.channel !== null) this.channel.postMessage({ sprite: name });
			return;
		}
		const win = window.open(url, ED_SPRITE_EDITOR_WINDOW);
		this.win = win;
		if (win !== null) win.focus();
	}
};
