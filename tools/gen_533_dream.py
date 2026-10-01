# -*- coding: utf-8 -*-
"""生成 Map533「梦境·书隅」——第一夜《礼物》占位切片（设计见 docs/设计_第一夜_20261002.md）
占位美学：医院图块 + 深蓝暗调 tint；书本=床身图块台座占位；文本在 00_MOD_dream1.yaml（均占位）
接线：Map515 调试图 EV018 入口（本脚本不负责，另行注入）→ 533 → 书(night0) → 2001 ON → 监听唤醒回 519(4,2)
"""
import os, sys
from mapgen import (MapGenerator, PALETTE, page, _conditions,
                    cmd_plugin, cmd_showmsg, cmd_wait, cmd_se, cmd_switch,
                    cmd_selfswitch, cmd_transfer, cmd_end)

PROJ = r"F:\OMORI mod\www_playtest_2c7c22ee"   # 铁律：生成工具目标工程指向 F（实际操作区）
Y = '00_MOD_dream1'   # 占位文本 yaml

def tint(rgba, dur, wait=False):
    return {"code": 223, "indent": 0, "parameters": [rgba, dur, wait]}
def fadeout(dur):  return {"code": 221, "indent": 0, "parameters": [dur]}
def fadein(dur):   return {"code": 222, "indent": 0, "parameters": [dur]}

def switch_cond(sid):
    c = _conditions(); c["switch1Id"] = sid; c["switch1Valid"] = True; return c
def self_cond(ch="A"):
    c = _conditions(); c["selfSwitchCh"] = ch; c["selfSwitchValid"] = True; return c

gen = MapGenerator(PROJ)
m = gen.map(533, "Dream_Night1", 17, 13, displayName="梦境·书隅")
m.room(floor="floor", door_x=None, windows=False)   # 封闭梦境空间：无门无窗

# ---- 事件 1：INITIALIZE（autorun，一次性）梦境色调 + 引导 ----
init_list = [
    tint([-85, -85, 20, 68], 60),          # 深蓝暗调（占位梦境氛围）
    cmd_wait(30),
    cmd_showmsg(Y, 'd1_intro_1'),
    cmd_showmsg(Y, 'd1_intro_2'),
    cmd_selfswitch('A', True),
    cmd_end(),
]
m.raw_event('INITIALIZE', 0, 0, [
    page(init_list, trigger=3),
    page([cmd_end()], conditions=self_cond('A')),   # 已引导 → 空页
])

# ---- 事件 2：梦境之书（动作按钮，床身图块=台座占位）----
book_page = page([
    cmd_showmsg(Y, 'd1_book_hint'),
    cmd_plugin('UnwrittenStory Open 00_MOD_book_night0'),   # 无页键→首页+进度恢复(A3)
    cmd_end(),
], trigger=0)
book_page["image"]["tileId"] = PALETTE["bed"][1]     # 占位：白色台座
m.raw_event('DreamBook', 8, 6, [book_page])
m.block(8, 6)                                        # 台座不可穿过（room 后追加）

# ---- 事件 3：完成监听（并行，开关 2001）→ 唤醒回宿舍 ----
watch_list = [
    cmd_wait(45),
    cmd_se('sys_PA_page_flip', 60, 60),              # 低沉翻页声
    cmd_showmsg(Y, 'd1_wake'),
    fadeout(90),
    cmd_transfer(519, 4, 2, 2, 0),                   # 回宿舍床位，朝下
    tint([45, 18, -30, 25], 45),                     # 晨光暖调（占位天亮）
    fadein(60),
    # 预留：正式版在此前接 EnableStab → 封存(2006) 再醒（见设计文档二节）
    cmd_end(),
]
m.raw_event('Watch', 0, 1, [
    page(watch_list, trigger=4, conditions=switch_cond(2001)),
])

# ---- 事件 4/5：氛围调查点（占位）----
m.sign('窗帘', 3, 2, Y, ['d1_look_1'])
m.sign('角落', 13, 9, Y, ['d1_look_2'])

m.save(parent=515, register=True)
print("[gen_533] Map533 梦境·书隅 生成完成")
