# -*- coding: utf-8 -*-
"""
小食堂 · 数据生成脚本
====================
从调研抓取的原始数据（E:/vibe/.research/）生成网站用的精简 JSON：
  - windows.json + dishes.json  (map.hgu.life 公开接口)
  - map-all.json               (map.hgu.life 地图 POI)
  - qinghe-dishes.js           (轻禾轻食档口文案)

用法：python tools/build_data.py
输出：data/canteens.json / windows.json / dishes.json / qinghe.json
"""
import json
import re
from pathlib import Path

RESEARCH = Path("E:/vibe/.research")
OUT = Path(__file__).resolve().parent.parent / "data"

# ---------------------------------------------------------------- 图片 URL 重写
# 参考站数据里封面图域名混杂（admin.hgu.life 已失效），统一改写到可直链的
# img.hgu.life/images/canteen/<文件名>；前端 onerror 时回退到占位图。
def rewrite_img(url: str) -> str:
    if not url:
        return ""
    fname = url.rsplit("/", 1)[-1]
    return f"https://img.hgu.life/images/canteen/{fname}"


# ---------------------------------------------------------------- 食堂信息
CAN_NAME = {1: "惠馨苑", 2: "南苑", 3: "风味苑", 4: "1953街区", 5: "北苑", 6: "其他"}
CAN_FULL = {
    1: "惠馨苑食堂",
    2: "南苑餐厅",
    3: "风味苑食堂",
    4: "1953青春街区",
    5: "北苑餐厅",
    6: "教一楼/服务楼（茶饮水果）",
}
CAN_MAP_POI = {  # 地图 POI 名 → 食堂 id
    "惠馨苑": 1, "南苑餐厅": 2, "风味苑": 3, "1953青春街区": 4,
}
CAN_POINT_POI = {  # 无建筑轮廓、用点位代替
    "教一楼": 6, "服务楼": 6,
}


def douglas_peucker(points, eps):
    if len(points) < 3:
        return points
    start, end = points[0], points[-1]
    def dist(p):
        x0, y0 = start
        x1, y1 = end
        x2, y2 = p
        num = abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1)
        den = ((y2 - y1) ** 2 + (x2 - x1) ** 2) ** 0.5
        return num / den if den else 0
    dmax, idx = 0, 0
    for i in range(1, len(points) - 1):
        d = dist(points[i])
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        left = douglas_peucker(points[: idx + 1], eps)
        right = douglas_peucker(points[idx:], eps)
        return left[:-1] + right
    return [start, end]


def norm_floor(f):
    f = (f or "").strip()
    m = re.match(r"(\d+F)", f)
    return m.group(1) if m else f


