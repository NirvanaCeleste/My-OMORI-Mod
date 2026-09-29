//=============================================================================
// TDS UnwrittenStory —— 《未竟之事》
// Version: 1.26
//=============================================================================
// Add to Imported List
var Imported = Imported || {} ; Imported.TDS_UnwrittenStory = true;
// Initialize Alias Object
var _TDS_ = _TDS_ || {} ; _TDS_.UnwrittenStory = _TDS_.UnwrittenStory || {};
//=============================================================================
 /*:
 * @plugindesc v1.22 梦境之书《未竟之事》：分支状态机 / 段落故事（**可改片段**）/
 * 书写 / 修改擦除 / 结局只读页 / 确认页 / 首次提示 / 自动分页 / 透明UI /
 * 自动播放。作者：NirvanaCeleste
 *
 * @author NirvanaCeleste
 *
 * @help
 * ============================================================================
 * 《未竟之事》—— 梦境修改之书插件
 * ============================================================================
 * 作者：NirvanaCeleste
 *
 * 这是一本可以被"改写"的书。故事按页翻动，文字逐字书写，
 * 其中夹在 **两个星号** 之间的句子是"可改片段"——
 * 玩家可以修改（换成备选句子）或擦除（把句子从故事里抹去）。
 *
 * ◆ 核心机制：分支状态机
 * ----------------------------------------------------------------------------
 * 1. 修改必须按页序进行：p1 的句子改完之后，p2 的句子才会解锁。
 * 2. 每一句只能修改一次，改完立即锁定，无法撤销、无法回退。
 * 3. 每一句的选择（选了哪个备选 / 是否擦除）会决定后续页面的
 *    文本内容、后续可改句的备选方案，以及最终结局。
 * 4. 改得越多，故事越往"偏离原稿"的方向走（默认文案为此铺垫，
 *    可用于心理恐怖的氛围营造）。
 *
 * ============================================================================
 * 打开书（事件插件命令）
 * ============================================================================
 *   UnwrittenStory Open uw_book p1
 *   UnwrittenStory Open uw_book p1 4 simultaneous
 *   （参数：YAML文件名 起始页 可选速度 可选模式 sequential/simultaneous）
 *
 * ============================================================================
 * YAML 结构
 * ============================================================================
 * defaults: { speed, mode, allowExit }
 * order: [页1, ...]
 * pages:
 *   页key:
 *     image: "插图名"            # 可选：img/pictures/ 下相对路径
 *     readonly: true             # 纯阅读页（结局页）
 *     allowExit: false           # 本页禁止中途退出
 *     confirm: true              # 末尾确认页
 *     confirmChoices: ["确定", "否"]
 *     doneSwitchId: 1005
 *     edits:                     # 本页的可改句（**片段**与 edits 按顺序对应）
 *       - id: e1
 *         variants: ["替换文本……"]
 *         speed: 6
 *     texts:                     # 状态版本数组（下标 = 已修改句数）
 *       - "状态0的文本（初始）"
 *       - "状态1的文本（改完第1句后）"
 *       - "……"
 *     text: |                    # 单一文本（无 texts 时使用）
 *       "……**接着贝瑟尔就这样被黑暗吞噬，**……"
 *
 * ◆ 整本状态快照（推荐格式，states）：
 *   每个状态 = 当前故事的整体版本，文本全部写死，零运行时分支判断。
 *   states:
 *     - id: s0
 *       editable: gA           # 本状态唯一可改句（天然顺序锁）
 *       pages:                 # 本状态所有页（省略的页继承前一状态）
 *         g_p1: { text: "…", edits: [{id: gA, variants: […]}] }
 *     - id: s1
 *       editable: gB1
 *       pages:
 *         g_p2: { text: "…（新版本）" }
 *   玩家每成功修改/擦除一次 → 状态+1 → 整本书按新状态重新渲染（停留当前页）。
 *
 * ◆ 分支语法（旧格式 branches）：
 *   branches:
 *     - when: {e1: 0}            # e1 选了第0个变体
 *       texts: ["该分支的文本……"]
 *       edits: [ {id: e2, variants: ["……"]} ]   # 可选：该分支下的可改句
 *     - when: {e1: 'erase'}      # e1 被擦除
 *       texts: ["……"]
 *     - when: {e1: 'modified'}   # e1 已修改（任意方式）
 *     - when: {e1: 'unmodified'} # e1 未修改
 *     - texts: ["默认分支……"]    # 无 when = 兜底分支
 *   匹配规则：按顺序找第一个 when 全部满足的分支；找不到则用无 when 的默认分支。
 *   when 支持多个条件：when: {e1: 0, e2: 'erase'}
 *
 * ◆ 每个分支版本里必须保留本页的 **可改片段**（与 edits 顺序对应）。
 *
 * 自动分页：内容超出一页自动拆子页。
 * ============================================================================
 * 操作
 * ============================================================================
 *   ← →      翻页（含子页）
 *   确定      书写中＝快进；写完＝进入选句（仅当前解锁页）
 *   ↑ ↓      选句（跳过不可改片段）
 *   确定      菜单：修改 / 擦除
 *   locked    可改句支持 locked: true —— 被改/擦后渲染恒为原文（"回响"效果）
 *   最后一页  自动弹出确认窗 → 确定＝自动播放整本书→黑屏淡出结束；
 *             否＝跳回上一页
 *   自动播放  按"确定"后从第一页开始自动翻页+书写动画，播完黑屏结束；
 *             跳过确认页；播放列表可用 autoPlayOrder() 自定义；
 *             每次翻页调用 onAutoPlayPage(pageKey, playIndex) 钩子（心理恐怖扩展点）
 *   （无 ESC 退出；书只能走正常流程结束）
 * ============================================================================
 * 脚本接口
 * ============================================================================
 *   $gameUnwrittenStory.sentenceState(pageId, sentenceId)
 *       → { variant: -1|索引, erased: bool, modified: bool, marked: bool }
 *   $gameUnwrittenStory.modifiedCount(pages, order)  → 已修改句数（全局状态）
 *   $gameUnwrittenStory.setVariant / setErased / setMarked
 *   UnwrittenStory EnableStab / DisableStab（原作主菜单开关4）
 * ============================================================================
 * 参数
 * ============================================================================
 * @param yamlFile
 * @text 书内容YAML文件名
 * @default uw_book
 *
 * @param defaultSpeed
 * @text 默认书写速度（帧/字符）
 * @default 4
 *
 * @param defaultMode
 * @text 默认渲染模式（sequential/simultaneous）
 * @default sequential
 *
 * @param cursorChar
 * @text 光标字符
 * @default _
 *
 * @param bookWidth
 * @text 书内容区宽（0 = 自动占满屏幕宽-40）
 * @default 0
 *
 * @param bookHeight
 * @text 书内容区高（0 = 自动占满屏幕高-40）
 * @default 0
 *
 * @param bookX
 * @text 书内容区X（-1自动居中）
 * @default -1
 *
 * @param bookY
 * @text 书内容区Y（-1自动居中）
 * @default -1
 *
 * @param fontSize
 * @text 正文字号（可自定义）
 * @default 16
 *
 * @param font
 * @text 字体（留空用游戏默认）
 * @default
 *
 * @param backgroundColor
 * @text 背景颜色（rgba；无背景图时使用）
 * @default rgba(10, 10, 14, 0.96)
 *
 * @param backgroundImage
 * @text 背景图片（img/pictures/ 下相对路径）
 * @default Unwritten/Book/book_page
 *
 * @param backgroundStretch
 * @text 背景是否拉伸全屏（false=原尺寸居中）
 * @default false
 *
 * @param pageImage
 * @text 书窗口衬底图（img/pictures/ 下相对路径，留空=无衬底）
 * @default Unwritten/Book/book_page_small
 *
 * @param textColor
 * @text 文字颜色
 * @default #333333
 *
 * @param coverImage
 * @text 开场书皮图（img/pictures/ 下相对路径）
 * @default Unwritten/Book/book_cover
 *
 * @param titleText
 * @text 开场标题文本（留空=不显示标题，只留书皮动画）
 * @default
 *
 * @param titleFontSize
 * @text 开场标题字号
 * @default 34
 *
 * @param titleColor
 * @text 开场标题颜色
 * @default #e8cd8c
 *
 * @param hintSwitchId
 * @text 首次提示开关ID
 * @desc 首次见到可改句子时显示提示；提示后此开关置ON，不再提示
 * @default 1006
 *
 * @param autoPlaySpeed
 * @text 自动播放书写速度（每字帧数，越小越快）
 * @desc 选"确定"后自动播放整本书时的书写速度；留空用 defaultSpeed
 * @default 2
 *
 * @param autoPlayPause
 * @text 自动播放页间停顿（帧数）
 * @desc 每页写完到自动翻页的停顿帧数，越小节奏越快
 * @default 15
 */
//=============================================================================

"use strict";

//=============================================================================
// ** Parameters
//=============================================================================
_TDS_.UnwrittenStory.Param = PluginManager.parameters('UnwrittenStory');
_TDS_.UnwrittenStory.Param.yamlFile        = String(_TDS_.UnwrittenStory.Param['yamlFile'] || 'uw_book');
_TDS_.UnwrittenStory.Param.defaultSpeed    = Number(_TDS_.UnwrittenStory.Param['defaultSpeed'] || 4);
_TDS_.UnwrittenStory.Param.defaultMode     = String(_TDS_.UnwrittenStory.Param['defaultMode'] || 'sequential');
_TDS_.UnwrittenStory.Param.cursorChar      = String(_TDS_.UnwrittenStory.Param['cursorChar'] || '_');
_TDS_.UnwrittenStory.Param.bookWidth       = Number(_TDS_.UnwrittenStory.Param['bookWidth'] || 0);
_TDS_.UnwrittenStory.Param.bookHeight      = Number(_TDS_.UnwrittenStory.Param['bookHeight'] || 0);
_TDS_.UnwrittenStory.Param.bookX           = Number(_TDS_.UnwrittenStory.Param['bookX'] || -1);
_TDS_.UnwrittenStory.Param.bookY           = Number(_TDS_.UnwrittenStory.Param['bookY'] || -1);
_TDS_.UnwrittenStory.Param.fontSize        = Number(_TDS_.UnwrittenStory.Param['fontSize'] || 16);
_TDS_.UnwrittenStory.Param.font            = String(_TDS_.UnwrittenStory.Param['font'] || '');
_TDS_.UnwrittenStory.Param.backgroundColor = String(_TDS_.UnwrittenStory.Param['backgroundColor'] || 'rgba(255, 255, 255, 1)');
_TDS_.UnwrittenStory.Param.backgroundImage = String(_TDS_.UnwrittenStory.Param['backgroundImage'] || '');
_TDS_.UnwrittenStory.Param.backgroundStretch = String(_TDS_.UnwrittenStory.Param['backgroundStretch'] || 'false') === 'true';
_TDS_.UnwrittenStory.Param.pageImage       = String(_TDS_.UnwrittenStory.Param['pageImage'] || 'Unwritten/Book/book_page_small');
_TDS_.UnwrittenStory.Param.textColor       = String(_TDS_.UnwrittenStory.Param['textColor'] || '#333333');
_TDS_.UnwrittenStory.Param.coverImage      = String(_TDS_.UnwrittenStory.Param['coverImage'] || 'Unwritten/Book/book_cover');
_TDS_.UnwrittenStory.Param.titleText       = String(_TDS_.UnwrittenStory.Param['titleText'] || '');
_TDS_.UnwrittenStory.Param.titleFontSize   = Number(_TDS_.UnwrittenStory.Param['titleFontSize'] || 34);
_TDS_.UnwrittenStory.Param.titleColor      = String(_TDS_.UnwrittenStory.Param['titleColor'] || '#e8cd8c');
_TDS_.UnwrittenStory.Param.hintSwitchId    = Number(_TDS_.UnwrittenStory.Param['hintSwitchId'] || 1006);
_TDS_.UnwrittenStory.Param.autoPlaySpeed   = Number(_TDS_.UnwrittenStory.Param['autoPlaySpeed'] || 2);
_TDS_.UnwrittenStory.Param.autoPlayPause   = Number(_TDS_.UnwrittenStory.Param['autoPlayPause'] || 15);

