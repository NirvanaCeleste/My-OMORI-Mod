//=============================================================================
// TDS UnwrittenSeal —— 《未竟之事》封存
// Version: 1.02 - 命名空间对齐 + replayBook(封存前重播玩家改写)
//=============================================================================
// 把主菜单的"戳刺(STAB)"改造为"封存"：
//   开关4 开启时（与原版 STAB 显隐逻辑完全一致）：
//   - 菜单第一项文字变为"封存"（参数可改），红色高亮沿用原版
//   - 选中队友列表第一位确认后，不再播放原版戳刺公共事件(34)，
//     而是进入封存演出场景
//
// 封存演出（美术占位：书皮用书本插件的 book_cover，印章用红"封"字）：
//   暗幕渐起 → 书皮浮出至画面中央并轻微放大 → 红"封"章逐个盖下
//   （每章一声闷响 + 书皮震颤）→ 全部盖完后白闪 → 完成开关置 ON → 返回
//
// 插件命令：
//   UnwrittenSeal Play          # 事件里直接播放封存演出（无视菜单）
//   UnwrittenSeal Menu ON/OFF   # 临时开关菜单拦截（默认参数决定初值）
//
// 参数说明见下方 @param 区。封存完成开关默认 2006（避开原作与夜书 2001-2003）。
//=============================================================================
// Add to Imported List
var Imported = Imported || {}; Imported.TDS_UnwrittenSeal = true;
// Initialize Alias Object
var _TDS_ = _TDS_ || {}; _TDS_.UnwrittenSeal = _TDS_.UnwrittenSeal || {};
//=============================================================================
 /*:
 * @plugindesc v1.00 封存：主菜单"戳刺"改为"封存"演出（书皮+红封章+完成开关）
 * @author NirvanaCeleste
 *
 * @help
 * 见文件头注释。需要 UnwrittenStory.js（共用书皮素材路径，无硬依赖也可独立运行）。
 *
 * @param sealLabel
 * @text 菜单按钮文字
 * @default 封存
 *
 * @param promptText
 * @text 队伍列表提示文字
 * @default 把这一页，封存起来吗？
 *
 * @param coverImage
 * @text 书皮图片（img/pictures/ 相对路径，留空=代码画占位书皮）
 * @default Unwritten/Book/book_cover
 *
 * @param stampSe
 * @text 盖章音效名（audio/se/）
 * @default Attack1
 *
 * @param stampPitch
 * @text 盖章音效音调
 * @default 70
 *
 * @param stampCount
 * @text 封章数量
 * @default 5
 *
 * @param stampInterval
 * @text 每个封章间隔帧数
 * @default 22
 *
 * @param doneSwitchId
 * @text 封存完成开关ID
 * @desc 演出结束后置 ON；填 0 = 不置开关
 * @default 2006
 *
 * @param menuIntercept
 * @text 拦截主菜单戳刺
 * @desc true = 菜单走封存演出；false = 保持原版戳刺（公共事件34）
 * @default true
 *
 * @param replayBook
 * @text 演出前重播改写
 * @desc true = 盖章前逐条重现玩家这一夜的真实改写
 * @default true
 */
//=============================================================================

"use strict";

