# -*- coding: utf-8 -*-
"""扫描游戏工程全部事件，生成 开关/变量/自开关 使用对照表（Markdown）
用法: python switchvar_report.py [工程目录] [输出.md]
解决"RPG Maker 里查开关变量痛苦"的问题：一张表看全所有 ID 的名字+用在哪。"""
import json, os, sys, glob, re
from collections import defaultdict

PROJ = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "www_playtest_2c7c22ee")
OUT  = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "docs", "开关变量对照表.md")

# mod 关键 ID 高亮（《未竟之事》已知占用）
MOD_IDS = {4: "戳刺菜单(EnableStab)", 84: "血脚印", 1006: "书首次提示",
           **{i: f"夜书完成开关" for i in range(1001, 1009)}}

def scan():
    sysd = json.load(open(os.path.join(PROJ, "data", "System.json"), encoding="utf-8"))
    sw_names = sysd.get("switches", [])
    var_names = sysd.get("variables", [])

    sw = defaultdict(lambda: {"n": 0, "sites": set()})
    var = defaultdict(lambda: {"n": 0, "sites": set()})
    selfsw = defaultdict(lambda: set())   # (mapId) -> channels

    def add(d, i, site):
        d[i]["n"] += 1
        if len(d[i]["sites"]) < 6:
            d[i]["sites"].add(site)

    def scan_list(lst, site):
        stack = list(lst)
        for c in stack:
            code = c.get("code", 0)
            p = c.get("parameters", [])
            if code == 121:                                # 开关操作
                for i in range(p[0], p[1] + 1): add(sw, i, site)
            elif code == 122:                              # 变量操作
                for i in range(p[0], p[1] + 1): add(var, i, site)
            elif code == 111 and p and p[0] == 0:          # 条件:开关
                add(sw, p[1], site)
            elif code == 111 and p and p[0] == 1:          # 条件:变量
                add(var, p[1], site)
            elif code == 356:                              # 插件命令里提 switch/variable
                t = str(p[0]) if p else ""
                for m in re.finditer(r"[Ss]witch\s*:\s*(\d+)", t): add(sw, int(m.group(1)), site + "(插件)")

    # 公共事件
    try:
        ce = json.load(open(os.path.join(PROJ, "data", "CommonEvents.json"), encoding="utf-8"))
        for e in [x for x in ce if x]:
            site = f"公共事件#{e['id']} {e.get('name','')}"
            for pg in ([e["list"]] if "list" in e else [p["list"] for p in e.get("pages", [])]):
                scan_list(pg, site)
    except FileNotFoundError:
        pass
    # 地图事件（含页条件里的开关/变量）
    map_files = [f for f in sorted(glob.glob(os.path.join(PROJ, "data", "Map*.json")))
                 if re.fullmatch(r"Map\d+\.json", os.path.basename(f))]
    for f in map_files:
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(d, dict):
            continue
        mid = os.path.basename(f)[3:-5]
        base = f"Map{mid}({d.get('displayName') or '?'})"
        chans = set()
        for e in [x for x in d.get("events", []) if x]:
            site = f"{base}·{e.get('name','')}"
            for pg in e.get("pages", []):
                cond = pg.get("conditions", {})
                if cond.get("switch1Valid"): add(sw, cond.get("switch1Id", 0), site + "(页条件)")
                if cond.get("switch2Valid"): add(sw, cond.get("switch2Id", 0), site + "(页条件)")
                if cond.get("variableValid"): add(var, cond.get("variableId", 0), site + "(页条件)")
                if cond.get("selfSwitchValid"): chans.add(cond.get("selfSwitchCh", "A"))
                scan_list(pg.get("list", []), site)
        if chans: selfsw[f"Map{mid}"] = chans
    return sw_names, var_names, sw, var, selfsw

def name_of(names, i):
    return names[i] if i < len(names) and names[i] else ""

def fmt(d, names, title, lo, hi):
    lines = [f"\n## {title}\n", "| ID | 名字(System.json) | 使用次数 | 使用位置（最多列6处） | 备注 |", "|---:|---|---:|---|---|"]
    for i in sorted(d):
        if not (lo <= i <= hi): continue
        v = d[i]
        note = MOD_IDS.get(i, "")
        nm = name_of(names, i) or ("⚠️未命名" if v["n"] else "")
        lines.append(f"| {i} | {nm} | {v['n']} | {'; '.join(sorted(v['sites'])) or '—'} | {note} |")
    return "\n".join(lines)

def main():
    sw_names, var_names, sw, var, selfsw = scan()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(f"# 开关/变量使用对照表\n\n> 由 `tools/switchvar_report.py` 自动扫描生成，改完事件后重跑即可更新。\n")
        f.write(f"> 工程: `{os.path.basename(PROJ)}` | 开关总数(有名字): {sum(1 for n in sw_names if n)} | 变量总数(有名字): {sum(1 for n in var_names if n)}\n")
        f.write(fmt(sw, sw_names, "开关（原作常用区 1-999）", 1, 999))
        f.write(fmt(sw, sw_names, "开关（模组常用区 1000+）", 1000, 10**9))
        f.write(fmt(var, var_names, "变量（原作常用区 1-999）", 1, 999))
        f.write(fmt(var, var_names, "变量（模组常用区 1000+）", 1000, 10**9))
        f.write("\n## 自开关使用热点（哪些地图在用 A/B/C/D）\n\n| 地图 | 通道 |\n|---|---|\n")
        for k in sorted(selfsw, key=lambda s: int(re.sub(r'\D', '', s) or 0)):
            f.write(f"| {k} | {', '.join(sorted(selfsw[k]))} |\n")
    print(f"[switchvar] 报告已生成: {OUT}")
    print(f"[switchvar] 开关使用 {len(sw)} 个ID | 变量使用 {len(var)} 个ID | 自开关地图 {len(selfsw)} 张")

if __name__ == "__main__":
    main()