//=============================================================================
// ** Game_UnwrittenStory —— 运行时状态
//=============================================================================
function Game_UnwrittenStory() { this.initialize.apply(this, arguments); }
Game_UnwrittenStory.prototype.initialize = function() { this.clear(); };
Game_UnwrittenStory.prototype.clear = function() { this._pages = {}; };
Game_UnwrittenStory.prototype.pageState = function(pageId) {
    if (this._pages[pageId] === undefined) { this._pages[pageId] = {}; }
    return this._pages[pageId];
};
Game_UnwrittenStory.prototype.sentenceState = function(pageId, sentenceId) {
    // 句子状态按 sentenceId 全局存储（edits id 全局唯一），
    // 这样分支匹配（when: {e1: 0}）在任意页都能查到前面句子的选择
    var key = String(sentenceId);
    if (this._pages[key] === undefined) { this._pages[key] = { variant: -1, erased: false, marked: false, modified: false }; }
    return this._pages[key];
};
Game_UnwrittenStory.prototype.setVariant = function(pageId, sentenceId, index) {
    var st = this.sentenceState(pageId, sentenceId);
    st.variant = index;
    st.erased = false;
    st.modified = true;   // 状态机：一旦修改即锁定，不可再次修改/回退
};
Game_UnwrittenStory.prototype.setErased = function(pageId, sentenceId, flag) {
    var st = this.sentenceState(pageId, sentenceId);
    st.erased = flag;
    if (flag) { st.modified = true; }   // 擦除同样是不可逆修改
    else { st.modified = false; st.variant = -1; }
};
Game_UnwrittenStory.prototype.setMarked = function(pageId, sentenceId, flag) {
    this.sentenceState(pageId, sentenceId).marked = flag;
};
Game_UnwrittenStory.prototype.allRequiredMarked = function(pageId, lines) {
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].mark) {
            if (!this.sentenceState(pageId, lines[i].id).marked) { return false; }
        }
    }
    return true;
};
Game_UnwrittenStory.prototype.allRequiredMarkedByYaml = function(yamlFile, pageId) {
    var data = null;
    try { data = LanguageManager.languageData().text[yamlFile]; } catch (e) { data = null; }
    if (!data || !data.pages || !data.pages[pageId]) { return false; }
    var lines = data.pages[pageId].lines || data.pages[pageId].edits || [];
    return this.allRequiredMarked(pageId, lines);
};
//---------------------------------------------------------------------------
// * 顺序状态机：一页一句、按页序修改；每改一句全局状态+1
//---------------------------------------------------------------------------
Game_UnwrittenStory.prototype.pageEditIds = function(page) {
    var ids = [];
    if (!page) { return ids; }
    var collect = function(p) {
        if (!p) { return; }
        var edits = p.edits || [];
        for (var i = 0; i < edits.length; i++) {
            if (edits[i].id !== undefined && ids.indexOf(String(edits[i].id)) < 0) { ids.push(String(edits[i].id)); }
        }
        var lines = p.lines || [];
        for (var j = 0; j < lines.length; j++) {
            if (lines[j].id !== undefined && ids.indexOf(String(lines[j].id)) < 0) { ids.push(String(lines[j].id)); }
        }
    };
    collect(page);
    // 分支页：收集所有分支里的可改句 id（含默认分支）
    var brs = page.branches;
    if (Array.isArray(brs)) {
        for (var b = 0; b < brs.length; b++) { collect(brs[b]); }
    }
    return ids;
};
Game_UnwrittenStory.prototype.modifiedCount = function(pages, order) {
    var n = 0;
    for (var i = 0; i < order.length; i++) {
        var ids = this.pageEditIds(pages[order[i]]);
        for (var j = 0; j < ids.length; j++) {
            if (this.sentenceState(order[i], ids[j]).modified) { n++; }
        }
    }
    return n;
};
// 分支感知版：只统计当前分支可改句里已修改的数量
Game_UnwrittenStory.prototype.modifiedCountBranch = function(pages, order, resolver) {
    var n = 0;
    for (var i = 0; i < order.length; i++) {
        var key = order[i];
        var resolved = resolver ? resolver(pages[key]) : pages[key];
        var ids = this.pageEditIds(resolved);
        for (var j = 0; j < ids.length; j++) {
            if (this.sentenceState(key, ids[j]).modified) { n++; }
        }
    }
    return n;
};
Game_UnwrittenStory.prototype.pageHasUnmodified = function(pageId, page) {
    var ids = this.pageEditIds(page);
    for (var j = 0; j < ids.length; j++) {
        if (!this.sentenceState(pageId, ids[j]).modified) { return true; }
    }
    return false;
};
// 检查页内是否存在指定 id 的可改句
Game_UnwrittenStory.prototype.pageHasId = function(page, targetId) {
    var ids = this.pageEditIds(page);
    return ids.indexOf(String(targetId)) >= 0;
};
// 分支感知版：先按当前状态解析分支，再检查该分支的可改句
Game_UnwrittenStory.prototype.pageHasUnmodifiedBranch = function(pageId, page, resolver) {
    var resolved = resolver(page);
    return this.pageHasUnmodified(pageId, resolved);
};

//=============================================================================
// ** DataManager —— 存档注入
//=============================================================================
_TDS_.UnwrittenStory.DataManager_createGameObjects = DataManager.createGameObjects;
DataManager.createGameObjects = function() {
    _TDS_.UnwrittenStory.DataManager_createGameObjects.call(this);
    $gameUnwrittenStory = new Game_UnwrittenStory();
};
_TDS_.UnwrittenStory.DataManager_makeSaveContents = DataManager.makeSaveContents;
DataManager.makeSaveContents = function() {
    var contents = _TDS_.UnwrittenStory.DataManager_makeSaveContents.call(this);
    contents.unwrittenStory = $gameUnwrittenStory;
    return contents;
};
_TDS_.UnwrittenStory.DataManager_extractSaveContents = DataManager.extractSaveContents;
DataManager.extractSaveContents = function(contents) {
    _TDS_.UnwrittenStory.DataManager_extractSaveContents.call(this, contents);
    $gameUnwrittenStory = contents.unwrittenStory || new Game_UnwrittenStory();
};

//=============================================================================
// ** Game_Interpreter —— 插件命令
//=============================================================================
Game_Interpreter.prototype.callUnwrittenStory = function(yamlFile, pageKey, speed, mode) {
    SceneManager.push(Scene_UnwrittenStory);
    SceneManager.prepareNextScene(yamlFile || _TDS_.UnwrittenStory.Param.yamlFile, pageKey, speed, mode);
};
_TDS_.UnwrittenStory.Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
Game_Interpreter.prototype.pluginCommand = function(command, args) {
    _TDS_.UnwrittenStory.Game_Interpreter_pluginCommand.call(this, command, args);
    if (command !== 'UnwrittenStory') { return; }
    switch (args[0]) {
        case 'Open':
            var speed = undefined, mode = undefined;
            for (var i = 3; i < args.length; i++) {
                var a = String(args[i]).toLowerCase();
                if (a === 'sequential' || a === 'simultaneous') { mode = a; }
                else if (Number(args[i]) > 0) { speed = Number(args[i]); }
            }
            this.callUnwrittenStory(args[1], args[2], speed, mode);
            break;
        case 'EnableStab':
            $gameSwitches.setValue(4, true);
            break;
        case 'DisableStab':
            $gameSwitches.setValue(4, false);
            break;
    }
};

//=============================================================================
// ** 窗口皮肤隐藏助手
//=============================================================================
_TDS_.UnwrittenStory.hideFrame = function(win) {
    if (win && win._windowSpriteContainer) {
        win._windowSpriteContainer.visible = false;
    }
};

//=============================================================================
// ** Window_UnwrittenBook
//=============================================================================
function Window_UnwrittenBook() { this.initialize.apply(this, arguments); }
Window_UnwrittenBook.prototype = Object.create(Window_Base.prototype);
Window_UnwrittenBook.prototype.constructor = Window_UnwrittenBook;