(function() {

    var P = PluginManager.parameters('UnwrittenSeal');
    _TDS_.UnwrittenSeal.Param = {
        sealLabel:      String(P['sealLabel'] || '封存'),
        promptText:     String(P['promptText'] || '把这一页，封存起来吗？'),
        coverImage:     String(P['coverImage'] || ''),
        stampSe:        String(P['stampSe'] || 'Attack1'),
        stampPitch:     Number(P['stampPitch'] || 70),
        stampCount:     Math.max(1, Number(P['stampCount'] || 5)),
        stampInterval:  Math.max(6, Number(P['stampInterval'] || 22)),
        doneSwitchId:   Number(P['doneSwitchId'] || 0),
        menuIntercept:  String(P['menuIntercept'] || 'true') === 'true',
        replayBook:     String(P['replayBook'] === undefined ? 'true' : P['replayBook']) === 'true'
    };
    _TDS_.UnwrittenSeal.Version = '1.02';
    var Param = _TDS_.UnwrittenSeal.Param;

    //=========================================================================
    // ** 主菜单三处挂钩（v1.02：别名统一挂 _TDS_.UnwrittenSeal 命名空间，
    //    对齐 TDS 插件惯例——后续模组可链式引用原实现）
    //=========================================================================

    // 1) 菜单第一项文字：STAB → 封存
    _TDS_.UnwrittenSeal.WMC_makeCommandList = Window_MenuCommand.prototype.makeCommandList;
    Window_MenuCommand.prototype.makeCommandList = function() {
        _TDS_.UnwrittenSeal.WMC_makeCommandList.call(this);
        if (!Param.menuIntercept || !$gameSwitches.value(4)) { return; }
        for (var i = 0; i < this._list.length; i++) {
            if (this._list[i].symbol === 'talk' && this._list[i].name !== Param.sealLabel) {
                this._list[i].name = Param.sealLabel;
            }
        }
        this.refresh();
    };

    // 2) 队伍列表上方的提示文字
    _TDS_.UnwrittenSeal.SM_commandTalk = Scene_Menu.prototype.commandTalk;
    Scene_Menu.prototype.commandTalk = function() {
        _TDS_.UnwrittenSeal.SM_commandTalk.call(this);
        if (!Param.menuIntercept || !$gameSwitches.value(4)) { return; }
        if (this._statusWindow && this._statusWindow.setCursorText) {
            this._statusWindow.setCursorText(Param.promptText);
        }
    };

    // 3) 确认选择：不再走原版公共事件34，进入封存演出
    _TDS_.UnwrittenSeal.SM_processTag = Scene_Menu.prototype.processTag;
    Scene_Menu.prototype.processTag = function() {
        if (Param.menuIntercept && $gameSwitches.value(4) &&
            this._statusWindow && this._statusWindow.index() === 0) {
            this._goldWindow.close();
            SceneManager.push(Scene_UnwrittenSeal);
            return;
        }
        _TDS_.UnwrittenSeal.SM_processTag.call(this);
    };

    //=========================================================================
    // ** 插件命令
    //=========================================================================
    _TDS_.UnwrittenSeal.GI_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _TDS_.UnwrittenSeal.GI_pluginCommand.call(this, command, args);
        if (command !== 'UnwrittenSeal') { return; }
        switch (String(args[0] || '').toUpperCase()) {
            case 'PLAY':
                SceneManager.push(Scene_UnwrittenSeal);
                break;
            case 'MENU':
                Param.menuIntercept = String(args[1] || '').toUpperCase() !== 'OFF';
                break;
            case 'REPLAY':
                // v1.02：REPLAY ON/OFF —— 演出前是否重播玩家改写（默认 ON）
                Param.replayBook = String(args[1] || '').toUpperCase() !== 'OFF';
                break;
        }
    };

    //=========================================================================
    // ** Scene_UnwrittenSeal —— 封存演出
    //   阶段 0: 暗幕渐起 + 书皮浮现放大
    //   阶段 1: 红"封"章逐个盖下（音效+震颤）
    //   阶段 2: 停留
    //   阶段 3: 白闪 → 置完成开关 → 返回
    //=========================================================================
    function Scene_UnwrittenSeal() { this.initialize.apply(this, arguments); }
    window.Scene_UnwrittenSeal = Scene_UnwrittenSeal;   // 暴露给测试环境（AIPLAY）
    Scene_UnwrittenSeal.prototype = Object.create(Scene_BaseEX.prototype);
    Scene_UnwrittenSeal.prototype.constructor = Scene_UnwrittenSeal;

    Scene_UnwrittenSeal.prototype.initialize = function() {
        Scene_BaseEX.prototype.initialize.call(this);
        this._phase = 0;
        this._timer = 0;
        this._stamps = [];
        this._stamped = 0;
        this._shakePower = 0;
        this._bookSprite = null;
        this._finishAfter = 0;
        // v1.02 replayBook：演出前重播玩家的真实改写
        this._replay = null;        // [{page,id,action,variant,text}] 或 null
        this._replayIndex = 0;
        this._replaySprite = null;
        this._replayLines = [];
    };

    Scene_UnwrittenSeal.prototype.create = function() {
        Scene_BaseEX.prototype.create.call(this);
        this.createDimmer();
        this.createBook();
        this.collectReplay();
    };

    // v1.02 replayBook：从 $gameUnwrittenStory 抽取"这一夜"的改写摘要。
    // 书名来源 = UnwrittenStory 侧记录的"最近完成的书"（finish 事件写入），
    // 兜底按夜书完成开关反查。无 UnwrittenStory / 无改写 / REPLAY OFF 时静默跳过。
    Scene_UnwrittenSeal.prototype.collectReplay = function() {
        this._replay = null;
        if (!Param.replayBook) { return; }
        var US = window._TDS_ && _TDS_.UnwrittenStory;
        if (!US || !$gameUnwrittenStory || !$gameUnwrittenStory.replayEntries) { return; }
        // ① 首选：UnwrittenStory 最近 finish 的书（封存紧跟读书，语义最准）
        var bookYaml = (US.lastFinishedBook !== undefined && US.lastFinishedBook !== null)
            ? String(US.lastFinishedBook) : null;
        // ② 兜底：夜书完成开关反查（事件直接 UnwrittenSeal Play 时的保守推断）
        if (!bookYaml) {
            var table = this.replayBookTable();
            var sws = ['2001', '2002', '2003'];
            for (var i = 0; i < sws.length; i++) {
                if ($gameSwitches.value(Number(sws[i]))) { bookYaml = table[sws[i]]; break; }
            }
        }
        if (!bookYaml) { return; }
        var lang = null;
        try { lang = LanguageManager.languageData(); } catch (e) { lang = null; }
        this._replay = $gameUnwrittenStory.replayEntries(bookYaml, lang);
        if (!this._replay || !this._replay.length) { this._replay = null; }
        this._replayIndex = 0;
    };
    // 夜书完成开关 → yaml 名（不带 .yaml 扩展；与 languages 目录文件名一致）
    Scene_UnwrittenSeal.prototype.replayBookTable = function() {
        return { '2001': '00_MOD_book_night0', '2002': '00_MOD_book_night1', '2003': '00_MOD_book_night2' };
    };

    Scene_UnwrittenSeal.prototype.createDimmer = function() {
        var bmp = new Bitmap(Graphics.width, Graphics.height);
        bmp.fillRect(0, 0, Graphics.width, Graphics.height, 'rgba(8, 6, 10, 1)');
        this._dimmer = new Sprite(bmp);
        this._dimmer.opacity = 0;
        this.addChild(this._dimmer);
        this.move.startMove({
            obj: this._dimmer, properties: ['opacity'],
            from: { opacity: 0 }, to: { opacity: 225 },
            durations: { opacity: 30 }, easing: Object_Movement.easeOutCirc
        });
    };

    Scene_UnwrittenSeal.prototype.createBook = function() {
        var self = this;
        var spr = new Sprite();
        spr.anchor.set(0.5, 0.5);
        spr.x = Graphics.width / 2;
        spr.y = Graphics.height / 2 + 30;
        spr.opacity = 0;
        this.addChild(spr);
        this._bookSprite = spr;
        var finishIntro = function(bmpW, bmpH) {
            self._bookW = bmpW; self._bookH = bmpH;
            var fit = Math.min((Graphics.width * 0.62) / bmpW, (Graphics.height * 0.7) / bmpH);
            self._bookFit = fit;
            spr.scale.x = fit * 0.9; spr.scale.y = fit * 0.9;
            self._phase = 0;
            self.move.startMove({
                obj: spr, properties: ['opacity', 'scale.x', 'scale.y', 'y'],
                from: { opacity: 0, 'scale.x': fit * 0.9, 'scale.y': fit * 0.9, y: spr.y + 26 },
                to: { opacity: 255, 'scale.x': fit, 'scale.y': fit, y: Graphics.height / 2 },
                durations: { opacity: 34, 'scale.x': 34, 'scale.y': 34, y: 34 },
                easing: Object_Movement.easeOutCirc
            });
        };
        if (Param.coverImage) {
            var img = ImageManager.loadPicture(Param.coverImage);
            img.addLoadListener(function() {
                if (img.width > 0 && !img.isError()) {
                    spr.bitmap = img;
                    finishIntro(img.width, img.height);
                } else {
                    spr.bitmap = self.makePlaceholderCover();
                    finishIntro(spr.bitmap.width, spr.bitmap.height);
                }
            });
        } else {
            spr.bitmap = this.makePlaceholderCover();
            finishIntro(spr.bitmap.width, spr.bitmap.height);
        }
    };

    // 占位书皮：米色纸 + 深色边框 + 中央"未竟之事"（纯代码，任何环境下都有）
    Scene_UnwrittenSeal.prototype.makePlaceholderCover = function() {
        var w = 460, h = 300;
        var bmp = new Bitmap(w, h);
        bmp.fillRect(0, 0, w, h, 'rgba(242, 233, 210, 1)');
        bmp.fillRect(0, 0, w, 10, 'rgba(60, 48, 40, 1)');
        bmp.fillRect(0, h - 10, w, 10, 'rgba(60, 48, 40, 1)');
        bmp.fillRect(0, 0, 10, h, 'rgba(60, 48, 40, 1)');
        bmp.fillRect(w - 10, 0, 10, h, 'rgba(60, 48, 40, 1)');
        bmp.fontSize = 30;
        bmp.textColor = '#3a3129';
        bmp.drawText('未竟之事', 0, h / 2 - 40, w, 36, 'center');
        bmp.fontSize = 16;
        bmp.drawText('— 封存 —', 0, h / 2 + 4, w, 24, 'center');
        return bmp;
    };

    // 封章位置：书皮上确定性伪随机散布（每次演出位置一致）
    Scene_UnwrittenSeal.prototype.stampPosition = function(i) {
        var n = Math.max(1, Param.stampCount);
        var fx = ((i * 137 + 41) % 100) / 100;   // 0..1
        var fy = ((i * 263 + 89) % 100) / 100;
        return {
            x: -0.32 + fx * 0.64,   // 书皮坐标系数（-0.5..0.5 为书皮范围）
            y: -0.36 + fy * 0.72
        };
    };

    Scene_UnwrittenSeal.prototype.dropStamp = function() {
        var i = this._stamped;
        var pos = this.stampPosition(i);
        var size = 44;
        var bmp = new Bitmap(size, size);
        bmp.fillRect(0, 0, size, size, 'rgba(158, 36, 36, 0.88)');
        bmp.fillRect(2, 2, size - 4, size - 4, 'rgba(178, 44, 44, 0.92)');
        bmp.fontSize = 30;
        bmp.textColor = '#f4e8dc';
        bmp.drawText('封', 0, 4, size, 30, 'center');
        var spr = new Sprite(bmp);
        spr.anchor.set(0.5, 0.5);
        spr.x = this._bookSprite.x + pos.x * this._bookW * this._bookFit;
        spr.y = this._bookSprite.y + pos.y * this._bookH * this._bookFit;
        spr.rotation = (i % 2 === 0 ? 1 : -1) * (0.08 + (i % 3) * 0.05);
        spr.opacity = 0;
        spr.scale.x = 1.6; spr.scale.y = 1.6;
        this.addChild(spr);
        this._stamps.push(spr);
        // 落章动画：从放大淡入砸到原尺寸
        this.move.startMove({
            obj: spr, properties: ['opacity', 'scale.x', 'scale.y'],
            from: { opacity: 0, 'scale.x': 1.6, 'scale.y': 1.6 },
            to: { opacity: 255, 'scale.x': 1, 'scale.y': 1 },
            durations: { opacity: 8, 'scale.x': 8, 'scale.y': 8 },
            easing: Object_Movement.easeOutCirc
        });
        AudioManager.playSe({ name: Param.stampSe, volume: 90, pitch: Param.stampPitch, pan: 0 });
        this._shakePower = 7;
        this._stamped++;
    };

    Scene_UnwrittenSeal.prototype.update = function() {
        try {
            Scene_BaseEX.prototype.update.call(this);
            this.updateShake();
            // phase 3：白闪倒计时 → 置开关 → popScene（2026-10-01 修复：
            // 原实现用 monkey-patch this.update 挂 _finishTick，但引擎/泵帧
            // 从原型链调 update 时倒计时永不执行 → 演出卡死在白闪）
            if (this._phase === 3) {
                this._finishAfter--;
                if (!isFinite(this._finishAfter) || this._finishAfter <= 0) {
                    if (Param.doneSwitchId > 0) { $gameSwitches.setValue(Param.doneSwitchId, true); }
                    this.popScene();
                }
                return;
            }
            if (Input.isTriggered('cancel') || Input.isTriggered('ok')) { this.finish(); return; }
            this._timer++;
            if (this._phase === 0) {
                if (!this.move.isMoving() && this._timer > 40) {
                    // v1.02：有改写记录时先走重播（phase 0.5），否则直接盖章
                    if (this._replay && this._replay.length) {
                        this._phase = 10; this._timer = 0;
                        this.showReplayLine();
                    } else {
                        this._phase = 1; this._timer = 0;
                    }
                }
            } else if (this._phase === 10) {
                // 重播阶段：逐条显示玩家改写（任意 ok/cancel 快进，见上方统一快进）
                this.updateReplay();
            } else if (this._phase === 1) {
                if (this._stamped < Param.stampCount &&
                    this._timer >= Param.stampInterval) {
                    this._timer = 0;
                    this.dropStamp();
                } else if (this._stamped >= Param.stampCount && this._timer > 50) {
                    this._phase = 2; this._timer = 0;
                }
            } else if (this._phase === 2) {
                if (this._timer > 24) { this.finish(); }
            }
        } catch (e) {
            console.warn('[UnwrittenSeal] 演出异常: ' + e.message);
            this.finish();
        }
    };

    // ========================================================================
    // v1.02 replayBook —— 重播玩家的真实改写
    //   演出语序：改写过的句子逐条浮现于书皮上方，然后淡去下一条。
    //   erase → 红色删除线文本；variant → 新句；keep → 原句（灰色）。
    // ========================================================================
    Scene_UnwrittenSeal.prototype.replayTextFor = function(entry) {
        var t = String(entry.text === undefined ? '' : entry.text);
        if (entry.action === 'erase') { return '(那一行消失了)'; }
        if (!t) { return '(未写下新的句子)'; }
        return t;
    };

    Scene_UnwrittenSeal.prototype.replayColor = function(entry) {
        if (entry.action === 'erase') { return 'rgba(168, 48, 48, 1)'; }
        if (entry.action === 'variant') { return 'rgba(58, 49, 41, 1)'; }
        return 'rgba(110, 100, 92, 1)';   // keep：灰
    };

    Scene_UnwrittenSeal.prototype.showReplayLine = function() {
        var self = this;
        var entry = this._replay[this._replayIndex];
        if (!entry) { return; }
        // 上一条淡出移除
        if (this._replaySprite) {
            var old = this._replaySprite;
            this.move.startMove({
                obj: old, properties: ['opacity'],
                from: { opacity: old.opacity }, to: { opacity: 0 },
                durations: { opacity: 18 }, easing: Object_Movement.easeInCirc
            });
            var self2 = this;
            // 18 帧后回收（queue 演出队列，不与 move 冲突）
            this.queue(function() { self2.removeChild(old); });
        }
        var bmp = new Bitmap(640, 120);
        bmp.fontSize = 22;
        bmp.textColor = this.replayColor(entry);
        var lines = this.wrapReplayText(this.replayTextFor(entry), 640, bmp);
        for (var i = 0; i < lines.length; i++) {
            bmp.drawText(lines[i], 0, i * 30, 640, 30, 'center');
        }
        if (entry.action === 'erase') {
            // 删除线：文字中线画一道红杠
            var yMid = (lines.length * 30) / 2 - 4;
            bmp.fillRect(0, yMid, 640, 2, 'rgba(168, 48, 48, 0.9)');
        }
        var spr = new Sprite(bmp);
        spr.anchor.set(0.5, 0.5);
        spr.x = Graphics.width / 2;
        spr.y = Graphics.height / 2 - 190;
        spr.opacity = 0;
        this.addChild(spr);
        this._replaySprite = spr;
        this.move.startMove({
            obj: spr, properties: ['opacity'],
            from: { opacity: 0 }, to: { opacity: 255 },
            durations: { opacity: 20 }, easing: Object_Movement.easeOutCirc
        });
        this.queue(function() { self._timer = 0; });   // 每条起播重置节拍
    };

    Scene_UnwrittenSeal.prototype.updateReplay = function() {
        var hold = 75;   // 每条停留 ~1.25 秒
        if (this._timer >= hold) {
            this._replayIndex++;
            if (this._replayIndex >= this._replay.length) {
                // 重播完毕：清场进盖章
                var self = this;
                if (this._replaySprite) {
                    var old = this._replaySprite;
                    this.move.startMove({
                        obj: old, properties: ['opacity'],
                        from: { opacity: old.opacity }, to: { opacity: 0 },
                        durations: { opacity: 18 }, easing: Object_Movement.easeInCirc
                    });
                    this.queue(function() { self.removeChild(old); self._replaySprite = null; });
                }
                this._replay = null;
                this._phase = 1; this._timer = 0;
            } else {
                this.showReplayLine();
            }
        }
    };

    // 极简按宽折行（书页重播用，非通用排版）
    Scene_UnwrittenSeal.prototype.wrapReplayText = function(text, maxW, bmp) {
        var out = [], line = '';
        for (var i = 0; i < text.length; i++) {
            var test = line + text.charAt(i);
            if (bmp.measureTextWidth(test) > maxW && line) { out.push(line); line = text.charAt(i); }
            else { line = test; }
        }
        if (line) { out.push(line); }
        return out.length ? out : [''];
    };

    // 书皮震颤（盖章冲击，指数衰减；不影响封章与暗幕）
    Scene_UnwrittenSeal.prototype.updateShake = function() {
        if (this._shakePower <= 0.2) {
            if (this._bookSprite) { this._bookSprite.x = Graphics.width / 2; }
            return;
        }
        this._shakePower *= 0.86;
        var t = Graphics.frameCount * 0.9;
        if (this._bookSprite) {
            this._bookSprite.x = Graphics.width / 2 + Math.sin(t) * this._shakePower;
            this._bookSprite.y = (Graphics.height / 2) + Math.cos(t * 0.8) * this._shakePower * 0.6;
        }
    };

    Scene_UnwrittenSeal.prototype.finish = function() {
        if (this._phase === 3) { return; }
        this._phase = 3;
        this._finishAfter = 20;   // 必须在任何可能抛异常的操作之前赋值
                                  // （否则 flash 动画异常时 fa=undefined → NaN 倒计时永不结束）
        var flash = new Sprite(new Bitmap(Graphics.width, Graphics.height));
        flash.bitmap.fillRect(0, 0, Graphics.width, Graphics.height, 'rgba(244, 238, 226, 1)');
        flash.opacity = 0;
        this.addChild(flash);
        this.move.startMove({
            obj: flash, properties: ['opacity'],
            from: { opacity: 0 }, to: { opacity: 255 },
            durations: { opacity: 16 }, easing: Object_Movement.easeInCirc
        });
        SoundManager.playSe({ name: 'sys_PA_page_flip', volume: 70, pitch: 80, pan: 0 });
    };

    console.log('[UnwrittenSeal] v' + _TDS_.UnwrittenSeal.Version + ' 已加载 | 菜单拦截:' +
        Param.menuIntercept + ' | 完成开关:' + Param.doneSwitchId);

})();
