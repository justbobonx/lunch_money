#!/usr/bin/env python3
"""Writes the generated list the page needs because a browser cannot list a folder:

  assets/unported_object_list.json  every original object and its parent, read from the GM object folders

usage: make_asset_lists.py <lunch_money dir> [<gm objects dir>]
"""
import glob, json, os, re, sys

root = sys.argv[1]
objects_dir = sys.argv[2] if len(sys.argv) > 2 else "/workspace/gm2_legacy/objects"
assets = os.path.join(root, "assets")

# object parents, from each object's definition file
tree = {}
for p in sorted(glob.glob(os.path.join(objects_dir, "*", "*.yy"))):
    name = os.path.basename(p)[:-3]
    text = open(p, encoding="utf8").read()
    m = re.search(r'"parentObjectId"\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"', text)
    tree[name] = m.group(1) if m else None
with open(os.path.join(assets, "unported_object_list.json"), "w") as f:
    json.dump({"parents": tree}, f, indent="\t")
    f.write("\n")
print("objects", len(tree))
