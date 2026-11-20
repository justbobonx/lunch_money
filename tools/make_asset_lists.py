#!/usr/bin/env python3
"""Writes the two generated lists the page needs because a browser cannot list a folder.

  assets/rooms.json        which room files and optional world files are present
  assets/object_tree.json  every original object and its parent, read from the GM object folders

usage: make_asset_lists.py <lunch_money dir> [<gm objects dir>]
"""
import glob, json, os, re, sys

root = sys.argv[1]
objects_dir = sys.argv[2] if len(sys.argv) > 2 else "/workspace/gm2_legacy/objects"
assets = os.path.join(root, "assets")

# room files, in the world file's order when there is one, then any extras alphabetically
names = sorted(re.match(r"room_(.+)\.dat$", os.path.basename(p)).group(1)
               for p in glob.glob(os.path.join(assets, "room_*.dat")))
order = []
world_path = os.path.join(assets, "world.dat")
if os.path.exists(world_path):
    world = json.load(open(world_path, encoding="utf8"))
    order = [r["name"] for r in world["rooms"]]
ordered = [n for n in order if n in names] + [n for n in names if n not in order]

rooms = {
    "rooms": [{"name": n, "file": "room_%s.dat" % n,
               "obj_defs": os.path.exists(os.path.join(assets, "%s_obj_defs.dat" % n))} for n in ordered],
    "world_scripts": os.path.exists(os.path.join(assets, "world_scripts.dat")),
    # the original's file name for the goals has this spelling
    "world_goals": os.path.exists(os.path.join(assets, "world_golas.dat")),
}
with open(os.path.join(assets, "rooms.json"), "w") as f:
    json.dump(rooms, f, indent="\t")
    f.write("\n")

# object parents, from each object's definition file
tree = {}
for p in sorted(glob.glob(os.path.join(objects_dir, "*", "*.yy"))):
    name = os.path.basename(p)[:-3]
    text = open(p, encoding="utf8").read()
    m = re.search(r'"parentObjectId"\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"', text)
    tree[name] = m.group(1) if m else None
with open(os.path.join(assets, "object_tree.json"), "w") as f:
    json.dump({"parents": tree}, f, indent="\t")
    f.write("\n")
print("rooms", len(ordered), "objects", len(tree))
