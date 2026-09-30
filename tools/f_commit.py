# -*- coding: utf-8 -*-
"""一键提交：F→D 回灌 + git add/commit/push
用法: python tools/f_commit.py "提交说明"
（工作流反转后的标准提交方式，防止 F 盘改动忘了回灌进 git）"""
import os, sys, subprocess

REPO = r"D:\GLM 工作目录\omori\OMORI mod"

def run(cmd, **kw):
    r = subprocess.run(cmd, cwd=REPO, shell=True,
                       capture_output=True, text=True, encoding="utf-8", errors="replace", **kw)
    return r.returncode, (r.stdout or "") + (r.stderr or "")

def main():
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print('用法: python tools/f_commit.py "提交说明"'); sys.exit(1)
    msg = sys.argv[1].strip()
    # 1) F→D 回灌
    rc, out = run('python tools/sync_from_f.py')
    print(out.strip())
    if rc != 0:
        print("[f_commit] ❌ 回灌失败，中止提交"); sys.exit(1)
    # 2) 暂存 + 提交
    rc, out = run('git add -A')
    rc, out = run('git diff --cached --stat')
    changed = [l for l in out.splitlines() if l.strip()]
    if not changed:
        print("[f_commit] 没有任何变化可提交（F 与 D 与 git 三方一致）")
        return
    rc, out = run(f'git commit -m "{msg}"')
    if rc != 0:
        print("[f_commit] ❌ commit 失败:\n" + out); sys.exit(1)
    print("[f_commit] 已提交:", msg)
    # 3) 推送（梯子没开时失败不致命，下次补推）
    rc, out = run("git push")
    print("[f_commit] 推送:", "✅ 成功" if rc == 0 else "⚠️ 失败（梯子没开？稍后手动 git push）")
    if rc != 0 and out.strip():
        print(out.strip().splitlines()[-1])

if __name__ == "__main__":
    main()
