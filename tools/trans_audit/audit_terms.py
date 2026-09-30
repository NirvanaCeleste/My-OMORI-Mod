# -*- coding: utf-8 -*-
"""翻译术语一致性审计 —— OMORI 模组教程中文版（上下册）
用法: python tools/trans_audit/audit_terms.py
输入: tools/trans_audit/fulltext.json（由 PyMuPDF 提取，{卷: [页文本]}）
输出: 控制台报告 + docs/翻译术语审计_20260930.md

审计三类问题（对应 Flicky 的意见）：
  1) 译名漂移：同一英文术语多种中文译法（对齐 RPG MV 官方中文）
  2) 英文裸露：中文句子里裸奔的英文术语（括号注记以外的）
  3) 风格一致性：中文(English) 注记的使用密度
"""
import json, os, re, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(REPO, "docs", "翻译术语审计_20260930.md")

# ---------------- 术语基线 ----------------
# en: 英文原词 | canon: RPG MV 官方/社区标准译名 | variants: 可疑漂移译法
TERMS = [
    ("Event",        "事件",   ["活动", "事项", "日程"]),
    ("Map",          "地图",   ["映射"]),
    ("Switch",       "开关",   ["切换"]),
    ("Variable",     "变量",   ["变数"]),
    ("Actor",        "角色",   ["演员", "行动者", "角色者"]),
    ("Item",         "物品",   ["道具", "物件"]),
    ("Skill",        "技能",   ["特技", "技艺"]),
    ("Weapon",       "武器",   []),
    ("Armor",        "防具",   ["护甲", "盔甲", "装甲"]),
    ("Enemy",        "敌人",   ["怪物", "敌方"]),
    ("Troop",        "敌群",   ["部队", "队伍", "群组"]),
    ("State",        "状态",   []),
    ("Tileset",      "图块",   ["瓦片", "贴图", "砖块", "拼图", "瓷片"]),
    ("Tile",         "图块",   ["瓦片", "砖块", "贴块"]),
    ("Plugin",       "插件",   ["外挂", "扩充", "扩展模块"]),
    ("Common Event", "公共事件", ["通用事件", "共同事件", "一般事件"]),
    ("Notetag",      "注释",   ["备忘", "标记", "备注标签"]),
    ("Plugin Command", "插件命令", ["插件指令"]),
    ("Script",       "脚本",   []),
    ("Sprite",       "精灵",   ["雪碧", "精灵图"]),
    ("Playtest",     "测试",   ["试玩"]),
    ("Parallax",     "远景",   ["视差"]),
    ("Battleback",   "战斗背景", ["战斗背景图"]),
    ("Autorun",      "自动执行", ["自动运行"]),
    ("Parallel",     "并行",   ["平行"]),
    ("Trigger",      "触发",   ["扳机", "触发器"]),
    ("Priority",     "优先级", ["优先度", "权重"]),
    ("Collision",    "碰撞",   ["冲突", "碰撞检测"]),
    ("Region",       "区域",   ["地域"]),
    ("Layer",        "图层",   ["层", "夹层"]),
    ("Database",     "数据库", []),
    ("Event Page",   "事件页",  ["事件分页", "事件页面"]),
    ("Follow-Up",    "追击",   ["后续技", "追击技"]),
    ("Emotion",      "情绪",   ["情感"]),
]

# 英文保留白名单：专有名词/工具/品牌（裸露不算问题）
WHITELIST = re.compile(
    r"OMORI|Tiled|OneLoader|OneMaker|BundleTool|GitHub|Git\b|Steam|RPG ?Maker|"
    r"mods\.one|JavaScript|Pixi|Yanfly|YEP|YED|Olivia|TDS|Discord|Google|Windows|Mac\b|"
    r"itch\.io|Aseprite|Photopea|VS ?Code|VSCode|Audacity|ffmpeg|GIMP|Obsidian|"
    r"Black Space|White Space|Head Space|Dream World|Faraway|Sweetheart|Humphrey|"
    r"OMOCAT|FruitDragon|TomatoRadio|Delta|delta|Basil|Aubrey|Kel\b|Hero\b|Mari|Sunny|Polly", re.I)
# 代码行特征：含这些的直接跳过（代码/文件名/路径不算翻译对象）
CODELINE = re.compile(r"[{};=]|\.js\b|\.png\b|\.yaml\b|\.json\b|\.zip\b|http|www\.|<|\\|\.\./")

