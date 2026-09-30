// ============================================================================
// node_compat.js —— 浏览器测试垫片（AI 自动化验证用，非游戏运行时依赖）
// 由 ai_test.html 在引擎脚本之前加载。把 nw.js/Node 环境 API 映射到浏览器：
//   require('path'|'fs'|'nw.gui'|'child_process'|'./js/libs/js-yaml-master')
//   fs 读取 = 同源同步 XHR（需 http 服务器）；写入 = 内存覆盖层（仅当次会话）
// 定义 process.versions.nw 使 Utils.isNwjs() 判真，保持引擎走文件路径逻辑。
// ============================================================================
(function () {
  'use strict';
  if (window.__NODE_COMPAT__) { return; }
  window.__NODE_COMPAT__ = true;

  var ORIGIN = location.origin;

  function norm(p) {
    p = String(p).replace(/\\/g, '/');
    // 去掉 origin 前缀，统一成站内相对路径
    if (p.indexOf(ORIGIN) === 0) { p = p.slice(ORIGIN.length); }
    return p.replace(/^\/+/, '');
  }
  function toUrl(p) { return ORIGIN + '/' + norm(p); }

  function xhr(url) {
    var r;
    try { r = new XMLHttpRequest(); r.open('GET', url, false); r.send(null); }
    catch (e) { return { status: 0, responseText: '' }; }
    return r;
  }

  var overlay = {};   // 写入覆盖层：normPath -> 字符串

  // ---- path ----
  var pathMod = {
    sep: '/',
    normalize: function (p) { return String(p).replace(/\\/g, '/'); },
    join: function () {
      return Array.prototype.filter.call(arguments, function (s) { return s !== ''; })
        .join('/').replace(/\/{2,}/g, '/');
    },
    dirname: function (p) {
      p = String(p).replace(/\\/g, '/');
      var i = p.lastIndexOf('/');
      return i < 0 ? '.' : p.slice(0, i) || '/';
    },
    basename: function (p, ext) {
      p = String(p).replace(/\\/g, '/');
      var b = p.slice(p.lastIndexOf('/') + 1);
      if (ext && b.slice(-ext.length) === ext) { b = b.slice(0, -ext.length); }
      return b;
    },
    extname: function (p) {
      var b = pathMod.basename(p); var i = b.lastIndexOf('.');
      return i <= 0 ? '' : b.slice(i);
    },
    resolve: function () { return pathMod.join.apply(null, arguments); }
  };

  // ---- 目录列表：解析 http.server 的目录索引 HTML ----
  var dirCache = {};
  function listDir(p) {
    var key = norm(p);
    if (dirCache[key]) { return dirCache[key]; }
    var r = xhr(toUrl(key) + '/');
    if (r.status !== 200) { throw new Error('ENOENT: ' + p); }
    var names = [];
    var re = /href="([^"?/]+\/?)"/g, m;
    while ((m = re.exec(r.responseText)) !== null) {
      if (m[1] === '../' || m[1][0] === '/') { continue; }
      names.push(decodeURIComponent(m[1]));
    }
    dirCache[key] = names;
    return names;
  }

  // ---- fs ----
  var fsMod = {
    existsSync: function (p) {
      var k = norm(p);
      if (overlay[k] !== undefined) { return true; }
      return xhr(toUrl(k)).status === 200;
    },
    readFileSync: function (p, enc) {
      var k = norm(p);
      if (overlay[k] !== undefined) { return overlay[k]; }
      var r = xhr(toUrl(k));
      if (r.status !== 200) {
        var e = new Error("ENOENT: no such file or directory, open '" + p + "'");
        e.code = 'ENOENT'; throw e;
      }
      return r.responseText;
    },
    readdirSync: function (p) { return listDir(p); },
    statSync: function (p) {
      var text = fsMod.readFileSync(p);
      return { size: text.length, isFile: function () { return true; },
               isDirectory: function () { return false; }, mtime: new Date() };
    },
    writeFileSync: function (p, data) {
      overlay[norm(p)] = (typeof data === 'string') ? data : String(data);
      console.log('[node_compat] writeFileSync(内存): ' + p + ' (' +
        ((typeof data === 'string') ? data.length : '?') + ' bytes)');
    },
    unlinkSync: function (p) { delete overlay[norm(p)]; },
    mkdirSync: function (p) { /* 空操作 */ },
    readFile: function (p, a, b) {
      // (path, callback) 或 (path, encoding, callback)
      var enc = (typeof a === 'string') ? a : null;
      var cb = (typeof a === 'function') ? a : b;
      var k = norm(p);
      if (overlay[k] !== undefined) {
        setTimeout(function () { cb(null, overlay[k]); }, 0);
        return;
      }
      var r = new XMLHttpRequest();
      r.open('GET', toUrl(k));
      r.onload = function () {
        if (r.status !== 200) {
          var e = new Error("ENOENT: no such file or directory, open '" + p + "'");
          e.code = 'ENOENT'; cb(e); return;
        }
        cb(null, r.responseText);
      };
      r.onerror = function () { cb(new Error('network error: ' + p)); };
      r.send();
    }
  };

  // ---- js-yaml ----
  var jsyamlMod = null;

  // ---- nw.gui ----
  function NwWindowStub() {}
  NwWindowStub.prototype.get = function (cb) {
    var win = {
      showDevTools: function () {},
      close: function () {},
      focus: function () {},
      hide: function () {},
      setResizable: function () {},
      setTitle: function () {},
      requestAttention: function () {},
      on: function () {},
      window: window
    };
    if (cb) { try { cb(win); } catch (e) { console.warn('[node_compat] Window.get 回调异常: ' + e.message); } }
    return win;
  };
  var nwGui = {
    Window: new NwWindowStub(),
    Shell: {
      openExternal: function (u) { window.open(u, '_blank'); },
      showItemInFolder: function () {}, openItem: function () {}
    },
    Clipboard: {
      get: function () { return { get: function () { return ''; }, set: function () {} }; }
    },
    App: { manifest: window.__TEST_MANIFEST__ || {}, dataPath: '/tmp', argv: [] },
    Screen: {
      Init: function () {},
      on: function () {},
      getOwnPropertyNames: function () { return []; },
      screens: []
    }
  };

  // ---- child_process ----
  var childProcess = {
    exec: function (cmd, cb) {
      console.log('[node_compat] child_process.exec 已拦截: ' + cmd);
      if (cb) { cb(null, '', ''); }
    },
    spawn: function () { return { on: function () {}, kill: function () {} }; }
  };

  // ---- os ----
  var osMod = {
    platform: function () { return 'win32'; },
    type: function () { return 'Windows_NT'; },
    release: function () { return '10.0'; },
    hostname: function () { return 'ai-test'; },
    tmpdir: function () { return '/tmp'; },
    EOL: '\r\n',
    homedir: function () { return '/home'; }
  };

  // ---- greenworks（Steam SDK 桥，测试环境永远返回未初始化 → 游戏走无 Steam 降级路径）----
  var greenworksMod = {
    initAPI: function () { return false; },
    isInit: function () { return false; },
    init: function () { return false; },
    getSteamId: function () { return null; },
    getAppId: function () { return 0; },
    cloudEnabled: function () { return false; },
    saveTextToFile: function (f, c, ok, err) { if (ok) { ok(); } },
    readTextFromFile: function (f, ok, err) { if (err) { err(new Error('no steam')); } },
    deleteFile: function (f, ok, err) { if (ok) { ok(); } },
    activateAchievement: function (id, cb) { if (cb) { cb(new Error('no steam')); } },
    getAchievement: function (id, cb) { if (cb) { cb(new Error('no steam')); } },
    clearAchievement: function (id, cb) { if (cb) { cb(new Error('no steam')); } }
  };

  // ---- process ----
  window.process = window.process || {
    mainModule: { filename: ORIGIN + '/index.html' },
    versions: { node: '11.0.0', nw: '0.29.0', chromium: '68.0.3440.0' },
    platform: 'win32',
    cwd: function () { return '/'; },
    argv: [],
    exit: function () { console.log('[node_compat] process.exit 已拦截'); },
    env: {
      // 真机指向 %LOCALAPPDATA%；这里给一个站内虚拟目录，写入只进内存覆盖层
      LOCALAPPDATA: 'virtualappdata',
      HOME: 'virtualappdata',
      USERPROFILE: 'virtualappdata'
    }
  };

  // 预置游戏运行时会在系统存档区读到的文件（首次运行时真机上也已存在的状态）
  overlay['virtualappdata/OMORI/CUTSCENE.json'] = '{}';

  window.require = function (name) {
    switch (name) {
      case 'path': return pathMod;
      case 'fs': return fsMod;
      case 'nw.gui': return nwGui;
      case 'child_process': return childProcess;
      case 'os': return osMod;
      default:
        if (name && name.indexOf('greenworks') >= 0) { return greenworksMod; }
        if (name && name.indexOf('js-yaml') >= 0) {
          if (!jsyamlMod && window.jsyaml) {
            jsyamlMod = {
              safeLoad: function (t) { return window.jsyaml.safeLoad(t); },
              load: function (t) { return window.jsyaml.load(t); },
              safeLoadAll: function (t) { return window.jsyaml.safeLoadAll(t); },
              loadAll: function (t) { return window.jsyaml.loadAll(t); },
              dump: function (o) { return window.jsyaml.dump(o); },
              safeDump: function (o) { return window.jsyaml.safeDump(o); }
            };
          }
          if (jsyamlMod) { return jsyamlMod; }
        }
        console.warn('[node_compat] 未模拟的 require: ' + name);
        return {};
    }
  };

  // window.nw 全局（GTP_CoreUpdates 直接用 window.nw.App.argv 取加密参数）
  window.nw = nwGui;
  // greenworks 桥的全局别名（Archeia_Steamworks 直接用全局 steamworks）
  window.steamworks = greenworksMod;

  console.log('[node_compat] 浏览器 Node 垫片已就绪 (origin=' + ORIGIN + ')');
})();
