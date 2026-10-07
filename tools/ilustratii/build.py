"""Construiește imaginile exercițiilor din setul gratuit RepDB (repdb.co).

  python3 tools/ilustratii/build.py <cale către clona github.com/repdb/repdb>

Citește db/seed/ilustratii-repdb.json, lipește cele două cadre (start | final) ale fiecărui exercițiu
într-o imagine 16:9 în apps/web/public/exercitii/<slug>.webp și completează câmpurile de imagine,
sursă, licență și atribuire din db/seed/library.json. Imaginile RepDB nu se redistribuie ca set de date:
aici sunt folosite doar în aplicație, cu atribuirea cerută de licență (vezi docs/ilustratii-exercitii.md).
"""
import json, os, sys
from PIL import Image

root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
src = sys.argv[1]
mapping = json.load(open(os.path.join(root, "db/seed/ilustratii-repdb.json"), encoding="utf-8"))
out_dir = os.path.join(root, "apps/web/public/exercitii")
os.makedirs(out_dir, exist_ok=True)
W, H = 1024, 576

def frames(rid, order):
    p = lambda k: os.path.join(src, "images/flat", f"{rid}-{k}.webp")
    if os.path.exists(p("main")):
        return [Image.open(p("main")).convert("RGB")]
    return [Image.open(p(k)).convert("RGB") for k in (order or ["start", "peak"])]

for slug, m in mapping["exercitii"].items():
    ims = frames(m["repdb"], m.get("ordine"))
    canvas = Image.new("RGB", (W, H), ims[0].getpixel((4, 4)))
    side = 512 if len(ims) > 1 else H  # un singur cadru: pe toată înălțimea
    x = (W - side * len(ims)) // 2
    for i, im in enumerate(ims):
        canvas.paste(im.resize((side, side), Image.LANCZOS), (x + side * i, (H - side) // 2))
    canvas.save(os.path.join(out_dir, f"{slug}.webp"), "WEBP", quality=82, method=6)

lib_path = os.path.join(root, "db/seed/library.json")
lib = json.load(open(lib_path, encoding="utf-8"))
for e in lib["exercises"]:
    if e["slug"] in mapping["exercitii"]:
        e.update(image_url=f"/exercitii/{e['slug']}.webp", source=mapping["sursa"], license=mapping["licenta"], attribution=mapping["atribuire"])
with open(lib_path, "w", encoding="utf-8") as f:
    json.dump(lib, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(len(mapping["exercitii"]), "imagini")
