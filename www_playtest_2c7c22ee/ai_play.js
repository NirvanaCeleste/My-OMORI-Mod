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
                if (SceneManager.isSceneChanging() && !SceneManager.isCurrentSceneBusy()) {
                    SceneManager.changeScene();
                }
                if (SceneManager._scene && SceneManager._scene.update) { SceneManager._scene.update(); }
                if (window.Input) { Input.update(); }
                if (window.TouchInput) { TouchInput.update(); }
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
            Input._currentState[dir] = true;
            frames(14);          // 一步 ≈ 14 帧（行走动画），可按需调
            Input._currentState[dir] = false;
            frames(4);
            L('walk ' + dir);
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

    // ---------- 导出 ----------
    window.AIPLAY = {
        version: '1.0',
        frames: frames, wait: wait,
        tap: tap, taps: taps, walk: walk, interact: interact,
        loadYaml: loadYaml, loadBook: loadBook,
        assemble: assemble, openBook: openBook, gotoMap: gotoMap,
        switches: switches, errors: errors, status: status,
        testBook: testBook, testAllBooks: testAllBooks,
        log: function (n) { return LOG.slice(-(n || 30)); }
    };
    console.log('[AIPLAY] v1.0 已就绪 | testAllBooks() = 四本书一键回归');
})();