Window_UnwrittenBook.prototype.initialize = function(x, y, width, height) {
    Window_Base.prototype.initialize.call(this, x, y, width, height);
    _TDS_.UnwrittenStory.hideFrame(this);
    this._page = null;
    this._pageKey = null;
    this._rows = [];
    this._flat = [];
    this._subPages = [];
    this._subIndex = 0;
    this._defaults = {};
    this._speed = _TDS_.UnwrittenStory.Param.defaultSpeed;
    this._mode = _TDS_.UnwrittenStory.Param.defaultMode;
    this._origin = [this.padding + 8, this.padding + 8];
    this._flatIndex = 0;
    this._charIndex = 0;
    this._frameCounter = 0;
    this._prog = [];
    this._lineFrames = [];
    this._lineSpeeds = [];
    this._eraseFlash = 0;
    this._rewritePending = false;
    this._writing = false;
    this._finished = false;
    this._selectionMode = false;
    this._selectionFlat = -1;
    this._dirty = true;
    this._cumWidths = [];
    this._autoPlayMode = false;   // 自动演示中：全部文字统一颜色
    if (_TDS_.UnwrittenStory.Param.font) { this.contents.fontFace = _TDS_.UnwrittenStory.Param.font; }
    this.contents.fontSize = _TDS_.UnwrittenStory.Param.fontSize;
};
//---------------------------------------------------------------------------
// * 行高：用字号+8（引擎默认固定 36，行距过大导致分页膨胀）
//---------------------------------------------------------------------------
Window_UnwrittenBook.prototype.lineHeight = function() {
    return this.contents.fontSize + 8;
};
//---------------------------------------------------------------------------
// * 配置接口
//---------------------------------------------------------------------------
Window_UnwrittenBook.prototype.setDefaults = function(defaults) { this._defaults = defaults || {}; };
Window_UnwrittenBook.prototype.setSpeed = function(n) {
    if (n !== undefined && Number(n) > 0) {
        this._speed = Number(n);
        for (var i = 0; i < this._lineSpeeds.length; i++) { this._lineSpeeds[i] = this._speed; }
    }
};
Window_UnwrittenBook.prototype.setMode = function(m) {
    if (m === 'sequential' || m === 'simultaneous') { this._mode = m; }
};
//---------------------------------------------------------------------------
// * 文本代码处理
//---------------------------------------------------------------------------
Window_UnwrittenBook.prototype.processText = function(text) {
    var str = String(text);
    str = str.replace(/\\v\[(\d+)\]/g, function(match, id) {
        return String($gameVariables.value(Number(id)));
    });
    str = str.replace(/\\n<[^>]*>/g, '');
    str = str.replace(/\\[A-Za-z]+(\[\d+(?:\.\d+)?\])?/g, '');
    return str;
};
//---------------------------------------------------------------------------
// * 片段构造与段落解析
//---------------------------------------------------------------------------
Window_UnwrittenBook.prototype.makeSeg = function(type, id, text, variants, speed, mark, locked) {
    return {
        type: type,
        id: id,
        base: this.processText(text),
        variants: variants || [],
        speed: speed,
        mark: !!mark,
        locked: !!locked,
        editable: type === 'edit'
    };
};
Window_UnwrittenBook.prototype.parseInline = function(line, edits, counter) {
    var segs = [];
    var re = /\*\*(.+?)\*\*/g;
    var last = 0, m;
    while ((m = re.exec(line)) !== null) {
        if (m.index > last) {
            segs.push(this.makeSeg('text', null, line.substring(last, m.index), [], undefined, false));
        }
        var ed = edits[counter.n] || {};
        counter.n++;
        var edId = ed.id !== undefined ? String(ed.id) : ('e' + counter.n);
        segs.push(this.makeSeg('edit', edId, m[1],
            (ed.variants || []).map(function(v) { return this.processText(v); }, this),
            ed.speed, !!ed.mark, !!ed.locked));
        last = m.index + m[0].length;
    }
    if (last < line.length) {
        segs.push(this.makeSeg('text', null, line.substring(last), [], undefined, false));
    }
    if (segs.length === 0) {
        segs.push(this.makeSeg('text', null, '', [], undefined, false));
    }
    return segs;
};
//---------------------------------------------------------------------------
// * 分支状态机：page.branches = [{when:{e1:0|'erase'|'modified'|'unmodified',...}, texts/text/edits}, ...]
//   按前面句子的选择匹配第一个满足的分支；无 when 的分支为默认
//---------------------------------------------------------------------------
Window_UnwrittenBook.prototype.branchMatches = function(when, pageKey) {
    if (!when) { return true; }
    var pk = pageKey || this._pageKey;
    for (var id in when) {
        var st = $gameUnwrittenStory.sentenceState(pk, id);
        var want = when[id];
        if (want === 'erase') {
            if (!st.erased) { return false; }
        } else if (want === 'modified') {
            if (!st.modified) { return false; }
        } else if (want === 'unmodified') {
            if (st.modified) { return false; }
        } else {
            var n = Number(want);
            if (st.erased || st.variant !== n) { return false; }
        }
    }
    return true;
};
Window_UnwrittenBook.prototype.resolveBranch = function(page, pageKey) {
    if (!page || !Array.isArray(page.branches) || page.branches.length === 0) {
        return page;
    }
    var pk = pageKey || this._pageKey;
    for (var i = 0; i < page.branches.length; i++) {
        var br = page.branches[i];
        if (!this.branchMatches(br.when, pk)) { continue; }
        // 用分支内容覆盖页面默认（text/texts/edits/write）
        var merged = {};
        for (var k in page) {
            if (k === 'branches') { continue; }
            merged[k] = page[k];
        }
        if (br.text !== undefined) { merged.text = br.text; }
        if (br.texts !== undefined) { merged.texts = br.texts; }
        if (br.edits !== undefined) { merged.edits = br.edits; }
        if (br.write !== undefined) { merged.write = br.write; }
        return merged;
    }
    return page;
};
//---------------------------------------------------------------------------
// * 载入页面数据
//   stateIndex: 全局状态（已修改句数）。page.texts 是状态版本数组
//   （texts[i] = 第 i 个状态下的文本）；没有 texts 时回退到 text
//   页面可定义 branches 按已做选择匹配（分支状态机）
//---------------------------------------------------------------------------
Window_UnwrittenBook.prototype.setPage = function(pageKey, page, stateIndex) {
    this._pageKey = pageKey;
    page = this.resolveBranch(page);
    this._page = page;
    this._rows = [];
    this._flat = [];
    var rawText = '';
    if (page) {
        if (Array.isArray(page.texts) && page.texts.length > 0) {
            var si = Math.max(0, Number(stateIndex) || 0);
            rawText = page.texts[Math.min(si, page.texts.length - 1)] || '';
        } else {
            rawText = page.text || '';
        }
    }
    if (page && typeof rawText === 'string') {
        var edits = (page.edits || []);
        var counter = { n: 0 };
        var rawLines = rawText.split('\n');
        for (var i = 0; i < rawLines.length; i++) {
            if (rawLines[i].trim() === '') { continue; }   // 跳过空行，避免空白片段/空白页
            var segs = this.parseInline(rawLines[i], edits, counter);
            this._rows.push({ segments: segs });
            for (var s = 0; s < segs.length; s++) {
                this._flat.push({ row: this._rows.length - 1, seg: s });
            }
        }
    } else {
        var raw = (page && page.lines) ? page.lines : [];
        for (var j = 0; j < raw.length; j++) {
            var l = raw[j];
            var sub = this.processText(l.text).split('\n');
            var segs = [];
            for (var t = 0; t < sub.length; t++) {
                if (sub[t].trim() === '') { continue; }   // 跳过空行
                segs.push(this.makeSeg(l.id !== undefined ? 'edit' : 'text',
                    l.id !== undefined ? String(l.id) : null, sub[t],
                    (l.variants || []).map(function(v) { return this.processText(v); }, this),
                    l.speed, !!l.mark, !!l.locked));
            }
            this._rows.push({ segments: segs });
            for (var u = 0; u < segs.length; u++) {
                this._flat.push({ row: this._rows.length - 1, seg: u });
            }
        }
    }
    var write = (page && page.write) || {};
    var def = this._defaults;
    this._speed = write.speed !== undefined ? Number(write.speed)
        : (def.speed !== undefined ? Number(def.speed) : _TDS_.UnwrittenStory.Param.defaultSpeed);
    var mode = write.mode || (write.simultaneous ? 'simultaneous' : null);
    this._mode = mode || def.mode || _TDS_.UnwrittenStory.Param.defaultMode;
    if (this._mode !== 'sequential' && this._mode !== 'simultaneous') { this._mode = 'sequential'; }
    this._origin = write.origin || [this.padding + 8, this.padding + 8];
    this._lineSpeeds = [];
    for (var f = 0; f < this._flat.length; f++) {
        var seg = this.segAt(f);
        this._lineSpeeds.push(seg.speed !== undefined ? seg.speed : this._speed);
    }
    this.computeSubPages();
    this._subIndex = 0;
    this._flatIndex = this._subPages[0] ? this._subPages[0].start : 0;
    this._charIndex = 0;
    this._frameCounter = 0;
    this._prog = [];
    this._lineFrames = [];
    for (var g = 0; g < this._flat.length; g++) { this._prog.push(0); this._lineFrames.push(0); }
    this._eraseFlash = 0;
    this._rewritePending = false;
    this._writing = this._flat.length > 0;
    this._finished = false;
    this._selectionMode = false;
    this._selectionFlat = this.nextEditableIndex(this._subPages[0] ? this._subPages[0].start : 0);
    this._dirty = true;
};
//---------------------------------------------------------------------------
// * 分页：已禁用。每个 YAML 页 = 一个完整书页（一个子页），
//   不再自动拆分——避免可改句被挤到第二子页导致交互问题。
//   书窗口高度需足够容纳整页文本（bookHeight 参数可调）。
//---------------------------------------------------------------------------
Window_UnwrittenBook.prototype.computeSubPages = function() {
    this._subPages = [];
    if (this._flat.length === 0) {
        this._subPages.push({ start: 0, end: -1 });
    } else {
        this._subPages.push({ start: 0, end: this._flat.length - 1 });
    }
};
Window_UnwrittenBook.prototype.currentSubPage = function() {
    return this._subPages[this._subIndex] || { start: 0, end: this._flat.length - 1 };
};
//---------------------------------------------------------------------------
// * 片段工具
//---------------------------------------------------------------------------
Window_UnwrittenBook.prototype.segAt = function(flatIndex) {
    var ref = this._flat[flatIndex];
    return this._rows[ref.row].segments[ref.seg];
};
Window_UnwrittenBook.prototype.segState = function(seg) {
    if (!seg.editable || seg.id === null) { return null; }
    return $gameUnwrittenStory.sentenceState(this._pageKey, seg.id);
};
Window_UnwrittenBook.prototype.segText = function(flatIndex) {
    var seg = this.segAt(flatIndex);
    var st = this.segState(seg);
    // 锁定句（locked: true）：无论怎么改/擦除，渲染恒为原文（"回响"效果）
    if (seg.locked) { return seg.base; }
    if (st && st.erased) { return ''; }
    if (st && st.variant >= 0 && seg.variants[st.variant] !== undefined) {
        return seg.variants[st.variant];
    }
    return seg.base;
};
//---------------------------------------------------------------------------
// * 累计宽度
//---------------------------------------------------------------------------
Window_UnwrittenBook.prototype.updateCumWidths = function() {
    this._cumWidths = [];
    var fs = this.contents.fontSize;
    for (var f = 0; f < this._flat.length; f++) {
        var text = this.segText(f);
        var cum = [];
        var total = 0;
        for (var k = 0; k < text.length; k++) {
            var w = this.textWidth(text.charAt(k));
            if (!w || w <= 0 || isNaN(w)) { w = fs; }
            total += w;
            cum.push(total);
        }
        this._cumWidths.push(cum);
    }
};
//---------------------------------------------------------------------------
// * 书写推进（限当前子页）
//---------------------------------------------------------------------------
Window_UnwrittenBook.prototype.updateWriting = function() {
    var page = this.currentSubPage();
    if (this._mode === 'simultaneous') { this.updateWritingSimultaneous(page); return; }
    if (this._flatIndex > page.end) {
        this._writing = false;
        this._finished = true;
        this._dirty = true;
        return;
    }
    while (this._flatIndex <= page.end && this.segText(this._flatIndex) === '') {
        this._flatIndex++;
        this._charIndex = 0;
    }
    if (this._flatIndex > page.end) {
        this._writing = false;
        this._finished = true;
        this._dirty = true;
        return;
    }
    this._frameCounter = (this._frameCounter || 0) + 1;
    var sp = Math.max(1, this._lineSpeeds[this._flatIndex] !== undefined ? this._lineSpeeds[this._flatIndex] : this._speed);
    if (this._frameCounter < sp) { return; }
    this._frameCounter = 0;
    var text = this.segText(this._flatIndex);
    this._charIndex += 1;
    if (this._charIndex >= text.length) {
        this._flatIndex++;
        this._charIndex = 0;
    }
    this._dirty = true;
};
Window_UnwrittenBook.prototype.updateWritingSimultaneous = function(page) {
    var allDone = true;
    for (var f = page.start; f <= page.end; f++) {
        var text = this.segText(f);
        if (this._prog[f] >= text.length) { continue; }
        allDone = false;
        this._lineFrames[f] = (this._lineFrames[f] || 0) + 1;
        var sp = Math.max(1, this._lineSpeeds[f] !== undefined ? this._lineSpeeds[f] : this._speed);
        if (this._lineFrames[f] >= sp) {
            this._lineFrames[f] = 0;
            this._prog[f]++;
            this._dirty = true;
        }
    }
    if (allDone) {
        this._writing = false;
        this._finished = true;
        this._dirty = true;
    }
};
Window_UnwrittenBook.prototype.finishWriting = function() {
    var page = this.currentSubPage();
    if (this._mode === 'simultaneous') {
        for (var f = page.start; f <= page.end; f++) { this._prog[f] = this.segText(f).length; }
    } else {
        this._flatIndex = page.end + 1;
        this._charIndex = 0;
    }
    this._writing = false;
    this._finished = true;
    this._dirty = true;
};
Window_UnwrittenBook.prototype.currentWriteProgress = function() {
    if (!this._writing || this._finished) { return null; }
    var page = this.currentSubPage();
    if (this._mode === 'simultaneous') {
        for (var f = page.end; f >= page.start; f--) {
            if (this._prog[f] < this.segText(f).length) { return { flat: f, count: this._prog[f] }; }
        }
        return null;
    }
    if (this._flatIndex > page.end) { return null; }
    return { flat: this._flatIndex, count: Math.min(this._charIndex, this.segText(this._flatIndex).length) };
};
//---------------------------------------------------------------------------
// * 选句
//---------------------------------------------------------------------------
Window_UnwrittenBook.prototype.isEditableFlat = function(flatIndex) {
    if (flatIndex < 0 || flatIndex >= this._flat.length) { return false; }
    var seg = this.segAt(flatIndex);
    if (!seg.editable) { return false; }
    var st = this.segState(seg);
    if (st && st.erased) { return false; }
    // 状态机：已修改的句子永久锁定，不能再次修改/回退
    if (st && st.modified) { return false; }
    return true;
};
Window_UnwrittenBook.prototype.nextEditableIndex = function(fromIndex) {
    var n = this._flat.length;
    var idx = fromIndex;
    for (var step = 0; step < n; step++) {
        if (idx > n - 1) { idx = 0; }
        if (idx < 0) { idx = n - 1; }
        if (this.isEditableFlat(idx)) { return idx; }
        idx = (idx + 1) % n;
    }
    return -1;
};
// 找到某 flat 索引所在的子页，并翻到它（返回是否成功）
Window_UnwrittenBook.prototype.gotoFlatSubPage = function(flatIndex) {
    for (var i = 0; i < this._subPages.length; i++) {
        if (flatIndex >= this._subPages[i].start && flatIndex <= this._subPages[i].end) {
            if (this._subIndex !== i) {
                this._subIndex = i;
                var page = this.currentSubPage();
                this._flatIndex = page.end + 1;
                this._charIndex = 0;
                this._frameCounter = 0;
                this._writing = false;
                this._finished = true;
                this._dirty = true;
            }
            return true;
        }
    }
    return false;
};
// 状态快照：按句子 id 找到本页中可改句的 flat 索引（-1 = 无）
Window_UnwrittenBook.prototype.findEditableIndexByState = function(editableId) {
    var target = String(editableId);
    for (var f = 0; f < this._flat.length; f++) {
        var seg = this.segAt(f);
        if (seg.editable && seg.id !== null && String(seg.id) === target) {
            if (this.isEditableFlat(f)) { return f; }
            return -1;   // 找到但已改过 → 不可再改
        }
    }
    return -1;
};
Window_UnwrittenBook.prototype.updateSelection = function() {
    if (Input.isRepeated('up') || Input.isTriggered('up')) {
        SoundManager.playCursor();
        this.moveSelection(-1);
    } else if (Input.isRepeated('down') || Input.isTriggered('down')) {
        SoundManager.playCursor();
        this.moveSelection(1);
    }
};
Window_UnwrittenBook.prototype.moveSelection = function(dir) {
    // 在当前子页内移动选择（可改句在本子页内循环），
    // 避免选中到其他子页的句子导致画面与选中不一致
    var page = this.currentSubPage();
    var n = this._flat.length;
    var idx = this._selectionFlat;
    for (var step = 0; step < n; step++) {
        idx += dir;
        if (idx < page.start) { idx = page.end; }
        if (idx > page.end) { idx = page.start; }
        if (this.isEditableFlat(idx)) { break; }
    }
    this._selectionFlat = idx;
    this._dirty = true;
};
Window_UnwrittenBook.prototype.segActionList = function(flatIndex) {
    var seg = this.segAt(flatIndex);
    var st = this.segState(seg);
    var list = [];
    // 状态机：已修改的句子锁定，不再提供任何操作
    if (st && st.modified) { return list; }
    if (seg.variants.length > 0 && !(st && st.erased)) { list.push('modify'); }
    if (!(st && st.erased)) { list.push('erase'); }
    return list;
};
//---------------------------------------------------------------------------
// * 子页翻页（默认直接显示完整内容；keepWriting=true 时从头播放书写动画）
//---------------------------------------------------------------------------
Window_UnwrittenBook.prototype.moveSubPage = function(dir, keepWriting) {
    var target = this._subIndex + dir;
    if (target < 0 || target >= this._subPages.length) { return false; }
    this._subIndex = target;
    var page = this.currentSubPage();
    if (keepWriting) {
        // 自动播放：从子页开头重新书写
        this._flatIndex = page.start;
        this._charIndex = 0;
        this._frameCounter = 0;
        this._writing = this._flat.length > 0;
        this._finished = false;
    } else {
        this._flatIndex = page.end + 1;
        this._charIndex = 0;
        this._frameCounter = 0;
        this._writing = false;
        this._finished = true;
    }
    this._selectionMode = false;
    this._selectionFlat = this.nextEditableIndex(page.start);
    this._dirty = true;
    return true;
};
//---------------------------------------------------------------------------
// * 主更新
//---------------------------------------------------------------------------
Window_UnwrittenBook.prototype.update = function() {
    try {
        Window_Base.prototype.update.call(this);
        if (this._eraseFlash > 0) {
            this._eraseFlash--;
            if (this._eraseFlash === 0 && this._rewritePending) {
                this._rewritePending = false;
                var page = this.currentSubPage();
                this._flatIndex = page.start;
                this._charIndex = 0;
                this._frameCounter = 0;
                for (var f = 0; f < this._flat.length; f++) { this._prog[f] = 0; this._lineFrames[f] = 0; }
                this._writing = this._flat.length > 0;
                this._finished = false;
            }
            this._dirty = true;
        } else if (this._writing && !this._finished) {
            this.updateWriting();
        }
        if (this._dirty) {
            this.updateCumWidths();
            this.refresh();
            this._dirty = false;
        }
    } catch (e) {
        this._dirty = false;
        console.warn('UnwrittenStory book update 异常: ' + e.message);
    }
};
//---------------------------------------------------------------------------
// * 绘制（当前子页；流式换行；可改片段金色高亮）
//---------------------------------------------------------------------------
Window_UnwrittenBook.prototype.refresh = function() {
    this.contents.clear();
    this.changeTextColor(_TDS_.UnwrittenStory.Param.textColor);
    if (!this._page) { return; }
    if (this._eraseFlash > 0) { return; }
    var fs = this.contents.fontSize;
    var o = this._origin;
    var lineH = this.lineHeight();
    var blinkOn = (Graphics.frameCount % 60) < 30;
    var rightX = this.contents.width - 4;
    var page = this.currentSubPage();
    var curX = o[0];
    var curY = o[1];
    var selLines = {};
    var cursorPos = null;
    var markPos = null;
    for (var f = page.start; f <= page.end; f++) {
        var seg = this.segAt(f);
        var st = this.segState(seg);
        var text = this.segText(f);
        var count = 0;
        if (this._finished) {
            count = text.length;
        } else if (this._mode === 'simultaneous') {
            count = Math.min(this._prog[f], text.length);
        } else {
            if (f < this._flatIndex) { count = text.length; }
            else if (f === this._flatIndex) { count = Math.min(this._charIndex, text.length); }
        }
        var cum = this._cumWidths[f] || [];
        // 可改句高亮：仅当 未擦除 && 未修改 && 非自动播放 时显示金色
        // （修改完之后 / 自动演示时 全部统一文字颜色）
        var isEdit = seg.editable && !(st && st.erased) && !(st && st.modified) && !this._autoPlayMode;
        var editColor = '#b8860b';
        for (var k = 0; k < count; k++) {
            var cw = (k > 0 ? cum[k] - cum[k - 1] : cum[0]);
            if (!cw || cw <= 0 || isNaN(cw)) { cw = fs; }
            if (curX + cw > rightX && curX > o[0]) {
                curX = o[0];
                curY += lineH;
            }
            if (isEdit) {
                this.contents.fillRect(curX, curY, cw, fs, 'rgba(255, 217, 102, 0.35)');
                if (this.contents.textColor !== editColor) { this.changeTextColor(editColor); }
            } else if (this.contents.textColor !== _TDS_.UnwrittenStory.Param.textColor) {
                this.changeTextColor(_TDS_.UnwrittenStory.Param.textColor);
            }
            this.contents.drawText(text.charAt(k), curX, curY, cw, fs);
            if (this._selectionMode && f === this._selectionFlat) {
                var key = curY;
                if (!selLines[key]) { selLines[key] = { x1: curX, x2: curX + cw }; }
                else {
                    if (curX < selLines[key].x1) { selLines[key].x1 = curX; }
                    if (curX + cw > selLines[key].x2) { selLines[key].x2 = curX + cw; }
                }
            }
            var isWriteFlat = false;
            if (!this._finished && this._writing) {
                if (this._mode === 'simultaneous') {
                    isWriteFlat = (this._prog[f] < text.length && k === count - 1);
                } else {
                    isWriteFlat = (f === this._flatIndex);
                }
            }
            if (isWriteFlat) {
                cursorPos = { x: curX + cw, y: curY };
            }
            curX += cw;
        }
        if (st && st.marked && count === text.length) {
            markPos = { x: curX + 4, y: curY };
        }
        curX = o[0];
        curY += lineH;
    }
    if (cursorPos && blinkOn) {
        this.contents.drawText(_TDS_.UnwrittenStory.Param.cursorChar, cursorPos.x, cursorPos.y, fs, fs);
    }
    if (markPos) {
        this.contents.fillRect(markPos.x - 1, markPos.y - 1, fs + 2, fs + 2, 'rgba(180, 40, 40, 0.85)');
        this.contents.drawText('封', markPos.x, markPos.y, fs, fs);
    }
};

