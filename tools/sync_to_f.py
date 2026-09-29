# -*- coding: utf-8 -*-
"""D盘(git主工作区) → F盘(游戏引擎读取端) 单向同步
用法: python tools/sync_to_f.py [--check]
  --check 只报告差异不复制
同步范围 = 引擎需要读的文本/新增内容（data/maps/languages/js/书UI/渲染缩略图），
大资产(audio/img/fonts/...)两边本来就一样，不碰。不删除F盘任何文件。"""
import os, sys, hashlib, shutil

SRC = r"D:\GLM 工作目录\omori\OMORI mod\www_playtest_2c7c22ee"
DST = r"F:\OMORI mod\www_playtest_2c7c22ee"

SYNC_DIRS = ["data", "maps", "languages", "js/plugins", "img/pictures/Unwritten"]
SYNC_FILES = ["js/plugins.js", "index.html", "package.json", "editor.json", "Game.rpgproject"]

def md5(p):
    h = hashlib.md5()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()

def main():
    check_only = "--check" in sys.argv
    copied, same, missing_src = [], 0, []
    for d in SYNC_DIRS:
        sdir = os.path.join(SRC, d)
        if not os.path.isdir(sdir):
            missing_src.append(d); continue
        for root, _, files in os.walk(sdir):
            for name in files:
                if name.endswith((".bak", ".bak_switch", ".bak_a2")) or ".bak_2026" in name:
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
        if not os.path.isfile(sp):
            missing_src.append(f); continue
        dp = os.path.join(DST, f)
        if os.path.exists(dp) and md5(sp) == md5(dp):
            same += 1; continue
        if not check_only:
            os.makedirs(os.path.dirname(dp), exist_ok=True)
            shutil.copy2(sp, dp)
        copied.append(f)
    # render/ 只补缺失的缩略图（不整目录镜像）
    rsrc = os.path.join(SRC, "render")
    rdst = os.path.join(DST, "render")
    if os.path.isdir(rsrc):
        for name in os.listdir(rsrc):
            if not os.path.exists(os.path.join(rdst, name)):
                if not check_only:
                    os.makedirs(rdst, exist_ok=True)
                    shutil.copy2(os.path.join(rsrc, name), os.path.join(rdst, name))
                copied.append("render/" + name)
    print(f"[sync_to_f] {'检查模式：' if check_only else ''}相同 {same} 个 | 需同步 {len(copied)} 个")
    for c in copied:
        print("   →", c)
    if missing_src:
        print("[sync_to_f] ⚠️ 源缺失:", missing_src)

if __name__ == "__main__":
    main()
