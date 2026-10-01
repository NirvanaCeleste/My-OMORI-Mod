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
        var t = bootToTitle();
        if (!t.ok) { return { ok: false, stage: 'title', title: t }; }
        var s = SceneManager._scene;
        if (typeof s.commandNewGame !== 'function') { return { ok: false, stage: 'no commandNewGame' }; }
        s.commandNewGame();
        // 等待进入地图场景（数据异步加载，给真实时间）
        var res = pumpUntil(function () {
            var sc = SceneManager._scene;
            return sc && sc.constructor.name === 'Scene_Map' && $gameMap && $gameMap.isReady() && !$gamePlayer.isTransferring();
        }, 120, 15, 60);
        var sc = SceneManager._scene;
        L('newGame → ' + (res.ok ? 'OK map=' + ($gameMap ? $gameMap._mapId : '?') : '超时'));
        return { ok: res.ok, stage: SceneManager._scene ? SceneManager._scene.constructor.name : null,
                 mapId: $gameMap ? $gameMap._mapId : -1, x: $gamePlayer ? $gamePlayer.x : -1, y: $gamePlayer ? $gamePlayer.y : -1,
                 displayName: $dataMap ? $dataMap.displayName : '' };
    }

    var __exports_marker = window.AIPLAY;

    window.AIPLAY = {
        version: '1.3',
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
        log: function (n) { return LOG.slice(-(n || 30)); }
    };
    console.log('[AIPLAY] v1.0 已就绪 | testAllBooks() = 四本书一键回归');
})();