//=============================================================================
// ** 透明子窗口（动作/变体/确认）
//=============================================================================
function Window_UnwrittenBase() { throw new Error('static'); }
Window_UnwrittenBase.normalColor = function() {
    return _TDS_.UnwrittenStory.Param.textColor;
};
function Window_UnwrittenAction() { this.initialize.apply(this, arguments); }
Window_UnwrittenAction.prototype = Object.create(Window_Command.prototype);
Window_UnwrittenAction.prototype.constructor = Window_UnwrittenAction;
Window_UnwrittenAction.prototype.initialize = function(x, y, actionList) {
    this._actionList = actionList || [];
    Window_Command.prototype.initialize.call(this, x, y);
    _TDS_.UnwrittenStory.hideFrame(this);
};
Window_UnwrittenAction.prototype.normalColor = Window_UnwrittenBase.normalColor;
Window_UnwrittenAction.prototype.windowWidth = function() { return 160; };
Window_UnwrittenAction.prototype.numVisibleRows = function() { return 3; };
Window_UnwrittenAction.prototype.lineHeight = function() { return 24; };
Window_UnwrittenAction.prototype.makeCommandList = function() {
    for (var i = 0; i < this._actionList.length; i++) {
        var name = '';
        switch (this._actionList[i]) {
            case 'modify': name = '修改'; break;
            case 'erase':  name = '擦除'; break;
        }
        this.addCommand(name, this._actionList[i]);
    }
};

