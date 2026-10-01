# -*- coding: utf-8 -*-
"""ai_play.js v1.2 → v1.3 升级脚本"""
import re

P = r"F:\OMORI mod\www_playtest_2c7c22ee\ai_play.js"
s = open(P, encoding="utf-8").read()

# ① walk 修正：设键后先 Input.update() 刷新 dir4；32帧一步
old_walk = """    function walk(dir, steps) {
        steps = steps || 1;
        for (var i = 0; i < steps; i++) {
            Input._currentState[dir] = true;
            frames(14);          // 一步 ≈ 14 帧（行走动画），可按需调
            Input._currentState[dir] = false;
            frames(4);
            L('walk ' + dir);
        }
    }"""
new_walk = """    function walk(dir, steps) {
        steps = steps || 1;
        for (var i = 0; i < steps; i++) {
            var sx = $gamePlayer.x, sy = $gamePlayer.y;
            Input._currentState[dir] = true;
            Input.update();          // 关键：先刷新 Input.dir4（getter 只在 update 时重算）
            frames(32);              // 一步 ≈ 32 帧（实测校准；14 帧不够）
            Input._currentState[dir] = false;
            frames(6);
            var moved = ($gamePlayer.x !== sx || $gamePlayer.y !== sy);
            L('walk ' + dir + (moved ? '' : ' (blocked)'));
        }
    }"""
assert old_walk in s, "walk 锚点未找到"
s = s.replace(old_walk, new_walk, 1)

# ② frames() 顺序：Input.update 提前
old_frames = """                SceneManager.updateScene();
                if (window.Input) { Input.update(); }
                if (window.TouchInput) { TouchInput.update(); }"""
new_frames = """                if (window.Input) { Input.update(); }   // 先刷输入（dir4 getter 依赖）
                if (window.TouchInput) { TouchInput.update(); }
                SceneManager.updateScene();"""
assert old_frames in s, "frames 锚点未找到"
s = s.replace(old_frames, new_frames, 1)

