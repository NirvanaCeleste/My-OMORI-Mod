# -*- coding: utf-8 -*-
"""ai_play.js v1.4 → v1.5 升级脚本（文件方式避免 heredoc 转义问题）"""

P = r"F:\OMORI mod\www_playtest_2c7c22ee\ai_play.js"
s = open(P, encoding="utf-8").read()

# ① 定时器注册表
anchor1 = "    // ---------- 帧驱动 ----------"
assert anchor1 in s, "锚点1"
TIMER = (
    "    // ---------- 定时器注册表（v1.5：防僵尸循环，reset 可统一 kill） ----------\n"
    "    var _timerSeq = 0;\n"
    "    var _timers = {};\n"
    "    var _origSetInterval = window.setInterval.bind(window);\n"
    "    var _origClearInterval = window.clearInterval.bind(window);\n"
    "    window.setInterval = function (fn, ms) {\n"
    "        var id = _origSetInterval(fn, ms);\n"
    "        _timers[id] = fn;\n"
    "        return id;\n"
    "    };\n"
    "    window.clearInterval = function (id) {\n"
    "        delete _timers[id];\n"
    "        return _origClearInterval(id);\n"
    "    };\n\n"
)
s = s.replace(anchor1, TIMER + anchor1, 1)

# ② 新功能块
anchor2 = "    // ---------- 导出 ----------"
assert anchor2 in s, "锚点2"

