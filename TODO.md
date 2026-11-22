# To do

## Port

- Carryables still to port: oPutter, oBallTopd, oBikeTopd.
- Held items (the rocket pack, the flame thrower) don't flicker as in the original: a held item is hidden, and hidden objects don't animate. Handle it with the carryables.
- oNpcChar and the give and take script actions. Giving an item (letting go of it on someone who accepts) empties the hand but leaves the item in the giver's inventory list, as in the original; fix it with this.
- World save. Right now the save keeps only the room, the player's spot and facing, and whether each of the room's layers is switched on. The plan for the full save:
  - Each class lists the fields it saves in a static list; the ship potted plant saves its frame.
  - Those fields are kept per room and object name, only when they differ from the object's start in the room file.
  - They are laid back onto each object where the room is built (the saved object states todo in the room build), before init runs.
  - The script state (setInstState, adjInstState, setGameState and their checks) goes through the same store and is saved with it.
  - Clearing the world stops wiping the game and object state; ctrl R restarts the room but keeps the world state, and a separate debug key wipes it.
  - The inventory, the player's status and copying state between player characters come with the carryables.
  - In the original only the ship potted plant (its look) and eaoChest (open) saved object state. oChest's list of open, locked and contents was for copying objects in the editor, not saving, and the analyzer saved nothing. The original also saved the room's layer states but never read them back.
- Locker contents are not saved: whatever is moved into or out of an oShipLocker is lost when the room reloads (restart, room picker, a fresh visit), and its start items come back. Goes with the world save.
- The ship console screen leaves out the original's choice menu (screenacttree, the prompt with the blinking cursor) and the consoles' actonScript room setting, which nothing runs (on the teleport console it only loops a sparkle script, flavour). Port them when a console needs a real menu.
- Pre-draw events don't run.
- oEdgeGroup is missing from the source.
- Missing sprites: sGameBoxV, guy_stand_2, s_city_roof_wh, sBlock, s_egg, s_tnt, s_honeycomb.
- Stand-in objects get only their parent's behavior, not the original's own create settings (oGrGrass was one, now ported). Each remaining stand-in needs a real class or room config.
- eaoHole: a top down floor zone that drops the player into a hole (fall animation, half a life, a short respawn script). No room uses it yet; needs the fall-in-hole pieces.
- oBoat: when ported, it should run the floor zone check with real speed values like the player does; the original passed none, which would break the sideways slope.
- Script action stubs that only log a not-ported notice (marked in the code).
- Sound: the spark's zap should be cut off after 3 to 8 updates and when the spark is destroyed; it only logs for now.
- oShark is not ported; its turn poof and its float death spray (the original's killGuyFloat) come with it.

### GM quirks kept for now (remove eventually)
- Stand-ins: unported_object_list.json and the Standins class give unported objects their GM parent behavior; both go once everything rooms use is ported.
- oBoxFall never lowers its life, so it never destroys itself.
- The swimming rat spawns a bubble every update.
- oDoor's default room roomLIlHouse isn't in the room list, so a door goes nowhere unless its room entry sets one.
- whynot: the player's layer starts disabled.
- oPuzBox: the puzzle box minigame (colors, guys, letters, numbers; timer and score), about 1400 lines in the original. Pl_Autumn has eight trig_pb triggers along its left edge that each make one with a different box_type, into the pop up layer. Wanted on a high layer.
- Death sprays follow whoever did the killing and pass through it: every batch comes from the killer's spot (the rat, the log, the hard landing's own character). Script deaths have no killer here and follow the player; the original followed the script runner, which sits at its trigger.
- Bubbles count up two each update (the original counts once and again for the wobble), so they fade after 300 updates and are gone at 350, and the wobble jumps back to its start every 80 updates, part way through a swing.
- The foreground water tiler repeats whole tiles until it passes its stretched size, so a stretch that isn't a whole number of tiles draws a little past its edge (TestDev's water by a pixel each way).
- Glass shards come from the glass's own spot, not where it was hit.
- A particle only checks the first solid it overlaps, so one inside the followed object stops on nothing else there.
- Blood that stops on a solid with no lifetime stays until revive or a room switch, keeping its burst alive with it.
- The top down death splatter never runs: the original never sets how much to splatter.
- Angles still use GM's convention: degrees, counterclockwise, with y down (pointDirection, lengthdir and everything built on them). Convert to radians and the usual JS direction later.

## Question

