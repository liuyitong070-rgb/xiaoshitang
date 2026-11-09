# -*- coding: utf-8 -*-
"""
小食堂 · 图标抓取脚本
====================
从 Phosphor Icons 官方仓库（MIT 协议）抓取独立 SVG，
提取 viewBox + path 数据，生成 js/icons.js 注册表（零运行时依赖）。

用法：python tools/fetch_icons.py
来源：https://raw.githubusercontent.com/phosphor-icons/core/main/assets/regular/<name>.svg
"""
import json
import re
import urllib.request
from pathlib import Path

BASE = "https://raw.githubusercontent.com/phosphor-icons/core/main/assets/regular/{}.svg"
OUT = Path(__file__).resolve().parent.parent / "js" / "icons.js"

# 本步骤需要的图标（磷光 regular 系列文件名）
ICONS = [
    "house",           # 首页
    "fork-knife",      # 点餐
    "chair",           # 座位
    "map-trifold",     # 导航
    "user-circle",     # 我的
    "star",            # 评分
    "flame",           # 热门
    "clock-countdown", # 高峰提醒
    "bell",            # 消息
    "x",               # 关闭
    "caret-right",     # 箭头
    "heart",           # 收藏
    "plus",            # 加购/增加
    "minus",           # 减少
]

def main():
    out = {}
    for name in ICONS:
        url = BASE.format(name)
        with urllib.request.urlopen(url, timeout=20) as r:
            svg = r.read().decode("utf-8")
        vb = re.search(r'viewBox="([^"]+)"', svg)
        paths = re.findall(r'<path d="([^"]+)"', svg)
        if not vb or not paths:
            print(f"! {name}: parse fail (vb={bool(vb)}, paths={len(paths)})")
            continue
        out[name] = {"vb": vb.group(1), "d": "".join(paths)}
        print(f"  {name}: {len(out[name]['d'])} chars")

    body = "// 由 tools/fetch_icons.py 自动生成（Phosphor Icons, MIT License）\n"
    body += "// 用法：ICONS.house -> {vb, d}，配合 <svg viewBox><path d> 渲染\n"
    body += "window.ICONS = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
    OUT.write_text(body, encoding="utf-8")
    print(f"written: {OUT} ({OUT.stat().st_size/1024:.1f} KB)")

if __name__ == "__main__":
    main()