NEW_LINES = [
    "    // ---------- v1.5：reset（原地满血重建） ----------",
    "    function reset() {",
    "        // ① kill 全部注册定时器",
    "        var killed = 0;",
    "        for (var id in _timers) { _origClearInterval(Number(id)); delete _timers[id]; killed++; }",
    "        // ② 清按键",
    "        ['down','up','left','right','ok','cancel','shift','menu','control'].forEach(function (k) { Input._currentState[k] = false; });",
    "        Input.update();",
    "        // ③ 重建游戏对象 + 语言",
    "        feedLanguages('sc');",
    "        DataManager.createGameObjects();",
    "        // ④ 回标题",
    "        if (window.Galv && Galv.ASPLASH) { Galv.ASPLASH.splashed = true; }",
    "        SceneManager.goto(Scene_OmoriTitleScreen);",
    "        AIPLAY.frames(40);",
    "        var s = SceneManager._scene;",
    "        if (s && s._titleCommands && s._titleCommands.length === 0) { s.createTitleCommands(); }",
    "        L('reset: kill=' + killed + ' 定时器, 回标题');",
    "        return { killedTimers: killed, scene: SceneManager._scene.constructor.name };",
    "    }",
    "",
    "    // ---------- v1.5：视觉断言 ----------",
    "    function visualCheck() {",
    "        try {",
    "            var canvas = (Graphics && Graphics._canvas) || document.querySelector('canvas');",
    "            if (!canvas) { return { kind: 'no-canvas' }; }",
    "            var probe = document.createElement('canvas');",
    "            probe.width = 64; probe.height = 48;",
    "            var ctx = probe.getContext('2d');",
    "            ctx.drawImage(canvas, 0, 0, 64, 48);",
    "            var data = ctx.getImageData(0, 0, 64, 48).data;",
    "            var dark = 0, red = 0, total = 64 * 48;",
    "            for (var i = 0; i < data.length; i += 4) {",
    "                if (data[i] < 24 && data[i+1] < 24 && data[i+2] < 24) { dark++; }",
    "                if (data[i] > 150 && data[i+1] < 80 && data[i+2] < 80) { red++; }",
    "            }",
    "            var kind = 'normal';",
    "            if (dark / total > 0.97) { kind = 'black'; }",
    "            if (red / total > 0.02) { kind = 'error-overlay'; }",
    "            return { kind: kind, darkRatio: +(dark / total).toFixed(3) };",
    "        } catch (e) { return { kind: 'probe-error', error: e.message }; }",
    "    }",
    "    function domErrorCheck() {",
    "        var found = [];",
    "        Array.from(document.body.children).forEach(function (el) {",
    "            if (el.tagName === 'DIV' && (el.textContent.indexOf('Cannot read') >= 0 ||",
    "                el.textContent.indexOf('TypeError') >= 0)) { found.push(el.textContent.slice(0, 60)); }",
    "        });",
    "        var gerr = Graphics && Graphics._errorPrinter && Graphics._errorPrinter.style.display !== 'none';",
    "        return { domErrors: found, graphicsErrorVisible: !!gerr };",
    "    }",
    "    function assertVisual() {",
    "        var v = visualCheck();",
    "        var d = domErrorCheck();",
    "        var ok = (v.kind === 'normal' || v.kind === 'black') && d.domErrors.length === 0 && !d.graphicsErrorVisible;",
    "        return { ok: ok, visual: v, dom: d };",
    "    }",
    "",
    "    // ---------- v1.5：存读档回归 ----------",
    "    function testSaveLoad() {",
    "        var rep = { steps: [] };",
    "        try {",
    "            if (!$gameMap || $gameMap._mapId === 0) { return { ok: false, reason: '不在游戏中' }; }",
    "            $gameSwitches.setValue(2001, true);",
    "            $gameSystem.onBeforeSave();",
    "            var saveOk = DataManager.saveGame(1);",
    "            rep.steps.push('saveGame(1): ' + saveOk);",
    "            if (!saveOk) { rep.ok = false; return rep; }",
    "            $gameSwitches.setValue(2001, false);",
    "            var loadOk = DataManager.loadGame(1);",
    "            rep.steps.push('loadGame(1): ' + loadOk);",
    "            SceneManager.goto(Scene_Map);",
    "            AIPLAY.frames(30);",
    "            var sw = $gameSwitches.value(2001);",
    "            rep.steps.push('开关2001读档后: ' + sw);",
    "            rep.pass = !!(loadOk && sw);",
    "            rep.ok = rep.pass;",
    "            L('testSaveLoad → ' + (rep.ok ? 'PASS' : 'FAIL'));",
    "        } catch (e) { rep.ok = false; rep.error = e.message; }",
    "        return rep;",
    "    }",
    "",
    "    // ---------- v1.5：全流程一键回归 ----------",
    "    function testStoryFlow() {",
    "        var R = { steps: [], visual: [] };",
    "        function step(name, ok, detail) {",
    "            R.steps.push((ok ? '✅ ' : '❌ ') + name + (detail ? ' | ' + detail : ''));",
    "            return ok;",
    "        }",
    "        return new Promise(function (resolve) {",
    "            function done() {",
    "                R.pass = R.steps.every(function (x) { return x.charAt(0) === '✅'; });",
    "                L('testStoryFlow → ' + (R.pass ? 'PASS' : 'FAIL'));",
    "                resolve(R);",
    "            }",
    "            var r0 = reset();",
    "            step('reset', true, 'kill ' + r0.killedTimers + ' 定时器');",
    "            var s = SceneManager._scene;",
    "            if (s && s._titleCommands && s._titleCommands.length === 0) { s.createTitleCommands(); }",
    "            var titleOK = s && s._titleCommands && s._titleCommands.length > 0;",
    "            step('标题命令窗', titleOK);",
    "            if (!titleOK) { return done(); }",
    "            s.commandNewGame();",
    "            var res = AIPLAY.pumpUntil(function () {",
    "                var sc = SceneManager._scene;",
    "                return sc && sc.constructor.name === 'Scene_Map' && $gameMap && $gameMap._mapId > 0 && !$gamePlayer.isTransferring();",
    "            }, 60, 15, 80);",
    "            step('newGame→Map', res.ok, 'Map' + ($gameMap ? $gameMap._mapId : '?'));",
    "            if (!res.ok) { return done(); }",
    "            advanceDialog(25).then(function (adv) {",
    "                step('开场对话', adv.done, '按' + adv.pressed + '次');",
    "                var pt = pathTo(5, 5);",
    "                step('pathTo(5,5) 下床', pt.ok);",
    "                step('玩家可控', $gamePlayer.canMove());",
    "                return testBook('00_MOD_book_night0', 'musicroom').then(function (r1) {",
    "                    step('night0 书决策', r1.pass, 'stateIdx→' + (r1.detail ? r1.detail.stateIdx : '?'));",
    "                    var sl = testSaveLoad();",
    "                    step('存读档回归', sl.ok, JSON.stringify(sl.steps || []));",
    "                    done();",
    "                });",
    "            }).catch(function (e) { step('异常', false, e.message); done(); });",
    "        });",
    "    }",
    "",
]
s = s.replace(anchor2, "\n".join(NEW_LINES) + "\n" + anchor2, 1)

# ③ 导出表
old_exp = "        cmd: cmd, seq: seq, actions: ACTIONS,"
assert old_exp in s, "导出锚点"
new_exp = (
    "        cmd: cmd, seq: seq, actions: ACTIONS,\n"
    "        reset: reset, visualCheck: visualCheck, assertVisual: assertVisual,\n"
    "        testSaveLoad: testSaveLoad, testStoryFlow: testStoryFlow,"
)
s = s.replace(old_exp, new_exp, 1)

# ④ 版本
s = s.replace("version: '1.4',", "version: '1.5',", 1)

open(P, "w", encoding="utf-8").write(s)
print("OK v1.5")