def bbox_center(poly):
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return [(min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2]


# ---------------------------------------------------------------- 校园地图图层
MAP_LABEL_KEEP = {"惠馨苑", "南苑餐厅", "风味苑", "1953青春街区", "教一楼", "服务楼",
                  "行政楼", "综合楼", "科研楼", "实验楼", "图书馆", "体育馆", "操场",
                  "正心园", "知行园", "诚意园"}
MAP_LABEL_SUFFIX = ("楼", "园", "道", "馆", "场", "堂", "路", "街")


def _geo(obj):
    try:
        return json.loads(obj.get("geometry", "null"))
    except Exception:
        return None


def extract_map(map_all):
    def polys(key):
        out = []
        for x in map_all.get(key, []) or []:
            g = _geo(x)
            if g and g.get("type") == "Polygon":
                out.append(g["coordinates"][0])
        return out

    def simplify(poly, eps, cap=40):
        p = douglas_peucker([tuple(q) for q in poly], eps)
        if len(p) > cap:  # 超限按等距抽稀
            step = len(p) / cap
            p = [p[int(i * step)] for i in range(cap)]
        return [list(q) for q in p]

    border = polys("bg_border")
    allpts = [q for poly in border for q in poly]
    b = [min(q[0] for q in allpts), min(q[1] for q in allpts),
         max(q[0] for q in allpts), max(q[1] for q in allpts)]

    land = [simplify(p, 2e-6) for p in polys("bg_land")]
    roads = [simplify(p, 2e-6) for p in polys("bg_road") + polys("bg_street")]
    border = [simplify(p, 2e-6, 80) for p in border]

    features = []
    for x in map_all.get("bg_others", []) or []:
        g = _geo(x)
        if g and g.get("type") == "Polygon":
            features.append({"t": x.get("type") or "", "p": simplify(g["coordinates"][0], 3e-6, 24)})

    buildings = []
    for x in map_all.get("building", []) or []:
        g = _geo(x)
        if g and g.get("type") == "Polygon" and x.get("name"):
            buildings.append({
                "n": x["name"],
                "p": simplify(g["coordinates"][0], 2e-6, 36),
                "canteen": 1 if x["name"] in CAN_MAP_POI else 0,
            })

    labels = []
    for x in map_all.get("map_text", []) or []:
        g = _geo(x)
        n = x.get("name") or ""
        if not g or g.get("type") != "Point" or not n:
            continue
        if n in MAP_LABEL_KEEP or n.endswith(MAP_LABEL_SUFFIX):
            labels.append({"n": n, "p": g["coordinates"], "main": x.get("text_type") == "main"})

    return {"b": b, "border": border, "land": land, "roads": roads,
            "features": features, "buildings": buildings, "labels": labels}


def main():
    windows = json.loads((RESEARCH / "windows.json").read_text(encoding="utf-8"))["data"]
    dishes = json.loads((RESEARCH / "dishes.json").read_text(encoding="utf-8"))["data"]
    map_all = json.loads((RESEARCH / "map-all.json").read_text(encoding="utf-8"))

    # ---- 地图 POI 提取 ----
    polys, pts = {}, {}
    def walk(o):
        if isinstance(o, dict):
            n = o.get("name")
            geo = o.get("geometry")
            if n and geo:
                try:
                    g = json.loads(geo)
                except Exception:
                    return
                if g.get("type") == "Polygon" and n in CAN_MAP_POI:
                    polys[n] = g["coordinates"][0]
                elif g.get("type") == "Point" and (n in CAN_MAP_POI or n in CAN_POINT_POI):
                    pts.setdefault(n, g["coordinates"])
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(map_all)

    # ---- 窗口 ----
    can_counts = {}
    win_out = []
    win_by_canteen = {}
    for x in windows:
        cid = x["canteen_id"]
        can_counts[cid] = can_counts.get(cid, 0) + 1
        win_by_canteen.setdefault(cid, []).append(x)
    for cid, ws in win_by_canteen.items():
        for x in sorted(ws, key=lambda z: (z.get("sort_order") or 0, z["id"])):
            win_out.append({
                "i": x["id"],
                "c": x["canteen_id"],
                "f": norm_floor(x.get("floor")),
                "n": x["name"],
                "img": rewrite_img(x.get("cover_image") or ""),
            })

    # ---- 菜品（精简字段） ----
    dish_out = []
    win_dish_count = {}
    for x in dishes:
        wid = x["window_id"]
        win_dish_count[wid] = win_dish_count.get(wid, 0) + 1
        rec = {"i": x["id"], "w": wid, "n": x["name"], "p": x["price"] or "-",
               "c": x["category"] or "dish"}
        if x.get("detail_category"):
            rec["d"] = x["detail_category"]
        if x.get("rating_count"):
            rec["rc"] = x["rating_count"]
            rec["ra"] = float(x["rating_avg"]) if x.get("rating_avg") else None
        dish_out.append(rec)

    # ---- 食堂 ----
    canteens = []
    for cid in sorted(can_counts):
        name = CAN_NAME.get(cid, f"食堂{cid}")
        c = {
            "i": cid,
            "n": name,
            "full": CAN_FULL.get(cid, name),
            "wins": can_counts[cid],
            "floors": sorted({norm_floor(x.get("floor")) for x in win_by_canteen.get(cid, []) if x.get("floor")}),
        }
        # 地图几何：建筑轮廓（简化后）或点位
        poi = next((n for n, i in CAN_MAP_POI.items() if i == cid), None)
        if poi and poi in polys:
            raw = [tuple(p) for p in polys[poi]]
            poly = douglas_peucker(raw, 2e-7)
            if len(poly) < 8:  # 兜底：别把建筑压成一条线
                poly = raw
            c["poly"] = [list(p) for p in poly]
            c["center"] = bbox_center(poly)
        elif poi and poi in pts:
            c["pts"] = [pts[poi]]
            c["center"] = pts[poi]
        elif cid == 6 and pts:
            c["pts"] = list(pts.values())
            c["center"] = bbox_center(list(pts.values()))
        canteens.append(c)

    # ---- 轻禾轻食文案 ----
    js = (RESEARCH / "qinghe-dishes.js").read_text(encoding="utf-8")
    body = js.split("window.QINGHE_DISHES = ", 1)[1].rsplit(";", 1)[0].strip()
    body = body.replace('"', '\\"')          # 文案内层英文双引号先转义
    body = re.sub(r"'([^']*)'", r'"\1"', body)
    body = re.sub(r"(\w+)\s*:", r'"\1":', body)
    qinghe = json.loads(body)

    # ---- 地图图层 ----
    map_out = extract_map(map_all)

    # ---- 写入 ----
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "canteens.json").write_text(json.dumps(canteens, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "windows.json").write_text(json.dumps(win_out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "dishes.json").write_text(json.dumps(dish_out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "qinghe.json").write_text(json.dumps(qinghe, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "map.json").write_text(json.dumps(map_out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    for f in ("canteens.json", "windows.json", "dishes.json", "qinghe.json", "map.json"):
        p = OUT / f
        print(f"{f:16s} {p.stat().st_size/1024:7.1f} KB")
    print(f"窗口 {len(win_out)} 个 / 菜品 {len(dish_out)} 道 / 食堂 {len(canteens)} 个 / 轻食 {len(qinghe)} 道")


if __name__ == "__main__":
    main()
