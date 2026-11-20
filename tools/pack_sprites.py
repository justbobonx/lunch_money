# Pack the loose sprite source folders into sheets for shipping.
# Each sprites/src/<group>/ folder becomes sprites/<group>.png plus sprites/<group>.json,
# or <group>_2 and so on when a group does not fit in one sheet.
# The sheet json lists every sprite with its frame rectangles, and image_file is relative to the json.
# sprites/sheets.json lists the packed sheets, and sprites/src/index.json is rebuilt from the loose source.
# Usage:
#   pack_sprites.py <sprites folder> --groups guy,ofm_tem
#   pack_sprites.py <sprites folder> --room <room.dat> [--names-file <text>] [--groups ...]
#   pack_sprites.py <sprites folder> --all
#   pack_sprites.py <sprites folder> --list
# Groups packed earlier and not named again stay packed. Use --unpack to drop groups from the packed list.
import json, os, re, sys, glob, argparse
from PIL import Image

MAX_SHEET_SIDE = 2048
# blank pixels between frames so neighbours never bleed into each other
GAP = 1


def read_src(src_dir):
    groups = {}
    for gdir in sorted(glob.glob(os.path.join(src_dir, "*", ""))):
        group = os.path.basename(os.path.dirname(gdir))
        sprites = {}
        for jpath in sorted(glob.glob(os.path.join(gdir, "*.json"))):
            name = os.path.basename(jpath)[:-5]
            png = os.path.join(gdir, name + ".png")
            if not os.path.exists(png):
                print("warning: no png for", jpath)
                continue
            sprites[name] = (json.load(open(jpath)), png)
        if sprites:
            groups[group] = sprites
    return groups


def write_index(src_dir, groups):
    index = {}
    for group, sprites in groups.items():
        for name, (rec, _) in sprites.items():
            if name in index:
                print("warning: sprite name", name, "is in both", index[name]["group"], "and", group)
            index[name] = {k: rec[k] for k in ("w", "h", "frames", "ox", "oy", "mask", "image_speed")}
            index[name]["group"] = group
    json.dump({"sprites": index}, open(os.path.join(src_dir, "index.json"), "w"), separators=(",", ":"))
    return index


def pack_group(group, sprites):
    # shelf packing in name order, a sprite never splits across sheets
    sheets = [[]]
    placements = [{}]
    x = y = row_h = 0
    for name in sorted(sprites):
        rec, png = sprites[name]
        w, h, n = rec["w"], rec["h"], rec["frames"]
        if w > MAX_SHEET_SIDE or h > MAX_SHEET_SIDE:
            raise ValueError("%s is larger than a sheet" % name)
        # try the current sheet with a copy of the cursor
        tx, ty, trow = x, y, row_h
        frames = []
        for i in range(n):
            if tx + w > MAX_SHEET_SIDE:
                tx, ty, trow = 0, ty + trow + GAP, 0
            frames.append([tx, ty, w, h])
            tx += w + GAP
            trow = max(trow, h)
        if ty + trow > MAX_SHEET_SIDE and sheets[-1]:
            # start a new sheet and place again from the corner
            sheets.append([])
            placements.append({})
            x = y = row_h = 0
            tx, ty, trow = 0, 0, 0
            frames = []
            for i in range(n):
                if tx + w > MAX_SHEET_SIDE:
                    tx, ty, trow = 0, ty + trow + GAP, 0
                frames.append([tx, ty, w, h])
                tx += w + GAP
                trow = max(trow, h)
            if ty + trow > MAX_SHEET_SIDE:
                raise ValueError("%s does not fit in one sheet" % name)
        x, y, row_h = tx, ty, trow
        sheets[-1].append(name)
        placements[-1][name] = frames
    out = []
    for i, names in enumerate(sheets):
        label = group if i == 0 else "%s_%d" % (group, i + 1)
        out.append((label, names, placements[i]))
    return out