function Window_UnwrittenVariant() { this.initialize.apply(this, arguments); }
Window_UnwrittenVariant.prototype = Object.create(Window_Command.prototype);
Window_UnwrittenVariant.prototype.constructor = Window_UnwrittenVariant;
Window_UnwrittenVariant.prototype.initialize = function(x, y, variants) {
    this._variants = variants || [];
    Window_Command.prototype.initialize.call(this, x, y);
    _TDS_.UnwrittenStory.hideFrame(this);
};
Window_UnwrittenVariant.prototype.normalColor = Window_UnwrittenBase.normalColor;
Window_UnwrittenVariant.prototype.windowWidth = function() { return 360; };
Window_UnwrittenVariant.prototype.numVisibleRows = function() { return Math.max(1, Math.min(4, this._variants.length)); };
Window_UnwrittenVariant.prototype.lineHeight = function() { return 24; };
Window_UnwrittenVariant.prototype.makeCommandList = function() {
    for (var i = 0; i < this._variants.length; i++) { this.addCommand(this._variants[i], 'variant'); }
};

function Window_UnwrittenConfirm() { this.initialize.apply(this, arguments); }
Window_UnwrittenConfirm.prototype = Object.create(Window_Command.prototype);
Window_UnwrittenConfirm.prototype.constructor = Window_UnwrittenConfirm;
Window_UnwrittenConfirm.prototype.initialize = function(x, y, choices) {
    this._choices = (choices && choices.length > 0) ? choices : ['确定', '再读一遍'];
    Window_Command.prototype.initialize.call(this, x, y);
    _TDS_.UnwrittenStory.hideFrame(this);
};
Window_UnwrittenConfirm.prototype.normalColor = Window_UnwrittenBase.normalColor;
Window_UnwrittenConfirm.prototype.windowWidth = function() { return 220; };
Window_UnwrittenConfirm.prototype.numVisibleRows = function() { return this._choices.length; };
Window_UnwrittenConfirm.prototype.lineHeight = function() { return 24; };
Window_UnwrittenConfirm.prototype.makeCommandList = function() {
    for (var i = 0; i < this._choices.length; i++) { this.addCommand(this._choices[i], 'confirm'); }
};

