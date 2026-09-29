# -*- coding: utf-8 -*-
"""生成 Map532「IPSU 探视室」——演示地图生成器完整流程
内容取自剧本《未竟之事》第六节-20（Kel 探视对话）。"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapgen import MapGenerator, PALETTE

PROJ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "www_playtest_2c7c22ee")
gen = MapGenerator(PROJ)

m = gen.map(532, "IPSU_VisitRoom", 17, 13, displayName="探视室")

# ---- 结构：房间（北墙+窗带+南墙压檐）+ 北门缺口 ----
m.room(floor="floor", door_x=8)

# ---- 陈设（占位图块）----
# 接待台（左上，墙体材质台面）
m.rect("G2", 2, 3, 4, 1, PALETTE["wall"])
m.block_rect(2, 3, 4, 1)
# 三张探视桌（亮色台面占位）+ 对面座位
for tx in (4, 8, 12):
    m.rect("G2", tx, 7, 2, 1, PALETTE["window"])
    m.set("G2", tx, 6, PALETTE["prop"])
    m.block_rect(tx, 7, 2, 1)
# 角落绿植（剧本梗：调查绿植"这里什么也没有"）
m.set("G2", 15, 3, PALETTE["prop"])
m.block(15, 3)
# 墙面挂饰 + 吸顶灯
m.set("A1", 6, 2, PALETTE["wall_deco"])
m.set("AX", 5, 5, PALETTE["lamp"])
m.set("AX", 11, 5, PALETTE["lamp"])

# ---- 门：回 IPSU_DAY（占位坐标，之后接到实际走廊）----
m.door(8, to_map=520, to_x=30, to_y=30, direction=8, name="Door_Out")

# ---- NPC：Kel（用剧本第六节-20 的探视对话）----
kel_char = "FA_KEL" if os.path.exists(
    os.path.join(PROJ, "img", "characters", "FA_KEL.png")) else "FA_BASIL"
m.npc("Kel", 4, 6, char=kel_char,
      msgs=[("00_MOD_visit", f"kel_{i}") for i in range(1, 6)], direction=6)

# ---- 告示牌：探视须知（呼应剧本"IPSU 公示规则"的设定）----
m.sign("Board", 2, 2, "00_MOD_visit", ["board_1", "board_2"])

# ---- 输出 ----
preview = m.save(parent=527, order=537)

# ---- 对话 yaml（sc）----
yaml_path = os.path.join(PROJ, "languages", "sc", "00_MOD_visit.yaml")
messages = {
    "kel_1": "等你出来，我们去吃东西。",
    "kel_2": "嗯。",
    "kel_3": "你不开心吗？",
    "kel_4": "不是。只是……",
    "kel_5": "如果没有我，你们是不是会轻松很多？",
    "board_1": "【探视须知】探视前请在接待处登记。不得谈论案件相关内容。",
    "board_2": "不得携带任何未经检查的物品交给病人。",
}
with open(yaml_path, "w", encoding="utf-8") as f:
    f.write("# 《未竟之事》探视室对话 —— 由 mapgen 生成（内容取自剧本第六节-20）\n")
    for k, v in messages.items():
        f.write(f"{k}:\n  text: \"{v}\"\n")
print(f"[mapgen] 对话 yaml 已写入: {yaml_path}")
