// Placeholders for objects not ported yet. Each keeps its real parent, so it collides and draws like it.

class oBouncer extends oObject {
	constructor() {
		super();
		this.spd = 0;
	}
}
oBouncer.ported = false;

class oTank extends oObject {
	constructor() {
		super();
		this.initMoveable();
	}
}
oTank.ported = false;

class oAniSpark extends oBgObject {}
oAniSpark.ported = false;

class oGameBoxV extends oIaBgObject {}
oGameBoxV.ported = false;

class oBike extends oIaBgObject {}
oBike.ported = false;

class oNpcChar extends oActor {}
oNpcChar.ported = false;
