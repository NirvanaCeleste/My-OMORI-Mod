//=============================================================================
// TDS UnwrittenStory —— 《未竟之事》
// Version: 1.41 - 阶段一排版/动画分离 + 阶段三事件总线与句子书域隔离
//=============================================================================
// Add to Imported List
var Imported = Imported || {} ; Imported.TDS_UnwrittenStory = true;
// Initialize Alias Object
var _TDS_ = _TDS_ || {} ; _TDS_.UnwrittenStory = _TDS_.UnwrittenStory || {};
//=============================================================================
 /*:
 * @plugindesc v1.39 梦境之书：树状状态机 / 修改擦除保留 / blocks四方向叠层文字 / 进度存档恢复 / 配合UnwrittenSeal封存
 * 作者：NirvanaCeleste
 *
 * @author NirvanaCeleste
 *
 * @help
 * ============================================================================
 * 《未竟之事》—— 梦境修改之书插件
 * ============================================================================
 * 打开书（事件插件命令）：
 *   UnwrittenStory Open uw_book_night0 treehouse
 *   UnwrittenStory Open uw_book_night0 treehouse 4 sequential
 *
 * YAML 结构（状态快照模式）：
 *   states:
 *     - id: s0
 *       editable: gA           # 本状态唯一可改句
 *       pages: { ... }         # 本状态所有页
 *     - id: s1
 *       parent: s0             # 父状态编号（树状）
 *       trigger: { sentence: "gA", action: "variant", value: 0 }
 *       editable: gB           # 子状态还能改下一句（叶子无 editable）
 *       pages: { ... }         # 只写变化的页，其余沿父链继承
 *     - id: s2
 *       parent: s0
 *       trigger: { sentence: "gA", action: "erase" }
 *       pages: { ... }
 *
 * trigger 字段：
 *   sentence: 触发句子的 id
 *   action: "variant" 或 "erase"
 *   value: 如果是 variant，填选的索引（0, 1, 2...）；如果是 erase，忽略
 *
 * 树状状态机：分支节点构成一棵树，每个节点 = 一个状态；
 * 分支 = 备选句子数：每节点可改句有 N 个备选 → N 个 variant 分支
 * （value 0..N-1 各对应一个备选）+ 保留(keep) + 擦除(erase) = N+2 分支；
 * 匹配 trigger 时只在"当前状态的直接子节点"中查找；
 * 内容沿 parent 链合并（子覆盖父）→ 被改句子之前的内容保持不变。
 * 树深支持 3-4 层；叶子节点无 editable（只读浏览到结局）。
 *
 * 修改后句子显示灰色下划线，未修改可改句显示金色高亮。
 * 文本自动按段落分页，左右箭头自由翻页。
 * 修改/擦除/保留后停留在当前页，不自动跳转。
 * 三种操作：修改(选变体) / 保留(原文不变) / 擦除(句子消失)。
 * 修改后触发两阶段过渡：先所有行同时逐字消失，再所有行同时逐字生长。
 * ============================================================================
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
_TDS_.UnwrittenStory.Param.pageImage       = String(_TDS_.UnwrittenStory.Param['pageImage'] || 'Unwritten/Book/book_page');
_TDS_.UnwrittenStory.Param.textColor       = String(_TDS_.UnwrittenStory.Param['textColor'] || '#333333');
_TDS_.UnwrittenStory.Param.coverImage      = String(_TDS_.UnwrittenStory.Param['coverImage'] || 'Unwritten/Book/book_cover');
_TDS_.UnwrittenStory.Param.titleText       = String(_TDS_.UnwrittenStory.Param['titleText'] || '');
_TDS_.UnwrittenStory.Param.titleFontSize   = Number(_TDS_.UnwrittenStory.Param['titleFontSize'] || 34);
_TDS_.UnwrittenStory.Param.titleColor      = String(_TDS_.UnwrittenStory.Param['titleColor'] || '#e8cd8c');
_TDS_.UnwrittenStory.Param.hintSwitchId    = Number(_TDS_.UnwrittenStory.Param['hintSwitchId'] || 1006);
_TDS_.UnwrittenStory.Param.autoPlaySpeed   = Number(_TDS_.UnwrittenStory.Param['autoPlaySpeed'] || 2);
_TDS_.UnwrittenStory.Param.autoPlayPause   = Number(_TDS_.UnwrittenStory.Param['autoPlayPause'] || 15);
// 版本号单一来源（头部注释与加载日志共用）
_TDS_.UnwrittenStory.Version = '1.41';

//=============================================================================
// ** 事件总线（阶段三）—— 剧情演出的外挂点
//   _TDS_.UnwrittenStory.on(事件, fn) 订阅；剧情侧零侵入核心：
//     'modified' {book, sentence, variant}   修改了一个片段
//     'erased'   {book, sentence}            擦除
//     'kept'     {book, sentence}            保留
//     'state'    {book, stateId}             树上推进到新状态
//     'page'     {book, pageKey}             翻页
//     'finish'   {book, switchId}            书完成（开关已置ON）
//=============================================================================
_TDS_.UnwrittenStory._bus = {};
_TDS_.UnwrittenStory.on = function(evt, fn) {
    (this._bus[evt] = this._bus[evt] || []).push(fn);
    return fn;
};
_TDS_.UnwrittenStory.off = function(evt, fn) {
    var list = this._bus[evt];
    if (!list) { return; }
    var i = list.indexOf(fn);
    if (i >= 0) { list.splice(i, 1); }
};
_TDS_.UnwrittenStory.emit = function(evt, data) {
    var list = this._bus[evt];
    if (!list) { return; }
    for (var i = 0; i < list.length; i++) {
        try { list[i](data || {}); }
        catch (e) { console.warn('[UnwrittenStory] 事件 ' + evt + ' 订阅者异常: ' + e.message); }
    }
};

//=============================================================================
// ** Game_UnwrittenStory —— 运行时状态
//=============================================================================
function Game_UnwrittenStory() { this.initialize.apply(this, arguments); }
Game_UnwrittenStory.prototype.initialize = function() { this.clear(); };
Game_UnwrittenStory.prototype.clear = function() {
    this._pages = {};
    this._lastOperation = null;
    this._bookState = {};   // yaml文件名 -> { id: 状态id, page: 页key }，书进度存档恢复用
};
// 记录某本书当前停在树上的哪个状态（A3：中途关游戏再读档可恢复进度）
Game_UnwrittenStory.prototype.setBookState = function(yamlFile, stateId, pageKey) {
    if (!this._bookState) { this._bookState = {}; }
    this._bookState[yamlFile] = {
        id: (stateId === null || stateId === undefined) ? null : String(stateId),
        page: pageKey || null
    };
};
Game_UnwrittenStory.prototype.bookState = function(yamlFile) {
    return (this._bookState && this._bookState[yamlFile]) || null;
};
// 句子状态按 (书名::句子id) 域隔离（阶段三）；
// bookId 缺省时回退裸 id，且优先命中旧存档的裸键 → 新旧存档互通
Game_UnwrittenStory.prototype._skey = function(sentenceId, bookId) {
    var k = String(sentenceId);
    return bookId ? String(bookId) + '::' + k : k;
};
Game_UnwrittenStory.prototype.sentenceState = function(pageId, sentenceId, bookId) {
    var key = this._skey(sentenceId, bookId);
    if (this._pages[key] === undefined && bookId) {
        var bare = String(sentenceId);
        if (this._pages[bare] !== undefined) { key = bare; }   // 旧存档兼容
    }
    if (this._pages[key] === undefined) { this._pages[key] = { variant: -1, erased: false, modified: false }; }
    return this._pages[key];
};
Game_UnwrittenStory.prototype.setVariant = function(pageId, sentenceId, index, bookId) {
    var st = this.sentenceState(pageId, sentenceId, bookId);
    st.variant = index;
    st.erased = false;
    st.modified = true;
    this._lastOperation = {
        id: String(sentenceId),
        action: 'variant',
        value: index
    };
};
Game_UnwrittenStory.prototype.setErased = function(pageId, sentenceId, flag, bookId) {
    var st = this.sentenceState(pageId, sentenceId, bookId);
    st.erased = flag;
    if (flag) { st.modified = true; }
    else { st.modified = false; st.variant = -1; }
    this._lastOperation = {
        id: String(sentenceId),
        action: 'erase',
        value: null
    };
};
Game_UnwrittenStory.prototype.setKeep = function(pageId, sentenceId, bookId) {
    var st = this.sentenceState(pageId, sentenceId, bookId);
    st.variant = -1;
    st.erased = false;
    st.modified = true;   // 保留 = 已处理，但原文不变
    this._lastOperation = {
        id: String(sentenceId),
        action: 'keep',
        value: null
    };
};
// 页内可改句 id 列表
Game_UnwrittenStory.prototype.pageEditIds = function(page) {
    var ids = [];
    if (!page) { return ids; }
    var push = function(e) {
        if (e && e.id !== undefined && ids.indexOf(String(e.id)) < 0) { ids.push(String(e.id)); }
    };
    var edits = page.edits || [];
    for (var i = 0; i < edits.length; i++) { push(edits[i]); }
    // blocks 模式：块内 edits 同样参与（否则 blocks 书永远进不了选句——
    // AI 回归第二战果：pageEditIds 漏收块内 edits，updateStoryState 找不到解锁页）
    var blocks = page.blocks || [];
    for (var b = 0; b < blocks.length; b++) {
        var bedits = (blocks[b] && blocks[b].edits) || [];
        for (var j = 0; j < bedits.length; j++) { push(bedits[j]); }
    }
    return ids;
};
Game_UnwrittenStory.prototype.pageHasUnmodified = function(pageId, page, bookId) {
    var ids = this.pageEditIds(page);
    for (var j = 0; j < ids.length; j++) {
        if (!this.sentenceState(pageId, ids[j], bookId).modified) { return true; }
    }
    return false;
};
Game_UnwrittenStory.prototype.pageHasId = function(page, targetId) {
    var ids = this.pageEditIds(page);
    return ids.indexOf(String(targetId)) >= 0;
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
    var us = contents.unwrittenStory;
    if (us) {
        // A5 修复：MV 存档经 JSON 序列化会丢失原型，不恢复则读档后书本所有方法调用崩溃
        Object.setPrototypeOf(us, Game_UnwrittenStory.prototype);
        if (!us._bookState) { us._bookState = {}; }
        if (us._lastOperation === undefined) { us._lastOperation = null; }
    }
    $gameUnwrittenStory = us || new Game_UnwrittenStory();
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
    this._layout = null;      // 排版缓存：全部字符坐标（setPage 时算一次）
    this._flatMeta = [];      // 每个 flat 的排版元数据（边界/光标/锚点）
    this._autoPlayMode = false;
    this._forceNoSkip = false;
    // 逐字过渡动画
    this._transitionActive = false;
    this._transitionProgress = 0;
    this._transitionSpeed = 2;
    this._transitionTotalChars = 0;
    this._transitionOldTexts = null;
    this._transitionNewTexts = null;
    this._transitionPhase = 0;
    this._transitionCharIndex = 0;
    this._transitionOldBitmap = null;
    this._transitionNewBitmap = null;
    if (_TDS_.UnwrittenStory.Param.font) { this.contents.fontFace = _TDS_.UnwrittenStory.Param.font; }
    this.contents.fontSize = _TDS_.UnwrittenStory.Param.fontSize;
};
Window_UnwrittenBook.prototype.lineHeight = function() {
    return this.contents.fontSize + 8;
};
Window_UnwrittenBook.prototype.setDefaults = function(defaults) { this._defaults = defaults || {}; };
// 书域（阶段三）：句子状态按 (书名::句子id) 隔离；场景打开书时设置
Window_UnwrittenBook.prototype.setBookId = function(bookId) { this._bookId = bookId || null; };
Window_UnwrittenBook.prototype.setSpeed = function(n) {
    if (n !== undefined && Number(n) > 0) {
        this._speed = Number(n);
        for (var i = 0; i < this._lineSpeeds.length; i++) { this._lineSpeeds[i] = this._speed; }
    }
};
Window_UnwrittenBook.prototype.setMode = function(m) {
    if (m === 'sequential' || m === 'simultaneous') { this._mode = m; }
};
Window_UnwrittenBook.prototype.processText = function(text) {
    var str = String(text);
    str = str.replace(/\\v\[(\d+)\]/g, function(match, id) {
        return String($gameVariables.value(Number(id)));
    });
    str = str.replace(/\\n<[^>]*>/g, '');
    str = str.replace(/\\[A-Za-z]+(\[\d+(?:\.\d+)?\])?/g, '');
    return str;
};
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
Window_UnwrittenBook.prototype.setPage = function(pageKey, page, stateIndex) {
    this._pageKey = pageKey;
    this._page = page;
    this._rows = [];
    this._flat = [];
    // ---- blocks 模式：page.blocks = [{origin,direction,speed,text,edits}, ...] ----
    // 每块绝对定位、各有书写方向（ltr/rtl/ttb/btt），按块序绘制（后块覆盖前块=互相遮挡）。
    // 用于心理恐怖演出：文字在任意位置上下左右生成、叠压。
    this._blocksMode = !!(page && Array.isArray(page.blocks) && page.blocks.length > 0);
    this._blocks = [];
    if (this._blocksMode) {
        for (var bi = 0; bi < page.blocks.length; bi++) {
            var blkRaw = page.blocks[bi] || {};
            this._blocks.push({
                origin: blkRaw.origin || [this.padding + 8, this.padding + 8],
                direction: blkRaw.direction || 'ltr',
                speed: blkRaw.speed
            });
        }
        for (var b = 0; b < page.blocks.length; b++) {
            var blk = page.blocks[b] || {};
            var bText = String(blk.text || '');
            var bEdits = blk.edits || [];
            var bCounter = { n: 0 };
            var bLines = bText.split('\n');
            var lineInBlock = 0;
            for (var li = 0; li < bLines.length; li++) {
                if (bLines[li].trim() === '') { continue; }
                var bSegs = this.parseInline(bLines[li], bEdits, bCounter);
                this._rows.push({ segments: bSegs, block: b, line: lineInBlock });
                for (var bs = 0; bs < bSegs.length; bs++) {
                    this._flat.push({ row: this._rows.length - 1, seg: bs });
                }
                lineInBlock++;
            }
        }
    } else {
        var rawText = (page && page.text) || '';
        if (typeof rawText === 'string' && rawText.length > 0) {
            var edits = (page.edits || []);
            var counter = { n: 0 };
            var rawLines = rawText.split('\n');
            for (var i = 0; i < rawLines.length; i++) {
                if (rawLines[i].trim() === '') { continue; }
                var segs = this.parseInline(rawLines[i], edits, counter);
                this._rows.push({ segments: segs });
                for (var s = 0; s < segs.length; s++) {
                    this._flat.push({ row: this._rows.length - 1, seg: s });
                }
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
    // origin 按背景图缩放系数转换:YAML 里的 origin 是原图(如1140x720)坐标,
    // 需要乘 fit 才能与缩放后的背景/窗口对齐,否则文字整体偏移导致边缘超出。
    // 注意:图片可能是异步加载的,width 此时可能为 0 → 用已知背景尺寸兜底,
    // 图片加载完成后由 createPageBackground 回调触发一次重新布局。
    var fitScale = 1;
    var pageImg = ImageManager.loadPicture(_TDS_.UnwrittenStory.Param.pageImage);
    var imgW = (pageImg && pageImg.width > 0 && !pageImg.isError()) ? pageImg.width : 0;
    // 兜底:书页背景已知原始尺寸(book_page.png = 1140x720)
    if (!imgW) {
        if (String(_TDS_.UnwrittenStory.Param.pageImage).indexOf('book_page') >= 0) {
            imgW = 1140; // 书页背景原始宽度
        }
    }
    if (imgW > 0) {
        var availW = Graphics.width - 40;
        var availH = Graphics.height - 160;
        var imgH = imgW === 1140 ? 720 : Math.round(imgW * 720 / 1140);
        fitScale = Math.min(availW / imgW, availH / imgH);
    }
    if (write.origin) {
        this._origin = [
            Math.round(write.origin[0] * fitScale),
            Math.round(write.origin[1] * fitScale)
        ];
    }
    // blocks 的 origin 同样按背景图缩放（yaml 里写原图坐标，如 1140x720）
    for (var bo = 0; bo < this._blocks.length; bo++) {
        var bOrigin = this._blocks[bo].origin;
        this._blocks[bo].origin = [
            Math.max(4, Math.min(this.contents.width - 8, Math.round(bOrigin[0] * fitScale))),
            Math.max(4, Math.min(this.contents.height - 8, Math.round(bOrigin[1] * fitScale)))
        ];
    }
    // 钳制 origin:文字起点不能超出窗口可绘制区域(防止字体画出窗口/背景)
    var maxOX = Math.max(this.padding + 4, this.contents.width - 40);
    var maxOY = Math.max(this.padding + 4, this.contents.height - 24);
    if (this._origin[0] > maxOX) { this._origin[0] = maxOX; }
    if (this._origin[1] > maxOY) { this._origin[1] = maxOY; }
    this._lineSpeeds = [];
    for (var f = 0; f < this._flat.length; f++) {
        var seg = this.segAt(f);
        var rBlk = this.rowBlock(this._flat[f].row);
        this._lineSpeeds.push(seg.speed !== undefined ? seg.speed
            : ((rBlk && rBlk.speed !== undefined) ? Number(rBlk.speed) : this._speed));
    }
    this.updateCumWidths();
    this.buildLayout();
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
    this._forceNoSkip = false;
    this._writing = this._flat.length > 0;
    this._finished = false;
    this._selectionMode = false;
    this._selectionFlat = this.nextEditableIndex(this._subPages[0] ? this._subPages[0].start : 0);
    this._transitionActive = false;
    this._dirty = true;
};

Window_UnwrittenBook.prototype.computeSubPages = function() {
    this._subPages = [];
    if (this._flat.length === 0) {
        this._subPages.push({ start: 0, end: -1 });
        return;
    }
    // blocks 模式：不自动分页（多块绝对定位是演出效果，整页一个子页）
    if (this._blocksMode) {
        this._subPages.push({ start: 0, end: this._flat.length - 1 });
        return;
    }
    // 经典模式：从 _flatMeta 的纵向边界推导子页（只在行边界切分，与旧实现等价）
    var maxHeight = this.contents.height - 48;
    var oY = this._origin[1];
    var flatMin = [], flatMax = [];
    for (var f = 0; f < this._flat.length; f++) {
        var m = this._flatMeta[f];
        if (!m) {
            m = { minY: oY, maxY: oY + this.lineHeight() };
        }
        flatMin.push(m.minY);
        flatMax.push(m.maxY);
    }
    var startFlat = 0;
    var curMin = flatMin[0], curMax = flatMax[0];
    for (var f2 = 1; f2 <= this._flat.length; f2++) {
        var split = (f2 === this._flat.length);
        if (!split) {
            var sameRow = (this._flat[f2].row === this._flat[f2 - 1].row);
            var nMin = Math.min(curMin, flatMin[f2]);
            var nMax = Math.max(curMax, flatMax[f2]);
            if (!sameRow && (nMax - oY) > maxHeight && (curMax - oY) > 0) {
                split = true;
            } else {
                curMin = nMin; curMax = nMax;
            }
        }
        if (split) {
            this._subPages.push({ start: startFlat, end: f2 - 1 });
            startFlat = f2;
            if (f2 < this._flat.length) { curMin = flatMin[f2]; curMax = flatMax[f2]; }
        }
    }
};

//=============================================================================
// * buildLayout —— 排版与动画分离的核心（v1.40 阶段一）
//   setPage 时一次性算出全部字符坐标；书写动画/过渡只决定"显示几个字符"，
//   不再参与定位。四方向（ltr/rtl/ttb/btt）与 blocks/经典两模式在此统一。
//
//   产物：
//     _layout.chars[i] = { flat, k, x, y, w, h, cx, cy, hide }
//        (cx,cy) = 该字符写完后的光标位置（按各自方向推算，含换行后的落点）
//     _flatMeta[f]  = { start, count, minX, maxX, minY, maxY, lastY, cursor0 }
//        cursor0 = 该 flat 一个字都没写时光标应在的位置（空句/擦除锚点用）
//=============================================================================
Window_UnwrittenBook.prototype._newFlatMeta = function(flatIndex, charsLen) {
    return { start: charsLen, count: 0, minX: 1e9, maxX: -1e9,
             minY: 1e9, maxY: -1e9, lastY: 0, cursor0: null };
};
Window_UnwrittenBook.prototype._pushChar = function(chars, meta, flatIndex, k,
                                                    x, y, w, h, cx, cy) {
    var c = { flat: flatIndex, k: k, x: x, y: y, w: w, h: h, cx: cx, cy: cy,
              hide: (y + h > this.contents.height || y < -h) };
    chars.push(c);
    meta.count++;
    if (x < meta.minX) { meta.minX = x; }
    if (x + w > meta.maxX) { meta.maxX = x + w; }
    if (y < meta.minY) { meta.minY = y; }
    if (y + h > meta.maxY) { meta.maxY = y + h; }
    meta.lastY = y;
    return c;
};
Window_UnwrittenBook.prototype.buildLayout = function() {
    var fs = this.contents.fontSize;
    var lineH = this.lineHeight();
    var o = this._origin;
    var rightX = this.contents.width - 30;
    var chars = [];
    this._flatMeta = [];
    var f, k;
    if (this._blocksMode) {
        // ---- blocks：每行按所属块的方向绝对定位，不换行 ----
        for (f = 0; f < this._flat.length; f++) {
            var ref = this._flat[f];
            var row = this._rows[ref.row];
            var blk = this.rowBlock(ref.row);
            var bo = blk ? blk.origin : o;
            var dir = blk ? blk.direction : 'ltr';
            var lineIdx = row.line || 0;
            var text = this.segText(f);
            var cum = this._cumWidths[f] || [];
            var meta = this._newFlatMeta(f, chars.length);
            for (k = 0; k < text.length; k++) {
                var cw = (k > 0 ? cum[k] - cum[k - 1] : cum[0]);
                if (!cw || cw <= 0 || isNaN(cw)) { cw = fs; }
                var prefix = (k > 0 ? cum[k - 1] : 0);
                var x, y, cx, cy;
                if (dir === 'ltr') {
                    cw = (k > 0 ? cum[k] - cum[k - 1] : cum[0]) || fs;
                    x = bo[0] + prefix; y = bo[1] + lineIdx * lineH;
                    cx = x + cw; cy = y;
                } else if (dir === 'rtl') {
                    cw = fs; prefix = k * fs;
                    x = bo[0] - prefix - cw; y = bo[1] + lineIdx * lineH;
                    cx = x - cw; cy = y;
                } else if (dir === 'ttb') {
                    cw = fs; prefix = k * fs;
                    x = bo[0] + lineIdx * lineH; y = bo[1] + prefix;
                    cx = x; cy = y + fs;
                } else {   // btt：首字在最下，向上逐字生长
                    cw = fs; prefix = k * fs;
                    x = bo[0] + lineIdx * lineH;
                    y = bo[1] + (text.length - 1 - k) * fs;
                    cx = x; cy = y - fs;
                }
                this._pushChar(chars, meta, f, k, x, y, cw, fs, cx, cy);
            }
            meta.dir = dir;
            meta.cursor0 = (dir === 'ttb' || dir === 'btt')
                ? { x: bo[0] + lineIdx * lineH, y: bo[1] }
                : { x: bo[0], y: bo[1] + lineIdx * lineH };
            this._flatMeta.push(meta);
        }
    } else {
        // ---- 经典流式：段落行连续排布 + 自动换行（与旧 refresh 逐字行为一致）----
        var curX = o[0], curY = o[1];
        var lastRow = -1;
        for (f = 0; f < this._flat.length; f++) {
            var refC = this._flat[f];
            if (refC.row !== lastRow) {
                if (lastRow >= 0) { curX = o[0]; curY += lineH; }
                lastRow = refC.row;
            }
            var textC = this.segText(f);
            var cumC = this._cumWidths[f] || [];
            var metaC = this._newFlatMeta(f, chars.length);
            metaC.dir = 'ltr';
            metaC.cursor0 = { x: curX, y: curY };
            for (k = 0; k < textC.length; k++) {
                var cwC = (k > 0 ? cumC[k] - cumC[k - 1] : cumC[0]);
                if (!cwC || cwC <= 0 || isNaN(cwC)) { cwC = fs; }
                if (curX + cwC > rightX && curX > o[0]) {
                    curX = o[0];
                    curY += lineH;
                }
                this._pushChar(chars, metaC, f, k, curX, curY, cwC, fs, curX + cwC, curY);
                curX += cwC;
            }
            this._flatMeta.push(metaC);
        }
    }
    this._layout = { chars: chars };
};

Window_UnwrittenBook.prototype.currentSubPage = function() {
    return this._subPages[this._subIndex] || { start: 0, end: this._flat.length - 1 };
};
Window_UnwrittenBook.prototype.segAt = function(flatIndex) {
    var ref = this._flat[flatIndex];
    return this._rows[ref.row].segments[ref.seg];
};
Window_UnwrittenBook.prototype.segState = function(seg) {
    if (!seg.editable || seg.id === null) { return null; }
    return $gameUnwrittenStory.sentenceState(this._pageKey, seg.id, this._bookId);
};
Window_UnwrittenBook.prototype.segText = function(flatIndex) {
    var seg = this.segAt(flatIndex);
    var st = this.segState(seg);
    if (seg.locked) { return seg.base; }
    if (st && st.erased) { return ''; }
    if (st && st.variant >= 0 && seg.variants[st.variant] !== undefined) {
        return seg.variants[st.variant];
    }
    return seg.base;
};
// 该行所属的 block（blocks 模式；经典模式返回 null）
Window_UnwrittenBook.prototype.rowBlock = function(rowIdx) {
    var r = this._rows[rowIdx];
    if (!r || r.block === undefined || r.block < 0 || !this._blocks[r.block]) { return null; }
    return this._blocks[r.block];
};
Window_UnwrittenBook.prototype.updateCumWidths = function() {
    // 返回布尔:宽度是否发生了变化(字体加载完成等场景)。变化时调用方需重新分页。
    if (!this._cumWidths) { this._cumWidths = []; }
    var fs = this.contents.fontSize;
    var changed = this._cumWidths.length !== this._flat.length;
    var newCum = [];
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
        if (!changed && this._cumWidths[f]) {
            var old = this._cumWidths[f];
            if (old.length !== cum.length) {
                changed = true;
            } else {
                for (var c = 0; c < cum.length; c++) {
                    if (Math.abs(old[c] - cum[c]) > 0.5) { changed = true; break; }
                }
            }
        }
        newCum.push(cum);
    }
    this._cumWidths = newCum;
    return changed;
};
Window_UnwrittenBook.prototype.updateWriting = function() {
    var page = this.currentSubPage();
    if (this._mode === 'simultaneous') { this.updateWritingSimultaneous(page); return; }
    if (this._flatIndex > page.end) {
        this._writing = false;
        this._finished = true;
        this._forceNoSkip = false;
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
        this._forceNoSkip = false;
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
        this._forceNoSkip = false;
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
Window_UnwrittenBook.prototype.isEditableFlat = function(flatIndex) {
    if (flatIndex < 0 || flatIndex >= this._flat.length) { return false; }
    var seg = this.segAt(flatIndex);
    if (!seg.editable) { return false; }
    var st = this.segState(seg);
    if (st && st.erased) {
        return seg.variants && seg.variants.length > 0;
    }
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
// 当前子页内第一个可改句（-1 = 本页没有）
Window_UnwrittenBook.prototype.currentEditableFlat = function() {
    var page = this.currentSubPage();
    for (var f = page.start; f <= page.end; f++) {
        if (this.isEditableFlat(f)) { return f; }
    }
    return -1;
};
Window_UnwrittenBook.prototype.gotoFlatSubPage = function(flatIndex) {
    for (var i = 0; i < this._subPages.length; i++) {
        if (flatIndex >= this._subPages[i].start && flatIndex <= this._subPages[i].end) {
            if (this._subIndex !== i) {
                this._subIndex = i;
                var page = this.currentSubPage();
                this._flatIndex = page.start;
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
Window_UnwrittenBook.prototype.findEditableIndexByState = function(editableId) {
    var target = String(editableId);
    for (var f = 0; f < this._flat.length; f++) {
        var seg = this.segAt(f);
        if (seg.editable && seg.id !== null && String(seg.id) === target) {
            if (this.isEditableFlat(f)) { return f; }
            return -1;
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
    if (st && st.modified && !st.erased) { return list; }
    if (seg.variants.length > 0) { list.push('modify'); }
    if (!(st && st.erased)) { list.push('erase'); }
    list.push('keep');   // 保留：原文不变，但标记为已处理 → 走 keep 分支
    return list;
};
Window_UnwrittenBook.prototype.moveSubPage = function(dir, keepWriting) {
    var target = this._subIndex + dir;
    if (target < 0 || target >= this._subPages.length) { return false; }
    this._subIndex = target;
    var page = this.currentSubPage();
    if (keepWriting) {
        this._flatIndex = page.start;
        this._charIndex = 0;
        this._frameCounter = 0;
        this._writing = this._flat.length > 0;
        this._finished = false;
        this._forceNoSkip = false;
    } else {
        this._flatIndex = page.start;
        this._charIndex = 0;
        this._frameCounter = 0;
        this._writing = false;
        this._finished = true;
        this._forceNoSkip = false;
    }
    this._selectionMode = false;
    this._selectionFlat = this.nextEditableIndex(page.start);
    this._dirty = true;
    return true;
};

//=============================================================================
// 逐字过渡动画（两阶段·全行同步）
//   阶段1（progress 0→0.5）：当前页每一行同时逐字消失
//   阶段2（progress 0.5→1）：每一行同时逐字生长出新文字
//   每行的进度相同（全局 progress），行与行完全同步
//=============================================================================
Window_UnwrittenBook.prototype.startTransition = function(oldTexts, speed) {
    this._transitionActive = true;
    this._transitionProgress = 0;
    this._transitionSpeed = speed || 2;
    this._transitionOldTexts = oldTexts;
    this._transitionNewTexts = [];
    for (var f = 0; f < this._flat.length; f++) {
        this._transitionNewTexts.push(this.segText(f));
    }
    this._transitionTotalChars = 0;
    for (var f2 = 0; f2 < this._transitionNewTexts.length; f2++) {
        this._transitionTotalChars = Math.max(this._transitionTotalChars, this._transitionNewTexts[f2].length);
    }
    for (var f3 = 0; f3 < this._transitionOldTexts.length; f3++) {
        this._transitionTotalChars = Math.max(this._transitionTotalChars, this._transitionOldTexts[f3].length);
    }
    this._forceNoSkip = true;
    this._writing = true;
    this._finished = false;
    this._flatIndex = 0;
    this._charIndex = 0;
    this._dirty = true;
};

Window_UnwrittenBook.prototype.updateTransition = function() {
    if (!this._transitionActive) { return; }
    this._transitionProgress += this._transitionSpeed;
    if (this._transitionProgress >= this._transitionTotalChars) {
        this._transitionActive = false;
        this._transitionOldTexts = null;
        this._transitionNewTexts = null;
        this._forceNoSkip = false;
        this._writing = false;
        this._finished = true;
        this._dirty = true;
        return;
    }
    this._dirty = true;
};

// 返回该行在过渡中的显示文本
// progress ∈ [0, total)：0→0.5total 逐字消失；0.5total→total 逐字生长
Window_UnwrittenBook.prototype.transitionText = function(flatIndex) {
    if (!this._transitionActive || !this._transitionOldTexts) {
        return this.segText(flatIndex);
    }
    var oldText = this._transitionOldTexts[flatIndex] || '';
    var newText = this._transitionNewTexts[flatIndex] || '';
    var total = Math.max(1, this._transitionTotalChars);
    var p = Math.min(1, this._transitionProgress / total);
    if (p >= 1) { return newText; }

    var oldLen = oldText.length;
    var newLen = newText.length;

    if (p < 0.5) {
        // 阶段1：全部行同时消失（按各自长度）
        var fade = Math.min(1, p * 2);   // 0→1
        var gone = Math.floor(oldLen * fade + 0.0001);
        return oldText.substring(0, Math.max(0, oldLen - gone));
    }
    // 阶段2：全部行同时生长
    var grow = Math.min(1, (p - 0.5) * 2);   // 0→1
    return newText.substring(0, Math.floor(newLen * grow + 0.0001));
};

Window_UnwrittenBook.prototype.update = function() {
    try {
        Window_Base.prototype.update.call(this);
        if (this._transitionActive) {
            this.updateTransition();
        }
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
                this._forceNoSkip = false;
            }
            this._dirty = true;
        } else if (this._writing && !this._finished && !this._transitionActive) {
            this.updateWriting();
        }
        // 字体加载完成的检测:字体未就绪时 textWidth 是占位值,布局会偏。
        // 字体就绪后强制用真实宽度重新分页,确保文字不超出窗口/背景。
        if (!this._fontWasReady && typeof FontManager !== 'undefined' && FontManager.isReady()) {
            this._fontWasReady = true;
            this._dirty = true;
        }
        if (this._dirty) {
            // 重算宽度;宽度变化（字体就绪等）时重建排版并重新分页
            if (this.updateCumWidths()) {
                this.buildLayout();
                this.computeSubPages();
                if (this._subIndex >= this._subPages.length) {
                    this._subIndex = Math.max(0, this._subPages.length - 1);
                }
                if (this._subIndex < 0) { this._subIndex = 0; }
                var sp0 = this._subPages[this._subIndex];
                if (sp0 && (this._flatIndex < sp0.start || this._flatIndex > sp0.end)) {
                    this._flatIndex = sp0.start;
                    this._charIndex = 0;
                }
            }
            this.refresh();
            this._dirty = false;
        }
    } catch (e) {
        this._dirty = false;
        console.warn('UnwrittenStory book update 异常: ' + e.message);
    }
};

//=============================================================================
// * _revealCounts —— 每个 flat 当前应显示的字符数（书写动画的唯一输出）
//   书写/过渡/完成状态 → 数量；与坐标完全解耦。
//=============================================================================
Window_UnwrittenBook.prototype._revealCounts = function(page) {
    var counts = [];
    for (var f = page.start; f <= page.end; f++) {
        var text = this._transitionActive ? this.transitionText(f) : this.segText(f);
        if (this._finished || this._transitionActive) {
            counts[f] = text.length;
        } else if (this._mode === 'simultaneous') {
            counts[f] = Math.min(this._prog[f] || 0, text.length);
        } else if (f < this._flatIndex) {
            counts[f] = text.length;
        } else if (f === this._flatIndex) {
            counts[f] = Math.min(this._charIndex, text.length);
        } else {
            counts[f] = 0;
        }
    }
    return counts;
};

//=============================================================================
// * refresh —— 统一渲染器（经典流式 / blocks 四方向 共用一份代码）
//   坐标全部查 _layout 缓存；本函数只做三件事：
//   1) 按显示数量逐字绘制（含金色高亮/灰下划线）
//   2) 累积选区包围盒、定位书写光标（= 最后显示字符的 cx,cy）
//   3) 画擦除锚点下划线 / 封存章 / 选区框 / 闪烁光标
//=============================================================================
Window_UnwrittenBook.prototype.refresh = function() {
    this.contents.clear();
    this.changeTextColor(_TDS_.UnwrittenStory.Param.textColor);
    if (!this._page) { return; }
    if (this._eraseFlash > 0) { return; }
    var L = this._layout;
    if (!L || !L.chars) { return; }
    var fs = this.contents.fontSize;
    var blinkOn = (Graphics.frameCount % 60) < 30;
    var page = this.currentSubPage();
    var counts = this._revealCounts(page);
    var cursorPos = null;
    var markPos = null;
    var sel = null;
    var editColor = '#b8860b';
    var i, f2;
    for (i = 0; i < L.chars.length; i++) {
        var c = L.chars[i];
        if (c.flat < page.start || c.flat > page.end) { continue; }
        var count = counts[c.flat] || 0;
        if (c.k >= count) { continue; }
        if (c.hide) { continue; }
        var seg = this.segAt(c.flat);
        var st = this.segState(seg);
        var isEdit = seg.editable && !this._autoPlayMode;
        var showGold = isEdit && !(st && st.modified) && !(st && st.erased);
        var showUnderline = isEdit && st && st.modified;
        if (showGold) {
            this.contents.fillRect(c.x, c.y, c.w, fs, 'rgba(255, 217, 102, 0.35)');
            if (this.contents.textColor !== editColor) { this.changeTextColor(editColor); }
        } else if (showUnderline) {
            this.contents.fillRect(c.x, c.y + fs - 2, c.w, 1, 'rgba(180, 180, 180, 0.5)');
            if (this.contents.textColor !== _TDS_.UnwrittenStory.Param.textColor) {
                this.changeTextColor(_TDS_.UnwrittenStory.Param.textColor);
            }
        } else {
            if (this.contents.textColor !== _TDS_.UnwrittenStory.Param.textColor) {
                this.changeTextColor(_TDS_.UnwrittenStory.Param.textColor);
            }
        }
        var text = this._transitionActive ? this.transitionText(c.flat) : this.segText(c.flat);
        this.contents.drawText(text.charAt(c.k), c.x, c.y, c.w, fs);
        if (this._selectionMode && c.flat === this._selectionFlat) {
            if (!sel) { sel = { minX: c.x, minY: c.y, maxX: c.x + c.w, maxY: c.y + fs }; }
            else {
                if (c.x < sel.minX) { sel.minX = c.x; }
                if (c.y < sel.minY) { sel.minY = c.y; }
                if (c.x + c.w > sel.maxX) { sel.maxX = c.x + c.w; }
                if (c.y + fs > sel.maxY) { sel.maxY = c.y + fs; }
            }
        }
        var isWriteFlat = false;
        if (!this._finished && this._writing && !this._transitionActive) {
            if (this._mode === 'simultaneous') {
                isWriteFlat = ((this._prog[c.flat] || 0) < this.segText(c.flat).length);
            } else {
                isWriteFlat = (c.flat === this._flatIndex);
            }
        }
        if (isWriteFlat && c.k === count - 1) {
            cursorPos = { x: c.cx, y: c.cy };
        }
    }
    // 空句/已擦除可改句：原位画灰色空下划线（提示这里曾有一句）
    for (f2 = page.start; f2 <= page.end; f2++) {
        var seg2 = this.segAt(f2);
        var st2 = this.segState(seg2);
        var cnt2 = counts[f2] || 0;
        if (seg2.editable && st2 && st2.modified && st2.erased && cnt2 === 0) {
            var meta = this._flatMeta[f2];
            if (meta && meta.cursor0) {
                var ux = meta.cursor0.x, uy = meta.cursor0.y;
                this.contents.fillRect(ux, uy + fs - 2, fs * 2, 1, 'rgba(180, 180, 180, 0.5)');
                if (this._selectionMode && f2 === this._selectionFlat && !sel) {
                    sel = { minX: ux, minY: uy, maxX: ux + fs * 2, maxY: uy + fs };
                }
                if (!this._finished && this._writing && f2 === this._flatIndex) {
                    cursorPos = { x: ux, y: uy };
                }
            }
        }
        // 封存章（兼容旧数据 marked 字段）
        if (st2 && st2.marked && cnt2 === this.segText(f2).length && this.segText(f2).length > 0) {
            var meta2 = this._flatMeta[f2];
            if (meta2 && meta2.maxX > meta2.minX) {
                markPos = (meta2.dir === 'rtl')
                    ? { x: meta2.minX - fs - 4, y: meta2.lastY }
                    : { x: meta2.maxX + 4, y: meta2.lastY };
            }
        }
    }
    if (sel) {
        this.contents.strokeRect(sel.minX - 4, sel.minY - 4,
            (sel.maxX - sel.minX) + 8, (sel.maxY - sel.minY) + 8, 'rgba(220, 60, 60, 0.9)');
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
// ** 透明子窗口
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
            case 'keep':   name = '保留'; break;
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
Scene_UnwrittenStory.prototype.initialize = function() {
    Scene_BaseEX.prototype.initialize.call(this);
    // ---- 书数据 ----
    this._yamlFile = _TDS_.UnwrittenStory.Param.yamlFile;
    this._pageKey = null;
    this._pageOrder = [];
    this._pageIndex = 0;
    this._overrideSpeed = undefined;
    this._overrideMode = undefined;
    // ---- 弹出窗口 ----
    this._actionWindow = null;
    this._variantWindow = null;
    this._confirmWindow = null;
    this._hintWindow = null;
    // ---- 视觉元素 ----
    this._pageImageSprite = null;
    // ---- 翻页 ----
    this._flipping = false;
    this._flipDuration = 18;
    this._oldPageSprite = null;
    // ---- 开场 ----
    this._introPhase = 0;
    this._introSprite = null;
    this._introTitleSprite = null;
    this._introChar = 0;
    this._introCharTimer = 0;
    this._introWait = 0;
    // ---- 结尾 ----
    this._endingPhase = 0;
    this._endingBlack = null;
    // ---- 自动播放 ----
    this._autoPlay = false;
    this._autoTimer = 0;
    this._playOrder = [];
    // ---- 树状状态机 ----
    this._states = [];
    this._stateIndex = 0;
    this._pages = {};
    this._nextEditPageIndex = -1;
};
Scene_UnwrittenStory.prototype.prepare = function(yamlFile, pageKey, speed, mode) {
    this._yamlFile = yamlFile || _TDS_.UnwrittenStory.Param.yamlFile;
    this._pageKey = pageKey || null;
    if (speed !== undefined && Number(speed) > 0) { this._overrideSpeed = Number(speed); }
    if (mode === 'sequential' || mode === 'simultaneous') { this._overrideMode = mode; }
};
Scene_UnwrittenStory.prototype.bookData = function() {
    var data = null;
    try { data = LanguageManager.languageData().text[this._yamlFile]; }
    catch (e) { data = null; }
    if (!data) {
        console.warn('UnwrittenStory: 找不到 YAML 数据: ' + this._yamlFile);
        return { order: [], defaults: {}, states: [] };
    }
    return {
        order: data.order || [],
        defaults: data.defaults || {},
        states: data.states || []    // 树状状态机（唯一格式）
    };
};
Scene_UnwrittenStory.prototype.buildStatePages = function(stateIndex) {
    // 树状状态机：沿 parent 链从根合并到当前状态（子覆盖父）
    // states 中每个状态有 id 与 parent（父状态 id；根为 null）
    var merged = {};
    var chain = [];
    var cur = this._states[stateIndex];
    var guard = 0;
    while (cur && guard < 100) {
        chain.unshift(cur);
        if (cur.parent === null || cur.parent === undefined) { break; }
        var pid = String(cur.parent);
        var found = null;
        for (var i = 0; i < this._states.length; i++) {
            if (String(this._states[i].id) === pid) { found = this._states[i]; break; }
        }
        cur = found;
        guard++;
    }
    for (var c = 0; c < chain.length; c++) {
        var st = chain[c];
        if (!st.pages) { continue; }
        for (var key in st.pages) {
            merged[key] = st.pages[key];
        }
    }
    return merged;
};
Scene_UnwrittenStory.prototype.create = function() {
    Scene_BaseEX.prototype.create.call(this);
    var data = this.bookData();
    this._defaults = data.defaults;
    this._states = data.states || [];
    // A4 修复：states 为空（yaml 缺失/格式错/切了没有书文件的语言）时先崩在 states[0]
    // 此处提前拦截，显示游戏内可见的红字诊断而不是 TypeError
    if (this._states.length === 0) {
        console.warn('UnwrittenStory: 书数据为空或不存在: ' + this._yamlFile +
            ' | languages=' + (LanguageManager._language || '?'));
        var err0 = new Sprite(new Bitmap(Graphics.width, 160));
        err0.bitmap.fontSize = 18;
        err0.bitmap.textColor = '#ff3333';
        err0.bitmap.drawText('书数据加载失败: ' + this._yamlFile, 0, 0, Graphics.width, 26, 'center');
        err0.bitmap.drawText('请检查对应 languages 目录里是否存在该书 yaml 且 states 非空', 0, 32, Graphics.width, 26, 'center');
        this.addChild(err0);
        this._fatal = true;
        return;
    }
    this._stateIndex = 0;
    // A3 修复：恢复上次进度（读档/重开书时不再从根状态重来导致卡死）
    var savedState = ($gameUnwrittenStory && $gameUnwrittenStory.bookState) ?
        $gameUnwrittenStory.bookState(this._yamlFile) : null;
    if (savedState && savedState.id !== null && savedState.id !== undefined) {
        for (var sv = 0; sv < this._states.length; sv++) {
            if (String(this._states[sv].id) === String(savedState.id)) { this._stateIndex = sv; break; }
        }
    }
    this._fullOrder = (this._states[0].order || data.order || []).slice();
    if (this._fullOrder.length === 0) {
        for (var k0 in this._states[0].pages) { this._fullOrder.push(k0); }
    }
    // 锁死页：根状态中 readonly 的页（结局阶段才显示）
    this._lockedPages = [];
    var s0p = this._states[0].pages || {};
    for (var lk in s0p) { if (s0p[lk] && s0p[lk].readonly) { this._lockedPages.push(lk); } }
    this._endingStage = false;
    this._pageOrder = this.currentVisibleOrder(this._stateIndex);
    this._pages = this.buildStatePages(this._stateIndex);
    if (this._pageOrder.length === 0) {
        console.warn('UnwrittenStory: 书没有任何页面。yamlFile=' + this._yamlFile +
            ' | languages=' + (LanguageManager._language || '?') +
            ' | text 有该键=' + (LanguageManager.languageData() && LanguageManager.languageData().text ?
                (LanguageManager.languageData().text[this._yamlFile] !== undefined) : 'n/a'));
        var err = new Sprite(new Bitmap(Graphics.width, 160));
        err.bitmap.fontSize = 18;
        err.bitmap.textColor = '#ff3333';
        err.bitmap.drawText('书数据加载失败: ' + this._yamlFile, 0, 0, Graphics.width, 26, 'center');
        err.bitmap.drawText('请检查 languages/sc/uw_book.yaml 是否存在且语法正确', 0, 32, Graphics.width, 26, 'center');
        this.addChild(err);
        return;
    }
    // A3：事件没显式指定起始页时，回到上次读到的页
    if (this._pageKey === null && savedState && savedState.page &&
        this._pageOrder.indexOf(savedState.page) >= 0) {
        this._pageKey = savedState.page;
    }
    if (this._pageKey === null) { this._pageKey = this._pageOrder[0]; }
    var found = this._pageOrder.indexOf(this._pageKey);
    this._pageIndex = found >= 0 ? found : 0;
    this.createBackground();
    this.createPageImageSprite();
    this.createBookWindow();
    this._bookWindow.setBookId(this._yamlFile);
    this.createPageBackground();
    this.createPageArrows();
    this.createFooterWindow();
    this.createIntroSprite();
    this.updateStoryState();
    this.onPageChange();
};
// 当前节点可见页 = 沿 parent 链收集所有写过的页（排除锁死页），按全局 order 排序。
// 玩家只能看到"自己 + 之前"的节点内容，看不到之后节点（含结局）的内容。
Scene_UnwrittenStory.prototype.currentVisibleOrder = function(stateIndex) {
    var seen = {};
    var cur = this._states[stateIndex];
    var guard = 0;
    while (cur && guard < 100) {
        if (cur.pages) {
            for (var k in cur.pages) {
                if (this._lockedPages && this._lockedPages.indexOf(k) >= 0) { continue; }
                seen[k] = true;
            }
        }
        if (cur.parent === null || cur.parent === undefined) { break; }
        var pid = String(cur.parent);
        var found = null;
        for (var i = 0; i < this._states.length; i++) {
            if (String(this._states[i].id) === pid) { found = this._states[i]; break; }
        }
        cur = found;
        guard++;
    }
    var order = [];
    for (var f = 0; f < this._fullOrder.length; f++) {
        if (seen[this._fullOrder[f]]) { order.push(this._fullOrder[f]); }
    }
    // 补上 order 之外的自定义页
    for (var s in seen) {
        if (order.indexOf(s) < 0) { order.push(s); }
    }
    return order;
};
// 进入结局阶段：显示锁死页（只读），读完由 confirm 触发重播
Scene_UnwrittenStory.prototype.enterEndingStage = function() {
    if (this._endingStage) { return; }
    this._endingStage = true;
    var order = [];
    for (var f = 0; f < this._fullOrder.length; f++) {
        if (this._lockedPages && this._lockedPages.indexOf(this._fullOrder[f]) >= 0) {
            order.push(this._fullOrder[f]);
        }
    }
    for (var i = 0; i < this._lockedPages.length; i++) {
        if (order.indexOf(this._lockedPages[i]) < 0) { order.push(this._lockedPages[i]); }
    }
    this._pageOrder = order;
    this._pageIndex = 0;
    this._pageKey = this._pageOrder[0];
    this._bookWindow.setDefaults(this._defaults);
    this._bookWindow.setPage(this._pageKey, this._pages[this._pageKey], this._stateIndex);
    this.updatePageImage();
    this._leftArrow.visible = false;
    this._rightArrow.visible = this._pageIndex < this._pageOrder.length - 1;
    this.refreshFooter();
    SoundManager.playCursor();
};
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
                // 图片加载完成:重新按真实尺寸计算窗口与背景(图片异步加载,create时可能未就绪)
                var size2 = self.bookWindowSize();
                var w2 = size2.w, h2 = size2.h;
                if (w2 !== w || h2 !== h) {
                    w = w2; h = h2;
                    self._bookWindowBaseX = (Graphics.width - w) / 2;
                    self._bookWindowBaseY = Math.max(8, (Graphics.height - h) / 2 - 16);
                    self._bookWindow.move(self._bookWindowBaseX, self._bookWindowBaseY, w, h);
                    self._bookWindow.createContents();
                    self._bookWindow.setPage(self._pageKey, self._pages[self._pageKey], self._stateIndex);
                    self._bookWindow._dirty = true;
                    if (self._footer) {          // 同上：缓存位图同步回调时 footer 可能未创建
                        self._footer.move((Graphics.width - w) / 2, Graphics.height - 66, w, 60);
                        self._footer.createContents();
                        self.refreshFooter();
                    }
                }
                self._pageBgSprite.bitmap = img;
                // 等比缩放（不拉伸），居中放置
                var fit = Math.min(w / img.width, h / img.height);
                self._pageBgSprite.scale.x = fit;
                self._pageBgSprite.scale.y = fit;
                self._pageBgSprite.x = self._bookWindowBaseX + (w - img.width * fit) / 2;
                self._pageBgSprite.y = self._bookWindowBaseY + (h - img.height * fit) / 2;
                self._pageBgSprite.visible = true;
                self._pageBgBaseX = self._pageBgSprite.x;
                self._pageBgBaseY = self._pageBgSprite.y;
                // 重新对齐左右箭头（图片已缓存时本回调会同步触发，
                // 此时 createPageArrows/createFooterWindow 可能尚未执行 → 判空防御，
                // 否则同一局第二次开书必崩——AI 自动回归首次实战抓到的真实 bug）
                if (self._leftArrow) {
                    self._leftArrow.y = self._bookWindowBaseY + self._bookWindow.height / 2;
                    self._leftArrow.x = self._bookWindowBaseX - 24;
                }
                if (self._rightArrow) {
                    self._rightArrow.y = self._bookWindowBaseY + self._bookWindow.height / 2;
                    self._rightArrow.x = self._bookWindowBaseX + self._bookWindow.width + 24;
                }
            }
        });
    } else {
        var bmp = new Bitmap(w, h);
        bmp.fillRect(0, 0, w, h, 'rgba(246, 240, 222, 1)');
        this._pageBgSprite.bitmap = bmp;
        this._pageBgSprite.visible = true;
    }
    var idx = this.children.indexOf(this._bookWindow);
    if (idx < 0) { idx = 0; }
    this.addChildAt(this._pageBgSprite, idx);
};
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
Scene_UnwrittenStory.prototype.createIntroSprite = function() {
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
    var totalW = bmp.measureTextWidth(shown);
    var x = (bmp.width - totalW) / 2;
    var y = (bmp.height - fs) / 2;
    bmp.textColor = _TDS_.UnwrittenStory.Param.titleColor;
    for (var i = 0; i < shown.length; i++) {
        var cw = bmp.measureTextWidth(shown.charAt(i));
        bmp.drawText(shown.charAt(i), x, y, cw, fs);
        x += cw;
    }
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
        this._introCharTimer++;
        if (this._introCharTimer >= 6 && this._introChar < title.length) {
            this._introCharTimer = 0;
            this._introChar++;
            this.drawIntroTitle();
        } else {
            this.drawIntroTitle();
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
Scene_UnwrittenStory.prototype.tryShowHint = function() {
    if (this._hintWindow || this._introPhase !== 99) { return; }
    if ($gameSwitches.value(_TDS_.UnwrittenStory.Param.hintSwitchId)) { return; }
    var page = this.currentPage();
    var hasEdit = (page.edits && page.edits.length > 0) ||
        (page.blocks && page.blocks.some(function(bl) { return bl.edits && bl.edits.length > 0; })) ||
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
Scene_UnwrittenStory.prototype.bookWindowSize = function() {
    var pw = _TDS_.UnwrittenStory.Param.bookWidth;
    var ph = _TDS_.UnwrittenStory.Param.bookHeight;
    if (pw && pw > 0 && ph && ph > 0) {
        return { w: pw, h: ph };
    }
    // 书窗口跟随书页背景图(等比缩放,不拉伸),保证文字区域与背景完全对齐
    var name = _TDS_.UnwrittenStory.Param.pageImage;
    var img = name ? ImageManager.loadPicture(name) : null;
    if (img && img.width > 0 && !img.isError()) {
        var availW = Graphics.width - 40;
        var availH = Graphics.height - 160;
        var fit = Math.min(availW / img.width, availH / img.height);
        var w = Math.floor(img.width * fit);
        var h = Math.floor(img.height * fit);
        if (pw && pw > 0) { w = pw; }
        if (ph && ph > 0) { h = ph; }
        return { w: w, h: h };
    }
    return {
        w: (pw && pw > 0) ? pw : (Graphics.width - 40),
        h: (ph && ph > 0) ? ph : (Graphics.height - 160)
    };
};
Scene_UnwrittenStory.prototype.createBookWindow = function() {
    var size = this.bookWindowSize();
    var w = size.w, h = size.h;
    var bx = _TDS_.UnwrittenStory.Param.bookX;
    var by = _TDS_.UnwrittenStory.Param.bookY;
    this._bookWindowBaseX = bx >= 0 ? bx : (Graphics.width - w) / 2;
    this._bookWindowBaseY = by >= 0 ? by : Math.max(8, (Graphics.height - h) / 2 - 16);
    this._bookWindow = new Window_UnwrittenBook(this._bookWindowBaseX, this._bookWindowBaseY, w, h);
    this.addChild(this._bookWindow);
};
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
Scene_UnwrittenStory.prototype.createFooterWindow = function() {
    var w = _TDS_.UnwrittenStory.Param.bookWidth;
    if (!(w > 0)) { w = Graphics.width - 40; }
    this._footer = new Window_Base(
        (Graphics.width - w) / 2,
        Graphics.height - 66, w, 60);
    _TDS_.UnwrittenStory.hideFrame(this._footer);
    this.addChild(this._footer);
};
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
Scene_UnwrittenStory.prototype.currentPage = function() {
    return this._pages[this._pageKey] || {};
};
Scene_UnwrittenStory.prototype.updateStoryState = function() {
    var book = this._bookWindow;
    // 树状状态机：解锁页 = 当前状态 editable 句子所在页（无 editable = 叶子，无可改）
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
};
Scene_UnwrittenStory.prototype.canEditCurrentPage = function() {
    // 当前页是否为解锁页，且包含未修改的可改句
    var book = this._bookWindow;
    if (!book || this._pageIndex !== this._nextEditPageIndex) { return false; }
    var page = this.currentPage();
    if (!page || page.readonly) { return false; }
    return $gameUnwrittenStory.pageHasUnmodified(this._pageKey, page, this._yamlFile);
};
Scene_UnwrittenStory.prototype.findMatchingState = function() {
    var lastOp = $gameUnwrittenStory._lastOperation;
    if (!lastOp) { return -1; }
    // 树状状态机：只在"当前状态的直接子节点"中匹配 trigger
    var curId = this._states[this._stateIndex] ? String(this._states[this._stateIndex].id) : null;
    for (var i = 0; i < this._states.length; i++) {
        var st = this._states[i];
        if (!st.trigger) { continue; }
        var parentId = (st.parent === null || st.parent === undefined) ? null : String(st.parent);
        if (parentId !== curId) { continue; }   // 只匹配当前节点的子节点
        if (st.trigger.sentence !== lastOp.id) { continue; }
        if (st.trigger.action !== lastOp.action) { continue; }
        // variant 且 trigger 指定了 value 时才比较；未指定 = 匹配任意变体
        if (lastOp.action === 'variant' && st.trigger.value !== undefined && st.trigger.value !== lastOp.value) { continue; }
        return i;
    }
    return -1;   // 没有子节点匹配（叶子节点）
};
Scene_UnwrittenStory.prototype.advanceState = function() {
    if (!this._states) { return; }
    var matchedIndex = this.findMatchingState();
    if (matchedIndex < 0 || matchedIndex >= this._states.length) { return; }

    var book = this._bookWindow;
    var oldTexts = [];
    if (book) {
        for (var f = 0; f < book._flat.length; f++) {
            oldTexts.push(book.segText(f));
        }
    }

    this._stateIndex = matchedIndex;
    this._pages = this.buildStatePages(matchedIndex);
    // 节点推进：重建可见页（玩家现在能看到"本节点+之前"的内容，看不到之后的节点）
    this._pageOrder = this.currentVisibleOrder(matchedIndex);
    this._endingStage = false;

    if (book) {
        // 刷新当前页的内容，不跳转
        var pageKey = this._pageKey;   // 保持当前页（该页必在新状态链中，因为修改发生在当前可改页）
        if (this._pageOrder.indexOf(pageKey) < 0) { pageKey = this._pageOrder[0]; }
        this._pageKey = pageKey;
        this._pageIndex = this._pageOrder.indexOf(pageKey);
        book.setDefaults(this._defaults);
        book.setPage(pageKey, this._pages[pageKey], this._stateIndex);
        if (this._overrideSpeed !== undefined) { book.setSpeed(this._overrideSpeed); }
        if (this._overrideMode !== undefined) { book.setMode(this._overrideMode); }
        this.updatePageImage();
        // 启动逐字过渡
        if (oldTexts && oldTexts.length > 0) {
            book.startTransition(oldTexts, 2);
        } else {
            book._writing = false;
            book._finished = true;
            book._dirty = true;
        }
        // 退出选句模式
        book._selectionMode = false;
        book._dirty = true;
    }
    this.updateStoryState();
    // A3：把书的新进度写进存档数据（状态 id + 当前页）
    if ($gameUnwrittenStory && $gameUnwrittenStory.setBookState) {
        var stObj = this._states[this._stateIndex];
        $gameUnwrittenStory.setBookState(this._yamlFile, stObj ? stObj.id : null, this._pageKey);
    }
    _TDS_.UnwrittenStory.emit('state', { book: this._yamlFile, stateId: (this._states[this._stateIndex] || {}).id });
};
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
    _TDS_.UnwrittenStory.emit('page', { book: this._yamlFile, pageKey: pageKey });
};
Scene_UnwrittenStory.prototype.flipPage = function(dir, keepWriting) {
    var book = this._bookWindow;
    if (book.moveSubPage(dir, keepWriting)) {
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
Scene_UnwrittenStory.prototype.playFlip = function(dir) {
    var book = this._bookWindow;
    var w = book.width, h = book.height;
    var cw = book.contents.width, ch = book.contents.height;
    var snap = new Bitmap(cw, ch);
    snap.blt(book.contents, 0, 0, cw, ch, 0, 0);
    this._oldPageSprite = new Sprite(snap);
    this._oldPageSprite.x = this._bookWindowBaseX;
    this._oldPageSprite.y = this._bookWindowBaseY;
    this.addChild(this._oldPageSprite);
    // 记录书页背景的真实基准位置(含居中偏移),翻页后恢复
    this._pageBgBaseX = this._pageBgSprite ? this._pageBgSprite.x : this._bookWindowBaseX;
    this._pageBgBaseY = this._pageBgSprite ? this._pageBgSprite.y : this._bookWindowBaseY;
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
    if (this._pageBgSprite) {
        var bgStartX = this._pageBgBaseX + dir * (w + 40);
        this._pageBgSprite.x = bgStartX;
        this.move.startMove({
            obj: this._pageBgSprite, properties: ['x'],
            from: { x: bgStartX }, to: { x: this._pageBgBaseX },
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
        if (this._pageBgSprite) {
            this._pageBgSprite.x = this._pageBgBaseX !== undefined ? this._pageBgBaseX : this._bookWindowBaseX;
        }
        if (this._oldPageSprite) {
            this.removeChild(this._oldPageSprite);
            this._oldPageSprite = null;
        }
        this._flipping = false;
    }
};
Scene_UnwrittenStory.prototype.menuBaseY = function() {
    return Graphics.height - 64;
};
Scene_UnwrittenStory.prototype.placeMenuBottom = function(win) {
    win.y = Graphics.height - win.height - 8;
};
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
        $gameUnwrittenStory.setErased(this._bookWindow._pageKey, seg.id, true, this._yamlFile);
        _TDS_.UnwrittenStory.emit('erased', { book: this._yamlFile, sentence: seg.id });
        AudioManager.playSe({ name: 'SE_Mess_Paper', volume: 70, pitch: 100, pan: 0 });
        var book = this._bookWindow;
        book._selectionMode = false;
        book._dirty = true;
        this.closeActionWindow();
        this.advanceState();
    } else if (action === 'keep') {
        // 保留：原文不变，标记已处理 → 走 keep 分支
        $gameUnwrittenStory.setKeep(this._bookWindow._pageKey, seg.id, this._yamlFile);
        _TDS_.UnwrittenStory.emit('kept', { book: this._yamlFile, sentence: seg.id });
        AudioManager.playSe({ name: 'SYS_select', volume: 80, pitch: 110, pan: 0 });
        var book2 = this._bookWindow;
        book2._selectionMode = false;
        book2._dirty = true;
        this.closeActionWindow();
        this.advanceState();
    }
};
Scene_UnwrittenStory.prototype.onVariantOk = function() {
    var flatIndex = this._bookWindow._selectionFlat;
    var seg = this._bookWindow.segAt(flatIndex);
    $gameUnwrittenStory.setVariant(this._bookWindow._pageKey, seg.id, this._variantWindow.index(), this._yamlFile);
    _TDS_.UnwrittenStory.emit('modified', { book: this._yamlFile, sentence: seg.id, variant: this._variantWindow.index() });
    AudioManager.playSe({ name: 'SYS_select', volume: 80, pitch: 110, pan: 0 });
    this._variantWindow.deactivate();
    this.removeChild(this._variantWindow);
    this._variantWindow = null;
    this.closeActionWindow();
    this.advanceState();
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
        this.startAutoPlay();
    } else {
        this.flipPage(-1);
        SoundManager.playCancel();
    }
};
Scene_UnwrittenStory.prototype.onAskCancel = function() {
    SoundManager.playBuzzer();
};
Scene_UnwrittenStory.prototype.autoPlayOrder = function() {
    var list = [];
    // 重播用完整顺序（从第一页到结局页），跳过 confirm 页
    var order = (this._fullOrder && this._fullOrder.length > 0) ? this._fullOrder : this._pageOrder;
    for (var i = 0; i < order.length; i++) {
        var p = this._pages[order[i]];
        if (p && p.confirm) { continue; }
        list.push(order[i]);
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
    this._pageKey = this._playOrder[0];
    // 重播时使用完整可见顺序（琴房→筹备→圣诞→反应→练习→结局），内容为合并后的页面
    var visible = [];
    for (var i = 0; i < this._playOrder.length; i++) {
        if (visible.indexOf(this._playOrder[i]) < 0) { visible.push(this._playOrder[i]); }
    }
    this._pageOrder = visible;
    this._footer.visible = false;
    this._bookWindow._autoPlayMode = true;
    this._bookWindow.setDefaults(this._defaults);
    this._bookWindow.setPage(this._pageKey, this._pages[this._pageKey], this._stateIndex);
    this.updatePageImage();
    this._leftArrow.visible = false;
    this._rightArrow.visible = this._pageIndex < this._pageOrder.length - 1;
    this.refreshFooter();
    this.applyAutoSpeed();
    SoundManager.playOk();
};
Scene_UnwrittenStory.prototype.updateAutoPlay = function() {
    var book = this._bookWindow;
    if (this._flipping) { this.updateFlip(); return; }
    if (book._writing && !book._finished) { return; }
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
    this.flipPage(1, true);
    this.applyAutoSpeed();
    this.onAutoPlayPage(this._pageKey, playIdx + 1);
};
Scene_UnwrittenStory.prototype.onAutoPlayPage = function(pageKey, playIndex) { };
Scene_UnwrittenStory.prototype.closeConfirmWindow = function() {
    if (this._confirmWindow) {
        this._confirmWindow.deactivate();
        this.removeChild(this._confirmWindow);
        this._confirmWindow = null;
    }
    if (this._footer) { this._footer.visible = true; }
};
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
            for (var i = 0; i < this._pageOrder.length; i++) {
                var p = this._pages[this._pageOrder[i]];
                if (p && p.doneSwitchId) { switchId = p.doneSwitchId; break; }
            }
        }
        // A1 修复：自动播放会跳过 confirm 页且把 _pageOrder 重写为不含 confirm 的列表，
        // 上面的搜索永远找不到挂在 confirm 页上的 doneSwitchId → 完成开关从不置 ON。
        // 兜底改为搜索全局 _fullOrder（_pages 沿父链合并，包含 confirm 页）。
        if (!switchId) {
            var full = (this._fullOrder && this._fullOrder.length > 0) ? this._fullOrder : this._pageOrder;
            for (var j = 0; j < full.length; j++) {
                var p2 = this._pages[full[j]];
                if (p2 && p2.doneSwitchId) { switchId = p2.doneSwitchId; break; }
            }
        }
        if (switchId) { $gameSwitches.setValue(Number(switchId), true); }
        _TDS_.UnwrittenStory.emit('finish', { book: this._yamlFile, switchId: switchId || 0 });
        this.popScene();
    }
};
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
    if (this._introPhase !== 99) { this.updateIntro(); return; }
    if (this._endingPhase === 2) { this.updateEnding(); return; }
    if (this._flipping) { this.updateFlip(); return; }
    if (this._autoPlay) { this.updateAutoPlay(); return; }
    if (this._actionWindow && this._actionWindow.active) { return; }
    if (this._variantWindow && this._variantWindow.active) { return; }
    if (this._confirmWindow && this._confirmWindow.active) { return; }
    var book = this._bookWindow;
    if (!book) { return; }
    // 提示窗：任意键关闭
    if (this._hintWindow) {
        if (Input.isTriggered('ok') || Input.isTriggered('cancel')) {
            this.closeHint();
            SoundManager.playOk();
        }
    }
    if (book._transitionActive) { return; }          // 过渡动画期间禁止操作
    if (book._writing) {
        if (!book._forceNoSkip && Input.isTriggered('ok')) {
            book.finishWriting();
            SoundManager.playCursor();
            this.refreshFooter();
        }
        return;
    }
    if (this.currentPage().confirm && !book._selectionMode && !this._confirmWindow && this._endingPhase !== 1) {
        this.showAskWindow();   // 翻到确认页自动弹窗
        return;
    }
    if (book._selectionMode) { this.updateSelectionInput(); return; }
    if (this._endingPhase === 1 && this.currentPage().confirm) {
        this.startEnding();
        return;
    }
    this.updateBrowseInput();
    this.updateArrowBounce();
};

// 选句模式输入：↑↓ 移动，确定打开动作菜单，←→ 退出并翻页
Scene_UnwrittenStory.prototype.updateSelectionInput = function() {
    var book = this._bookWindow;
    book.updateSelection();
    if (Input.isTriggered('ok')) { this.openActionWindow(); }
    else if (Input.isTriggered('cancel')) {
        book._selectionMode = false;
        book._dirty = true;
        SoundManager.playCancel();
    }
    else if (Input.isRepeated('left') && (this._pageIndex > 0 || book._subIndex > 0)) {
        book._selectionMode = false;
        this.flipPage(-1);
    } else if (Input.isRepeated('right') && (this._pageIndex < this._pageOrder.length - 1 || book._subIndex < book._subPages.length - 1)) {
        book._selectionMode = false;
        this.flipPage(1);
    }
};

// 浏览模式输入：翻页 / 确定进入选句
Scene_UnwrittenStory.prototype.updateBrowseInput = function() {
    var book = this._bookWindow;
    var canLeft = this._pageIndex > 0 || book._subIndex > 0;
    var canRight = this._pageIndex < this._pageOrder.length - 1 ||
        book._subIndex < book._subPages.length - 1;
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
        this.handleConfirmOrSelect();
    }
    this.tryShowHint();
};

// 确定键：确认页弹窗 / 当前页可改则进入选句
// 注意：只在"当前子页"内查找可改句——句子不在本页时只响提示音，
// 不自动跳页（金色高亮会提示句子在哪一页，由玩家自己翻过去）
Scene_UnwrittenStory.prototype.handleConfirmOrSelect = function() {
    var book = this._bookWindow;
    if (this.currentPage().confirm) {
        this.showAskWindow();
    } else if (this.isLeafNode() && book._finished && book._flat.length > 0) {
        // 叶子节点读完 → 进入结局阶段
        this.enterEndingStage();
    } else if (book._finished && book._flat.length > 0 && !this.currentPage().readonly &&
               this.canEditCurrentPage()) {
        var targetFlat = book.currentEditableFlat();
        if (targetFlat < 0) { SoundManager.playBuzzer(); }
        else {
            book._selectionFlat = targetFlat;
            book._selectionMode = true;
            book._dirty = true;
            SoundManager.playCursor();
        }
    } else if (book._finished && !this.isLeafNode() && this._nextEditPageIndex >= 0 &&
               this._nextEditPageIndex < this._pageOrder.length && this._pageIndex !== this._nextEditPageIndex) {
        // 当前页不是可改句所在页 → 直接跳到可改句所在页（避免玩家卡住不知道要翻页）
        this._pageIndex = this._nextEditPageIndex;
        this.onPageChange();
        SoundManager.playCursor();
        this.refreshFooter();
    } else {
        SoundManager.playBuzzer();
    }
};
// 当前状态是否为叶子节点（无 editable，没有可改句）
Scene_UnwrittenStory.prototype.isLeafNode = function() {
    var cur = this._states[this._stateIndex];
    return !!(cur && (cur.editable === undefined || cur.editable === null));
};

// 左右箭头呼吸动画
Scene_UnwrittenStory.prototype.updateArrowBounce = function() {
    var s = Math.sin(Graphics.frameCount * 0.2) * 0.1;
    this._leftArrow.anchor.x = 0.5 - s;
    this._rightArrow.anchor.x = 0.5 + s;
};

console.log('[UnwrittenStory] v' + _TDS_.UnwrittenStory.Version + ' 已加载（树状状态机 / 每状态一句可改 / 继承父状态）');