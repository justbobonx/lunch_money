# To do

## Port

- Carryables still to port: oPutter, oBallTopd, oBike, oBikeTopd.
- oNpcChar and the give and take script actions. Giving an item (letting go of it on someone who accepts) empties the hand but leaves the item in the giver's inventory list, as in the original; fix it with this.
- Saved object state: the original kept some fields per object across saves and room changes (the chest's open, locked and kind of contents, the ship potted plant's and analyzer's look). The port has no such list yet, so these start fresh each time a room loads.
- Locker contents are not saved: whatever is moved into or out of an oShipLocker is lost when the room reloads (restart, room picker, a fresh visit), and its start items come back. Goes with saved object state.
- The ship console screen leaves out the original's choice menu (screenacttree, the prompt with the blinking cursor) and the consoles' actonScript room setting, which nothing runs (on the teleport console it only loops a sparkle script, flavour). Port them when a console needs a real menu.
- Pre-draw events don't run.
- oEdgeGroup is missing from the source.
- Missing sprites: sGameBoxV, guy_stand_2, s_city_roof_wh, sBlock, s_egg, s_tnt, s_honeycomb.
- Stand-in objects get only their parent's behavior, not the original's own create settings (oGrGrass was one, now ported). Each remaining stand-in needs a real class or room config.
- eaoHole: a top down floor zone that drops the player into a hole (fall animation, half a life, a short respawn script). No room uses it yet; needs the fall-in-hole pieces.
- oBoat: when ported, it should run the floor zone check with real speed values like the player does; the original passed none, which would break the sideways slope.
- Script action stubs that only log a not-ported notice (marked in the code).
- oBubble: side view swimming asks for a bubble every two seconds and only logs until oBubble is ported.
- oShark is not ported; its turn poof and its float death spray (the original's killGuyFloat) come with it.

### GM quirks kept for now (remove eventually)
- Stand-ins: unported_object_list.json and the Standins class give unported objects their GM parent behavior; both go once everything rooms use is ported.
- Dog stop clears a misspelled field, so it still remembers the ball.
- oBoxFall never lowers its life, so it never destroys itself.
- The ball bounce test only checks speed.
- The swimming rat spawns a bubble every update.
- oDoor's default room roomLIlHouse isn't in the room list, so a door goes nowhere unless its room entry sets one.
- whynot: the player's layer starts disabled.
- oPuzBox: the puzzle box minigame (colors, guys, letters, numbers; timer and score), about 1400 lines in the original. Pl_Autumn has eight trig_pb triggers along its left edge that each make one with a different box_type, into the pop up layer. Wanted on a high layer.
- OFM_underwater: star field veloy is written as 0.0-2, probably meant 0.02.
- Death sprays follow whoever did the killing and pass through it: every batch comes from the killer's spot (the rat, the log, the hard landing's own character). Script deaths have no killer here and follow the player; the original followed the script runner, which sits at its trigger.
- The swim jump water burst comes from the water object's own spot, usually its top left corner, not the player.
- Glass shards come from the glass's own spot, not where it was hit.
- A particle only checks the first solid it overlaps, so one inside the followed object stops on nothing else there.
- Blood that stops on a solid with no lifetime stays until revive or a room switch, keeping its burst alive with it.
- The top down death splatter never runs: the original never sets how much to splatter.

## Question

- Sim pause still lets the camera and decor animation run; should it freeze them?
- No pause while the inventory or console screen is up, as in the original: the world keeps running and only the player's controls are off. Should enemies freeze while a screen is open?
- Objects with tile flags now tile instead of stretching (oGolfGreen stand-ins in OutForMilk); is that right?
- JumpRoom's chest has an openScript in its room entry that nothing in the original ever ran; should chests run it on opening?
- Stand-in presets (like oGrGrass was): small classes or room config?
- Start room is TestDev, overriding world.dat's OutForMilk; keep while testing?
- The swim boost poof goes at the bottom of the player's layer as the original asked, so it draws behind everything there; in the original its particles were separate objects added on top of the layer, so they drew in front. Keep it behind, or put it on top?
- Particles use plain random, while the rest of the port uses its seeded generator; switch them if replays ever matter.

## Fix

- Collision has no broad pass: every place check walks all instances (GM's runner used a spatial tree), so many movers like the 30 rats bury the fps. Discuss design: a grid for non-movers, a short list for movers, creation order kept; also the catch-up loop snowballing when steps run long.
- Timing inside draw: logic that waits on an animation ending (doors) depends on drawing; things that move or decide inside draw (the star field, the bird's dip) run once per drawn frame rather than per update, so they slow down when a frame covers two updates; held items never animate because animation runs in the layer draw, which skips hidden things (the rocket pack and flame thrower flicker in the original). Move all of it into update.
- Blank marker sprites (sBlankGrCtr, sBlankPr and the other sBlank ones) should be editor only: mark them in their sprite json and have the draw skip them. Then climbables need no visibility default; ladders show and blank climb zones stay hidden. Right now blank climb zones show a translucent green block in play.
- Tiling glitches: a small glitch in background tiling, and sprite part draws sometimes off by a pixel; likely also affects the popup backing box (bgSquare).
- Objects with no sprite need a mask size from their config (width and height or a rectangle).
- A camera pan time with no value snaps instantly.
- No outside-room check, since rooms have no fixed bounds.
- Particles on a parallax or looping layer do not shift with it the way objects do; none of the placed emitters sit on one.
- Mixin field clashes: the pickup item switch is now itemOn, since active is the engine flag; also owner of carriedBy and over_con, the acton rule.
- A button held when a screen or message box closes leaks its release into play: press the drop button in the inventory, close it while still holding, let go, and the player drops what's in hand.
- In loose sprite mode, sprites only spawned at runtime (star1, sShootingStar, s_snow_poof, sAniPop) may not load; packed mode loads all.
- Graphics issues reported by the user, details to come.
- Physics and collision issues reported by the user, details to come.

## Later

- Sprite data editing: adding a loose sprite means hand-writing its json and keeping sprites/src/index.json in sync, which is extra steps for whoever makes the art. When the editor comes, give it a way to edit a sprite's data (size, frames, origin, mask, speed, group) and rebuild the index itself.
- Layer name wildcards: the star only works as a suffix (starts with). Add more options, such as a leading star for ends with, stars on both ends for contains, or a star in the middle.
- The font list is hardcoded in draw.js (FONT_NAMES); generate it from the fonts folder like the object file map or the asset lists.
- Room picker has no gamepad support.
- Drawing the room at 640×360 instead of full screen resolution, if fps is still poor in heavier rooms.