def page_no(vol, idx):
    return idx + 1 if vol == "上册" else 128 + idx + 1

def classify_english(line, term_en):
    """行内英文术语出现是：括号注记 / 裸露 / 白名单"""
    hits = {"paren": 0, "bare": 0, "samples": []}
    for m in re.finditer(r"\b" + re.escape(term_en) + r"(s)?\b", line):
        s = m.start()
        # 白名单上下文（整词所在更长英文串里，如 OneLoader Event）→ 先按词判断
        if WHITELIST.search(line[max(0, s - 30):s + 30]):
            continue
        before = line[max(0, s - 2):s]
        if before.endswith("(") or before.endswith("（"):
            hits["paren"] += 1
        else:
            # 前后都是英文单词 → 整句是英文/代码，跳过
            ctx = line[max(0, s - 1):s + len(term_en) + 2]
            if re.match(r"^[A-Za-z0-9_ \-\./:'\"#<>\[\]]+$", line.strip()):
                continue
            hits["bare"] += 1
            if len(hits["samples"]) < 3:
                hits["samples"].append(line.strip()[:60])
    return hits

def main():
    data = json.load(open(os.path.join(HERE, "fulltext.json"), encoding="utf-8"))
    # 合并成 (卷, 页码, 行) 流
    lines = []
    for vol in ("上册", "下册"):
        for i, page in enumerate(data.get(vol, [])):
            for ln in page.split("\n"):
                ln = ln.strip()
                if not ln:
                    continue
                lines.append((vol, page_no(vol, i), ln))
    # 过滤纯代码行（术语在里面属于代码本体）
    prose = [(v, p, ln) for (v, p, ln) in lines if not CODELINE.search(ln)]

    report = ["# 翻译术语一致性审计 —— OMORI 模组教程中文版（上/下册）",
              "",
              f"> 审计范围：上册128页 + 下册129页，正文行 {len(prose)} 行（已剔除代码/路径行）",
              "> 基线：RPG Maker MV 官方中文术语 + 模组社区通行译名",
              ""]
    problems_total = 0
    rows = ["| 英文术语 | 基准译名 | 译名出现 | 可疑漂移 | 英文括号注记 | 英文裸露 | 评价 |",
            "|---|---|---|---|---|---|---|"]
    details = []

    for en, canon, variants in TERMS:
        zh_canon = sum(1 for _, _, ln in prose if canon in ln)
        drift = {}
        for v in variants:
            for vol, pg, ln in prose:
                if v in ln:
                    drift.setdefault(v, []).append((pg, ln[:50]))
        paren = bare = 0
        bare_samples = []
        for vol, pg, ln in prose:
            h = classify_english(ln, en)
            paren += h["paren"]; bare += h["bare"]
            if h["bare"]:
                for s in h["samples"]:
                    if len(bare_samples) < 3:
                        bare_samples.append((pg, s))
        issues = []
        if drift:
            issues.append(f"漂移 {sum(len(x) for x in drift.values())} 处")
        if bare > 8:
            issues.append(f"裸露 {bare} 处")
        verdict = "✅" if not issues else ("⚠️ " + "；".join(issues))
        if issues:
            problems_total += 1
        rows.append(f"| {en} | {canon} | {zh_canon} | "
                    f"{sum(len(x) for x in drift.values())} | {paren} | {bare} | {verdict} |")
        if drift or bare_samples:
            details.append(f"\n## {en} → {canon}")
            for v, hits in drift.items():
                pgs = "、".join(f"p{p}" for p, _ in hits[:6])
                details.append(f"- ⚠️ 漂移译法「{v}」× {len(hits)}（{pgs}…）例：{hits[0][1]}")
            for pg, s in bare_samples:
                details.append(f"- 英文裸露 p{pg}：…{s}…")

    report += rows
    report.append("")
    report.extend(details)
    report += ["", f"## 结论", f"- 有问题的术语 {problems_total}/{len(TERMS)} 个",
               "- 逐条明细如上；修复建议：以基准译名全局替换漂移译法，"]
    open(OUT, "w", encoding="utf-8").write("\n".join(report))
    print("\n".join(rows))
    print(f"\n报告已写入 {OUT}")

if __name__ == "__main__":
    main()
