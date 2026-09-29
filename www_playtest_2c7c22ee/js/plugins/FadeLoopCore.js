/*:
 * @plugindesc v1.1 通用淡入淡出循环控制器（支持无开关模式）
 * @author NirvanaCeleste
 * @help
 * ============================================================
 * 使用方法：
 * 1. registerFadeLoop('picture', 图片ID, 开关ID, 'normal', 速度, 停留帧, 最低透明度, 最高透明度)
 *    开关ID传 0 表示无开关，始终开启。
 * 
 * 2. 需要一个并行公共事件每帧调用 updateFadeLoops();
 * 
 * 3. 开关打开 → 开始循环；开关关闭 → 淡出后停止。
 *    无开关模式（开关ID=0）：始终运行。
 * 
 * 4. removeFadeLoop('picture', 图片ID) 可永久停止并移除循环。
 * ============================================================
 */

(function() {
    // 等待 $gameTemp 初始化
    function init() {
        if (typeof $gameTemp === 'undefined' || $gameTemp === null) {
            setTimeout(init, 16);
            return;
        }

        if (!$gameTemp._fadeLoops) {
            $gameTemp._fadeLoops = [];
        }

        console.log("FadeLoopCore: 初始化完成");
    }

    // --- 注册函数 ---
    window.registerFadeLoop = function(targetType, id, switchId, effectType, speed, holdDuration, minOpacity, maxOpacity) {
        // 防御性检查
        if (!$gameTemp) {
            $gameTemp = {};
        }
        if (!$gameTemp._fadeLoops) {
            $gameTemp._fadeLoops = [];
        }

        speed = speed || 5;
        holdDuration = holdDuration || 30;
        minOpacity = minOpacity || 0;
        maxOpacity = maxOpacity || 255;
        effectType = effectType || 'normal';

        var loops = $gameTemp._fadeLoops;

        for (var i = 0; i < loops.length; i++) {
            if (loops[i].target === targetType && loops[i].id === id) {
                loops[i].switchId = switchId;
                loops[i].effectType = effectType;
                loops[i].speed = speed;
                loops[i].holdDuration = holdDuration;
                loops[i].minOpacity = minOpacity;
                loops[i].maxOpacity = maxOpacity;
                return loops[i];
            }
        }

        var loop = {
            target: targetType,
            id: id,
            switchId: switchId,
            effectType: effectType,
            state: 0,
            opacity: 0,
            holdTimer: 0,
            speed: speed,
            holdDuration: holdDuration,
            minOpacity: minOpacity,
            maxOpacity: maxOpacity,
            paused: false,
            breathPhase: 0
        };
        loops.push(loop);

        // ---- 图片初始化：只处理不存在的图片 ----
        if (targetType === 'picture') {
            var pic = $gameScreen.picture(id);
            if (pic) {
                // 图片已存在：只确保可见，保留当前帧和透明度
                pic._visible = true;
            } else {
                console.warn("registerFadeLoop: 图片 ID " + id + " 不存在，请先用 Show Picture 显示该图片。");
            }
        }

        return loop;
    };

    // --- 更新函数 ---
    window.updateFadeLoops = function() {
        var loops = $gameTemp._fadeLoops;
        if (!loops) return;

        for (var i = loops.length - 1; i >= 0; i--) {
            var loop = loops[i];
            
            // 开关逻辑：switchId === 0 表示无开关，始终视为开启
            var sw = (loop.switchId === 0) ? true : $gameSwitches.value(loop.switchId);
            
            var targetObj = null;

            if (loop.target === 'picture') {
                targetObj = $gameScreen.picture(loop.id);
                if (!targetObj) continue;
            } else if (loop.target === 'event') {
                targetObj = $gameMap.event(loop.id);
                if (!targetObj) continue;
            } else {
                continue;
            }

            if (sw) {
                loop.paused = false;
                if (loop.effectType === 'breath') {
                    loop.breathPhase += 0.02 * (loop.speed / 5);
                    var progress = (Math.sin(loop.breathPhase) + 1) / 2;
                    loop.opacity = loop.minOpacity + progress * (loop.maxOpacity - loop.minOpacity);
                } else {
                    switch (loop.state) {
                        case 0:
                            loop.state = 1;
                            loop.opacity = loop.minOpacity;
                            break;
                        case 1:
                            loop.opacity += loop.speed;
                            if (loop.opacity >= loop.maxOpacity) {
                                loop.opacity = loop.maxOpacity;
                                loop.state = 2;
                                loop.holdTimer = 0;
                            }
                            break;
                        case 2:
                            loop.holdTimer++;
                            if (loop.holdTimer >= loop.holdDuration) {
                                loop.holdTimer = 0;
                                loop.state = 3;
                            }
                            break;
                        case 3:
                            loop.opacity -= loop.speed;
                            if (loop.opacity <= loop.minOpacity) {
                                loop.opacity = loop.minOpacity;
                                loop.state = 4;
                                loop.holdTimer = 0;
                            }
                            break;
                        case 4:
                            loop.holdTimer++;
                            if (loop.holdTimer >= loop.holdDuration) {
                                loop.holdTimer = 0;
                                loop.state = 1;
                            }
                            break;
                    }
                }
            } else {
                if (!loop.paused) {
                    loop.paused = true;
                    if (loop.effectType === 'breath') {
                        loop.state = 0;
                        loop.opacity = loop.minOpacity;
                    } else {
                        if (loop.state !== 0 && loop.state !== 4) {
                            loop.state = 3;
                        } else {
                            loop.state = 0;
                            loop.opacity = loop.minOpacity;
                        }
                    }
                } else {
                    if (loop.effectType !== 'breath' && loop.state === 3) {
                        loop.opacity -= loop.speed;
                        if (loop.opacity <= loop.minOpacity) {
                            loop.opacity = loop.minOpacity;
                            loop.state = 0;
                        }
                    }
                }
            }

            // ---- 应用透明度 ----
            if (loop.target === 'picture') {
                var pic = targetObj;
                pic._opacity = Math.round(loop.opacity);
                // 只在透明度为 0 且状态为空闲时才隐藏
                if (loop.opacity === loop.minOpacity && loop.state === 0) {
                    pic._visible = false;
                } else {
                    pic._visible = true;
                }
            } else if (loop.target === 'event') {
                targetObj.setOpacity(Math.round(loop.opacity));
            }
        }
    };

    // --- 移除函数 ---
    window.removeFadeLoop = function(targetType, id) {
        var loops = $gameTemp._fadeLoops;
        if (!loops) return;
        for (var i = 0; i < loops.length; i++) {
            if (loops[i].target === targetType && loops[i].id === id) {
                loops.splice(i, 1);
                return;
            }
        }
    };

    // 启动初始化
    init();

})();