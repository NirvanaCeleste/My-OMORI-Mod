//=============================================================================
// AIPLAY —— AI 自动游玩控制器 v1.0
//=============================================================================
// 在 ai_test.html 中加载。把"AI 开游戏自己玩"所需的全部底层技巧
// （数据注入/场景装配/帧驱动/按键注入/状态断言）封装成一个干净接口：
//
//   await AIPLAY.openBook('00_MOD_book_night0', 'musicroom')   打开一本书
//   await AIPLAY.testBook('00_MOD_book_night0', 'musicroom')   自动玩一个修改决策并判定
//   await AIPLAY.testAllBooks()                                四本书一键回归
//   await AIPLAY.gotoMap(519); AIPLAY.walk('down', 3); AIPLAY.interact()
//   AIPLAY.status(); AIPLAY.switches([2001,2002,2003]); AIPLAY.errors()
//   AIPLAY.tap('ok'); AIPLAY.taps('ok','ok'); AIPLAY.frames(60)
//
// 底层原则（docs/AI测试环境_20260930.md 实战表）：
//   · 游戏数据：同步 XHR + jsyaml 直接注入 LanguageManager._data
//   · 场景切换：goto 会被闪屏劫持 → 手工装配（new+prepare+create+start）
//   · 帧驱动：IAB 后台节流 → 同步泵 scene.update()/Input.update()
//   · 输入：Input._currentState 按【按钮名】键控（'ok'=Z，'cancel'=X/Esc…）
//=============================================================================
(function () {
    'use strict';
    var LOG = [];
    function L(msg) {
        LOG.push(msg);
        if (LOG.length > 800) { LOG.shift(); }
        try { window.__log && window.__log('aiplay', [msg]); } catch (e) {}
    }

    // ---------- 定时器注册表（v1.5：防僵尸循环，reset 可统一 kill） ----------
    var _timerSeq = 0;
    var _timers = {};
    var _origSetInterval = window.setInterval.bind(window);
    var _origClearInterval = window.clearInterval.bind(window);
    window.setInterval = function (fn, ms) {
        var id = _origSetInterval(fn, ms);
        _timers[id] = fn;
        return id;
    };
    window.clearInterval = function (id) {
        delete _timers[id];
        return _origClearInterval(id);
    };

    // ---------- 帧驱动 ----------
    function frames(n) {
        for (var i = 0; i < n; i++) {
            try {
                // 完整复刻引擎主循环（SceneManager.updateMain 的核心三步）：
                // 1) Scene_Map.updateMain 有真实时间门槛 → 每帧归零 _currentTime 穿越
                var _sc = SceneManager._scene;
                if (_sc && _sc._currentTime !== undefined) { _sc._currentTime = 0; }
                // 2) changeScene：terminate 旧场景 + create 新场景（引擎自己的交接，不抢跑）
                if (SceneManager.isSceneChanging() && !SceneManager.isCurrentSceneBusy()) {
                    SceneManager.changeScene();
                }
                // 3) updateScene：isReady 后自动 start()，start 后才 update()
                //    （直接调 scene.update() 会跳过 start 链 → 场景卡死，2026-10-01 教训）
                if (window.Input) { Input.update(); }   // 先刷输入（dir4 getter 依赖）
                if (window.TouchInput) { TouchInput.update(); }
                SceneManager.updateScene();
            } catch (e) {
                L('帧错误: ' + e.message);
                return false;
            }
        }
        return true;
    }
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    // ---------- 输入注入（按钮名，非键码） ----------
    function tap(btn, hold) {
        Input._currentState[btn] = true;
        frames(hold || 2);
        Input._currentState[btn] = false;
        frames(2);
        L('tap ' + btn);
    }
    function taps() {
        for (var i = 0; i < arguments.length; i++) { tap(arguments[i]); }
    }
    function walk(dir, steps) {
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
    }
    function interact() { tap('ok'); }

    // ---------- 数据注入 ----------
    function loadYaml(path, name) {
        var x = new XMLHttpRequest();
        x.open('GET', path, false);
        x.send();
        if (x.status !== 200) { throw new Error('loadYaml HTTP ' + x.status + ': ' + path); }
        var doc = (window.jsyaml || window.YAML).load(x.responseText);
        var lang = path.indexOf('/en/') >= 0 ? 'en' : 'sc';
        LanguageManager._data = LanguageManager._data || {};
        LanguageManager._data[lang] = LanguageManager._data[lang] || { text: {} };
        var key = name || path.replace(/^.*\//, '').replace(/\.[^.]*$/, '');
        LanguageManager._data[lang].text[key] = doc;
        L('注入 yaml: ' + key + ' (' + lang + ')');
        return doc;
    }
    function loadBook(name) { return loadYaml('languages/sc/' + name + '.yaml', name); }

    // ---------- 场景装配（绕过被劫持的 goto） ----------
    function assemble(SceneClass, prepareArgs) {
        try { if (SceneManager._scene && SceneManager._scene.stop) { SceneManager._scene.stop(); } } catch (e) { L('stop忽略: ' + e.message); }
        var s = new SceneClass();
        SceneManager._scene = s;
        SceneManager._nextScene = null;
        if (prepareArgs && s.prepare) { s.prepare.apply(s, prepareArgs); }
        s.create();
        if (!s._started && s.start) { s.start(); }
        // 关键：手动 start 后必须对齐引擎标志位，否则真实主循环的 updateScene 会
        // 再 start() 一次，把窗口/选句状态二次初始化（流程内必现、单独跑偶过的真根因）
        SceneManager._sceneStarted = true;
        L('装配场景 ' + (SceneClass.name || 'Scene'));
        return s;
    }

    // ---------- 书 ----------
    // 全同步：IAB 后台标签的 setInterval/setTimeout 被节流至 ~1Hz，
    // 因此不依赖真实定时器；开场/书写动画直接强制收尾（finishIntro/finishWriting）
    function openBook(book, page, speed, mode) {
        loadBook(book);
        if (window.Galv && Galv.ASPLASH) { Galv.ASPLASH.splashed = true; }
        DataManager.createGameObjects();
        $gameSwitches.setValue(2005, true);          // 跳过首次提示窗
        var s = assemble(Scene_UnwrittenStory, [book, page || null, speed || 1, mode || 'sequential']);
        frames(60);                                  // 让开场动画自然走一部分
        if (s._introPhase !== 99) { s.finishIntro(); }        // 强制收尾开场
        frames(5);
        if (s._bookWindow && s._bookWindow._writing) { s._bookWindow.finishWriting(); }
        frames(5);
        if (s._hintWindow) { s.closeHint(); }
        $gameSwitches.setValue(2005, true);
        L('openBook ' + book + '#' + (page || '(首页)') + ' 就绪');
        return s;
    }

    // ---------- 地图 ----------
    function gotoMap(mapId, x, y) {
        if (!$gameMap) { DataManager.createGameObjects(); }
        if (window.Galv && Galv.ASPLASH) { Galv.ASPLASH.splashed = true; }
        $gameMap.setup(mapId);                        // 触发地图数据加载
        $gamePlayer._mapId = mapId;
        $gamePlayer.locate(x !== undefined ? x : $gameMap.startX(),
                           y !== undefined ? y : $gameMap.startY());
        return new Promise(function (resolve) {
            var i = 0;
            var t = setInterval(function () {
                i++;
                if ($gameMap.isReady() || i > 100) {
                    clearInterval(t);
                    var s = assemble(Scene_Map);
                    frames(10);
                    resolve({ scene: s, mapId: mapId, x: $gamePlayer.x, y: $gamePlayer.y });
                }
            }, 30);
        });
    }

    // ---------- 状态/断言 ----------
    function switches(list) {
        var o = {};
        (list || []).forEach(function (id) { o[id] = $gameSwitches.value(id); });
        return o;
    }
    function errors(n) {
        return (window.__bootlog || []).filter(function (l) {
            return l.indexOf('onerror') >= 0 || l.indexOf('catchException') >= 0 || l.indexOf('SceneManager.onError') >= 0;
        }).slice(-(n || 10));
    }
    function status() {
        var s = SceneManager._scene;
        var out = {
            scene: s ? s.constructor.name : null,
            frameCount: Graphics.frameCount,
            errors: errors(3),
            switches: {}
        };
        if ($gameSwitches) { out.switches = { 2001: $gameSwitches.value(2001), 2002: $gameSwitches.value(2002), 2003: $gameSwitches.value(2003), 2006: $gameSwitches.value(2006) }; }
        if ($gameMap && $gameMap._mapId) { out.map = { id: $gameMap._mapId, x: $gamePlayer.x, y: $gamePlayer.y }; }
        if ($gameUnwrittenStory && $gameUnwrittenStory.bookState) {
            out.bookStates = $gameUnwrittenStory._bookState || {};
        }
        if (s && s._bookWindow) {
            out.book = { page: String(s._pageKey), stateIdx: s._stateIndex,
                         stateId: s._states && s._states[s._stateIndex] ? s._states[s._stateIndex].id : null,
                         writing: s._bookWindow._writing };
        }
        return out;
    }

    // ---------- 一键自测 ----------
    // 自动玩一个"修改"决策：找第一个可编辑句→选句→修改→变体0→等过渡→判定
    function testBook(book, page) {
        var rep = { book: book, page: page || null, pass: false, steps: [] };
        try {
            var s = openBook(book, page);
            var b = s._bookWindow;
            if (b._writing) { b.finishWriting(); frames(5); }
            if (s._hintWindow) { s.closeHint(); }
            // 找可编辑句并直达其子页
            var target = -1;
            for (var f = 0; f < b._flat.length; f++) {
                if (b.isEditableFlat(f)) { target = f; break; }
            }
            if (target < 0) { throw new Error('没有可编辑句'); }
            var seg = b.segAt(target);
            b.gotoFlatSubPage(target);
            frames(3);
            var idxBefore = s._stateIndex;
            // 四连击：选句 → 动作菜单(修改) → 变体窗 → 确认变体0
            tap('ok'); frames(3);
            tap('ok'); frames(3);
            tap('ok'); frames(3);
            tap('ok'); frames(3);
            // 等两阶段过渡
            var g = 0;
            while (b._transitionActive && g++ < 300) { frames(10); }
            frames(10);
            var st = $gameUnwrittenStory.sentenceState(b._pageKey, seg.id, s._yamlFile);
            rep.steps.push('stateIdx: ' + idxBefore + ' → ' + s._stateIndex);
            rep.steps.push('sentence(' + seg.id + '): ' + JSON.stringify(st));
            rep.steps.push('lastOp: ' + JSON.stringify($gameUnwrittenStory._lastOperation));
            rep.steps.push('bookState: ' + JSON.stringify($gameUnwrittenStory.bookState(s._yamlFile)));
            rep.pass = !!st.modified;
            rep.detail = { sentence: st, stateIdx: s._stateIndex };
            L('testBook ' + book + ' → ' + (rep.pass ? 'PASS' : 'FAIL'));
        } catch (e) {
            rep.error = e.message;
            L('testBook ' + book + ' → 异常: ' + e.message);
        }
        return Promise.resolve(rep);
    }
    function testAllBooks() {
        var books = [
            ['00_MOD_book_night0', 'musicroom'],
            ['00_MOD_book_night1', 'rehearsal'],
            ['00_MOD_book_night2', 'room'],
            ['00_MOD_book_blocks_demo', 'demo']
        ];
        var results = [];
        // 用 Promise 微任务链推进（微任务不受后台节流影响）
        var chain = Promise.resolve();
        books.forEach(function (bk) {
            chain = chain.then(function () {
                return testBook(bk[0], bk[1]).then(function (r) {
                    results.push(r);
                    frames(20);
                });
            });
        });
        return chain.then(function () {
            var allPass = results.every(function (r) { return r.pass; });
            L('testAllBooks → ' + (allPass ? 'ALL PASS' : 'HAS FAIL'));
            return { allPass: allPass, results: results };
        });
    }

    // ---------- 寻路与交互（v1.3，实战中长出来的） ----------
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
        var arrived = ($gamePlayer.x === x && $gamePlayer.y === y);
        var failed = trail.filter(function (s) { return s.charAt(s.length - 1) === '!'; }).length;
        return { ok: arrived && failed === 0, arrived: arrived,
                 reason: failed ? '有 ' + failed + ' 步没走动（解释器占用/碰撞）' : (arrived ? '' : '未到达目标'),
                 trail: trail, pos: '(' + $gamePlayer.x + ',' + $gamePlayer.y + ')' };
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
                else if (Date.now() - start > maxSeconds * 1000) {
                    clearInterval(t);
                    Input._currentState['ok'] = false;   // 超时也要松键，别把 ok 焊死给下个环节
                    resolve({ done: false, pressed: pressed, texts: texts, timeout: true });
                }
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

    // ========================================================================
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
    ACTIONS.reset       = function (p) { return wait(1).then(function () { return reset(); }); };
    ACTIONS.testStoryFlow = function (p) { return testStoryFlow(); };
    ACTIONS.testSaveLoad  = function (p) { return Promise.resolve(testSaveLoad()); };
    ACTIONS.visualCheck   = function (p) { return Promise.resolve(visualCheck()); };

    // ---- v1.7 战斗 ----
    ACTIONS.battle       = function (p) { return battleSetup(p && p.troopId !== undefined ? p.troopId : 12, p || {}); };
    ACTIONS.battleStatus = function (p) { return Promise.resolve(battleStatus()); };
    ACTIONS.battleAttack = function (p) { return battleAttackOnce(p && p.target); };
    ACTIONS.testBattle   = function (p) { return testBattle(p && p.troopId, p && p.maxTurns); };

    // ---- v1.7 探索 ----
    ACTIONS.explore      = function (p) { return explore(p || {}); };

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

    // ---------- v1.6：强制完成场景交换（等价 changeScene，仅绕过 isBusy） ----------    // 启动期 Scene_SplashScreens 会长期 isBusy()，把 SceneManager.changeScene 卡死，
    // _nextScene 一直换不过去（实测：reset 后 scene 仍是闪屏、next 排队中）。
    function forceSwapScene() {
        var sm = SceneManager;
        if (sm._scene) {
            try { sm._scene._fadeDuration = 0; } catch (e) {}   // isBusy 的来源先清掉
            try { sm._scene.terminate(); } catch (e) {}
            try { sm._scene.detachReservation(); } catch (e) {}
            sm._previousClass = sm._scene.constructor;
        }
        sm._scene = sm._nextScene;
        if (sm._scene) {
            try { sm._scene.attachReservation(); } catch (e) {}
            sm._scene.create();
            sm._nextScene = null;
            sm._sceneStarted = false;
            if (sm.onSceneCreate) { try { sm.onSceneCreate(); } catch (e) {} }
        }
    }

    // ---------- v1.5：reset（原地满血重建） ----------
    function reset() {
        // ① kill 全部注册定时器
        var killed = 0;
        for (var id in _timers) { _origClearInterval(Number(id)); delete _timers[id]; killed++; }
        // ② 清按键
        ['down','up','left','right','ok','cancel','shift','menu','control'].forEach(function (k) { Input._currentState[k] = false; });
        Input.update();
        // ③ 重建游戏对象 + 语言
        feedLanguages('sc');
        DataManager.createGameObjects();
        // ④ 回标题：goto 后强制完成交换（闪屏 busy 不再能卡住），terminate 若再排队新场景则循环消化
        if (window.Galv && Galv.ASPLASH) { Galv.ASPLASH.splashed = true; }
        SceneManager.goto(Scene_OmoriTitleScreen);
        var swaps = 0;
        while (SceneManager._nextScene && swaps++ < 10) { forceSwapScene(); }
        // ⑤ 泵帧直到标题场景 start 完（命令数据在 create() 生成，窗口要等 start()）
        var ready = pumpUntil(function () {
            var t = SceneManager._scene;
            return t && t.constructor.name === 'Scene_OmoriTitleScreen' &&
                   t._titleCommands && t._titleCommands.length > 0 &&
                   (!t.isStarted || t.isStarted());
        }, 40, 15, 40);
        var sname = SceneManager._scene ? SceneManager._scene.constructor.name : '?';
        L('reset: kill=' + killed + ' 定时器, 回标题 ' + sname + (ready.ok ? ' (ready)' : ' (未就绪)'));
        return { killedTimers: killed, scene: sname, titleReady: ready.ok };
    }

    // ---------- v1.5：视觉断言 ----------
    function visualCheck() {
        try {
            var canvas = (Graphics && Graphics._canvas) || document.querySelector('canvas');
            if (!canvas) { return { kind: 'no-canvas' }; }
            var probe = document.createElement('canvas');
            probe.width = 64; probe.height = 48;
            var ctx = probe.getContext('2d');
            ctx.drawImage(canvas, 0, 0, 64, 48);
            var data = ctx.getImageData(0, 0, 64, 48).data;
            var dark = 0, red = 0, total = 64 * 48;
            for (var i = 0; i < data.length; i += 4) {
                if (data[i] < 24 && data[i+1] < 24 && data[i+2] < 24) { dark++; }
                if (data[i] > 150 && data[i+1] < 80 && data[i+2] < 80) { red++; }
            }
            var kind = 'normal';
            if (dark / total > 0.97) { kind = 'black'; }
            if (red / total > 0.02) { kind = 'error-overlay'; }
            return { kind: kind, darkRatio: +(dark / total).toFixed(3) };
        } catch (e) { return { kind: 'probe-error', error: e.message }; }
    }
    function domErrorCheck() {
        var found = [];
        Array.from(document.body.children).forEach(function (el) {
            if (el.tagName === 'DIV' && (el.textContent.indexOf('Cannot read') >= 0 ||
                el.textContent.indexOf('TypeError') >= 0)) { found.push(el.textContent.slice(0, 60)); }
        });
        var gerr = Graphics && Graphics._errorPrinter && Graphics._errorPrinter.style.display !== 'none';
        return { domErrors: found, graphicsErrorVisible: !!gerr };
    }
    function assertVisual() {
        var v = visualCheck();
        var d = domErrorCheck();
        var ok = (v.kind === 'normal' || v.kind === 'black') && d.domErrors.length === 0 && !d.graphicsErrorVisible;
        return { ok: ok, visual: v, dom: d };
    }

    // ---------- v1.6：存读档回归（异步——浏览器存档是 XHR，同步泵等不到） ----------
    function testSaveLoad() {
        var rep = { steps: [] };
        try {
            if (!$gameMap || $gameMap._mapId === 0) { return Promise.resolve({ ok: false, reason: '不在游戏中' }); }
            $gameSwitches.setValue(2001, true);
            $gameSystem.onBeforeSave();
            var saveOk = DataManager.saveGame(1);
            rep.steps.push('saveGame(1): ' + saveOk);
            if (!saveOk) { rep.ok = false; return Promise.resolve(rep); }
            $gameSwitches.setValue(2001, false);
            var loadOk = DataManager.loadGame(1);
            rep.steps.push('loadGame(1): ' + loadOk);
            SceneManager.goto(Scene_Map);
            AIPLAY.frames(30);
            // 读档数据经异步 XHR 回来才写进 $gameSwitches；frames() 同步泵不让出事件循环，
            // 立即断言会读到改回的 false（v1.6 实测踩坑）
            return waitFor(function () { return $gameSwitches.value(2001) === true; }, 8000).then(function (w) {
                var sw = $gameSwitches.value(2001);
                rep.steps.push('开关2001读档后: ' + sw + (w.ok ? '' : '(等待超时)'));
                rep.pass = !!(loadOk && sw);
                rep.ok = rep.pass;
                L('testSaveLoad → ' + (rep.ok ? 'PASS' : 'FAIL'));
                return rep;
            });
        } catch (e) { rep.ok = false; rep.error = e.message; return Promise.resolve(rep); }
    }

    // ---------- 异步等待条件（setTimeout 让出主线程，由真实主循环/Worker 驱动推进） ----------
    // pumpUntil 的同步忙等会把主线程焊死 → Worker 消息进不来 → 长链路（newGame 转移等）
    // 反而停摆。凡条件靠"游戏自己走"满足的等待都用本函数；frames() 泵只用于短步进。
    function waitFor(condFn, timeoutMs, checkMs) {
        timeoutMs = timeoutMs || 30000; checkMs = checkMs || 120;
        return new Promise(function (resolve) {
            var t0 = Date.now();
            (function check() {
                var v;
                try { v = condFn(); } catch (e) { v = false; }
                if (v) { resolve({ ok: true, ms: Date.now() - t0 }); return; }
                if (Date.now() - t0 > timeoutMs) { resolve({ ok: false, ms: Date.now() - t0 }); return; }
                setTimeout(check, checkMs);
            })();
        });
    }

    // ---------- v1.5：全流程一键回归 ----------
    function testStoryFlow() {
        var R = { steps: [], visual: [] };
        function step(name, ok, detail) {
            R.steps.push((ok ? '✅ ' : '❌ ') + name + (detail ? ' | ' + detail : ''));
            return ok;
        }
        return wait(1).then(function () {   // 延迟一拍：reset 的 pumpUntil 同步阻塞 2-4s，
        // 直接在 Promise 执行器里跑会把调用方（浏览器 evaluate 通道 3s 超时）堵死
            var r0 = reset();
            step('reset', r0.scene === 'Scene_OmoriTitleScreen', 'kill ' + r0.killedTimers + ' 定时器');
            var s = SceneManager._scene;
            var titleOK = !!(s && s._titleCommands && s._titleCommands.length > 0);
            step('标题命令窗', titleOK);
            if (!titleOK) { finish(); return Promise.resolve(R); }
            s.commandNewGame();
            // 新游戏链路 = 标题淡出 + 531(Cursor) + 转移 516 + 资源解码，靠真实主循环推进
            return waitFor(function () {
                var sc = SceneManager._scene;
                return sc && sc.constructor.name === 'Scene_Map' && $gameMap &&
                       $gameMap._mapId > 0 && !$gamePlayer.isTransferring();
            }, 90000).then(function (res) {
                step('newGame→Map', res.ok, 'Map' + ($gameMap ? $gameMap._mapId : '?') + ' ' + res.ms + 'ms');
                if (!res.ok) { finish(); return R; }
                return advanceDialog(240).then(function (adv) {
                    step('开场对话', adv.done, '按' + adv.pressed + '次');
                    var sx = $gamePlayer.x, sy = $gamePlayer.y;
                    // 新游戏起始地图会随作者改版漂移（曾为 516 梦境开场，现为 520 IPSU_DAY），
                    // 固定坐标目标会过时 → 改用地图无关的"自由行走"断言（多方向试探）
                    AIPLAY.walk('down', 2);
                    AIPLAY.walk('left', 2);
                    var moved = Math.abs($gamePlayer.x - sx) + Math.abs($gamePlayer.y - sy);
                    if (moved < 2) { AIPLAY.walk('up', 2); AIPLAY.walk('right', 2);
                        moved = Math.abs($gamePlayer.x - sx) + Math.abs($gamePlayer.y - sy); }
                    step('自由行走', moved >= 2,
                         '位移' + moved + '格 (' + sx + ',' + sy + ')→(' + $gamePlayer.x + ',' + $gamePlayer.y + ')');
                    step('玩家可控', $gamePlayer.canMove());
                    // 存读档必须在书测试之前：testBook 会重建游戏对象并停在书场景，
                    // 之后 $gameMap._mapId === 0，testSaveLoad 的"不在游戏中"前置会拦掉
                    return testSaveLoad().then(function (sl) {
                        step('存读档回归', sl.ok, JSON.stringify(sl.steps || sl.reason || []));
                        // saveLoad 末尾 goto(Scene_Map) 的换场若未安顿，openBook 的场景装配会
                        // 和地图场景抢跑 → 书决策 tap 落空（v1.6 实测：流程内 FAIL、单独跑 PASS）
                        return waitFor(function () {
                            var sc = SceneManager._scene;
                            return sc && sc.constructor.name === 'Scene_Map' &&
                                   $gameMap && $gameMap._mapId > 0 &&
                                   !($gameMap._interpreter && $gameMap._interpreter.isRunning());
                        }, 15000).then(function (settle) {
                            // 首跑书测试可能被地图自动事件的残留对话层吃掉几次 tap（单独跑必过）→
                            // 失败重开一次（openBook 自包含重建）
                            return testBook('00_MOD_book_night0', 'musicroom').then(function (r1) {
                                if (!r1.pass) { return testBook('00_MOD_book_night0', 'musicroom'); }
                                return r1;
                            }).then(function (r1) {
                                step('night0 书决策', r1.pass,
                                     'stateIdx→' + (r1.detail ? r1.detail.stateIdx : '?') +
                                     (settle.ok ? '' : '(地图未安顿)'));
                                finish();
                                return R;
                            });
                        });
                    });
                });
            });
            function finish() {
                R.pass = R.steps.every(function (x) { return x.charAt(0) === '✅'; });
                L('testStoryFlow → ' + (R.pass ? 'PASS' : 'FAIL'));
            }
        }).catch(function (e) {
            R.steps.push('❌ 异常 | ' + ((e && e.message) || String(e)));
            R.pass = false;
            L('testStoryFlow → FAIL(异常)');
            return R;
        });
    }

    // ---------- 导出 ----------

    // ---------- 语言全量同步喂入（目录列表解析） ----------
    function feedLanguages(lang) {
        lang = lang || 'sc';
        var get = function (url) { var x = new XMLHttpRequest(); x.open('GET', url, false); x.send(); return x.responseText; };
        var html = get('languages/' + lang + '/');
        var files = [];
        var re = /href="([^"?\/]+\.yaml)"/g, m;
        while ((m = re.exec(html)) !== null) { files.push(m[1]); }
        LanguageManager._data = LanguageManager._data || {};
        LanguageManager._data[lang] = { text: {} };
        var fail = 0;
        for (var i = 0; i < files.length; i++) {
            try {
                var doc = (window.jsyaml || window.YAML).load(get('languages/' + lang + '/' + files[i]));
                if (doc) { LanguageManager._data[lang].text[files[i].replace(/\.yaml$/, '')] = doc; }
            } catch (e) { fail++; }
        }
        LanguageManager._language = lang;
        L('feedLanguages(' + lang + '): ' + (files.length - fail) + '/' + files.length);
        return { total: files.length, fail: fail };
    }

    // ---------- 泵帧直到条件满足（带真实时间让图片/地图异步加载） ----------
    function pumpUntil(condFn, maxBatches, framesPerBatch, gapMs) {
        maxBatches = maxBatches || 60; framesPerBatch = framesPerBatch || 15; gapMs = gapMs || 50;
        var t0 = Date.now();
        for (var b = 0; b < maxBatches; b++) {
            frames(framesPerBatch);
            var v;
            try { v = condFn(); } catch (e) { v = false; }
            if (v) { return { ok: true, batches: b, ms: Date.now() - t0 }; }
            if (gapMs > 0) { var s0 = Date.now(); while (Date.now() - s0 < gapMs) {} }
        }
        return { ok: false, batches: maxBatches, ms: Date.now() - t0 };
    }

    // ---------- 数据补丁（OMORI 不用标准装备/灵气系统） ----------
    function patchDataForTest() {
        for (var i = 1; i < $dataClasses.length; i++) {
            if ($dataClasses[i] && !$dataClasses[i].equipSlots) { $dataClasses[i].equipSlots = [1, 2, 3, 4]; }
        }
        var ea = { all: [], friends: [], opponents: [], party: [], troop: [] };
        for (var j = 1; j < $dataStates.length; j++) {
            if ($dataStates[j] && !$dataStates[j].aura) { $dataStates[j].aura = JSON.parse(JSON.stringify(ea)); }
        }
        L('patchDataForTest: equipSlots + aura 补齐');
    }

    // ---------- 同步预载地图数据（绕异步 XHR） ----------
    function forceMapLoad(mapId) {
        var get = function (url) { var x = new XMLHttpRequest(); x.open('GET', url, false); x.send(); return x.responseText; };
        $dataMap = JSON.parse(get('data/Map' + mapId + '.json'));
        DataManager.onLoad($dataMap);
        DataManager._tempTiledData = JSON.parse(get('maps/Map' + mapId + '.json'));
        (DataManager._tempTiledData.tilesets || []).forEach(function (ts) {
            if (ts.source) {
                try { Object.assign(ts, JSON.parse(get('maps/' + ts.source.replace(/^.*[\/]/, '')))); } catch (e) {}
            }
        });
        DataManager._tiledLoaded = true;
        DataManager._tilesetToLoad = 0;
        L('forceMapLoad(' + mapId + ') 完成');
    }

    // ---------- 完整新游戏流程（v1.2：实测打通 531→516） ----------
    // 前提：页面已加载 20s+（数据库异步已到）
    // 全程同步，无需真实等待
    function newGame() {
        var report = { steps: [] };
        try {
            // ① 语言 + 数据补丁
            if (!LanguageManager._data || !LanguageManager._data[LanguageManager._language] ||
                !LanguageManager._data[LanguageManager._language].text ||
                Object.keys(LanguageManager._data[LanguageManager._language].text).length < 50) {
                feedLanguages('sc');
                report.steps.push('语言喂入');
            }
            patchDataForTest();
            report.steps.push('数据补丁');

            // ② 新游戏
            DataManager.setupNewGame();
            report.steps.push('setupNewGame');

            // ③ 同步加载 531 + setup + locate
            forceMapLoad(531);
            $gameMap.setup(531);
            $gamePlayer.locate(4, 6);
            $gamePlayer.setDirection(2);
            report.steps.push('Map531 setup');

            // ④ INITIALIZE autorun → 解释器跑到 transfer(516)
            $gameMap.updateStartingEvents();
            var interp = $gameMap._interpreter;
            if (!interp.isRunning()) {
                // 手动启动
                var evs = $gameMap.events();
                for (var e = 0; e < evs.length; e++) {
                    if (evs[e].event().name === 'INITIALIZE') { evs[e].start(); break; }
                }
                report.steps.push('INITIALIZE 手动启动');
            }
            // 推解释器直到 transferring 或到 516
            var guard = 0;
            while ($gameMap._mapId === 531 && guard++ < 100) {
                if ($gameMessage && $gameMessage.isBusy()) { Input._currentState['ok'] = true; }
                $gameMap.update(true);
                Input.update();
            }
            Input._currentState['ok'] = false;

            // ⑤ 如果还在 531（解释器卡在 transfer），同步加载 516 + 手动跳
            if ($gameMap._mapId === 531) {
                forceMapLoad(516);
                $gameMap.setup(516);
                $gamePlayer.locate(12, 7);
                $gamePlayer.setDirection(2);
                $gamePlayer._transferring = false;
                report.steps.push('Map516 手动跳转');
            } else {
                report.steps.push('Map516 引擎转移');
            }

            // ⑥ 强制场景 start（绕 isReady 等图片）
            var sc = SceneManager._scene;
            if (sc && !SceneManager._sceneStarted) {
                sc.start();
                SceneManager._sceneStarted = true;
            }
            AIPLAY.frames(30);
            report.steps.push('场景启动');

            report.ok = true;
            report.mapId = $gameMap._mapId;
            report.mapName = $dataMap ? $dataMap.displayName : '';
            report.x = $gamePlayer.x;
            report.y = $gamePlayer.y;
            L('newGame → Map' + report.mapId + ' (' + report.mapName + ') @(' + report.x + ',' + report.y + ')');
        } catch (e) {
            report.ok = false;
            report.error = e.message;
            L('newGame 异常: ' + e.message);
        }
        return report;
    }

    // ---------- 旧 bootToTitle 保留但简化 ----------
    function bootToTitle() {
        feedLanguages('sc');
        patchDataForTest();
        // 泵帧过 boot → splash → 标题
        AIPLAY.frames(200);
        var cs = SceneManager._scene;
        if (cs && cs.constructor.name === 'Scene_SplashScreens') {
            cs._fadeDuration = 0;
            if (cs.endSplashes) { cs.endSplashes(); }
            AIPLAY.frames(60);
        }
        var t = pumpUntil(function () {
            var s = SceneManager._scene;
            return s && s._titleCommands && s._titleCommands.length > 0;
        }, 30, 15, 60);
        var s = SceneManager._scene;
        return { ok: t.ok, commands: s && s._titleCommands ? s._titleCommands.length : 0 };
    }

    // ---------- 导出 ----------

    // ---------- 语言全量同步喂入（目录列表解析） ----------
    function feedLanguages(lang) {
        lang = lang || 'sc';
        var get = function (url) { var x = new XMLHttpRequest(); x.open('GET', url, false); x.send(); return x.responseText; };
        var html = get('languages/' + lang + '/');
        var files = [];
        var re = /href="([^"?\/]+\.yaml)"/g, m;
        while ((m = re.exec(html)) !== null) { files.push(m[1]); }
        LanguageManager._data = LanguageManager._data || {};
        LanguageManager._data[lang] = { text: {} };
        var fail = 0;
        for (var i = 0; i < files.length; i++) {
            try {
                var doc = (window.jsyaml || window.YAML).load(get('languages/' + lang + '/' + files[i]));
                if (doc) { LanguageManager._data[lang].text[files[i].replace(/\.yaml$/, '')] = doc; }
            } catch (e) { fail++; }
        }
        LanguageManager._language = lang;
        L('feedLanguages(' + lang + '): ' + (files.length - fail) + '/' + files.length);
        return { total: files.length, fail: fail };
    }

    // ---------- 泵帧直到条件满足（带真实时间让图片/地图异步加载） ----------
    function pumpUntil(condFn, maxBatches, framesPerBatch, gapMs) {
        maxBatches = maxBatches || 60; framesPerBatch = framesPerBatch || 15; gapMs = gapMs || 50;
        var t0 = Date.now();
        for (var b = 0; b < maxBatches; b++) {
            frames(framesPerBatch);
            var v;
            try { v = condFn(); } catch (e) { v = false; }
            if (v) { return { ok: true, batches: b, ms: Date.now() - t0 }; }
            if (gapMs > 0) { var s0 = Date.now(); while (Date.now() - s0 < gapMs) {} }
        }
        return { ok: false, batches: maxBatches, ms: Date.now() - t0 };
    }

    // ---------- 标题：喂语言→goto→等命令窗就绪 ----------
    function bootToTitle() {
        if (!LanguageManager._data || !LanguageManager._data[LanguageManager._language] ||
            !LanguageManager._data[LanguageManager._language].text ||
            Object.keys(LanguageManager._data[LanguageManager._language].text).length < 50) {
            feedLanguages('sc');
        }
        if (window.Galv && Galv.ASPLASH) { Galv.ASPLASH.splashed = true; }
        if (!DataManager._databaseLoaded) { DataManager.loadDatabase(); frames(60); }
        var cs = SceneManager._scene;
        if (!cs || cs.constructor.name !== 'Scene_OmoriTitleScreen') {
            SceneManager.goto(Scene_OmoriTitleScreen);
        }
        var res = pumpUntil(function () {
            var s = SceneManager._scene;
            return s && s.constructor.name === 'Scene_OmoriTitleScreen' && s._commandWindow && s._commandWindow._list && s._commandWindow._list.length > 0;
        }, 80, 15, 50);
        var s = SceneManager._scene;
        L('bootToTitle → ' + (res.ok ? 'OK' : '超时') + ' 命令数=' + (s && s._commandWindow ? s._commandWindow._list.length : 0));
        return { ok: res.ok, commands: s && s._commandWindow ? s._commandWindow._list.map(function (c) { return c.name; }) : [] };
    }

    // ---------- 新游戏：走标题的 commandNewGame → 531 → autorun → 516 ----------
    function newGame() {
        // v1.7：改走 reset 的 forceSwap 链（旧 bootToTitle 的 busy 门换场会被闪屏卡死），
        // 且长等待改 waitFor（pumpUntil 忙等会饿死 Worker 驱动的真实主循环）；
        // 返回 Promise（battleSetup/ACTIONS.newGame 都 await 它）
        return wait(1).then(function () {
            var t = reset();
            if (!t.titleReady || t.scene !== 'Scene_OmoriTitleScreen') {
                return { ok: false, stage: 'title', title: t };
            }
            var s = SceneManager._scene;
            if (typeof s.commandNewGame !== 'function') { return { ok: false, stage: 'no commandNewGame' }; }
            s.commandNewGame();
            return waitFor(function () {
                var sc = SceneManager._scene;
                // 注意不用 $gameMap.isReady()：Tiled 装配路径下它可能恒 false，
                // 用 testStoryFlow 已验证的判定（mapId>0 且不在传送中）
                return sc && sc.constructor.name === 'Scene_Map' && $gameMap &&
                       $gameMap._mapId > 0 && !$gamePlayer.isTransferring();
            }, 90000).then(function (res) {
                L('newGame → ' + (res.ok ? 'OK map=' + ($gameMap ? $gameMap._mapId : '?') : '超时'));
                return { ok: res.ok, stage: SceneManager._scene ? SceneManager._scene.constructor.name : null,
                         mapId: $gameMap ? $gameMap._mapId : -1,
                         x: $gamePlayer ? $gamePlayer.x : -1, y: $gamePlayer ? $gamePlayer.y : -1,
                         displayName: $dataMap ? $dataMap.displayName : '' };
            });
        });
    }

    var __exports_marker = window.AIPLAY;

    // ========================================================================
    // v1.7 战斗自动化
    // ========================================================================
    // 窗口直选：按 symbol（或序号）设 index 并触发 handler —— 比 Input 注入稳，
    // OMORI 自定义窗口链（guard→snacks 等重绑定）也能走通
    function windowSelect(w, target) {
        if (!w) { return false; }
        var list = w._list || [];
        var idx = -1;
        if (typeof target === 'string') {
            for (var i = 0; i < list.length; i++) { if (list[i] && list[i].symbol === target) { idx = i; break; } }
        } else { idx = target; }
        if (idx < 0 || idx >= list.length) { return false; }
        w.select(idx);
        w.processOk();
        return true;
    }

    function battleInScene() {
        var sc = SceneManager._scene;
        return !!(sc && sc.constructor.name === 'Scene_Battle');
    }

    function battleStatus() {
        var sc = SceneManager._scene;
        if (!sc || sc.constructor.name !== 'Scene_Battle') {
            return { inBattle: false, scene: sc ? sc.constructor.name : null };
        }
        var actor = BattleManager.actor ? BattleManager.actor() : null;
        var enemies = [];
        try {
            if (window.$gameTroop) {
                enemies = $gameTroop.aliveMembers().map(function (e) {
                    return { name: e.originalName ? e.originalName() : String(e.battlerName() || '?'), hp: e.hp };
                });
            }
        } catch (e) {}
        var actWin = null;
        ['_partyCommandWindow', '_actorCommandWindow', '_enemyWindow', '_skillListWindow', '_itemListWindow']
            .forEach(function (k) { if (sc[k] && sc[k].active) { actWin = k; } });
        return {
            inBattle: true, phase: BattleManager._phase,
            actor: actor ? actor.name() : null,
            actorHp: actor ? (actor.hp + '/' + actor.mhp) : null,
            enemies: enemies, activeWindow: actWin,
            busy: BattleManager.isBusy ? BattleManager.isBusy() : null,
            inputting: BattleManager.isInputting ? BattleManager.isInputting() : null
        };
    }

    // 进入战斗（无游戏局时先自动 newGame）
    function battleSetup(troopId, opts) {
        opts = opts || {};
        return wait(1).then(function () {
            if (!$gameParty || !$gameParty.battleMembers().length ||
                !$gameMap || $gameMap._mapId === 0) {
                return newGame();
            }
            return { ok: true };
        }).then(function (g) {
            if (g && g.ok === false) { return { ok: false, reason: 'newGame 失败: ' + (g.stage || '') }; }
            if (!$dataTroops[troopId]) { return { ok: false, reason: 'troop ' + troopId + ' 不存在' }; }
            // 复刻事件指令 Battle Processing 的调用序列
            BattleManager.setup(troopId, opts.canEscape !== false, !!opts.canLose);
            SceneManager.push(Scene_Battle);
            // 引擎的遇敌换场依赖 scene.stop() 链，本工程实测会把
            // _encounterEffectDuration 置位后无人递减（busy 恒真卡死换场）→
            // 8s 未自然换成就用 forceSwapScene 强换（与 reset 同机制）
            return waitFor(battleInScene, 8000).then(function (w) {
                if (!w.ok && SceneManager._nextScene &&
                    SceneManager._nextScene.constructor.name === 'Scene_Battle') {
                    L('battleSetup: 自然换场卡死(encounter效果)，强制交换');
                    forceSwapScene();
                }
                return waitFor(battleInScene, 15000).then(function (w2) {
                    L('battleSetup troop' + troopId + ' → ' + (w2.ok ? 'OK' : '超时'));
                    return w2.ok ? { ok: true } : { ok: false, reason: '进入战斗超时(' + w2.ms + 'ms)' };
                });
            });
        });
    }

    // 攻击一回合：等输入态 → (party窗fight) → attack → 敌目标0 → 等结算回输入态
    function battleAttackOnce(targetIndex) {
        var sawAction = false;
        // OMORI 战斗入场动画很长（实测 ~30s），窗口会先 active 但命令表为空 →
        // 等待条件必须含"_list 非空"，窗口 45s
        return waitFor(function () {
            if (!battleInScene()) { return true; }
            var sc = SceneManager._scene;
            // 上一回合的收尾动画可能拖很长（隐藏页签下尤其慢）：时机条阶段主动按 ok 加速
            if (BattleManager._phase === 'actionList') {
                Input._currentState['ok'] = !Input._currentState['ok'];
                frames(3);
                return false;
            }
            if (sc._partyCommandWindow && sc._partyCommandWindow.active) {
                windowSelect(sc._partyCommandWindow, 'fight');
                return false;
            }
            var aw = sc._actorCommandWindow;
            return !!(aw && aw.active && aw._list && aw._list.length);
        }, 90000).then(function () {
            Input._currentState['ok'] = false;
            if (!battleInScene()) { return { ok: true, battleOver: true }; }
            var sc = SceneManager._scene;
            var aw = sc._actorCommandWindow;
            if (!aw || !aw.active || !aw._list || !aw._list.length) {
                return { ok: false, reason: '指令窗未就绪' };
            }
            if (!windowSelect(aw, 'actionSkill') && !windowSelect(aw, 'attack')) {
                // OMORI 的攻击命令 symbol 是 actionSkill（实测 Basil 指令窗：
                // actionSkill|攻击, skill|..., guard|防守, item|物品）
                return { ok: false, reason: '指令窗无攻击命令(actionSkill/attack)' };
            }
            frames(20);
            return waitFor(function () {
                if (!battleInScene()) { return true; }
                var s2 = SceneManager._scene;
                // OMORI 攻击后进入 ACTION 时机条阶段（actionList）：主动按 ok 命中时机
                // （不按会长时间自动 miss，伤害只有 ~10）
                if (BattleManager._phase === 'actionList') {
                    Input._currentState['ok'] = !Input._currentState['ok'];
                    frames(3);
                    return false;
                }
                if (s2._enemyWindow && s2._enemyWindow.active) {
                    var ew = s2._enemyWindow;
                    if (ew._list && ew._list.length) { windowSelect(ew, targetIndex || 0); }
                    else { ew.select(0); ew.processOk(); }   // 激活瞬间列表未建：直接确认默认目标（实测有效）
                    sawAction = true;
                    return false;
                }
                if (BattleManager.isInputting && !BattleManager.isInputting()) { sawAction = true; return false; }
                return sawAction && !BattleManager.isBusy();
            }, 90000).then(function () {
                Input._currentState['ok'] = false;
                return { ok: true, battleOver: !battleInScene() };
            });
        });
    }

    // 收尾：胜利结算/失败画面逐个 ok 直到离开战斗场景
    function battleFinish() {
        return waitFor(function () {
            if (!battleInScene()) { return true; }
            Input._currentState['ok'] = !Input._currentState['ok'];
            frames(6);
            return false;
        }, 20000).then(function (w) {
            Input._currentState['ok'] = false;
            return { battleOver: w.ok, scene: SceneManager._scene ? SceneManager._scene.constructor.name : null };
        });
    }

    function testBattle(troopId, maxTurns) {
        // 默认 troop12=森林兔兔x1（HP85，打得死）；troop4 的"TEST NO ATTACK"是 99 万血假人
        troopId = (troopId === undefined || troopId === null) ? 12 : troopId;
        maxTurns = maxTurns || 8;
        var rep = { troopId: troopId, turns: [] };
        L('testBattle troop' + troopId + ' 开始');
        return battleSetup(troopId, { canEscape: false, canLose: false }).then(function (s0) {
            if (!s0.ok) { rep.reason = s0.reason; L('testBattle troop' + troopId + ' → FAIL(进入失败)'); return rep; }
            function next(n) {
                var st = battleStatus();
                if (!st.inBattle) { return Promise.resolve('over'); }
                if (n > maxTurns) { return Promise.resolve('maxturns'); }
                return battleAttackOnce(0).then(function (r) {
                    rep.turns.push({ n: n, ok: r.ok, battleOver: !!r.battleOver, reason: r.reason || '' });
                    if (!r.ok) { return Promise.resolve('error'); }
                    if (r.battleOver) { return Promise.resolve('over'); }
                    return next(n + 1);
                });
            }
            return next(1).then(function (why) {
                rep.endedBy = why;
                return battleFinish().then(function (fin) {
                    rep.finalScene = fin.scene;
                    rep.statusAfter = battleStatus();
                    // 通过标准 = 战斗机制全走通（每回合指令都执行成功且正常终局/打满回合）；
                    // 胜负属于数值内容，不算自动化失败
                    rep.pass = rep.turns.length > 0 &&
                               rep.turns.every(function (t) { return t.ok; }) &&
                               (why === 'over' || why === 'maxturns');
                    L('testBattle troop' + troopId + ' → ' + (rep.pass ? 'PASS' : 'FAIL') +
                      ' (' + rep.turns.length + '回合, ' + why + ')');
                    return rep;
                });
            });
        });
    }

    // ========================================================================
    // v1.7 自由探索：随机游走 + 自动对话/选项 + 错误/卡死/开关变化采集
    //   用途：发现"走到哪会卡死/报错"这类设计者预料外的问题
    // ========================================================================
    function explore(opts) {
        opts = opts || {};
        var maxMs = ((opts.seconds === undefined) ? 120 : opts.seconds) * 1000;
        var rep = { startedAt: new Date().toISOString(), maps: [], visited: 0, steps: 0,
                    blocked: 0, dialogs: 0, choices: 0, interacts: 0, events: [],
                    errors: [], switchesChanged: {}, stuck: null, endedBy: 'timeout' };
        function errLines() {
            return (window.__bootlog || []).filter(function (l) {
                return l.indexOf('onerror') >= 0 || l.indexOf('catchException') >= 0 ||
                       l.indexOf('SceneManager.onError') >= 0 || l.indexOf('Graphics.屏显错误') >= 0;
            });
        }
        return wait(1).then(function () {
            if (!$gameMap || $gameMap._mapId === 0) {
                return { ok: false, reason: '不在游戏中（先 newGame 或 testStoryFlow）', rep: rep };
            }
            var t0 = Date.now();
            var errBase = errLines().length;
            var swBase = {};
            for (var i = 2001; i <= 2100; i++) { swBase[i] = $gameSwitches.value(i); }
            var visit = {};
            var tries = {};   // 每个邻格的尝试次数（含撞墙）——只用访问数会被不可走格"永远最吸引"困进角落
            var maps = {}, events = {};
            var lastCell = null, sameTicks = 0, eventBusyTicks = 0;
            var DIRS = { down: 2, left: 4, right: 6, up: 8 };
            var DIRNAMES = ['down', 'left', 'right', 'up'];
            function cell() { return $gameMap._mapId + ':' + $gamePlayer.x + ',' + $gamePlayer.y; }
            return new Promise(function (resolve) {
                var t = setInterval(function () {
                    try { tick(); } catch (e) { rep.errors.push('explore异常: ' + e.message); }
                }, 400);
                function finish() {
                    clearInterval(t);
                    Input._currentState['ok'] = false; Input._currentState['cancel'] = false;
                    rep.ms = Date.now() - t0;
                    rep.maps = Object.keys(maps);
                    rep.events = events;
                    var swNow = {};
                    for (var k = 2001; k <= 2100; k++) { swNow[k] = $gameSwitches.value(k); }
                    for (var k2 in swNow) { if (swNow[k2] !== swBase[k2]) { rep.switchesChanged[k2] = swNow[k2]; } }
                    rep.errors = rep.errors.concat(errLines().slice(errBase).slice(0, 10));
                    rep.eventBusyTicks = eventBusyTicks;   // 探索期被事件解释器占用的 tick 数（每tick≈400ms）
                    L('explore → ' + rep.endedBy + ' (' + rep.steps + '步/' + rep.maps.length + '图/' +
                      rep.dialogs + '对话/' + rep.interacts + '交互/事件占用' + eventBusyTicks + ')');
                    resolve({ ok: true, rep: rep });
                }
                function tick() {
                    if (Date.now() - t0 > maxMs) { finish(); return; }
                    var vc = visualCheck();
                    if (vc.kind === 'error-overlay') { rep.endedBy = 'error-overlay'; finish(); return; }
                    var sc = SceneManager._scene;
                    var cn = sc ? sc.constructor.name : null;
                    if (cn !== 'Scene_Map') {
                        if (cn === 'Scene_Battle') { rep.endedBy = 'battle'; finish(); return; }
                        if (cn === 'Scene_UnwrittenStory') { rep.endedBy = 'book'; finish(); return; }
                        // 菜单/其他场景：cancel 退出
                        Input._currentState['cancel'] = !Input._currentState['cancel'];
                        frames(10);
                        return;
                    }
                    maps[$gameMap._mapId] = true;
                    if ($gameMap._interpreter && $gameMap._interpreter.isRunning()) {
                        if ($gameMap._interpreter._eventId) { events['ev' + $gameMap._interpreter._eventId] = true; }
                        eventBusyTicks++;   // 长期占用=常驻autorun（设计或触发条件未关，报告可见）
                        if (Math.random() < 0.5) { Input._currentState['ok'] = true; frames(6); Input._currentState['ok'] = false; }
                        frames(8);
                        sameTicks = 0;
                        return;
                    }
                    if ($gameMessage && $gameMessage.isBusy()) {
                        var cw = sc._messageWindow && sc._messageWindow._choiceWindow;
                        if (cw && cw.active && cw._list && cw._list.length) {
                            windowSelect(cw, Math.floor(Math.random() * cw._list.length));
                            rep.choices++;
                        } else {
                            Input._currentState['ok'] = true; frames(4); Input._currentState['ok'] = false;
                            rep.dialogs++;
                        }
                        frames(8);
                        sameTicks = 0;
                        return;
                    }
                    if ($gamePlayer.isTransferring() || $gamePlayer.isMoving()) { frames(10); return; }
                    var c = cell();
                    if (c === lastCell) { sameTicks++; } else { lastCell = c; sameTicks = 0; rep.visited++; visit[c] = (visit[c] || 0) + 1; }
                    if (sameTicks === 25) {   // 先试四向交互脱困
                        [2, 4, 6, 8].forEach(function (d) { $gamePlayer.setDirection(d); });
                        Input._currentState['ok'] = true; frames(6); Input._currentState['ok'] = false;
                        rep.interacts++;
                    }
                    if (sameTicks >= 45) {
                        rep.endedBy = 'stuck';
                        rep.stuck = { map: $gameMap._mapId, x: $gamePlayer.x, y: $gamePlayer.y, scene: cn };
                        finish();
                        return;
                    }
                    var r = Math.random();
                    if (r < 0.6) {
                        // 偏好尝试次数少的邻格（尝试数含撞墙 → 不可走格会被迅速降权，防止角落陷阱）
                        var cands = DIRNAMES.map(function (dn) {
                            var dd = DIRS[dn];
                            var nx = $gamePlayer.x + (dd === 4 ? -1 : dd === 6 ? 1 : 0);
                            var ny = $gamePlayer.y + (dd === 2 ? 1 : dd === 8 ? -1 : 0);
                            var key = $gameMap._mapId + ':' + nx + ',' + ny;
                            return { d: dn, key: key, w: (tries[key] || 0) + Math.random() * 1.5 };
                        }).sort(function (a, b) { return a.w - b.w; });
                        tries[cands[0].key] = (tries[cands[0].key] || 0) + 1;
                        var sx = $gamePlayer.x, sy = $gamePlayer.y;
                        walk(cands[0].d, 1);
                        if ($gamePlayer.x === sx && $gamePlayer.y === sy) { rep.blocked++; } else { rep.steps++; }
                    } else if (r < 0.85) {
                        $gamePlayer.setDirection([2, 4, 6, 8][Math.floor(Math.random() * 4)]);
                        Input._currentState['ok'] = true; frames(6); Input._currentState['ok'] = false;
                        rep.interacts++;
                        frames(10);
                    } else { frames(10); }
                }
            });
        });
    }

    window.AIPLAY = {
        version: '1.7',
        frames: frames, wait: wait,
        tap: tap, taps: taps, walk: walk, interact: interact,
        loadYaml: loadYaml, loadBook: loadBook,
        assemble: assemble, openBook: openBook, gotoMap: gotoMap,
        switches: switches, errors: errors, status: status,
        testBook: testBook, testAllBooks: testAllBooks,
        feedLanguages: feedLanguages, pumpUntil: pumpUntil,
        patchDataForTest: patchDataForTest, forceMapLoad: forceMapLoad,
        bootToTitle: bootToTitle, newGame: newGame,
        pathTo: pathTo, talkTo: talkTo, advanceDialog: advanceDialog, clearKeys: clearKeys,
        cmd: cmd, seq: seq, actions: ACTIONS,
        reset: reset, visualCheck: visualCheck, assertVisual: assertVisual,
        testSaveLoad: testSaveLoad, testStoryFlow: testStoryFlow,
        waitFor: waitFor,
        battleSetup: battleSetup, battleStatus: battleStatus,
        battleAttackOnce: battleAttackOnce, battleFinish: battleFinish, testBattle: testBattle,
        explore: explore,
        log: function (n) { return LOG.slice(-(n || 30)); }
    };
    console.log('[AIPLAY] v1.7 已就绪 | testAllBooks/testStoryFlow/testBattle/explore');
})();