def write_sheet(sprites_dir, label, names, placements, sprites):
    width = max(f[0] + f[2] for n in names for f in placements[n])
    height = max(f[1] + f[3] for n in names for f in placements[n])
    sheet = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    records = {}
    for name in names:
        rec, png = sprites[name]
        strip = Image.open(png).convert("RGBA")
        for i, f in enumerate(placements[name]):
            sheet.paste(strip.crop((i * rec["w"], 0, (i + 1) * rec["w"], rec["h"])), (f[0], f[1]))
        records[name] = {"w": rec["w"], "h": rec["h"], "ox": rec["ox"], "oy": rec["oy"], "mask": rec["mask"],
                         "image_speed": rec["image_speed"], "frames": placements[name]}
    sheet.save(os.path.join(sprites_dir, label + ".png"))
    json.dump({"image_file": label + ".png", "sprites": records}, open(os.path.join(sprites_dir, label + ".json"), "w"), indent=0, separators=(",", ":"))
    return width, height


def names_from_room(path):
    return set(re.findall(r'"spi"\s*:\s*"([^"]+)"', open(path).read()))


def names_from_text(path, known):
    # words in a free text list, a trailing star stands for every sprite with that start
    found = set()
    for tok in re.findall(r"[A-Za-z0-9_]+\*?", open(path).read()):
        if tok.endswith("*"):
            found.update(n for n in known if n.startswith(tok[:-1]))
        elif tok in known:
            found.add(tok)
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sprites_dir")
    ap.add_argument("--groups", default="")
    ap.add_argument("--room", action="append", default=[])
    ap.add_argument("--names-file", action="append", default=[])
    ap.add_argument("--prefix", action="append", default=[], help="pack groups holding a sprite with this name start")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--unpack", default="")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()

    sprites_dir = a.sprites_dir
    src_dir = os.path.join(sprites_dir, "src")
    groups = read_src(src_dir)
    index = write_index(src_dir, groups)
    sheets_path = os.path.join(sprites_dir, "sheets.json")
    current = json.load(open(sheets_path))["sheets"] if os.path.exists(sheets_path) else []

    if a.list:
        packed = {s["group"] for s in current}
        for g in sorted(groups):
            print("%-28s %4d sprites %s" % (g, len(groups[g]), "packed" if g in packed else "loose"))
        return

    want = set(g for g in a.groups.split(",") if g)
    if a.all:
        want = set(groups)
    names = set()
    for r in a.room:
        names |= names_from_room(r)
    for t in a.names_file:
        names |= names_from_text(t, index)
    for n in sorted(names):
        if n in index:
            want.add(index[n]["group"])
    for p in a.prefix:
        want |= {index[n]["group"] for n in index if n.startswith(p)}
    unpack = set(g for g in a.unpack.split(",") if g)
    missing = sorted(w for w in want if w not in groups)
    if missing:
        sys.exit("unknown groups: " + ", ".join(missing))

    # drop old sheets of everything being repacked or unpacked
    redo = want | unpack
    keep = []
    for s in current:
        if s["group"] in redo or s["group"] not in groups:
            for ext in (".png", ".json"):
                p = os.path.join(sprites_dir, s["file"][:-5] + ext)
                if os.path.exists(p):
                    os.remove(p)
        else:
            keep.append(s)
    new = []
    for g in sorted(want - unpack):
        for label, names_, placements in pack_group(g, groups[g]):
            w, h = write_sheet(sprites_dir, label, names_, placements, groups[g])
            new.append({"file": label + ".json", "group": g, "sprites": len(names_), "size": [w, h]})
            print("packed %-28s %3d sprites %dx%d" % (label, len(names_), w, h))
    sheets = sorted(keep + new, key=lambda s: s["file"])
    json.dump({"sheets": sheets}, open(sheets_path, "w"), indent=1)
    print("sheets.json lists", len(sheets), "sheets")


main()