- Sim pause still lets the camera run (following, zoom, pans and the shake countdown); should it freeze it?
- No pause while the inventory or console screen is up, as in the original: the world keeps running and only the player's controls are off. Should enemies freeze while a screen is open?
- Objects with tile flags now tile instead of stretching (oGolfGreen stand-ins in OutForMilk); is that right?
- JumpRoom's chest has an openScript in its room entry that nothing in the original ever ran; should chests run it on opening?
- Stand-in presets (like oGrGrass was): small classes or room config?
- Start room is TestDev, overriding world.dat's OutForMilk; keep while testing?
- The swim boost poof goes at the bottom of the player's layer as the original asked, so it draws behind everything there; in the original its particles were separate objects added on top of the layer, so they drew in front. Keep it behind, or put it on top?
- Changed from the original: jumping out of water now makes the same splash as going in, at the player's spot on the water's top. The original let out a different, smaller burst from the water object's own spot, usually its top left corner.
- Changed from the original: a robin scared in the middle of a hop now just flies off. The original kept the hop going on top of the flight for that one trip, so the bird also fell by the hop's gravity while flying away.
- Changed from the original: a robin that has flown out of view is hidden by turning it invisible rather than the original's separate hidden flag. It keeps living while hidden, as before, so it can still hop, peck or be scared off again unseen.
- Changed from the original: weather moves each update instead of each drawn frame, so it keeps update pace and stops while play is paused.
- Changed from the original: weather is shared out only over the room's own layers that are switched on and not overlay layers, so areas switched off don't take a share that never shows, and it never draws over the HUD or popups. The original shared it over every layer, the switched off and overlay ones too.
- Changed from the original: each weather drop takes its kind's random speed times its layer's; the original also sped each drop up a little more than the one before it in a layer, so the last of a layer's rain went about twice as fast as the first.
- Changed from the original: the weather debug keys are control G (on and off) and control shift G (next kind) instead of control W, which the browser keeps for closing the tab. They work any time, like the other debug keys; the original only took them when started from the editor.
- Changed from the original: only looking at the bike gets the player on it. The original got him on for any action, touching and hitting it too.
- Changed from the original: a rider who dies or is hit falls off the bike, keeping the speed the death or the knock gave him. The original kept him pinned to it.
- Particles use plain random, while the rest of the port uses its seeded generator; switch them if replays ever matter.

## Fix

- Collision has no broad pass: every place check walks all instances (GM's runner used a spatial tree), so many movers like the 30 rats bury the fps. Discuss design: a grid for non-movers, a short list for movers, creation order kept; also the catch-up loop snowballing when steps run long.
- Blank marker sprites (sBlankGrCtr, sBlankPr and the other sBlank ones) should be editor only: mark them in their sprite json and have the draw skip them. Then climbables need no visibility default; ladders show and blank climb zones stay hidden. Right now blank climb zones show a translucent green block in play.
- Tiling glitches: a small glitch in background tiling, and sprite part draws sometimes off by a pixel; likely also affects the popup backing box (bgSquare).
- Objects with no sprite need a mask size from their config (width and height or a rectangle).
- A camera pan time with no value snaps instantly.
- The single circle check builds the full list of matches only to return the first; make it stop at the first hit.
- No outside-room check, since rooms have no fixed bounds.
- Particles on a parallax or looping layer do not shift with it the way objects do; none of the placed emitters sit on one.
- Mixin field clashes: the pickup item switch is now itemOn, since active is the engine flag; also owner of carriedBy and over_con, the acton rule.
- A button held when a screen or message box closes leaks its release into play: press the drop button in the inventory, close it while still holding, let go, and the player drops what's in hand.
- In loose sprite mode, sprites only spawned at runtime (star1, sShootingStar, s_snow_poof, sAniPop, the robin family's other birds and their eat, fly and shadow sprites, the sheep's walk and eat sprites, the weather drops) may not load; packed mode loads all.
- A pose name with a suffix that has no sprite (guy has no swim boost sprite, swim with carry and other combos nobody drew) falls straight back to stand; drop suffixes from the end until a sprite exists instead. Guy also needs a swim boost sprite made.
- Graphics issues reported by the user, details to come.
- Physics and collision issues reported by the user, details to come.

## Later

- Sprite data editing: adding a loose sprite means hand-writing its json and keeping sprites/src/index.json in sync, which is extra steps for whoever makes the art. When the editor comes, give it a way to edit a sprite's data (size, frames, origin, mask, speed, group) and rebuild the index itself.
- Layer name wildcards: the star only works as a suffix (starts with). Add more options, such as a leading star for ends with, stars on both ends for contains, or a star in the middle.
- The font list is hardcoded in draw.js (FONT_NAMES); generate it from the fonts folder like the object file map or the asset lists.
- Room picker has no gamepad support.
- Drawing the room at 640×360 instead of full screen resolution, if fps is still poor in heavier rooms.