//=============================================================================
// ** Scene_UnwrittenStory
//=============================================================================
function Scene_UnwrittenStory() { this.initialize.apply(this, arguments); }
Scene_UnwrittenStory.prototype = Object.create(Scene_BaseEX.prototype);
Scene_UnwrittenStory.prototype.constructor = Scene_UnwrittenStory;
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.initialize = function() {
    Scene_BaseEX.prototype.initialize.call(this);
    this._yamlFile = _TDS_.UnwrittenStory.Param.yamlFile;
    this._pageKey = null;
    this._pageOrder = [];
    this._pageIndex = 0;
    this._overrideSpeed = undefined;
    this._overrideMode = undefined;
    this._actionWindow = null;
    this._variantWindow = null;
    this._confirmWindow = null;
    this._hintWindow = null;
    this._pageImageSprite = null;
    this._flipping = false;
    this._flipDuration = 18;
    this._oldPageSprite = null;
    // 开场（书名书皮 + 标题打字）
    this._introPhase = 0;      // 0等待加载 1书皮淡入 2标题打字 3停留 4淡出 99完成
    this._introSprite = null;
    this._introTitleSprite = null;
    this._introChar = 0;
    this._introCharTimer = 0;
    this._introWait = 0;
    // 结尾流程（询问 → 重看 → 黑屏淡出）
    this._endingPhase = 0;      // 0=正常 1=重看模式 2=黑屏淡出
    this._endingBlack = null;
    // 自动播放（"确定"后从第一页自动翻页 + 书写动画）
    this._autoPlay = false;
    this._autoTimer = 0;
    this._playOrder = [];
    // 顺序状态机：全局已修改句数 + 当前解锁的修改页
    this._stateIndex = 0;
    this._nextEditPageIndex = -1;
};
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.prepare = function(yamlFile, pageKey, speed, mode) {
    this._yamlFile = yamlFile || _TDS_.UnwrittenStory.Param.yamlFile;
    this._pageKey = pageKey || null;
    if (speed !== undefined && Number(speed) > 0) { this._overrideSpeed = Number(speed); }
    if (mode === 'sequential' || mode === 'simultaneous') { this._overrideMode = mode; }
};
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.bookData = function() {
    var data = null;
    try { data = LanguageManager.languageData().text[this._yamlFile]; }
    catch (e) { data = null; }
    if (!data) {
        console.warn('UnwrittenStory: 找不到 YAML 数据: ' + this._yamlFile);
        return { pages: {}, order: [], defaults: {}, states: null };
    }
    return {
        pages: data.pages || {},
        order: data.order || Object.keys(data.pages || {}),
        defaults: data.defaults || {},
        states: data.states || null    // 整本状态快照模式（新格式）
    };
};
//---------------------------------------------------------------------------
// * 状态快照：把 states[0..stateIndex] 的 pages 逐层合并成当前完整书
//   后写覆盖先写（省略的页继承前一状态）
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.buildStatePages = function(stateIndex) {
    var merged = {};
    for (var s = 0; s <= stateIndex; s++) {
        var st = this._states[s];
        if (!st || !st.pages) { continue; }
        for (var key in st.pages) {
            merged[key] = st.pages[key];
        }
    }
    return merged;
};
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.create = function() {
    Scene_BaseEX.prototype.create.call(this);
    var data = this.bookData();
    this._defaults = data.defaults;
    if (data.states && data.states.length > 0) {
        // 状态快照模式：states[0].order 为页面顺序；_pages 按状态合并
        this._states = data.states;
        this._stateIndex = 0;
        this._pageOrder = (data.states[0].order || data.order || []).slice();
        if (this._pageOrder.length === 0) {
            for (var k0 in data.states[0].pages) { this._pageOrder.push(k0); }
        }
        this._pages = this.buildStatePages(0);
    } else {
        this._states = null;
        this._stateIndex = 0;
        this._pageOrder = data.order;
        this._pages = data.pages;
    }
    if (this._pageOrder.length === 0) {
        console.warn('UnwrittenStory: 书没有任何页面。yamlFile=' + this._yamlFile +
            ' | languages=' + (LanguageManager._language || '?') +
            ' | text 有该键=' + (LanguageManager.languageData() && LanguageManager.languageData().text ?
                (LanguageManager.languageData().text[this._yamlFile] !== undefined) : 'n/a'));
        // 游戏内可见诊断（红字）
        var err = new Sprite(new Bitmap(Graphics.width, 160));
        err.bitmap.fontSize = 18;
        err.bitmap.textColor = '#ff3333';
        err.bitmap.drawText('书数据加载失败: ' + this._yamlFile, 0, 0, Graphics.width, 26, 'center');
        err.bitmap.drawText('请检查 languages/sc/uw_book.yaml 是否存在且语法正确', 0, 32, Graphics.width, 26, 'center');
        this.addChild(err);
        return;
    }
    if (this._pageKey === null) { this._pageKey = this._pageOrder[0]; }
    var found = this._pageOrder.indexOf(this._pageKey);
    this._pageIndex = found >= 0 ? found : 0;
    this.createBackground();
    this.createPageImageSprite();
    this.createBookWindow();
    this.createPageBackground();
    this.createPageArrows();
    this.createFooterWindow();
    this.createIntroSprite();
    this.updateStoryState();
    this.onPageChange();
};
//---------------------------------------------------------------------------
// * 书窗口衬底：默认纯色（代码生成，无加载风险）；pageImage 参数可换图片
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.createPageBackground = function() {
    var size = this.bookWindowSize();
    var w = size.w, h = size.h;
    this._pageBgSprite = new Sprite();
    this._pageBgSprite.x = this._bookWindowBaseX;
    this._pageBgSprite.y = this._bookWindowBaseY;
    var name = _TDS_.UnwrittenStory.Param.pageImage;
    var self = this;
    if (name) {
        var img = ImageManager.loadPicture(name);
        img.addLoadListener(function() {
            if (img.width > 0 && !img.isError()) {
                self._pageBgSprite.bitmap = img;
                self._pageBgSprite.scale.x = w / img.width;
                self._pageBgSprite.scale.y = h / img.height;
                self._pageBgSprite.visible = true;
            }
        });
    } else {
        var bmp = new Bitmap(w, h);
        bmp.fillRect(0, 0, w, h, 'rgba(246, 240, 222, 1)');   // 米色纸
        this._pageBgSprite.bitmap = bmp;
        this._pageBgSprite.visible = true;
    }
    // 插到书窗口下方（背景 → 衬底 → 文本 → 页脚）
    var idx = this.children.indexOf(this._bookWindow);
    if (idx < 0) { idx = 0; }
    this.addChildAt(this._pageBgSprite, idx);
};
//---------------------------------------------------------------------------
// * 背景（纯色兜底 + 图片 addLoadListener 替换，最底层）
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.createBackground = function() {
    this._background = new Sprite(new Bitmap(Graphics.width, Graphics.height));
    this._background.bitmap.fillRect(0, 0, Graphics.width, Graphics.height,
        _TDS_.UnwrittenStory.Param.backgroundColor);
    this.addChildAt(this._background, 0);
    var name = _TDS_.UnwrittenStory.Param.backgroundImage || '';
    if (!name) { return; }
    var img = ImageManager.loadPicture(name);
    var self = this;
    img.addLoadListener(function() {
        if (img.width > 0 && !img.isError()) {
            var spr = self._background;
            spr.bitmap = img;
            spr.scale.x = 1;
            spr.scale.y = 1;
            if (_TDS_.UnwrittenStory.Param.backgroundStretch) {
                spr.x = 0;
                spr.y = 0;
                spr.scale.x = Graphics.width / img.width;
                spr.scale.y = Graphics.height / img.height;
            } else {
                spr.x = (Graphics.width - img.width) / 2;
                spr.y = (Graphics.height - img.height) / 2;
            }
        }
    });
};
//---------------------------------------------------------------------------
// * 开场：书皮淡入 → 标题逐字打字 → 停留 → 淡出（动画期间隐藏书内容）
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.createIntroSprite = function() {
    // 开场期间先隐藏书内容/页脚/箭头
    this._bookWindow.visible = false;
    this._footer.visible = false;
    this._leftArrow.visible = false;
    this._rightArrow.visible = false;
    var name = _TDS_.UnwrittenStory.Param.coverImage;
    if (!name) { this.finishIntro(); return; }
    var img = ImageManager.loadPicture(name);
    var self = this;
    img.addLoadListener(function() {
        if (img.width > 0 && !img.isError()) {
            // 书皮大图按比例适配屏幕（fit）
            var fit = Math.min(Graphics.width / img.width, Graphics.height / img.height);
            var spr = new Sprite(img);
            spr.anchor.set(0.5, 0.5);
            spr.x = Graphics.width / 2;
            spr.y = Graphics.height / 2;
            spr.scale.x = fit * 0.85;
            spr.scale.y = fit * 0.85;
            spr.opacity = 0;
            self.addChild(spr);
            self._introSprite = spr;
            // 标题文本（可留空 = 不显示）
            if (_TDS_.UnwrittenStory.Param.titleText) {
                var title = new Sprite(new Bitmap(640, 100));
                title.x = 0;
                title.y = Graphics.height / 2 - 78;
                self.addChild(title);
                self._introTitleSprite = title;
            }
            self._introPhase = 1;
            self.move.startMove({
                obj: spr, properties: ['opacity', 'scale.x', 'scale.y'],
                from: { opacity: 0, 'scale.x': fit * 0.85, 'scale.y': fit * 0.85 },
                to: { opacity: 255, 'scale.x': fit, 'scale.y': fit },
                durations: { opacity: 20, 'scale.x': 20, 'scale.y': 20 },
                easing: Object_Movement.easeOutCirc
            });
        } else {
            self.finishIntro();
        }
    });
};
// 标题打字绘制（逐字 + 闪烁光标）
Scene_UnwrittenStory.prototype.drawIntroTitle = function() {
    if (!this._introTitleSprite || !_TDS_.UnwrittenStory.Param.titleText) { return; }
    var bmp = this._introTitleSprite.bitmap;
    bmp.clear();
    var fs = _TDS_.UnwrittenStory.Param.titleFontSize;
    bmp.fontSize = fs;
    bmp.fontFace = _TDS_.UnwrittenStory.Param.font || bmp.fontFace;
    var text = _TDS_.UnwrittenStory.Param.titleText;
    var count = Math.min(this._introChar, text.length);
    var shown = text.substring(0, count);
    // 居中定位
    var totalW = bmp.measureTextWidth(shown);
    var x = (bmp.width - totalW) / 2;
    var y = (bmp.height - fs) / 2;
    bmp.textColor = _TDS_.UnwrittenStory.Param.titleColor;
    for (var i = 0; i < shown.length; i++) {
        var cw = bmp.measureTextWidth(shown.charAt(i));
        bmp.drawText(shown.charAt(i), x, y, cw, fs);
        x += cw;
    }
    // 光标闪烁
    if (count < text.length || (Graphics.frameCount % 60) < 30) {
        bmp.textColor = _TDS_.UnwrittenStory.Param.titleColor;
        bmp.drawText('_', x, y, fs, fs);
    }
};
Scene_UnwrittenStory.prototype.finishIntro = function() {
    this._introPhase = 99;
    this._bookWindow.visible = true;
    this._footer.visible = true;
    this._leftArrow.visible = this._pageIndex > 0 || this._bookWindow._subIndex > 0;
    this._rightArrow.visible = this._pageIndex < this._pageOrder.length - 1 ||
        this._bookWindow._subIndex < this._bookWindow._subPages.length - 1;
    this.refreshFooter();
};
Scene_UnwrittenStory.prototype.updateIntro = function() {
    var title = _TDS_.UnwrittenStory.Param.titleText;
    if (this._introPhase === 1) {
        // 书皮淡入完成 → 有标题则打字，否则停留
        if (!this.move.isMoving()) {
            if (title.length > 0) {
                this._introPhase = 2;
                this._introChar = 0;
                this._introCharTimer = 0;
                this.drawIntroTitle();
            } else {
                this._introPhase = 3;
                this._introWait = 0;
            }
        }
    } else if (this._introPhase === 2) {
        // 逐字打字（每 6 帧一个字）
        this._introCharTimer++;
        if (this._introCharTimer >= 6 && this._introChar < title.length) {
            this._introCharTimer = 0;
            this._introChar++;
            this.drawIntroTitle();
        } else {
            this.drawIntroTitle();  // 刷新光标闪烁
        }
        if (this._introChar >= title.length) {
            this._introPhase = 3;
            this._introWait = 0;
        }
    } else if (this._introPhase === 3) {
        this._introWait++;
        if (this._introWait > 30) {
            this._introPhase = 4;
            AudioManager.playSe({ name: 'sys_PA_page_flip', volume: 80, pitch: 110, pan: 0 });
            var objs = [this._introSprite, this._introTitleSprite];
            for (var i = 0; i < objs.length; i++) {
                if (!objs[i]) { continue; }
                this.move.startMove({
                    obj: objs[i], properties: ['opacity', 'scale.x', 'scale.y'],
                    from: { opacity: 255, 'scale.x': 1, 'scale.y': 1 },
                    to: { opacity: 0, 'scale.x': 1.15, 'scale.y': 1.15 },
                    durations: { opacity: 25, 'scale.x': 25, 'scale.y': 25 },
                    easing: Object_Movement.easeInCirc
                });
            }
        }
    } else if (this._introPhase === 4) {
        if (!this.move.isMoving()) {
            if (this._introSprite) { this.removeChild(this._introSprite); this._introSprite = null; }
            if (this._introTitleSprite) { this.removeChild(this._introTitleSprite); this._introTitleSprite = null; }
            this.finishIntro();
        }
    }
};
//---------------------------------------------------------------------------
// * 首次提示（可改句子）
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.tryShowHint = function() {
    if (this._hintWindow || this._introPhase !== 99) { return; }
    if ($gameSwitches.value(_TDS_.UnwrittenStory.Param.hintSwitchId)) { return; }
    var page = this.currentPage();
    var hasEdit = (page.edits && page.edits.length > 0) ||
        (page.lines && page.lines.some(function(l) { return l.id !== undefined; }));
    if (!hasEdit) { return; }
    this._hintWindow = new Window_Base(0, 0, 380, 56);
    _TDS_.UnwrittenStory.hideFrame(this._hintWindow);
    this._hintWindow.x = (Graphics.width - 380) / 2;
    this._hintWindow.y = this.menuBaseY();
    this._hintWindow.contents.fontSize = 15;
    this._hintWindow.changeTextColor('#b8860b');
    this._hintWindow.contents.drawText('这里好像还能再改一改', 0, 0,
        this._hintWindow.contents.width, 22, 'center');
    this._hintWindow.contents.drawText('（按顺序改，改后不可撤销）', 0, 26,
        this._hintWindow.contents.width, 20, 'center');
    this.addChild(this._hintWindow);
    this._footer.visible = false;
};
Scene_UnwrittenStory.prototype.closeHint = function() {
    if (this._hintWindow) {
        this.removeChild(this._hintWindow);
        this._hintWindow = null;
    }
    if (this._footer) { this._footer.visible = true; }
    $gameSwitches.setValue(_TDS_.UnwrittenStory.Param.hintSwitchId, true);
};
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.createPageImageSprite = function() {
    this._pageImageSprite = new Sprite();
    this._pageImageSprite.visible = false;
    this.addChild(this._pageImageSprite);
};
Scene_UnwrittenStory.prototype.updatePageImage = function() {
    if (!this._pageImageSprite) { return; }
    var page = this._pages[this._pageKey];
    var name = (page && page.image) || '';
    if (!name) {
        this._pageImageSprite.visible = false;
        this._pageImageSprite.bitmap = null;
        return;
    }
    var img = ImageManager.loadPicture(name);
    if (!img.isReady()) { return; }
    if (img.width === 0 || img.isError()) {
        this._pageImageSprite.visible = false;
        return;
    }
    this._pageImageSprite.bitmap = img;
    var ix = (page.imageX !== undefined) ? Number(page.imageX) : -1;
    var iy = (page.imageY !== undefined) ? Number(page.imageY) : -1;
    this._pageImageSprite.x = ix >= 0 ? ix : (Graphics.width - img.width) / 2;
    this._pageImageSprite.y = iy >= 0 ? iy : (Graphics.height - img.height) / 2;
    this._pageImageSprite.visible = true;
};
//---------------------------------------------------------------------------
//---------------------------------------------------------------------------
// * 书窗口尺寸（0 = 自适应；底部留 160px 给页码/菜单/询问窗）
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.bookWindowSize = function() {
    var pw = _TDS_.UnwrittenStory.Param.bookWidth;
    var ph = _TDS_.UnwrittenStory.Param.bookHeight;
    return {
        w: (pw && pw > 0) ? pw : (Graphics.width - 40),
        // 分页已禁用：书窗口足够高，容纳整页文本（默认内容区约 9 行）
        h: (ph && ph > 0) ? ph : (Graphics.height - 160)
    };
};
Scene_UnwrittenStory.prototype.createBookWindow = function() {
    var size = this.bookWindowSize();
    var w = size.w, h = size.h;
    var bx = _TDS_.UnwrittenStory.Param.bookX;
    var by = _TDS_.UnwrittenStory.Param.bookY;
    this._bookWindowBaseX = bx >= 0 ? bx : (Graphics.width - w) / 2;
    // 默认位置上移：底部留出菜单区
    this._bookWindowBaseY = by >= 0 ? by : Math.max(8, (Graphics.height - h) / 2 - 16);
    this._bookWindow = new Window_UnwrittenBook(this._bookWindowBaseX, this._bookWindowBaseY, w, h);
    this.addChild(this._bookWindow);
};
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.createPageArrows = function() {
    var bitmap = ImageManager.loadSystem('ACSArrows');
    this._leftArrow = new Sprite(bitmap);
    this._leftArrow.anchor.set(0.5, 0.5);
    this._leftArrow.setFrame(64, 0, 32, 29);
    this._leftArrow.x = this._bookWindow.x - 24;
    this._leftArrow.y = this._bookWindow.y + this._bookWindow.height / 2;
    this.addChild(this._leftArrow);
    this._rightArrow = new Sprite(bitmap);
    this._rightArrow.anchor.set(0.5, 0.5);
    this._rightArrow.setFrame(32, 0, 32, 29);
    this._rightArrow.x = this._bookWindow.x + this._bookWindow.width + 24;
    this._rightArrow.y = this._bookWindow.y + this._bookWindow.height / 2;
    this.addChild(this._rightArrow);
};
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.createFooterWindow = function() {
    var w = _TDS_.UnwrittenStory.Param.bookWidth;
    if (!(w > 0)) { w = Graphics.width - 40; }
    // 页脚固定在屏幕底部（不再被书窗口挤出屏幕外）
    this._footer = new Window_Base(
        (Graphics.width - w) / 2,
        Graphics.height - 66, w, 60);
    _TDS_.UnwrittenStory.hideFrame(this._footer);
    this.addChild(this._footer);
};
//---------------------------------------------------------------------------
// * 页码（全局子页序号）
//---------------------------------------------------------------------------
// 分页已禁用：每页 = 一个子页，页码恒为 1
Scene_UnwrittenStory.prototype.estimateSubPages = function(pageKey) {
    return 1;
};
Scene_UnwrittenStory.prototype.totalSubPages = function() {
    return Math.max(1, this._pageOrder.length);
};
Scene_UnwrittenStory.prototype.currentSubPageNumber = function() {
    return this._pageIndex + 1;
};
Scene_UnwrittenStory.prototype.refreshFooter = function() {
    this._footer.contents.clear();
    this._footer.changeTextColor(_TDS_.UnwrittenStory.Param.textColor);
    this._footer.contents.fontSize = 14;
    this._footer.contents.drawText('←→ 翻页   确定 选句',
        0, 8, this._footer.contents.width, 18, 'center');
};
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.currentPage = function() {
    return this._pages[this._pageKey] || {};
};
//---------------------------------------------------------------------------
//---------------------------------------------------------------------------
// * 顺序状态机：按页序修改，改完一页才解锁下一页的句子
//   状态快照模式：解锁页 = 当前状态 editable 句子所在页
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.updateStoryState = function() {
    var book = this._bookWindow;
    if (this._states) {
        // --- 状态快照模式 ---
        var cur = this._states[this._stateIndex];
        this._nextEditPageIndex = -1;
        if (cur && cur.editable !== undefined) {
            var targetId = String(cur.editable);
            for (var i = 0; i < this._pageOrder.length; i++) {
                var key = this._pageOrder[i];
                var pg = this._pages[key];
                if (pg && $gameUnwrittenStory.pageHasId(pg, targetId)) {
                    this._nextEditPageIndex = i;
                    break;
                }
            }
        }
        if (book) { book._dirty = true; }
        return;
    }
    // --- 旧格式（分支/逐句）---
    var resolver = function(pg) { return book ? book.resolveBranch(pg) : pg; };
    this._stateIndex = $gameUnwrittenStory.modifiedCountBranch(this._pages, this._pageOrder, resolver);
    this._nextEditPageIndex = -1;
    for (var j = 0; j < this._pageOrder.length; j++) {
        var key2 = this._pageOrder[j];
        var pg2 = this._pages[key2];
        if (!pg2 || pg2.readonly) { continue; }
        // 分支感知：先按当前状态解析该页分支，再检查分支内的可改句
        var resolved = book ? book.resolveBranch(pg2, key2) : pg2;
        if ($gameUnwrittenStory.pageHasUnmodified(key2, resolved)) {
            this._nextEditPageIndex = j;
            break;
        }
    }
    if (book) {
        book._dirty = true;
    }
};
Scene_UnwrittenStory.prototype.canEditCurrentPage = function() {
    return this._pageIndex === this._nextEditPageIndex;
};
//---------------------------------------------------------------------------
// * 状态快照推进：修改成功后调用。
//   状态+1 → 重建整本 _pages（后状态覆盖前状态）→ 重渲染当前页（停留当前页）
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.advanceState = function() {
    if (!this._states) { return; }
    var next = this._stateIndex + 1;
    if (next >= this._states.length) { return; }
    this._stateIndex = next;
    this._pages = this.buildStatePages(next);
    // 重渲染当前页（按新状态的页面内容）
    if (this._bookWindow) {
        this.onPageChange();
        this._bookWindow._writing = false;
        this._bookWindow._finished = true;
    }
    this.updateStoryState();
};
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.onPageChange = function() {
    var pageKey = this._pageOrder[this._pageIndex];
    this._pageKey = pageKey;
    this._bookWindow.setDefaults(this._defaults);
    this._bookWindow.setPage(pageKey, this._pages[pageKey], this._stateIndex);
    if (this._overrideSpeed !== undefined) { this._bookWindow.setSpeed(this._overrideSpeed); }
    if (this._overrideMode !== undefined) { this._bookWindow.setMode(this._overrideMode); }
    this.updatePageImage();
    this._leftArrow.visible = this._pageIndex > 0 || this._bookWindow._subIndex > 0;
    this._rightArrow.visible = this._pageIndex < this._pageOrder.length - 1 ||
        this._bookWindow._subIndex < this._bookWindow._subPages.length - 1;
    this.refreshFooter();
};
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.flipPage = function(dir, keepWriting) {
    var book = this._bookWindow;
    if (book.moveSubPage(dir, keepWriting)) {
        // 子页内翻页：页码与箭头可见性也要刷新
        this._leftArrow.visible = this._pageIndex > 0 || book._subIndex > 0;
        this._rightArrow.visible = this._pageIndex < this._pageOrder.length - 1 ||
            book._subIndex < book._subPages.length - 1;
        this.refreshFooter();
        this.playFlip(dir);
        return;
    }
    var target = this._pageIndex + dir;
    if (target < 0 || target >= this._pageOrder.length) { return; }
    this._pageIndex = target;
    // onPageChange 会更新 _pageKey、页脚、箭头与页面背景图
    this.onPageChange();
    if (!keepWriting) {
        this._bookWindow._writing = false;
        this._bookWindow._finished = true;
    }
    if (dir < 0) {
        while (book.moveSubPage(1, keepWriting)) { /* 移到最后一子页 */ }
        this._leftArrow.visible = this._pageIndex > 0 || book._subIndex > 0;
        this._rightArrow.visible = this._pageIndex < this._pageOrder.length - 1 ||
            book._subIndex < book._subPages.length - 1;
        this.refreshFooter();
    }
    this.playFlip(dir);
};
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.playFlip = function(dir) {
    var book = this._bookWindow;
    var w = book.width, h = book.height;
    var cw = book.contents.width, ch = book.contents.height;
    var snap = new Bitmap(cw, ch);
    snap.blt(book.contents, 0, 0, cw, ch, 0, 0);   // 用 contents 实际尺寸（否则快照空白）
    this._oldPageSprite = new Sprite(snap);
    this._oldPageSprite.x = this._bookWindowBaseX;
    this._oldPageSprite.y = this._bookWindowBaseY;
    this.addChild(this._oldPageSprite);
    var startX = this._bookWindowBaseX + dir * (w + 40);
    book.x = startX;
    this._flipping = true;
    var dur = this._flipDuration;
    this.move.startMove({
        obj: book, properties: ['x'],
        from: { x: startX }, to: { x: this._bookWindowBaseX },
        durations: { x: dur }, easing: Object_Movement.easeOutCirc
    });
    this.move.startMove({
        obj: this._oldPageSprite, properties: ['x'],
        from: { x: this._bookWindowBaseX }, to: { x: this._bookWindowBaseX - dir * (w + 40) },
        durations: { x: dur }, easing: Object_Movement.easeOutCirc
    });
    // 书页衬底跟随新页一起滑入
    if (this._pageBgSprite) {
        this._pageBgSprite.x = startX;
        this.move.startMove({
            obj: this._pageBgSprite, properties: ['x'],
            from: { x: startX }, to: { x: this._bookWindowBaseX },
            durations: { x: dur }, easing: Object_Movement.easeOutCirc
        });
    }
    AudioManager.playSe({ name: 'sys_PA_page_flip', volume: 80, pitch: 100, pan: 0 });
    this.updatePageImage();
    this._leftArrow.visible = this._pageIndex > 0 || book._subIndex > 0;
    this._rightArrow.visible = this._pageIndex < this._pageOrder.length - 1 ||
        book._subIndex < book._subPages.length - 1;
    this.refreshFooter();
};
Scene_UnwrittenStory.prototype.updateFlip = function() {
    if (!this.move.isMoving()) {
        this._bookWindow.x = this._bookWindowBaseX;
        if (this._pageBgSprite) { this._pageBgSprite.x = this._bookWindowBaseX; }
        if (this._oldPageSprite) {
            this.removeChild(this._oldPageSprite);
            this._oldPageSprite = null;
        }
        this._flipping = false;
    }
};
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.menuBaseY = function() {
    return Graphics.height - 64;
};
// 把菜单/询问窗贴到屏幕底部（永不遮挡书页）
Scene_UnwrittenStory.prototype.placeMenuBottom = function(win) {
    win.y = Graphics.height - win.height - 8;
};
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.openActionWindow = function() {
    var actionList = this._bookWindow.segActionList(this._bookWindow._selectionFlat);
    if (actionList.length === 0) { SoundManager.playBuzzer(); return; }
    this._actionWindow = new Window_UnwrittenAction(0, 0, actionList);
    this._actionWindow.x = (Graphics.width - this._actionWindow.width) / 2;
    this.placeMenuBottom(this._actionWindow);
    this._actionWindow.setHandler('ok', this.onActionOk.bind(this));
    this._actionWindow.setHandler('cancel', this.onActionCancel.bind(this));
    this.addChild(this._actionWindow);
    this._footer.visible = false;
    this._actionWindow.activate();
    this._actionWindow.select(0);
};
Scene_UnwrittenStory.prototype.onActionOk = function() {
    var action = this._actionWindow.currentSymbol();
    var flatIndex = this._bookWindow._selectionFlat;
    var seg = this._bookWindow.segAt(flatIndex);
    var st = this._bookWindow.segState(seg);
    if (action === 'modify') {
        this._actionWindow.deactivate();
        this.removeChild(this._actionWindow);
        this._actionWindow = null;
        this._variantWindow = new Window_UnwrittenVariant(0, 0, seg.variants);
        this._variantWindow.x = (Graphics.width - this._variantWindow.width) / 2;
        this.placeMenuBottom(this._variantWindow);
        this._variantWindow.setHandler('ok', this.onVariantOk.bind(this));
        this._variantWindow.setHandler('cancel', this.onVariantCancel.bind(this));
        this.addChild(this._variantWindow);
        this._variantWindow.activate();
        this._variantWindow.select(0);
    } else if (action === 'erase') {
        $gameUnwrittenStory.setErased(this._bookWindow._pageKey, seg.id, true);
        AudioManager.playSe({ name: 'SE_Mess_Paper', volume: 70, pitch: 100, pan: 0 });
        var book = this._bookWindow;
        book._selectionMode = false;
        book._eraseFlash = 25;
        book._rewritePending = true;
        book._dirty = true;
        this.closeActionWindow();
        if (this._states) { this.advanceState(); } else { this.updateStoryState(); }
    }
};
Scene_UnwrittenStory.prototype.onVariantOk = function() {
    var flatIndex = this._bookWindow._selectionFlat;
    var seg = this._bookWindow.segAt(flatIndex);
    $gameUnwrittenStory.setVariant(this._bookWindow._pageKey, seg.id, this._variantWindow.index());
    AudioManager.playSe({ name: 'SYS_select', volume: 80, pitch: 110, pan: 0 });
    this._variantWindow.deactivate();
    this.removeChild(this._variantWindow);
    this._variantWindow = null;
    this.closeActionWindow();
    if (this._states) { this.advanceState(); } else { this.updateStoryState(); }
};
Scene_UnwrittenStory.prototype.onVariantCancel = function() {
    this._variantWindow.deactivate();
    this.removeChild(this._variantWindow);
    this._variantWindow = null;
    if (this._actionWindow) { this._actionWindow.activate(); }
};
Scene_UnwrittenStory.prototype.onActionCancel = function() {
    this.closeActionWindow();
};
Scene_UnwrittenStory.prototype.closeActionWindow = function() {
    if (this._actionWindow) {
        this._actionWindow.deactivate();
        this.removeChild(this._actionWindow);
        this._actionWindow = null;
    }
    if (this._footer) { this._footer.visible = true; }
    if (this._bookWindow) {
        this._bookWindow._dirty = true;
        this.refreshFooter();
    }
};
//---------------------------------------------------------------------------
// * 结尾：最后一页按确定 → 询问"是否确定" → 确定(自动播放整本书→黑屏淡出) / 否(跳回上一页)
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.showAskWindow = function() {
    try {
        var page = this.currentPage();
        var choices = page.confirmChoices || ['确定', '否'];
        this._confirmWindow = new Window_UnwrittenConfirm(0, 0, choices);
        this._confirmWindow.x = (Graphics.width - this._confirmWindow.width) / 2;
        this.placeMenuBottom(this._confirmWindow);
        this._confirmWindow.setHandler('ok', this.onAskOk.bind(this));
        this._confirmWindow.setHandler('cancel', this.onAskCancel.bind(this));
        this.addChild(this._confirmWindow);
        this._footer.visible = false;
        this._confirmWindow.activate();
        this._confirmWindow.select(0);
    } catch (e) {
        console.warn('UnwrittenStory 询问窗异常: ' + e.message);
    }
};
Scene_UnwrittenStory.prototype.onAskOk = function() {
    var index = this._confirmWindow.index();
    this.closeConfirmWindow();
    if (index === 0) {
        // 确定：自动播放整本书
        this.startAutoPlay();
    } else {
        // 否：自动跳回上一页
        this.flipPage(-1);
        SoundManager.playCancel();
    }
};
Scene_UnwrittenStory.prototype.onAskCancel = function() {
    // 不使用 ESC 退出；忽略
    SoundManager.playBuzzer();
};
//---------------------------------------------------------------------------
// * 自动播放（"确定"后从第一页开始自动翻页 + 书写动画，播完黑屏淡出）
//   播放列表默认排除确认页（confirm），只播正文+结局；可被子类/后续扩展
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.autoPlayOrder = function() {
    var list = [];
    for (var i = 0; i < this._pageOrder.length; i++) {
        var p = this._pages[this._pageOrder[i]];
        if (p && p.confirm) { continue; }   // 自动播放不放出"故事已经结束了"这一页
        list.push(this._pageOrder[i]);
    }
    return list;
};
Scene_UnwrittenStory.prototype.applyAutoSpeed = function() {
    var book = this._bookWindow;
    if (!book) { return; }
    var asp = Math.max(1, _TDS_.UnwrittenStory.Param.autoPlaySpeed || 2);
    book._speed = asp;
    for (var i = 0; i < book._lineSpeeds.length; i++) { book._lineSpeeds[i] = asp; }
};
Scene_UnwrittenStory.prototype.startAutoPlay = function() {
    this._autoPlay = true;
    this._autoTimer = 0;
    this._playOrder = this.autoPlayOrder();
    this._pageIndex = 0;
    this._footer.visible = false;
    this._bookWindow._autoPlayMode = true;   // 自动演示中：全部文字统一颜色
    this.onPageChange();   // setPage 会触发书写动画
    this.applyAutoSpeed();
    SoundManager.playOk();
};
Scene_UnwrittenStory.prototype.updateAutoPlay = function() {
    var book = this._bookWindow;
    if (this._flipping) { this.updateFlip(); return; }
    if (book._writing && !book._finished) { return; }   // 书写中
    this._autoTimer++;
    if (this._autoTimer < Math.max(1, _TDS_.UnwrittenStory.Param.autoPlayPause || 15)) { return; }
    this._autoTimer = 0;
    var playIdx = this._playOrder.indexOf(this._pageKey);
    var isLast = (playIdx >= this._playOrder.length - 1) &&
                 (book._subIndex >= book._subPages.length - 1);
    if (isLast) {
        this._autoPlay = false;
        this.startEnding();
        return;
    }
    this.flipPage(1, true);   // 自动翻下一页（保留书写动画）
    this.applyAutoSpeed();
    // 扩展钩子：每次翻到新页时调用，可在此加入心理恐怖效果
    this.onAutoPlayPage(this._pageKey, playIdx + 1);
};
//---------------------------------------------------------------------------
// * 自动播放扩展钩子（默认空实现；后续可在子类/覆盖中加心理恐怖效果）
//   pageKey: 当前页键；playIndex: 播放列表序号（从0开始）
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.onAutoPlayPage = function(pageKey, playIndex) { };
Scene_UnwrittenStory.prototype.closeConfirmWindow = function() {
    if (this._confirmWindow) {
        this._confirmWindow.deactivate();
        this.removeChild(this._confirmWindow);
        this._confirmWindow = null;
    }
    if (this._footer) { this._footer.visible = true; }
};
//---------------------------------------------------------------------------
// * 黑屏淡出结束
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.startEnding = function() {
    if (this._endingPhase === 2) { return; }
    this._endingPhase = 2;
    var black = new Sprite(new Bitmap(Graphics.width, Graphics.height));
    black.bitmap.fillRect(0, 0, Graphics.width, Graphics.height, 'rgba(0, 0, 0, 1)');
    black.opacity = 0;
    this.addChild(black);
    this._endingBlack = black;
    this.move.startMove({
        obj: black, properties: ['opacity'],
        from: { opacity: 0 }, to: { opacity: 255 },
        durations: { opacity: 40 }, easing: Object_Movement.easeInCirc
    });
    SoundManager.playSe({ name: 'sys_PA_page_flip', volume: 60, pitch: 60, pan: 0 });
};
Scene_UnwrittenStory.prototype.updateEnding = function() {
    if (this._endingPhase === 2 && !this.move.isMoving()) {
        var page = this.currentPage();
        var switchId = page.doneSwitchId;
        if (!switchId) {
            // 自动播放跳过了确认页：在全书配置中查找完成开关
            for (var i = 0; i < this._pageOrder.length; i++) {
                var p = this._pages[this._pageOrder[i]];
                if (p && p.doneSwitchId) { switchId = p.doneSwitchId; break; }
            }
        }
        if (switchId) { $gameSwitches.setValue(Number(switchId), true); }
        this.popScene();
    }
};
//---------------------------------------------------------------------------
Scene_UnwrittenStory.prototype.update = function() {
    try {
        this.updateInner();
    } catch (e) {
        this._flipping = false;
        console.warn('[UnwrittenStory] 场景异常: ' + e.message + ' | ' + (e.stack || '').split('\n')[1] || '');
    }
};
Scene_UnwrittenStory.prototype.updateInner = function() {
    Scene_BaseEX.prototype.update.call(this);
    if (this._introPhase !== 99) {
        this.updateIntro();
        return;
    }
    if (this._endingPhase === 2) {
        this.updateEnding();
        return;
    }
    if (this._flipping) { this.updateFlip(); return; }
    if (this._autoPlay) { this.updateAutoPlay(); return; }
    if (this._actionWindow && this._actionWindow.active) { return; }
    if (this._variantWindow && this._variantWindow.active) { return; }
    if (this._confirmWindow && this._confirmWindow.active) { return; }
    var book = this._bookWindow;
    if (!book) { return; }
    if (this._hintWindow) {
        if (Input.isTriggered('ok') || Input.isTriggered('cancel')) {
            this.closeHint();
            SoundManager.playOk();
        }
        // 不拦截其他输入（翻页等继续可用）
    }
    if (book._writing) {
        if (Input.isTriggered('ok')) { book.finishWriting(); SoundManager.playCursor(); this.refreshFooter(); }
        return;
    }
    // 确认页：翻到即自动弹出询问窗（不依赖按键；重看模式除外）
    if (this.currentPage().confirm && !book._selectionMode && !this._confirmWindow && this._endingPhase !== 1) {
        this.showAskWindow();
        return;
    }
    if (book._selectionMode) {
        book.updateSelection();
        if (Input.isTriggered('ok')) { this.openActionWindow(); }
        else if (Input.isTriggered('cancel')) {
            book._selectionMode = false;
            book._dirty = true;
            SoundManager.playCancel();
        }
        // 选句模式下也允许 ← → 翻页（先退出选句）
        else if (Input.isRepeated('left') && (this._pageIndex > 0 || book._subIndex > 0)) {
            book._selectionMode = false;
            this.flipPage(-1);
        } else if (Input.isRepeated('right') && (this._pageIndex < this._pageOrder.length - 1 || book._subIndex < book._subPages.length - 1)) {
            book._selectionMode = false;
            this.flipPage(1);
        }
        return;
    }
    // 重看模式：翻到最后一页（确认页）→ 黑屏淡出结束
    if (this._endingPhase === 1 && this.currentPage().confirm) {
        this.startEnding();
        return;
    }
    var canLeft = this._pageIndex > 0 || book._subIndex > 0;
    var canRight = this._pageIndex < this._pageOrder.length - 1 ||
        book._subIndex < book._subPages.length - 1;
    // 翻页：isTriggered 每按一次翻一页（可靠），isRepeated 按住加速
    if (Input.isTriggered('left') && canLeft) {
        if (this._hintWindow) { this.closeHint(); }
        this.flipPage(-1);
    } else if (Input.isTriggered('right') && canRight) {
        if (this._hintWindow) { this.closeHint(); }
        this.flipPage(1);
    } else if (Input.isRepeated('left') && canLeft) {
        if (this._hintWindow) { this.closeHint(); }
        this.flipPage(-1);
    } else if (Input.isRepeated('right') && canRight) {
        if (this._hintWindow) { this.closeHint(); }
        this.flipPage(1);
    } else if (Input.isTriggered('ok')) {
        if (this.currentPage().confirm) {
            // 最后一页按确定 → 询问"是否更改完成"
            this.showAskWindow();
        } else if (book._finished && book._flat.length > 0 && !this.currentPage().readonly &&
                   this.canEditCurrentPage() && book.nextEditableIndex(book.currentSubPage().start) >= 0) {
            var targetFlat = this._states
                ? book.findEditableIndexByState(this._states[this._stateIndex].editable)
                : book.nextEditableIndex(book.currentSubPage().start);
            if (targetFlat < 0) { SoundManager.playBuzzer(); }
            else {
                book._selectionFlat = targetFlat;
                book.gotoFlatSubPage(book._selectionFlat);
                book._selectionMode = true;
                book._dirty = true;
                SoundManager.playCursor();
            }
        } else {
            SoundManager.playBuzzer();
        }
    }
    // 首次提示：开场结束后、浏览态中显示
    this.tryShowHint();
    var s = Math.sin(Graphics.frameCount * 0.2) * 0.1;
    this._leftArrow.anchor.x = 0.5 - s;
    this._rightArrow.anchor.x = 0.5 + s;
};

//=============================================================================
// ** 加载自检日志
//=============================================================================
console.log('[UnwrittenStory] v1.26 已加载 | 背景: ' +
    _TDS_.UnwrittenStory.Param.backgroundImage +
    ' | 书皮: ' + _TDS_.UnwrittenStory.Param.coverImage +
    ' | 字号: ' + _TDS_.UnwrittenStory.Param.fontSize +
    ' | 提示开关: ' + _TDS_.UnwrittenStory.Param.hintSwitchId);
