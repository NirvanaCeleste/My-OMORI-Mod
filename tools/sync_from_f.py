# -*- coding: utf-8 -*-
"""F盘(实际操作区/引擎端) → D盘(git形式工作区) 单向回灌
用法: python tools/sync_from_f.py [--check]
  --check 只报告差异不复制

工作流（2026-09-30 起反转）：
  1. 所有编辑直接发生在 F:\OMORI mod\www_playtest_2c7c22ee（包括 RPG Maker 的保存）
  2. 提交前跑本脚本把 F 的变化回灌到 D 的 git 仓库
  3. 或直接用 tools/f_commit.py "提交说明" 一步完成回灌+提交+推送

范围 = 引擎相关文本（data/maps/languages/js/书UI），跳过 *.bak*。
不删除 D 盘任何文件。"""
import os, sys, hashlib, shutil

SRC = r"F:\OMORI mod\www_playtest_2c7c22ee"
DST = r"D:\GLM 工作目录\omori\OMORI mod\www_playtest_2c7c22ee"

SYNC_DIRS = ["data", "maps", "languages", "js/plugins", "img/pictures/Unwritten"]
SYNC_FILES = ["js/plugins.js", "index.html", "package.json", "editor.json", "Game.rpgproject",
               "ai_test.html", "ai_play.js", "node_compat.js"]   # 测试环境三件套在工程根

def md5(p):
    h = hashlib.md5()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()

def skip(name):
    return name.endswith((".bak", ".bak_switch", ".bak_a2")) or ".bak_2026" in name

def main():
    check_only = "--check" in sys.argv
    if not os.path.isdir(SRC):
        print("[sync_from_f] ❌ 找不到 F 盘工程，请确认 F 盘已挂载"); sys.exit(1)
    copied, same = [], 0
    for d in SYNC_DIRS:
        sdir = os.path.join(SRC, d)
        if not os.path.isdir(sdir):
            continue
        for root, _, files in os.walk(sdir):
            for name in files:
                if skip(name):
                    continue
                sp = os.path.join(root, name)
                rel = os.path.relpath(sp, SRC)
                dp = os.path.join(DST, rel)
                if os.path.exists(dp) and os.path.getsize(sp) == os.path.getsize(dp) and md5(sp) == md5(dp):
                    same += 1; continue
                if not check_only:
                    os.makedirs(os.path.dirname(dp), exist_ok=True)
                    shutil.copy2(sp, dp)
                copied.append(rel)
    for f in SYNC_FILES:
        sp = os.path.join(SRC, f)
        if not os.path.isfile(sp) or skip(os.path.basename(f)):
            continue
        dp = os.path.join(DST, f)
        if os.path.exists(dp) and md5(sp) == md5(dp):
            same += 1; continue
        if not check_only:
            os.makedirs(os.path.dirname(dp), exist_ok=True)
            shutil.copy2(sp, dp)
        copied.append(f)
    print(f"[sync_from_f] {'检查模式：' if check_only else ''}相同 {same} 个 | 需回灌 {len(copied)} 个")
    for c in copied:
        print("   ←", c)

if __name__ == "__main__":
    main()
