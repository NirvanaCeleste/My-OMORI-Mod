# -*- coding: utf-8 -*-
"""ai_play.js v1.3 → v1.4：注控行协议（cmd 统一入口）
在 v1.3 之上追加，不破坏既有函数。"""

P = r"F:\OMORI mod\www_playtest_2c7c22ee\ai_play.js"
s = open(P, encoding="utf-8").read()

# ---------- 版本 ----------
s = s.replace("version: '1.3',", "version: '1.4',", 1)

# ---------- 在导出注释前插入协议层 ----------
anchor = "    // ---------- 导出 ----------"
assert anchor in s

NEW = r'''    // ========================================================================
    // v1.4 注控行协议 —— 所有操作的统一入口
    //   AIPLAY.cmd("动作", 参数对象) → Promise<{ok, data|error}>
    //   动作表见 AIPLAY.cmd.actions（可扩展：actions.xxx = fn）
    //   设计原则：每个动作 = 幂等可重放 + 返回结构化结果 + 失败不抛出
    // ========================================================================
    var ACTIONS = {};

    // ---- 状态查询类 ----
    ACTIONS.status      = function (p) { return status(); };
    ACTIONS.switches    = function (p) { return switches(p && p.ids || [2001,2002,2003,2006]); };
    ACTIONS.errors      = function (p) { return errors(p && p.n || 10); };
    ACTIONS.variables   = function (p) {
        var o = {};
        (p.ids || []).forEach(function (id) { o[id] = $gameVariables.value(id); });
        return o;
    };
    ACTIONS.position    = function (p) {
        return { mapId: $gameMap._mapId, x: $gamePlayer.x, y: $gamePlayer.y,
                 dir: $gamePlayer.direction(), mapName: $dataMap ? $dataMap.displayName : '' };
    };

    // ---- 移动/交互类 ----
    ACTIONS.walk        = function (p) { walk(p.dir, p.steps || 1); return { pos: '(' + $gamePlayer.x + ',' + $gamePlayer.y + ')' }; };
    ACTIONS.pathTo      = function (p) { return pathTo(p.x, p.y); };
    ACTIONS.talkTo      = function (p) { return talkTo(p.x, p.y); };
    ACTIONS.tap         = function (p) { tap(p.btn || 'ok', p.hold); return { done: true }; };
    ACTIONS.interact    = function (p) { interact(); return { done: true }; };
    ACTIONS.face        = function (p) { $gamePlayer.setDirection(p.dir); frames(3); return { dir: p.dir }; };

    // ---- 对话推进 ----
    // p.choice: 选项序号（有选项窗时自动选）；p.untilFree: 等到完全空闲
    ACTIONS.advance     = function (p) {
        return advanceDialog((p && p.seconds) || 20, p && p.choice, p && p.onText).then(function (r) {
            r.pos = '(' + $gamePlayer.x + ',' + $gamePlayer.y + ')';
            return r;
        });
    };
    // 推进直到解释器空闲（长过场专用；比 advance 更耐心）
    ACTIONS.advanceAll  = function (p) {
        var maxSec = (p && p.seconds) || 60;
        return new Promise(function (resolve) {
            var start = Date.now();
            var t = setInterval(function () {
                var busy = ($gameMessage && $gameMessage.isBusy()) ||
                           ($gameMap._interpreter && $gameMap._interpreter.isRunning());
                if (busy) { Input._currentState['ok'] = true; }
                else { Input._currentState['ok'] = false; }
                frames(12);
                if ((!busy && $gamePlayer && !$gamePlayer.isMoving() && Date.now() - start > 1500) ||
                    Date.now() - start > maxSec * 1000) {
                    clearInterval(t);
                    Input._currentState['ok'] = false;
                    resolve({ done: true, pos: '(' + $gamePlayer.x + ',' + $gamePlayer.y + ')',
                              mapId: $gameMap._mapId });
                }
            }, 100);
        });
    };
    // 选项专用：不动消息，只选第 N 项
    ACTIONS.choose      = function (p) {
        var sc = SceneManager._scene, cw = null;
        if (sc && sc._messageWindow && sc._messageWindow._choiceWindow) { cw = sc._messageWindow._choiceWindow; }
        if (!cw || !cw.active) { return { ok: false, reason: '无活跃选项窗' }; }
        var target = (p && p.index !== undefined) ? p.index : 0;
        var guard = 0;
        while (cw.index() !== target && guard++ < 10) {
            Input._currentState['down'] = true; frames(4); Input._currentState['down'] = false; frames(4);
        }
        Input._currentState['ok'] = true; frames(4); Input._currentState['ok'] = false; frames(6);
        return { ok: true, chosen: cw._list ? (cw._list[target] || {}).name : target };
    };

    // ---- 场景宏 ----
    ACTIONS.newGame     = function (p) { return Promise.resolve(newGame()); };
    ACTIONS.openBook    = function (p) { return Promise.resolve(openBook(p.book, p.page, p.speed, p.mode)); };
    ACTIONS.testBook    = function (p) { return testBook(p.book, p.page); };
    ACTIONS.testAllBooks= function (p) { return testAllBooks(); };
    ACTIONS.gotoMap     = function (p) { return gotoMap(p.mapId, p.x, p.y); };
    ACTIONS.gotoTitle   = function (p) { return Promise.resolve(bootToTitle()); };
    ACTIONS.forceMapLoad= function (p) { forceMapLoad(p.mapId); return { done: true }; };
    ACTIONS.feedLanguages = function (p) { return feedLanguages(p && p.lang || 'sc'); };

    // ---- 事件/数据操作（调试用） ----
    ACTIONS.runEvent    = function (p) {
        // 直接启动某事件（不经玩家接触）：找事件→start
        var ev = $gameMap.event(p.eventId);
        if (!ev) { return { ok: false, reason: '事件不存在' }; }
        ev.start();
        frames(5);
        return { started: ev.event().name };
    };
    ACTIONS.setSwitch   = function (p) { $gameSwitches.setValue(p.id, !!p.on); return { id: p.id, on: p.on }; };
    ACTIONS.setVariable = function (p) { $gameVariables.setValue(p.id, p.value); return { id: p.id, value: p.value }; };
    ACTIONS.eval        = function (p) {
        // 兜底逃生口：直接执行任意表达式（最后手段，正常流程不该用）
        try { return { ok: true, result: String(eval(p.code)) }; }
        catch (e) { return { ok: false, error: e.message }; }
    };

    // ---- 协议入口 ----
    function cmd(action, params) {
        var fn = ACTIONS[action];
        if (!fn) {
            return Promise.resolve({ ok: false, error: '未知动作: ' + action,
                                     available: Object.keys(ACTIONS) });
        }
        var result;
        try { result = fn(params || {}); }
        catch (e) { return Promise.resolve({ ok: false, error: e.message, action: action }); }
        return Promise.resolve(result).then(function (data) {
            return { ok: true, action: action, data: data,
                     pos: ($gamePlayer && $gameMap && $gameMap._mapId > 0) ?
                          '(' + $gamePlayer.x + ',' + $gamePlayer.y + ')@M' + $gameMap._mapId : undefined };
        });
    }
    // 顺序执行多条命令（前一条失败即停）
    function seq(list) {
        var results = [];
        var chain = Promise.resolve();
        list.forEach(function (item) {
            chain = chain.then(function () {
                return cmd(item.action, item).then(function (r) {
                    results.push(r);
                    if (r.ok === false && item.stopOnError !== false) { throw { stop: true, results: results }; }
                });
            });
        });
        return chain.then(function () { return { ok: true, results: results }; })
                    .catch(function (e) {
                        if (e && e.stop) { return { ok: false, results: e.results }; }
                        return { ok: false, error: e.message };
                    });
    }

'''
s = s.replace(anchor, NEW + anchor, 1)

# ---------- 导出表 ----------
old_exp = "        pathTo: pathTo, talkTo: talkTo, advanceDialog: advanceDialog, clearKeys: clearKeys,"
new_exp = """        pathTo: pathTo, talkTo: talkTo, advanceDialog: advanceDialog, clearKeys: clearKeys,
        cmd: cmd, seq: seq, actions: ACTIONS,"""
assert old_exp in s
s = s.replace(old_exp, new_exp, 1)

open(P, "w", encoding="utf-8").write(s)
print("✅ ai_play.js v1.4：cmd/seq 注控行协议 + 22 个动作")
