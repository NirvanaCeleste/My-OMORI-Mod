# -*- coding: utf-8 -*-
"""AI 自动游玩环境 · 宿主管理器
用法:
  python tools/ai_play.py            # 起 F 盘工程本地服务器，打印入口与速查
  python tools/ai_play.py --open     # 同上并用系统浏览器打开入口页
说明:
  · 服务器保持运行，Ctrl+C 停止
  · 页面内控制器 AIPLAY 的接口速查见下方 RECIPES（也会打印出来）
  · AI 会话中的标准用法：起本服务器 → 浏览器打开入口 → evaluate 调 AIPLAY
"""
import sys, time, functools, webbrowser
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PROJ = r"F:\OMORI mod\www_playtest_2c7c22ee"
PORT = 8777
URL = f"http://127.0.0.1:{PORT}/ai_test.html?test"

RECIPES = """
==================== AIPLAY 速查（浏览器控制台 / AI evaluate 均可用）====================
await AIPLAY.status()                                  一句话体检（场景/开关/书进度/错误尾）
await AIPLAY.openBook('00_MOD_book_night0','musicroom') 打开一本书（自动注入+装配+过开场）
await AIPLAY.testBook('00_MOD_book_night0','musicroom') 自动玩一个修改决策 → {pass, steps}
await AIPLAY.testAllBooks()                            四本书一键回归 → {allPass, results}
await AIPLAY.gotoMap(519, 4, 6)                        传送到地图（x,y 可选）
AIPLAY.walk('down', 3); AIPLAY.interact()              走三格 / 按确定
AIPLAY.tap('ok'); AIPLAY.taps('ok','ok','ok')          按键（按钮名: ok/cancel/up/down/left/right/shift/menu）
AIPLAY.frames(60)                                      泵 60 帧
AIPLAY.switches([2001,2002,2003])                      读开关
AIPLAY.errors(10)                                      最近引擎错误
AIPLAY.loadYaml('languages/sc/00_MOD.yaml')            手动注入任意语言 yaml
=========================================================================================
注意: 游戏的"确定"= Z 键；AIPLAY 用按钮名注入，与键码无关。
每次 testBook 前无需重置——openBook 内部会重建游戏对象。
"""

def main():
    open_browser = "--open" in sys.argv
    class NoCacheHandler(SimpleHTTPRequestHandler):
    """no-store：浏览器对无 Cache-Control 的响应做启发式缓存，改插件后会拿到旧文件（实测踩坑）"""
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

handler = functools.partial(NoCacheHandler, directory=PROJ)
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    print(f"[ai_play] 工程目录: {PROJ}")
    print(f"[ai_play] 入口地址: {URL}   （Ctrl+C 停止服务器）")
    print(RECIPES)
    if open_browser:
        webbrowser.open(URL)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[ai_play] 服务器已停止")

if __name__ == "__main__":
    main()
