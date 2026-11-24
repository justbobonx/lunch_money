// Placeholders for objects not ported yet. Each keeps its real parent, so it collides and draws like it.

class oBouncer extends oObject {
	constructor() {
		super();
		this.spd = 0;
	}
}
oBouncer.ported = false;

class oGameBoxV extends oIaBgObject {}
oGameBoxV.ported = false;