# ③ 新 API 块（插在导出注释前）
anchor = "    // ---------- 导出 ----------"
assert anchor in s, "导出锚点未找到"
NEW = r'''    // ---------- 寻路与交互（v1.3，实战中长出来的） ----------
    function bfs(sx, sy, tx, ty) {
        var DIRS = [[2,0,1],[4,-1,0],[6,1,0],[8,0,-1]];
        var key = function (x, y) { return y * $gameMap.width() + x; };
        var prev = {}, visited = {};
        visited[key(sx, sy)] = true;
        var queue = [[sx, sy]];
        while (queue.length) {
            var cur = queue.shift();
            if (cur[0] === tx && cur[1] === ty) {
                var path = [];
                var k = key(tx, ty);
                while (prev[k] !== undefined) { path.unshift(prev[k].dir); k = prev[k].fromKey; }
                return path;
            }
            for (var i = 0; i < 4; i++) {
                var d = DIRS[i][0], dx = DIRS[i][1], dy = DIRS[i][2];
                var nx = cur[0] + dx, ny = cur[1] + dy;
                var nk = key(nx, ny);
                if (nx < 0 || ny < 0 || nx >= $gameMap.width() || ny >= $gameMap.height() || visited[nk]) { continue; }
                // 玩家当探针测通行，每格用完立即放回（防自伤传送）
                $gamePlayer.locate(cur[0], cur[1]);
                var ok = $gamePlayer.canPass(cur[0], cur[1], d);
                $gamePlayer.locate(sx, sy);
                if (!ok) { continue; }
                visited[nk] = true;
                prev[nk] = { dir: d, fromKey: key(cur[0], cur[1]) };
                queue.push([nx, ny]);
            }
        }
        return null;
    }
    function pathTo(x, y) {
        var sx = $gamePlayer.x, sy = $gamePlayer.y;
        var path = bfs(sx, sy, x, y);
        $gamePlayer.locate(sx, sy);
        if (!path) { return { ok: false, reason: '不可达' }; }
        var trail = [];
        for (var i = 0; i < path.length; i++) {
            var d = path[i];
            var name = { 2: 'down', 4: 'left', 6: 'right', 8: 'up' }[d];
            var tx = $gamePlayer.x + (d === 4 ? -1 : d === 6 ? 1 : 0);
            var ty = $gamePlayer.y + (d === 2 ? 1 : d === 8 ? -1 : 0);
            var ok = false;
            for (var a = 0; a < 2 && !ok; a++) {
                Input._currentState[name] = true;
                Input.update();
                frames(32);
                Input._currentState[name] = false;
                frames(6);
                if ($gamePlayer.x === tx && $gamePlayer.y === ty) { ok = true; }
            }
            trail.push('(' + $gamePlayer.x + ',' + $gamePlayer.y + ')' + (ok ? '' : '!'));
        }
        return { ok: true, trail: trail, pos: '(' + $gamePlayer.x + ',' + $gamePlayer.y + ')' };
    }
    function talkTo(x, y) {
        var DIRS = [[2,0,1],[4,-1,0],[6,1,0],[8,0,-1]];
        var faceDir = null;
        for (var i = 0; i < 4; i++) {
            if ($gamePlayer.x + DIRS[i][1] === x && $gamePlayer.y + DIRS[i][2] === y) { faceDir = DIRS[i][0]; break; }
        }
        if (faceDir === null) {
            var order = [2, 4, 6, 8];
            for (var j = 0; j < 4 && faceDir === null; j++) {
                var tx2 = x + (order[j] === 4 ? -1 : order[j] === 6 ? 1 : 0);
                var ty2 = y + (order[j] === 2 ? 1 : order[j] === 8 ? -1 : 0);
                var r1 = pathTo(tx2, ty2);
                if (r1.ok) {
                    for (var k = 0; k < 4; k++) {
                        if ($gamePlayer.x + DIRS[k][1] === x && $gamePlayer.y + DIRS[k][2] === y) { faceDir = DIRS[k][0]; break; }
                    }
                }
            }
        }
        if (faceDir === null) { return { ok: false, reason: '无法接近目标' }; }
        $gamePlayer.setDirection(faceDir);
        frames(5);
        Input._currentState['ok'] = true;
        Input.update();
        frames(5);
        Input._currentState['ok'] = false;
        frames(25);
        return { ok: true, msg: $gameMessage.isBusy(),
                 text: $gameMessage._texts ? $gameMessage._texts.filter(Boolean).join(' ').slice(0, 120) : '' };
    }
    function advanceDialog(maxSeconds, choiceIndex, onText) {
        maxSeconds = maxSeconds || 30;
        return new Promise(function (resolve) {
            var start = Date.now();
            var pressed = 0, idle = 0, texts = [];
            var t = setInterval(function () {
                var busy = ($gameMessage && $gameMessage.isBusy()) ||
                           ($gameMap._interpreter && $gameMap._interpreter.isRunning());
                if (busy) {
                    idle = 0;
                    var sc = SceneManager._scene, cw = null;
                    if (sc && sc._messageWindow && sc._messageWindow._choiceWindow && sc._messageWindow._choiceWindow.active) {
                        cw = sc._messageWindow._choiceWindow;
                    }
                    if (cw && choiceIndex !== undefined && choiceIndex !== null && cw.index() !== choiceIndex) {
                        Input._currentState['down'] = true;
                        frames(4);
                        Input._currentState['down'] = false;
                        frames(4);
                        return;
                    }
                    Input._currentState['ok'] = true;
                    pressed++;
                    if (pressed % 5 === 0 && onText) {
                        try {
                            var txt = $gameMessage._texts ? $gameMessage._texts.filter(Boolean).join(' ') : '';
                            if (txt) { onText(txt); }
                        } catch (e) {}
                    }
                } else {
                    Input._currentState['ok'] = false;
                    idle++;
                }
                frames(12);
                if (idle >= 8) { clearInterval(t); resolve({ done: true, pressed: pressed, texts: texts }); }
                else if (Date.now() - start > maxSeconds * 1000) { clearInterval(t); resolve({ done: false, pressed: pressed, texts: texts, timeout: true }); }
            }, 100);
        });
    }
    function clearKeys() {
        ['down','up','left','right','ok','cancel','shift','menu','control'].forEach(function (k) {
            Input._currentState[k] = false;
        });
        Input.update();
        L('clearKeys');
    }

'''
s = s.replace(anchor, NEW + anchor, 1)

# ④ 导出表
old_exp = "        bootToTitle: bootToTitle, newGame: newGame,"
new_exp = """        bootToTitle: bootToTitle, newGame: newGame,
        pathTo: pathTo, talkTo: talkTo, advanceDialog: advanceDialog, clearKeys: clearKeys,"""
assert old_exp in s, "导出表锚点未找到"
s = s.replace(old_exp, new_exp, 1)

# ⑤ 版本
s = s.replace("version: '1.2',", "version: '1.3',")

open(P, "w", encoding="utf-8").write(s)
print("✅ ai_play.js v1.3 写入完成")
