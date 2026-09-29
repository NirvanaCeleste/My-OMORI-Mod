//=============================================================================
// TDS Custom Battle Action Text
// Version: 1.0
//=============================================================================
// Add to Imported List
var Imported = Imported || {} ; Imported.TDS_CustomBattleActionText = true;
// Initialize Alias Object
var _TDS_ = _TDS_ || {} ; _TDS_.CustomBattleActionText = _TDS_.CustomBattleActionText || {};
//=============================================================================
 /*:
 * @plugindesc
 * This plugins allows you to set customized messages for actions.
 *
 * @author TDS
 */
//=============================================================================


//=============================================================================
// ** Window_BattleLog
//-----------------------------------------------------------------------------
// The window for displaying battle progress. No frame is displayed, but it is
// handled as a window for convenience.
//=============================================================================
// Alias Listing
//=============================================================================
_TDS_.CustomBattleActionText.Window_BattleLog_displayAction         = Window_BattleLog.prototype.displayAction;
_TDS_.CustomBattleActionText.Window_BattleLog_displayActionResults  = Window_BattleLog.prototype.displayActionResults;
//=============================================================================
// * Make Custom Action Text
//=============================================================================
Window_BattleLog.prototype.makeCustomActionText = function(subject, target, item) {
  var user          = subject;
  var result        = target.result();
  var hit           = result.isHit();
  var success       = result.success;
  var critical      = result.critical;
  var missed        = result.missed;
  var evaded        = result.evaded;
  var hpDam         = result.hpDamage;
  var mpDam         = result.mpDamage;
  var tpDam         = result.tpDamage;
  var addedStates   = result.addedStates;
  var removedStates = result.removedStates;
  var strongHit     = result.elementStrong;
  var weakHit       = result.elementWeak;
  var text = '';
  var type = item.meta.BattleLogType.toUpperCase();
  var switches = $gameSwitches;
  var unitLowestIndex = target.friendsUnit().getLowestIndexMember();


  function parseNoEffectEmotion(tname, em) {
    if(em.toLowerCase().contains("害怕")) {
      if(tname === "OMORI") {return "OMORI 无法变得害怕！\r\n"}
      return target.name() + "无法变得害怕！\r\n";
    }
    let finalString = `${tname + (tname === "OMORI" ? " " : "")}无法变得${em}`;
    if(finalString.length >= 40) {
      let voinIndex = 0;
      for(let i = 40; i >= 0; i--) {
        if(finalString[i] === " ") {
          voinIndex = i;
          break;
        }
      }
      finalString = [finalString.slice(0, voinIndex).trim(), "\r\n", finalString.slice(voinIndex).trimLeft()].join('')
    }
    return finalString;
  }

  function parseNoStateChange(tname,stat,hl) {
    let noStateChangeText = `${tname + (tname[tname.length - 1] <= 'z' ? " " : "")}的${stat}无法变得\r\n${hl}`; // TARGET NAME - STAT - HIGHER/LOWER
    return noStateChangeText
  }

  // Type case
//OMORI//
if (hpDam != 0) {
  var hpDamageText = target.name() + (target.name() === "OMORI" ? " " : "") + '受到了 ' + hpDam + ' 点伤害！';
  if (strongHit) {
    hpDamageText = '……迅捷一击！\r\n' + hpDamageText;
  } else if (weakHit) {
    hpDamageText = '……疲软一击。\r\n' + hpDamageText;
  }
} else if (result.isHit() === true) {
  var hpDamageText = user.name() + "的攻击没有效果。";
} else {
  var hpDamageText = user.name() + "的攻击没有命中！";
}

if (critical) {
    hpDamageText = '正中中心！\r\n' + hpDamageText;
}

if (mpDam > 0) {
  var mpDamageText = target.name() + (target.name() === "OMORI" ? " " : "") + '失去了 ' + mpDam + ' 点活力……';
  hpDamageText = hpDamageText + "\r\n" + mpDamageText;
} else {
  var mpDamageText = '';
}
  var userSp = user.name().trim()[user.name().length - 1] <= 'z' ? " " : "";
  var targetSp = target.name().trim()[target.name().length - 1] <= 'z' ? " " : "";

  switch (type) {
  case 'BLANK': // ATTACK
    text = '……';
    break;

  case 'ATTACK': // ATTACK
    text = user.name() + userSp + '攻击了' + targetSp + target.name() + targetSp + '！\r\n';
    text += hpDamageText;
    break;

  case 'MULTIHIT':
    text = user.name() + userSp + "使出了奋力一击！\r\n";
    break;

  case 'OBSERVE': // OBSERVE
    text = user.name() + userSp + '聚精会神地观察着。\r\n';
    text += target.name() + '！';
    break;

  case 'OBSERVE TARGET': // OBSERVE TARGET
    //text = user.name() + " observes " + target.name() + ".\r\n";
    text = target.name() + userSp + '盯住了\r\n';
    text += user.name() + '！';
    break;

  case 'OBSERVE ALL': // OBSERVE TARGET
    //text = user.name() + " observes " + target.name() + ".\r\n";
    text = user.name() + userSp + '聚精会神地观察着。\r\n';
    text += target.name() + '！';
    text = target.name() + userSp + '盯住了所有人！';
    break;

  case 'SAD POEM':  // SAD POEM
    text = user.name() + userSp + '读起了一首悲伤的诗。\r\n';
    if(!target._noEffectMessage) {
      if(target.isStateAffected(12)) {text += target.name() + targetSp + '陷入了痛苦…………';}
      else if(target.isStateAffected(11)) {text += target.name() + targetSp + '变得抑郁了……';}
      else if(target.isStateAffected(10)) {text += target.name() + targetSp + '变得悲伤了。';}
    }
    else {text += parseNoEffectEmotion(target.name(), "更悲伤了！")}
    break;

  case 'STAB': // STAB
    text = user.name() + userSp + '捅了' + targetSp + target.name() + targetSp + '一刀。\r\n';
    text += hpDamageText;
    break;

  case 'TRICK':  // TRICK
    text = user.name() + userSp + '对' + targetSp + target.name() + targetSp + '做恶作剧。\r\n';
    if(target.isEmotionAffected("happy")) {
      if(!target._noStateMessage) {text += target.name() + targetSp + '的速度下降了！\r\n';}
      else {text += parseNoStateChange(target.name(), "速度", "更低了！\r\n")}
    }
    text += hpDamageText;
    break;

  case 'SHUN': // SHUN
    text = user.name() + userSp + '故意疏远' + targetSp + target.name() + '。\r\n';
    if(target.isEmotionAffected("sad")) {
      if(!target._noStateMessage) {text += target.name() + targetSp + '的防御下降了。\r\n';}
      else {text += parseNoStateChange(target.name(), "防御", "更低了！\r\n")}
    }
    text += hpDamageText;
    break;

  case 'MOCK': // MOCK
    text = user.name() + userSp + '嘲讽起了' + targetSp + target.name() + '。\r\n';
    text += hpDamageText;
    break;

  case 'HACKAWAY':  // Hack Away
    text = user.name() + userSp + '疯狂地劈砍！';
    break;

  case 'PICK POCKET': //Pick Pocket 注：未使用
    text = user.name() + userSp + '尝试偷窃物品！\r\n';
    text += '目标是' + targetSp + target.name();
    break;

  case 'BREAD SLICE': //Bread Slice
    text = user.name() + userSp + '切开了' + targetSp + target.name() + '！\r\n';
    text += hpDamageText;
    break;

  case 'HIDE': // Hide 注：未使用
    text = user.name() + userSp + '融入了背景……';
    break;

  case 'QUICK ATTACK': // Quick Attack 注：未使用
    text = user.name() + userSp + '飞扑向了' + targetSp + target.name() + '！\r\n';
    text += hpDamageText;
    break;

  case 'EXPLOIT HAPPY': //Exploit Happy
    text = user.name() + userSp + '利用了' + targetSp + target.name() + targetSp + '的\r\n';
    text += '开心情绪！\r\n';
    text += hpDamageText;
    break;

  case 'EXPLOIT SAD': // Exploit Sad
    text = user.name() + userSp + '利用了' + targetSp + target.name() + targetSp + '的\r\n';
    text += '悲伤情绪！\r\n';
    text += hpDamageText;
    break;

  case 'EXPLOIT ANGRY': // Exploit Angry
    text = user.name() + userSp + '利用了' + targetSp + target.name() + targetSp + '的\r\n';
    text += '生气情绪！\r\n';
    text += hpDamageText;
    break;

  case 'EXPLOIT EMOTION': // Exploit Emotion
    text = user.name() + userSp + "利用了" + targetSp + target.name() + targetSp + "的情绪。";
    if(text.length >= 34) {
      text = user.name() + userSp + '利用了' + targetSp + target.name() + targetSp + '的\r\n';
      text += '情绪！\r\n';
    }
    else {text += "\r\n"}
    text += hpDamageText;
    break;

  case 'FINAL STRIKE': // Final Strike
    text = user.name() + userSp + '释放了他的终极攻击！';
    break;

  case 'TRUTH': // PAINFUL TRUTH
    text = user.name() + userSp + '低声向\r\n';
    text += target.name() + targetSp + '说了些什么。\r\n';
    text += hpDamageText + "\r\n";
    if(!target._noEffectMessage) {
      text += target.name() + userSp + "变得悲伤了。\r\n";
    }
    else {text += parseNoEffectEmotion(target.name(), "更悲伤了！\r\n")}
    if(user.isStateAffected(12)) {text += user.name() + userSp + "陷入了痛苦…………";}
    else if(user.isStateAffected(11)) {text += user.name() + userSp + "变得抑郁了……";}
    else if(user.isStateAffected(10)) {text += user.name() + userSp + "变得悲伤了。";}
    break;

  case 'ATTACK AGAIN':  // ATTACK AGAIN 2
    text = user.name() + userSp + '再次攻击！\r\n';
    text += hpDamageText;
    break;

  case 'TRIP':  // TRIP
    text = user.name() + userSp + '绊倒了' + targetSp + target.name() + '！\r\n';
    if(!target._noStateMessage) {text += target.name() + targetSp + '的速度下降了！\r\n';}
    else {text += parseNoStateChange(target.name(), "速度", "更低了！\r\n")}
    text += hpDamageText;
    break;

    case 'TRIP 2':  // TRIP 2
      text = user.name() + userSp + '绊倒了' + targetSp + target.name() + '！\r\n';
      if(!target._noStateMessage) {text += target.name() + '的速度下降了！\r\n';}
      else {text += parseNoStateChange(target.name(), "速度", "更低了！\r\n")}
      if(!target._noEffectMessage) {text += target.name() + '变得悲伤了。\r\n';}
      else {text += parseNoEffectEmotion(target.name(), "更悲伤了！\r\n")}
      text += hpDamageText;
      break;

  case 'STARE': // STARE
    text = user.name() + userSp + '瞪视着' + targetSp + target.name() + '。\r\n';
    text += target.name() + targetSp + '感到很不自在。';
    break;

  case 'RELEASE ENERGY':  // RELEASE ENERGY
    text = user.name() + userSp + '与朋友们集结在一起，\r\n';
    text += '释放出终极一击！';
    break;

  case 'VERTIGO': // OMORI VERTIGO
    if(target.index() <= unitLowestIndex) {
      text = user.name() + userSp + '使敌人眼前一阵天旋地转！\r\n';
      text += '所有敌人的攻击下降了！\r\n';
    }
    text += hpDamageText;
    break;

  case 'CRIPPLE': // OMORI CRIPPLE
    if(target.index() <= unitLowestIndex) {
      text = user.name() + '把敌人打得半残！\r\n';
      text += "所有敌人的速度下降了。\r\n";
    }
    text += hpDamageText;
    break;

  case 'SUFFOCATE': // OMORI SUFFOCATE
    if(target.index() <= unitLowestIndex) {
      text = user.name() + '掐住了敌人的咽喉！\r\n';
      text += '所有敌人都感觉喘不过气来。\r\n';
      text += "所有敌人的防御下降了。\r\n";
    }
    text += hpDamageText;
    break;

  //AUBREY//
  case 'PEP TALK':  // PEP TALK
    text = user.name() + userSp + '给' + targetSp + target.name() + '打气！\r\n';
    if(!target._noEffectMessage) {
      if(target.isStateAffected(8)) {text += target.name() + targetSp + '陷入了癫狂！！！';}
      else if(target.isStateAffected(7)) {text += target.name() + targetSp + '变得狂喜了！！';}
      else if(target.isStateAffected(6)) {text += target.name() + targetSp + '变得开心了！';}
    }
    else {text += parseNoEffectEmotion(target.name(), "更开心了！")}
    break;

  case 'TEAM SPIRIT':  // TEAM SPIRIT
    text = user.name() + userSp + '给' + targetSp + target.name() + '打气！\r\n';
    if(!target._noEffectMessage) {
      if(target.isStateAffected(8)) {text += target.name() + targetSp + '陷入了癫狂！！！\r\n';}
      else if(target.isStateAffected(7)) {text += target.name() + targetSp + '变得狂喜了！！\r\n';}
      else if(target.isStateAffected(6)) {text += target.name() + targetSp + '变得开心了！\r\n';}
    }
    else {text += parseNoEffectEmotion(target.name(), "更开心了！\r\n")}

    if(!user._noEffectMessage) {
      if(user.isStateAffected(8)) {text += user.name() + userSp + '陷入了癫狂！！！';}
      else if(user.isStateAffected(7)) {text += user.name() + userSp + '变得狂喜了！！';}
      else if(user.isStateAffected(6)) {text += user.name() + userSp + '变得开心了！';}
    }
    else {text += parseNoEffectEmotion(user.name(), "更开心了！\r\n")}
    break;

  case 'HEADBUTT':  // HEADBUTT
    text = user.name() + userSp + '给了' + targetSp + target.name() + targetSp + '一记头槌！\r\n';
    text += hpDamageText;
    break;

  case 'HOMERUN': // Homerun
    text = user.name() + userSp + '把' + targetSp + target.name() + '\r\n';
    text += '打得落花流水！\r\n';
    text += hpDamageText;
    break;

  case 'THROW': // Wind-up Throw
    text = user.name() + userSp + '扔出了她的武器！';
    break;

  case 'POWER HIT': //Power Hit
    text = user.name() + userSp + '全力砸向' + targetSp + target.name() + '！\r\n';
    if(!target._noStateMessage) {text += target.name() + targetSp + '的防御下降了。\r\n';}
    else {text += parseNoStateChange(target.name(), "防御", "更低了！\r\n")}
    text += hpDamageText;
    break;

  case 'LAST RESORT': // Last Resort
    text = user.name() + userSp + '使尽浑身解数，不顾一切地\r\n';
    text += '攻向' + targetSp + target.name() + '！\r\n';
    text += hpDamageText;
    break;

  case 'COUNTER ATTACK': // Counter Attack
    text = user.name() + userSp + '举起了棒球棍！';
    break;

  case 'COUNTER HEADBUTT': // Counter Headbutt
    text = user.name() + userSp + '把力量集中在额头！';
    break;

  case 'COUNTER ANGRY': //Counter Angry
    text = user.name() + userSp + '严阵以待！';
    break;

  case 'LOOK OMORI 1':  // Look at Omori 2
    text = 'OMORI 没有注意到' + userSp + user.name() + userSp + '，于是\r\n';
    text += user.name() + userSp + '再次发动攻击！\r\n';
    text += hpDamageText;
    break;

  case 'LOOK OMORI 2': // Look at Omori 2
    text = 'OMORI 还是没有注意到' + userSp + user.name() + userSp + '，于是\r\n';
    text += user.name() + userSp + '攻击得更使劲了！\r\n';
    text += hpDamageText;
    break;

  case 'LOOK OMORI 3': // Look at Omori 3
    text = 'OMORI 终于注意到了' + userSp + user.name() + userSp + '！\r\n';
    text += user.name() + userSp + '开心地挥舞起了棒球棍！\r\n';
    text += hpDamageText;
    break;

  case 'LOOK KEL 1':  // Look at Kel 1
    text = '凯使劲怂恿奥布里！\r\n';
    text += target.name() + "变得生气了！";
    break;

  case 'LOOK KEL 2': // Look at Kel 2
   text = '凯使劲怂恿奥布里！\r\n';
   text += '凯和奥布里的攻击上升了！\r\n';
   var AUBREY = $gameActors.actor(2);
   var KEL = $gameActors.actor(3);
   if(AUBREY.isStateAffected(14) && KEL.isStateAffected(14)) {text += '凯和奥布里变得生气了！';}
   else if(AUBREY.isStateAffected(14) && KEL.isStateAffected(15)) {
    text += '凯变得愤怒了！！\r\n';
    text += '奥布里变得生气了！';
   }
   else if(AUBREY.isStateAffected(15) && KEL.isStateAffected(14)) {
    text += '凯变得生气了！\r\n';
    text += '奥布里变得愤怒了！！';
   }
   else if(AUBREY.isStateAffected(15) && KEL.isStateAffected(15)) {text += '凯和奥布里变得愤怒了！！';}
   else {text += '凯和奥布里变得生气了！';}
   break;

  case 'LOOK HERO':  // LOOK AT HERO 1
    text = '英雄让奥布里集中注意力！\r\n';
    if(target.isStateAffected(6)) {text += target.name() + targetSp + "变得开心了！\r\n"}
    else if(target.isStateAffected(7)) {text += target.name() + targetSp + "变得狂喜了！！\r\n"}
    text += user.name() + userSp + '的防御上升了！';
    break;

  case 'LOOK HERO 2': // LOOK AT HERO 2
    text = '英雄给奥布里打气！\r\n';
    text += '奥布里的防御上升了！！\r\n';
    if(target.isStateAffected(6)) {text += target.name() + targetSp + "变得开心了！\r\n"}
    else if(target.isStateAffected(7)) {text += target.name() + targetSp + "变得狂喜了！！\r\n"}
    if(!!$gameTemp._statsState[0]) {
      var absHp = Math.abs($gameTemp._statsState[0] - $gameActors.actor(2).hp);
      if(absHp > 0) {text += `奥布里回复了 ${absHp} 点心心！\r\n`;}
    }
    if(!!$gameTemp._statsState[1]) {
      var absMp = Math.abs($gameTemp._statsState[1] - $gameActors.actor(2).mp);
      if(absMp > 0) {text += `奥布里回复了 ${absMp} 点体力……`;}
    }
    $gameTemp._statsState = undefined;
    break;

  case 'TWIRL': // ATTACK
    text = user.name() + userSp + '攻击了' + targetSp + target.name() + '！\r\n';
    text += hpDamageText;
    break;

  //KEL//
    case 'ANNOY':  // ANNOY
      text = user.name() + userSp + '让' + targetSp + target.name() + targetSp + '很恼火！\r\n';
      if(!target._noEffectMessage) {
        if(target.isStateAffected(14)) {text += target.name() + targetSp + '变得生气了！';}
        else if(target.isStateAffected(15)) {text += target.name() + targetSp + '变得愤怒了！！';}
        else if(target.isStateAffected(16)) {text += target.name() + targetSp + '陷入狂怒！！！';}
      }
      else {text += parseNoEffectEmotion(target.name(), "更生气了！")}
      break;

    case 'REBOUND':  // REBOUND
      text = user.name() + userSp + '的球到处弹来弹去！';
      break;

    case 'FLEX':  // FLEX
      text = user.name() + userSp + '十分拿手地秀起了肌肉！\r\n';
      text += user.name() + userSp + "的命中率上升了！\r\n"
      break;

    case 'JUICE ME': // JUICE ME
      text = user.name() + userSp + '把手中的椰子砸向' + targetSp + target.name() + '！\r\n'
      var absMp = Math.abs(mpDam);
      if(absMp > 0) {
        text += `${target.name()}${targetSp}回复了 ${absMp} 点体力……\r\n`
      }
      text += hpDamageText;
      break;

    case 'RALLY': // RALLY
      text = user.name() + userSp + '的打气让大家精神抖擞！\r\n';
      if(user.isStateAffected(7)) {text += user.name() + "变得狂喜了！！\r\n"}
      else if(user.isStateAffected(6)) {text += user.name() + "变得开心了！\r\n"}
      text += "大家获得了能量！\r\n"
      for(let actor of $gameParty.members()) {
        if(actor.name() === "凯") {continue;}
        var result = actor.result();
        if(result.mpDamage >= 0) {continue;}
        var absMp = Math.abs(result.mpDamage);
        var actorSp = actor.name() === "OMORI" ? " " : "";
        text += `${actor.name()}${actorSp}恢复了 ${absMp} 点体力……\r\n`
      }
      break;

    case 'SNOWBALL': // SNOWBALL
      text = user.name() + userSp + '向' + targetSp + target.name() + '\r\n';
      text += '扔雪球！\r\n';
      if(!target._noEffectMessage) {text += target.name() + "变得悲伤了。\r\n"}
      else {text += parseNoEffectEmotion(target.name(), "更悲伤了！\r\n")}
      text += hpDamageText;
      break;

    case 'TICKLE': // TICKLE
      text = user.name() + userSp + '给' + targetSp + target.name() + targetSp + '挠痒痒！\r\n'
      text += `${target.name()}${targetSp}放松了警惕！`
      break;

    case 'RICOCHET': // RICOCHET
     text = user.name() + userSp + '表演了一个花式球技！\r\n';
     text += hpDamageText;
     break;

    case 'CURVEBALL': // CURVEBALL
     text = user.name() + userSp + '发了个曲线球……\r\n';
     text += target.name() + targetSp + '被球的轨迹弄晕了！\r\n';
     switch($gameTemp._randomState) {
       case 6:
         if(!target._noEffectMessage) {text += target.name() + targetSp + "变得开心了！\r\n"}
         else {text += parseNoEffectEmotion(target.name(), "更开心了！\r\n")}
         break;
      case 14:
        if(!target._noEffectMessage) {text += target.name() + "变得生气了！\r\n"}
        else {text += parseNoEffectEmotion(target.name(), "更生气了！\r\n")}
        break;
      case 10:
        if(!target._noEffectMessage) {text += target.name() + "变得悲伤了。\r\n"}
        else {text += parseNoEffectEmotion(target.name(), "更悲伤了！\r\n")}
        break;

     }
     text += hpDamageText;
     break;

    case 'MEGAPHONE': // MEGAPHONE
      if(target.index() <= unitLowestIndex) {text = user.name() + userSp + '四处骚扰，把大家弄得心烦气躁！\r\n';}
      if(target.isStateAffected(16)) {text += target.name() + targetSp + '陷入了狂怒！！！\r\n'}
      else if(target.isStateAffected(15)) {text += target.name() + targetSp + '变得愤怒了！！\r\n'}
      else if(target.isStateAffected(14)) {text += target.name() + targetSp + '变得生气了！\r\n'}
      break;

    case 'DODGE ATTACK': // DODGE ATTACK
      text = user.name() + userSp + '做好了闪避的准备！';
      break;

    case 'DODGE ANNOY': // DODGE ANNOY
      text = user.name() + userSp + '开始挑逗敌人！';
      break;

    case 'DODGE TAUNT': // DODGE TAUNT
      text = user.name() + userSp + '开始嘲讽敌人！\r\n';
      text += "所有敌人的命中率下降了！"
      break;

    case 'PASS OMORI':  // KEL PASS OMORI
      text = 'OMORI 在走神，被凯的球临头一击！\r\n';
      text += 'OMORI 受到了 1 点伤害！';
      break;

    case 'PASS OMORI 2': //KEL PASS OMORI 2
      text = 'OMORI 接住了凯的球！\r\n';
      text += 'OMORI 把球扔向\r\n';
      text += target.name() + '！\r\n';
      var OMORI = $gameActors.actor(1);
      if(OMORI.isStateAffected(6)) {text += "OMORI 变得开心了！\r\n"}
      else if(OMORI.isStateAffected(7)) {text += "OMORI 变得狂喜了！！\r\n"}
      text += hpDamageText;
      break;

    case 'PASS AUBREY':  // KEL PASS AUBREY
      text = '奥布里瞄准敌人，打出了一记强力扣杀！\r\n';
      text += hpDamageText;
      break;

    case 'PASS HERO':  // KEL PASS HERO
      if(target.index() <= unitLowestIndex) {text = user.name() + userSp + '一记扣球击中了敌人！\r\n';}
      text += hpDamageText;
      break;

    case 'PASS HERO 2':  // KEL PASS HERO
      if(target.index() <= unitLowestIndex) {
        text = user.name() + userSp + '一记优雅的扣球击中了敌人！\r\n';
        text += "所有敌人的攻击下降了！\r\n";
      }
      text += hpDamageText;
      break;

    //HERO//
    case 'MASSAGE':  // MASSAGE
      text = user.name() + userSp + '给' + targetSp + target.name() + targetSp + '按摩！\r\n';
      if(!!target.isAnyEmotionAffected(true)) {
        text += target.name() + targetSp + '冷静了下来……';
      }
      else {text += "并没有效果……"}
      break;

    case 'COOK':  // COOK
      text = user.name() + userSp + '为' + targetSp + target.name() + targetSp + '手工制作了一块曲奇饼干！';
      break;

    case 'FAST FOOD': //FAST FOOD
      text = user.name() + userSp + '为' + targetSp + target.name() + targetSp + '准备了一顿快餐。';
      break;

    case 'JUICE': // JUICE
      text = user.name() + userSp + '递给' + targetSp + target.name() + targetSp + '一些喝的。';
      break;

    case 'SMILE':  // SMILE
      text = user.name() + userSp + '对着' + targetSp + target.name() + targetSp + '微笑！\r\n';
      if(!target._noStateMessage) {text += target.name() + targetSp + '的攻击下降了。';}
      else {text += parseNoStateChange(target.name(), "攻击", "更低了！\r\n")}
      break;

    case 'DAZZLE':
      text = user.name() + userSp + '对着' + targetSp + target.name() + targetSp + '微笑！\r\n';
      if(!target._noStateMessage) {text += target.name() + targetSp + '的攻击下降了。\r\n';}
      else {text += parseNoStateChange(target.name(), "攻击", "更低了！\r\n")}
      if(!target._noEffectMessage) {
        text += target.name() + targetSp + '变得开心了！';
      }
      else {text += parseNoEffectEmotion(target.name(), "更开心了！")}
      break;
    case 'TENDERIZE': // TENDERIZE
      text = user.name() + userSp + '给\r\n';
      text += target.name() + targetSp + '激烈地按摩！\r\n';
      if(!target._noStateMessage) {text += target.name() + targetSp + '的防御下降了！\r\n';}
      else {text += parseNoStateChange(target.name(), "防御", "更低了！\r\n")}
      text += hpDamageText;
      break;

    case 'SNACK TIME':  // SNACK TIME
      text = user.name() + userSp + '为大家手工制作了曲奇饼干！';
      break;

    case 'TEA TIME': // TEA TIME
      text = user.name() + userSp + '端出茶点，让' + targetSp + target.name() + targetSp + '休息一下。\r\n';
      text += target.name() + targetSp + '感到精神焕发！\r\n';
      if(result.hpDamage < 0) {
        var absHp = Math.abs(result.hpDamage);
        text += `${target.name() + targetSp}回复了 ${absHp} 点心心！\r\n`
      }
      if(result.mpDamage < 0) {
        var absMp = Math.abs(result.mpDamage);
        text += `${target.name() + targetSp}回复了 ${absMp} 点体力……\r\n`
      }
      break;

    case 'SPICY FOOD': // SPICY FOOD
      text = user.name() + userSp + '烹饪了一些辛辣食物！\r\n';
      text += hpDamageText;
      break;

    case 'SINGLE TAUNT': // SINGLE TAUNT
      text = user.name() + userSp + '吸引了' + targetSp + target.name() + targetSp + '的\r\n';
      text += '注意力。';
      break;

    case 'TAUNT':  // TAUNT
      text = user.name() + userSp + '吸引了敌人的注意力。';
      break;

    case 'SUPER TAUNT': // SUPER TAUNT
      text = user.name() + userSp + '吸引了敌人的注意力。\r\n';
      text += user.name() + userSp + '做好了格挡敌人攻击的准备。';
      break;

    case 'ENCHANT':  // ENCHANT
      text = user.name() + '用微笑吸引了敌人的\r\n';
      text += '注意力。\r\n';
      if(!target._noEffectMessage) {text += target.name() + targetSp + "变得开心了！";}
      else {text += parseNoEffectEmotion(target.name(), "更开心了！")}
      break;

    case 'MENDING': //MENDING
      text = user.name() + userSp + '为' + targetSp + target.name() + targetSp + '准备餐饮。\r\n';
      text += user.name() + userSp + '成为了' + targetSp + target.name() + targetSp + '的私人厨师！';
      break;

    case 'SHARE FOOD': //SHARE FOOD
      if(target.name() !== user.name()) {
        text = user.name() + userSp + '把食物分享给' + targetSp + target.name() + '！'
      }
      break;

    case 'CALL OMORI':  // CALL OMORI
      text = user.name() + userSp + '给 OMORI 打信号！\r\n';
      if(!!$gameTemp._statsState[0]) {
        var absHp = Math.abs($gameTemp._statsState[0] - $gameActors.actor(1).hp);
        if(absHp > 0) {text += `OMORI 回复了 ${absHp} 点心心！\r\n`;}
      }
      if(!!$gameTemp._statsState[1]) {
        var absMp = Math.abs($gameTemp._statsState[1] - $gameActors.actor(1).mp);
        if(absMp > 0) {text += `OMORI 回复了 ${absMp} 点体力……`;}
      }
      $gameTemp._statsState = undefined;
      break;

    case 'CALL KEL':  // CALL KEL
      text = user.name() + userSp + '让凯鼓足干劲！\r\n';
      if(!!$gameTemp._statsState[0]) {
        var absHp = Math.abs($gameTemp._statsState[0] - $gameActors.actor(3).hp);
        if(absHp > 0) {text += `凯回复了 ${absHp} 点心心！\r\n`;}
      }
      if(!!$gameTemp._statsState[1]) {
        var absMp = Math.abs($gameTemp._statsState[1] - $gameActors.actor(3).mp);
        if(absMp > 0) {text += `凯回复了 ${absMp} 点体力……`;}
      }
      break;

    case 'CALL AUBREY':  // CALL AUBREY
      text = user.name() + userSp + '给奥布里加油！\r\n';
      if(!!$gameTemp._statsState[0]) {
        var absHp = Math.abs($gameTemp._statsState[0] - $gameActors.actor(2).hp);
        if(absHp > 0) {text += `奥布里回复了 ${absHp} 点心心！\r\n`;}
      }
      if(!!$gameTemp._statsState[1]) {
        var absMp = Math.abs($gameTemp._statsState[1] - $gameActors.actor(2).mp);
        if(absMp > 0) {text += `奥布里回复了 ${absMp} 点体力……`;}
      }
      break;

    //PLAYER//
    case 'CALM DOWN':  // PLAYER CALM DOWN
      if(item.id !== 1445) {text = user.name() + userSp + '冷静了下来。\r\n';} // Process if Calm Down it's not broken;
      if(Math.abs(hpDam) > 0) {text += user.name() + userSp + '回复了 ' + Math.abs(hpDam) + ' 点心心！';}
      break;

    case 'FOCUS':  // PLAYER FOCUS
      text = user.name() + userSp + '集中了精神。';
      break;

    case 'PERSIST':  // PLAYER PERSIST
      text = user.name() + userSp + '坚持了下去。';
      break;

    case 'OVERCOME':  // PLAYER OVERCOME
      text = user.name() + userSp + '克服了困难。';
      break;

  //UNIVERSAL//
    case 'FIRST AID':  // FIRST AID
      text = user.name() + userSp + '开始照料' + targetSp + target.name() + '！\r\n';
      text += target.name() + targetSp + '回复了 ' + Math.abs(target._result.hpDamage) + ' 点心心！';
      break;

    case 'PROTECT':  // PROTECT
      text = user.name() + userSp + '站在' + userSp + target.name() + userSp + '前！';
      break;

    case 'GAURD': // GAURD
      text = user.name() + userSp + '做好了格挡攻击的准备。';
      break;

  //FOREST BUNNY//
    case 'BUNNY ATTACK': // FOREST BUNNY ATTACK
      text = user.name() + '咬了' + targetSp + target.name() + '一口！\r\n';
      text += hpDamageText;
      break;

    case 'BUNNY NOTHING': // BUNNY DO NOTHING
      text = user.name() + '到处蹦蹦跳跳！';
      break;

    case 'BE CUTE':  // BE CUTE
      text = user.name() + '朝着' + targetSp + target.name() + targetSp + '眨了眨眼！\r\n';
      text += target.name() + targetSp + '的攻击下降了……';
      break;

    case 'SAD EYES': //SAD EYES
      text = user.name() + '悲伤地望着' + targetSp + target.name() + '。\r\n';
      if(!target._noEffectMessage) {text += target.name() + targetSp + '变得悲伤了。';}
      else {text += parseNoEffectEmotion(target.name(), "更悲伤了！")}
      break;

  //FOREST BUNNY?//
    case 'BUNNY ATTACK2': // BUNNY? ATTACK
      text = user.name() + '咬了' + targetSp + target.name() + '一口？\r\n';
      text += hpDamageText;
      break;

    case 'BUNNY NOTHING2':  // BUNNY? DO NOTHING
      text = user.name() + '到处蹦蹦跳跳？';
      break;

    case 'BUNNY CUTE2':  // BE CUTE?
      text = user.name() + '朝着' + targetSp + target.name() + targetSp + '眨了眨眼？\r\n';
      text += target.name() + targetSp + '的攻击下降了？';
      break;

    case 'SAD EYES2': // SAD EYES?
      text = user.name() + '悲伤地望着' + targetSp + target.name() + '……\r\n';
      if(!target._noEffectMessage) {text += target.name() + targetSp + '变得悲伤了？';}
      else {text += parseNoEffectEmotion(target.name(), "更悲伤了！")}
      break;

    //SPROUT MOLE//
    case 'SPROUT ATTACK':  // SPROUT MOLE ATTACK
      text = user.name() + '撞了' + targetSp + target.name() + targetSp + '一下！\r\n';
      text += hpDamageText;
      break;

    case 'SPROUT NOTHING':  // SPROUT NOTHING
      text = user.name() + '到处翻滚。';
      break;

    case 'RUN AROUND':  // RUN AROUND
      text = user.name() + '到处乱跑！';
      break;

    case 'HAPPY RUN AROUND': //HAPPY RUN AROUND
      text = user.name() + '精力十足地到处乱跑！';
       break;

    //MOON BUNNY//
    case 'MOON ATTACK':  // MOON BUNNY ATTACK
      text = user.name() + '撞向' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'MOON NOTHING':  // MOON BUNNY NOTHING
      text = user.name() + '在发呆。'; // 注：原文 spacing out 是个双关（月球兔兔），不知道有没有更好的翻译
      break;

    case 'BUNNY BEAM':  // BUNNY BEAM
      text = user.name() + '发射了激光！\r\n';
      text += hpDamageText;
      break;

    //DUST BUNNY//
    case 'DUST NOTHING':  // DUST NOTHING
      text = user.name() + '正在努力避免\r\n';
      text += '被吹飞。';
      break;

    case 'DUST SCATTER':  // DUST SCATTER
      text = user.name() + '炸开了！';
      break;

    //U.F.O//
    case 'UFO ATTACK':  // UFO ATTACK
      text = user.name() + userSp + '向' + targetSp + target.name() + targetSp + '迎面撞来！\r\n';
      text += hpDamageText;
      break;

    case 'UFO NOTHING':  // UFO NOTHING
      text = user.name() + userSp + '失去了兴致。';
      break;

    case 'STRANGE BEAM':  // STRANGE BEAM
      text = user.name() + userSp + '闪烁着奇怪的光！\r\n';
      text += target.name() + targetSp + "被灌输了某种随机的情绪！"
      break;

    case 'ORANGE BEAM':  // ORANGE BEAM
      text = user.name() + userSp + '发射了橙色的激光！\r\n';
      text += hpDamageText;
      break;

    //VENUS FLYTRAP//
    case 'FLYTRAP ATTACK':  // FLYTRAP ATTACK
      text = user.name() + '向' + targetSp + target.name() + targetSp + '袭来！\r\n';
      text += hpDamageText;
      break;

    case 'FLYTRAP NOTHING':  // FLYTRAP NOTHING
      text = user.name() + '在啃咬空气。';
      break;

    case 'FLYTRAP CRUNCH':  // FLYTRAP
      text = user.name() + '在啃咬' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    //WORMHOLE//
    case 'WORM ATTACK':  // WORM ATTACK
      text = user.name() + '狠狠拍打' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'WORM NOTHING':  // WORM NOTHING
      text = user.name() + '扭动着身体……';
      break;

    case 'OPEN WORMHOLE':  // OPEN WORMHOLE
      text = user.name() + '打开了一个虫洞！';
      break;

    //MIXTAPE//
    case 'MIXTAPE ATTACK':  // MIXTAPE ATTACK
      text = user.name() + '狠狠拍打' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'MIXTAPE NOTHING':  // MIXTAPE NOTHING
      text = user.name() + '正在解开带子上的结。';
      break;

    case 'TANGLE':  // TANGLE
      text = target.name() + targetSp + '被' + user.name() + '的带子缠住了！\r\n';
      text += target.name() + targetSp + '的速度下降了……';
      break;

    //DIAL-UP//
    case 'DIAL ATTACK':  // DIAL ATTACK
      text = user.name() + '很慢。\r\n';
      text += `${target.name() + targetSp}被气出了内伤！\r\n`;
      text += hpDamageText;
      break;

    case 'DIAL NOTHING':  // DIAL NOTHING
      text = user.name() + '正在缓冲中……';
      break;

    case 'DIAL SLOW':  // DIAL SLOW
      text = user.name() + '变得更更慢慢慢慢慢了了了。\r\n';
      text += '所有人的速度都下降了……';
      break;

    //DOOMBOX//
    case 'DOOM ATTACK':  // DOOM ATTACK
      text = user.name() + '猛地撞向' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'DOOM NOTHING':  // DOOM NOTHING
      text = user.name() + '正在调整无线电。';
      break;

    case 'BLAST MUSIC':  // BLAST MUSIC
      text = user.name() + '开始播放劲爆的音乐！';
      break;

    //SHARKPLANE//
    case 'SHARK ATTACK':  // SHARK PLANE
      text = user.name() + '冲向' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'SHARK NOTHING':  // SHARK NOTHING
      text = user.name() + '正在剔牙。';
      break;

    case 'OVERCLOCK ENGINE':  // OVERCLOCK ENGINE
      text = user.name() + '的引擎开始加速！\r\n';
      if(!target._noStateMessage) {
        text += user.name() + '的速度上升了！';
      }
      else {text += parseNoStateChange(user.name(), "速度", "更高了！")}
      break;

    case 'SHARK CRUNCH':  // SHARK
        text = user.name() + '在啃咬' + targetSp + target.name() + '！\r\n';
        text += hpDamageText;
        break;

    //SNOW BUNNY//
    case 'SNOW BUNNY ATTACK':  // SNOW ATTACK
      text = user.name() + '把雪踢向' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'SNOW NOTHING':  // SNOW NOTHING
      text = user.name() + '在爽爽地放松自己。'; // 注：原文 Chilling out，双关
      break;

    case 'SMALL SNOWSTORM':  // SMALL SNOWSTORM
      text = user.name() + ' shoves snow at everyone,\r\n';
      text += 'causing the world\'s tiniest snowstorm!';
      break;

    //SNOW ANGEL//
    case 'SNOW ANGEL ATTACK': //SNOW ANGEL ATTACK
      text = user.name() + '用冰冷的双手\r\n触摸' + targetSp + target.name() + '。';
      text += hpDamageText;
      break;

    case 'UPLIFTING HYMN': //UPLIFTING HYMN
      if(target.index() <= unitLowestIndex) {
        text = user.name() + '唱了一首优美的歌……\r\n';
        text += '大家都变得开心了！';
      }
      target._noEffectMessage = undefined;
      break;

    case 'PIERCE HEART': //PIERCE HEART
      text = user.name() + '刺穿了' + targetSp + target.name() + targetSp + '的心。\r\n';
      text += hpDamageText;
      break;

    //SNOW PILE//
    case 'SNOW PILE ATTACK': //SNOW PILE ATTACK
      text = user.name() + '朝着' + targetSp + target.name() + targetSp + '扔雪！\r\n';
      text += hpDamageText;
      break;

    case 'SNOW PILE NOTHING': //SNOW PILE NOTHING
      text = user.name() + '冷若冰霜。';
      break;

    case 'SNOW PILE ENGULF': //SNOW PILE ENGULF
      text = user.name() + '吞噬了' + targetSp + target.name() + '！\r\n';
      text += target.name() + '的速度下降了。\r\n';
      text += target.name() + '的防御下降了。';
      break;

    case 'SNOW PILE MORE SNOW': //SNOW PILE MORE SNOW
      text = user.name() + '往自己身上堆雪！\r\n';
      text += user.name() + '的攻击上升了！\r\n';
      text += user.name() + '的防御上升了！';
      break;

    //CUPCAKE BUNNY//
    case 'CCB ATTACK': //CUP CAKE BUNNY ATTACK
      text = user.name() + '撞向' + targetSp + target.name() + '。\r\n';
      text += hpDamageText;
      break;

    case 'CCB NOTHING': //CUP CAKE BUNNY NOTHING
      text = user.name() + '在原地上下蹦跳。';
      break;

    case 'CCB SPRINKLES': //CUP CAKE BUNNY SPRINKLES
      text = user.name() + '往' + targetSp + target.name() + targetSp + '身上\r\n';
      text += '洒巧克力米。\r\n';
      if(!target._noEffectMessage) {text += target.name() + '变得开心了！\r\n';}
      else {text += parseNoEffectEmotion(target.name(), "更开心了！\r\n")}
      text += target.name() + "的属性上升了！"
      break;

    //MILKSHAKE BUNNY//
    case 'MSB ATTACK': //MILKSHAKE BUNNY ATTACK
      text = user.name() + '把奶昔倒在了' + targetSp + target.name() + targetSp + '身上。\r\n';
      text += hpDamageText;
      break;

    case 'MSB NOTHING': //MILKSHAKE BUNNY NOTHING
      text = user.name() + '在原地跑圈圈。';
      break;

    case 'MSB SHAKE': //MILKSHAKE BUNNY SHAKE
      text = user.name() + '开始剧烈晃动！\r\n';
      text += '奶昔飞溅得到处都是！';
      break;

    //PANCAKE BUNNY//
    case 'PAN ATTACK': //PANCAKE BUNNY ATTACK
      text = user.name() + '咬了' + targetSp + target.name() + targetSp + '一口。\r\n';
      text += hpDamageText;
      break;

    case 'PAN NOTHING': //PANCAKE BUNNY NOTHING
      text = user.name() + '表演了一个后空翻！\r\n';
      text += '真有才华！';
      break;

    //STRAWBERRY SHORT SNAKE//
    case 'SSS ATTACK': //STRAWBERRY SHORT SNAKE ATTACK
      text = user.name() + '把獠牙插入' + targetSp + target.name() + targetSp + '的身体。\r\n';
      text += hpDamageText;
      break;

    case 'SSS NOTHING': //STRAWBERRY SHORT SNAKE NOTHING
      text = user.name() + '发出嘶嘶声。';
      break;

    case 'SSS SLITHER': //STRAWBERRY SHORT SNAKE SLITHER
      text = user.name() + '欢快地四处滑行！\r\n';
      if(!user._noEffectMessage) {text += user.name() + '变得开心了！';}
      else {text += parseNoEffectEmotion(user.name(), "更开心了！")}
      break;

    //PORCUPIE//
    case 'PORCUPIE ATTACK': //PORCUPIE ATTACK
      text = user.name() + '戳了' + targetSp + target.name() + targetSp + '一下。\r\n';
      text += hpDamageText;
      break;

    case 'PORCUPIE NOTHING': //PORCUPIE NOTHING
      text = user.name() + '四处嗅探。';
      break;

    case 'PORCUPIE PIERCE': //PORCUPIE PIERCE
      text = user.name() + '刺穿了' + targetSp + target.name() + targetSp + '的身体！\r\n';
      text += hpDamageText;
      break;

    //BUN BUNNY//
    case 'BUN ATTACK': //BUN ATTACK
      text = user.name() + '用面包狠撞' + targetSp + target.name() + targetSp + '！\r\n';
      text += hpDamageText;
      break;

    case 'BUN NOTHING': //BUN NOTHING
      text = user.name() + '在四处闲逛。'; // 注：Loafing around，双关（a loaf of bread）
      break;

    case 'BUN HIDE': //BUN HIDE
      text = user.name() + '躲在自己的面包下面。';
      break;

    //TOASTY//
    case 'TOASTY ATTACK': //TOASTY ATTACK
      text = user.name() + '冲向' + targetSp + target.name() + '。\r\n';
      text += hpDamageText;
      break;

    case 'TOASTY NOTHING': //TOASTY NOTHING
      text = user.name() + '在抠鼻子。';
      break;

    case 'TOASTY RILE': //TOASTY RILE
      if(target.index() <= unitLowestIndex) {
        text = user.name() + '发表了一番富有争议性的演讲！\r\n';
        text += '大家都变得愤怒了！';
      }
      target._noEffectMessage = undefined;
      break;

    //SOURDOUGH//
    case 'SOUR ATTACK': //SOURDOUGH ATTACK
      text = user.name() + '踩到了' + targetSp + target.name() + targetSp + '的脚趾头！\r\n';
      text += hpDamageText;
      break;

    case 'SOUR NOTHING': //SOURDOUGH NOTHING
      text = user.name() + '正在踢土。';
      break;

    case 'SOUR BAD WORD': //SOURDOUGH BAD WORD
      text = '天啊！' + user.name() + '说了一句脏话！\r\n';
      text += hpDamageText;
      break;

    //SESAME//
    case 'SESAME ATTACK': //SESAME ATTACK
      text = user.name() + '把种子撒向' + targetSp + target.name() + '。\r\n';
      text += hpDamageText;
      break;

    case 'SESAME NOTHING': //SESAME Nothing
      text = user.name() + '正在挠头。';
      break;

    case 'SESAME ROLL': //SESAME BREAD ROLL
      if(target.index() <= unitLowestIndex) {
        text = user.name() + '到处翻滚撞人！\r\n';
      }
      text += hpDamageText;
      break;

    //CREEPY PASTA//
    case 'CREEPY ATTACK': //CREEPY ATTACK
      text = user.name() + '让' + targetSp + target.name() + targetSp + '感觉\r\n';
      text += '很不安。\r\n';
      text += hpDamageText;
      break;

    case 'CREEPY NOTHING': //CREEPY NOTHING
      text = user.name() + '什么也没有做……\r\n令人不寒而栗！';
      break;

    case 'CREEPY SCARE': //CREEPY SCARE
      text = user.name() + '向所有人展示了他们\r\n';
      text += '最可怕的噩梦！';
      break;

    //COPY PASTA//
    case 'COPY ATTACK': //COPY ATTACK
      text = user.name() + '撞向' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'DUPLICATE': //DUPLICATE
      text = user.name() + '复制粘贴了自己！';
      break;

    //HUSH PUPPY//
    case 'HUSH ATTACK': //HUSH ATTACK
      text = user.name() + '冲向' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'HUSH NOTHING': //HUSH NOTHING
      text = user.name() + '试着吠叫……\r\n';
      text += '但是什么也没有发生……';
      break;

    case 'MUFFLED SCREAMS': //MUFFLED SCREAMS
      text = user.name() + '开始尖叫！\r\n';
      if(!target._noEffectMessage && target.name() !== "OMORI") {
        text += target.name() + '感到害怕。';
      }
      else {text += parseNoEffectEmotion(target.name(), "害怕")}
      break;

    //GINGER DEAD MAN//
    case 'GINGER DEAD ATTACK': //GINGER DEAD MAN ATTACK
      text = user.name() + '刺向' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'GINGER DEAD NOTHING': //GINGER DEAD MAN DO NOTHING
      text = user.name() + '的头掉了下来……\r\n';
      text += user.name() + '把头放回了原位。';
      break;

    case 'GINGER DEAD THROW HEAD': //GINGER DEAD MAN THROW HEAD
      text = user.name() + '摘下自己的头扔向\r\n';
      text +=  target.name() + '！\r\n';
      text += hpDamageText;
      break;

    //LIVING BREAD//
    case 'LIVING BREAD ATTACK': //LIVING BREAD ATTACK
      text = user.name() + '挥向' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'LIVING BREAD NOTHING': //LIVING BREAD ATTACK
      text = user.name() + `向${targetSp + target.name()}\r\n缓缓靠近！`;
      break;

    case 'LIVING BREAD BITE': //LIVING BREAD BITE
      text = user.name() + '咬了' + targetSp + target.name() + '一口！\r\n';
      text += hpDamageText;
      break;

    case 'LIVING BREAD BAD SMELL': //LIVING BREAD BAD SMELL
      text = user.name() + '闻起来很糟糕！\r\n';
      text += target.name() + targetSp + '的防御下降了！';
      break;

    //Bug Bunny//
    case 'BUG BUN ATTACK': //Bug Bun Attack
     text = user.name() + '挥向' + targetSp + target.name() + '！\r\n';
     text += hpDamageText;
     break;

    case 'BUG BUN NOTHING': //Bug Bun Nothing
      text = user.name() + '正在尝试倒立。';
      break;

    case 'SUDDEN JUMP': //SUDDEN JUMP
      text = user.name() + '朝着' + targetSp + target.name() + targetSp + '扑了过来！\r\n';
      text += hpDamageText;
      break;

    case 'SCUTTLE': //Bug Bun Scuttle
      text = user.name() + '快乐地四处乱窜。\r\n';
      text += '真的好可爱！\r\n';
      if(!user._noEffectMessage) {text += user.name() + '变得开心了！';}
      else {text += parseNoEffectEmotion(user.name(), "更开心了！")}
      break;

    //RARE BEAR//
    case 'BEAR ATTACK': //BEAR ATTACK
      text = user.name() + '的爪子挥向了' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'BEAR HUG': //BEAR HUG
      text = user.name() + '给了' + targetSp + target.name() + targetSp + '一个熊抱！\r\n';
      text += target.name() + '的速度下降了！\r\n';
      text += hpDamageText;
      break;

    case 'ROAR': //ROAR
      text = user.name() + '发出了震耳欲聋的咆哮！\r\n';
      if(!user._noEffectMessage) {text += user.name() + '变得生气了！';}
      else {text += parseNoEffectEmotion(user.name(), "更生气了！")}
      break;

    //POTTED PALM//
    case 'PALM ATTACK': //PALM ATTACK
      text = user.name() + '扑向了' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'PALM NOTHING': //PALM NOTHING
      text = user.name() + '在盆里休息。';
      break;

    case 'PALM TRIP': //PALM TRIP
      text = target.name() + targetSp + '被' + user.name() + '的根部绊倒了。\r\n';
      text += hpDamageText + '。\r\n';
      text += target.name() + '的速度下降了。';
      break;

    case 'PALM EXPLOSION': //PALM EXPLOSION
      text = user.name() + '炸开了！';
      break;

    //SPIDER CAT//
    case  'SPIDER ATTACK': //SPIDER ATTACK
      text = user.name() + '咬了' + targetSp + target.name() + targetSp + '一口！\r\n';
      text += hpDamageText;
      break;

    case 'SPIDER NOTHING': //SPIDER NOTHING
      text = user.name() + '咳出了一个蜘蛛网交织成的球。';
      break;

    case 'SPIN WEB': //SPIN WEB
       text = user.name() + '朝着' + targetSp + target.name() + targetSp + '发射蜘蛛网！\r\n';
       text += target.name() + '的速度下降了。';
       break;

    //SPROUT MOLE?//
    case 'SPROUT ATTACK 2':  // SPROUT MOLE? ATTACK
      text = user.name() + '撞了' + targetSp + target.name() + targetSp + '一下？\r\n';
      text += hpDamageText;
      break;

    case 'SPROUT NOTHING 2':  // SPROUT MOLE? NOTHING
      text = user.name() + '到处翻滚？';
      break;

    case 'SPROUT RUN AROUND 2':  // SPROUT MOLE? RUN AROUND
      text = user.name() + '到处乱跑？';
      break;

    //HAROLD//
    case 'HAROLD ATTACK': //HAROLD ATTACK
      text = user.name() + '的剑向' + targetSp + target.name() + targetSp + '挥来！\r\n';
      text += hpDamageText;
      break;

    case 'HAROLD NOTHING': // HAROLD NOTHING
      text = user.name() + '摆正自己的头盔。';
      break;

    case 'HAROLD PROTECT': // HAROLD PROTECT
      text = user.name() + '做好防卫的准备。';
      break;

    case 'HAROLD WINK': //HAROLD WINK
      text = user.name() + '朝着' + targetSp + target.name() + targetSp + '眨了眨眼。\r\n';
      if(!target._noEffectMessage) {text += target.name() + '变得开心了！';}
      else {text += parseNoEffectEmotion(target.name(), "更开心了！")}
      break;

    //MARSHA//
    case 'MARSHA ATTACK': //MARSHA ATTACK
      text = user.name() + '抡起斧头向' + targetSp + target.name() + targetSp + '砍去！\r\n';
      text += hpDamageText;
      break;

    case 'MARSHA NOTHING': //MARSHA NOTHING
      text = user.name() + '摔了一跤。';
      break;

    case 'MARSHA SPIN': //MARSHA NOTHING
      text = user.name() + '开始自转，速度达到了音速！\r\n';
      text += hpDamageText;
      break;

    case 'MARSHA CHOP': //MARSHA CHOP
      text = user.name() + '把斧头挥向' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    //THERESE//
    case 'THERESE ATTACK': //THERESE ATTACK
      text = user.name() + '朝着' + targetSp + target.name() + targetSp + '射了一箭！\r\n';
      text += hpDamageText;
      break;

    case 'THERESE NOTHING': //THERESE NOTHING
      text = user.name() + '掉了一支箭在地上。';
      break;

    case 'THERESE SNIPE': //THERESE SNIPE
      text = user.name() + '瞄准' + targetSp + target.name() + targetSp + '的弱点射箭！\r\n';
      text += hpDamageText;
      break;

    case 'THERESE INSULT': //THERESE INSULT
      text = user.name() + '说' + targetSp + target.name() + targetSp + '是大傻蛋！\r\n';
      if(!target._noEffectMessage) {text += target.name() + '变得生气了！\r\n';}
      else {text += parseNoEffectEmotion(target.name(), "更生气了！\r\n")}
      text += hpDamageText;
      break;

    case 'DOUBLE SHOT': //THERESE DOUBLE SHOT
      text = user.name() + '双箭连发！';
      break;

    //LUSCIOUS//
    case 'LUSCIOUS ATTACK': //LUSCIOUS ATTACK
      text = user.name() + '试图施放咒术……\r\n';
      text += user.name() + '发动了某种魔法！\r\n';
      text += hpDamageText;
      break;

    case 'LUSCIOUS NOTHING': //LUSCIOUS NOTHING
      text = user.name() + '试图施放咒术……\r\n';
      text += '但是什么也没有发生……';
      break;

    case 'FIRE MAGIC': //FIRE MAGIC
      text = user.name() + '试图施放咒术……\r\n';
      text += user.name() + '把大家都点燃了！\r\n';
      text += hpDamageText;
      break;

    case 'MISFIRE MAGIC': //MISFIRE MAGIC
      text = user.name() + '试图施放咒术……\r\n';
      text += user.name() + '把整个房间都点燃了！！！\r\n';
      text += hpDamageText;
      break;

    //HORSE HEAD//
    case 'HORSE HEAD ATTACK': //HORSE HEAD ATTACK
      text = user.name() + '咬了' + targetSp + target.name() + targetSp + '的手臂一口。\r\n';
      text += hpDamageText;
      break;

    case 'HORSE HEAD NOTHING': //HORSE HEAD NOTHING
      text = user.name() + '打了个嗝。';
      break;

    case 'HORSE HEAD LICK': //HORSE HEAD LICK
     text = user.name() + '舔了' + targetSp + target.name() + targetSp + '的头发。\r\n';
     text += hpDamageText + '\r\n';
     if(!target._noEffectMessage) {text += target.name() + '变得生气了！';}
     else {text += parseNoEffectEmotion(target.name(), "更生气了！")}
     break;

    case 'HORSE HEAD WHINNY': //HORSE HEAD WHINNY
      text = user.name() + '快乐地嘶叫起来！'; // 注：whinnies 双关
      break;

    //HORSE BUTT//
    case 'HORSE BUTT ATTACK': //HORSE BUTT ATTACK
      text = user.name() + '一屁股坐在' + targetSp + target.name() + targetSp + '身上！\r\n';
      text += hpDamageText;
      break;

    case 'HORSE BUTT NOTHING': //HORSE BUTT NOTHING
      text = user.name() + '放了个屁。';
      break;

    case 'HORSE BUTT KICK': //HORSE BUTT KICK
      text = user.name() + '踢了' + targetSp + target.name() + targetSp + '一脚！\r\n';
      text += hpDamageText;
      break;

    case 'HORSE BUTT PRANCE': //HORSE BUTT PRANCE
      text = user.name() + '来回踱步。'; // 注：prances 双关
      break;

    //FISH BUNNY//
    case 'FISH BUNNY ATTACK': //FISH BUNNY ATTACK
      text = user.name() + '游到了' + targetSp + target.name() + targetSp + '身上！\r\n';
      text += hpDamageText;
      break;

    case 'FISH BUNNY NOTHING': //FISH BUNNY NOTHING
      text = user.name() + '在原地转圈圈。';
      break;

    case 'SCHOOLING': //SCHOOLING
      text = user.name() + '呼朋唤友！';
      break;

    //MAFIA ALLIGATOR//
    case 'MAFIA ATTACK': //MAFIA ATTACK
      text = user.name() + '空手道撕咬' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'MAFIA NOTHING': //MAFIA NOTHING
      text = user.name() + '把手指关节掰得咔咔作响。';
      break;

    case 'MAFIA ROUGH UP': //MAFIA ROUGH UP
      text = user.name() + '对' + targetSp + target.name() + targetSp + '一阵殴打！\r\n';
      text += hpDamageText;
      break;

    case 'MAFIA BACK UP': //MAFIA ALLIGATOR BACKUP
      text = user.name() + '呼叫支援！';
      break;

    //MUSSEL//
    case 'MUSSEL ATTACK': //MUSSEL ATTACK
      text = user.name() + '给了' + targetSp + target.name() + targetSp + '一拳！\r\n';
      text += hpDamageText;
      break;

    case 'MUSSEL FLEX': //MUSSEL FLEX
     text = user.name() + '秀起了肌肉，\r\n这是它的拿手好戏！\r\n';
     text += user.name() + "的命中率上升了！\r\n"
     break;

    case 'MUSSEL HIDE': //MUSSEL HIDE
     text = user.name() + '藏到了壳里。';
     break;

    //REVERSE MERMAID//
    case 'REVERSE ATTACK': //REVERSE ATTACK
     text = target.name() + '撞上了' + userSp + user.name() + '！\r\n';
     text += hpDamageText;
     break;

    case 'REVERSE NOTHING': //REVERSE NOTHING
     text = user.name() + '表演了一个后空翻！\r\n';
     text += '哇哦！！';
     break;

    case 'REVERSE RUN AROUND': //REVERSE RUN AROUND
      text = '大家都试图躲开' + user.name() + '，\r\n';
      text += '但是反而迎面撞上了它……\r\n';
      text += hpDamageText;
      break;

    //SHARK FIN//
    case 'SHARK FIN ATTACK': //SHARK FIN ATTACK
      text = user.name() + '冲向' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'SHARK FIN NOTHING': //SHARK FIN NOTHING
      text = user.name() + '在原地转圈圈。';
      break;

    case 'SHARK FIN BITE': //SHARK FIN BITE
      text = user.name() + '在啃咬' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'SHARK WORK UP': //SHARK FIN WORK UP
      text = user.name() + '火力全开！\r\n';
      text += user.name() + '的速度上升了！\r\n';
      if(!user._noEffectMessage) {
        text += user.name() + '变得生气了！';
      }
      else {text += parseNoEffectEmotion(user.name(), "更生气了！")}
      break;

    //ANGLER FISH//
    case 'ANGLER ATTACK': //ANGLER FISH ATTACK
      text = user.name() + '咬了' + targetSp + target.name() + targetSp + '一口！\r\n';
      text += hpDamageText;
      break;

    case 'ANGLER NOTHING': //ANGLER FISH NOTHING
      text = user.name() + '的肚子开始咕咕叫。';
      break;

    case 'ANGLER LIGHT OFF': //ANGLER FISH LIGHT OFF
      text = user.name() + '关掉了灯。\r\n';
      text += user.name() + '潜入了黑暗。';
      break;

    case 'ANGLER BRIGHT LIGHT': //ANGLER FISH BRIGHT LIGHT
      text = '大家的眼前出现了\r\n';
      text += '人生的走马灯！';
      break;

    case 'ANGLER CRUNCH': //ANGLER FISH CRUNCH
      text = user.name() + '的尖牙刺入了' + targetSp + target.name() + targetSp + '的身体！\r\n';
      text += hpDamageText;
      break;

    //SLIME BUNNY//
    case 'SLIME BUN ATTACK': //SLIME BUNNY ATTACK
      text = user.name() + '紧紧依偎着' + targetSp + target.name() +'。\r\n';
      text += hpDamageText;
      break;

    case 'SLIME BUN NOTHING': //SLIME BUN NOTHING
      text = user.name() + '对着大家微笑。\r\n';
      break;

    case 'SLIME BUN STICKY': //SLIME BUN STICKY
      text = user.name() + '觉得孤单并哭泣了起来。\r\n';
      if(!target._noStateMessage) {text += target.name() + '的速度下降了！\r\n';}
      else {text += parseNoStateChange(target.name(), "速度", "更低了！\r\n")}
      text += target.name() + "变得悲伤了。";
      break;

    //WATERMELON MIMIC//
    case 'WATERMELON RUBBER BAND': //WATERMELON MIMIC RUBBER BAND
      text = user.name() + '抛出了一个橡皮筋！\r\n';
      text += hpDamageText;
      break;

    case 'WATERMELON JACKS': //WATERMELON MIMIC JACKS
      text = user.name() + '往到处扔金属掷子！\r\n';
      text += hpDamageText;
      break;

    case 'WATERMELON DYNAMITE': //WATERMELON MIMIC DYNAMITE
      text = user.name() + '把炸药抛向空中！\r\n';
      text += '噢不！！\r\n';
      text += hpDamageText;
      break;

    case 'WATERMELON WATERMELON SLICE': //WATERMELON MIMIC WATERMELON SLICE
      text = user.name() + '扔出了西瓜汁！\r\n';
      text += hpDamageText;
      break;

    case 'WATERMELON GRAPES': //WATERMELON MIMIC GRAPES
      text = user.name() + '扔出了葡萄汽水！\r\n';
      text += hpDamageText;
      break;

    case 'WATEMELON FRENCH FRIES': //WATERMELON MIMIC FRENCH FRIES
      text = user.name() + '扔出了薯条！\r\n';
      text += hpDamageText;
      break;

    case 'WATERMELON CONFETTI': //WATERMELON MIMIC CONFETTI
      if(target.index() <= unitLowestIndex) {
        text = user.name() + '扔出了五彩纸片！\r\n';
        text += "大家变得开心了！"
      }
      target._noEffectMessage = undefined;
      break;

    case 'WATERMELON RAIN CLOUD': //WATERMELON MIMIC RAIN CLOUD
      if(target.index() <= unitLowestIndex) {
        text = user.name() + '召唤出雨云！\r\n';
        text += "大家变得悲伤了。"
      }
      target._noEffectMessage = undefined;
      break;

    case 'WATERMELON AIR HORN': //WATERMELON MIMIC AIR HORN
      if(target.index() <= unitLowestIndex) {
        text = user.name() + '使用了大汽笛喇叭！\r\n';
        text += "大家变得生气了！"
      }
      target._noEffectMessage = undefined;
      break;

    //SQUIZZARD//
    case 'SQUIZZARD ATTACK': //SQUIZZARD ATTACK
      text = user.name() + '在' + targetSp + target.name() + targetSp + '身上施法！\r\n';
      text += hpDamageText;
      break;

    case 'SQUIZZARD NOTHING': //SQUIZZARD NOTHING
      text = user.name() + '在喃喃自语着。';
      break;

    case 'SQUID WARD': //SQUID WARD
      text = user.name() + '创造出一只墨鱼守护者。\r\n'; // 注：squidward 是海绵宝宝里章鱼哥的reference。。。
      text += target.name() + targetSp + '的防御上升了。';
      break;

    case  'SQUID MAGIC': //SQUID MAGIC
      text = user.name() +  '施放了墨鱼咒术！\r\n';
      text += '大家开始感到怪怪的……';
      break;

    //WORM-BOT//
    case 'BOT ATTACK': //MECHA WORM ATTACK
      text = user.name() + '撞向' + targetSp + target.name() + targetSp + '！\r\n';
      text += hpDamageText;
      break;

    case 'BOT NOTHING': //MECHA WORM NOTHING
      text = user.name() + '在大声咀嚼！';
      break;

    case 'BOT LASER': //MECHA WORM CRUNCH
      text = user.name() + '向' + targetSp + target.name() + targetSp + '发射激光！\r\n';
      text += hpDamageText;
      break;

    case 'BOT FEED': //MECHA WORM FEED
      text = user.name() + '在啃食' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;


    //SNOT BUBBLE//
    case 'SNOT INFLATE': //SNOT INFLATE
      text = user.name() + '的鼻涕膨胀了起来！\r\n';
      text += target.name() + targetSp + '的攻击上升了！';
      break;

    case 'SNOT POP': //SNOT POP
      text = user.name() + '炸开了！\r\n';
      text += '鼻涕飞得到处都是！！\r\n';
      text += hpDamageText;
      break;

    //LAB RAT//
    case  'LAB ATTACK': //LAB RAT ATTACK
      text = user.name() + '发射鼠鼠激光！\r\n';
      text += hpDamageText;
      break;

    case  'LAB NOTHING': //LAB RAT NOTHING
      text = user.name() + '正在释放压力。';
      break;

    case  'LAB HAPPY GAS': //LAB RAT HAPPY GAS
      text = user.name() + '释放了快乐气体！\r\n';
      text += '大家都变得开心了！';
      target._noEffectMessage = undefined;
      break;

    case  'LAB SCURRY': //LAB RAT SCURRY
      text = user.name() + '四处疾走！\r\n';
      break;

    //MECHA MOLE//
    case 'MECHA MOLE ATTACK': //MECHA MOLE ATTACK
      text = user.name() + '向' + targetSp + target.name() + targetSp + '发射激光！\r\n';
      text += hpDamageText;
      break;

    case 'MECHA MOLE NOTHING': //MECHA MOLE NOTHING
      text = user.name() + '的双眼稍微亮了起来。';
      break;

    case 'MECHA MOLE EXPLODE': //MECHA MOLE EXPLODE
      text = user.name() + '流下了一滴眼泪。\r\n';
      text += user.name() + '炸成了烟花！';
      break;

    case 'MECHA MOLE STRANGE LASER': //MECHA MOLE STRANGE LASER
      text = user.name() + '的双眼释放出诡异的\r\n';
      text += '光芒，让' + targetSp + target.name() + targetSp + '不太舒服。';
      break;

    case 'MECHA MOLE JET PACK': //MECHA MOLE JET PACK
      text = user.name() + '身后出现了喷气背包！\r\n';
      text += user.name() + '在每个人的身边穿梭而过！';
      break;

    //CHIMERA CHICKEN//
    case 'CHICKEN RUN AWAY': //CHIMERA CHICKEN RUN AWAY
      text = user.name() + '逃跑了。';
      break;

    case 'CHICKEN NOTHING': //CHICKEN DO NOTHING
      text = user.name() + '咯咯叫。';
      break;

    //SALLI//
    case 'SALLI ATTACK': //SALLI ATTACK
      text = user.name() + '撞到了' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'SALLI NOTHING': //SALLI NOTHING
      text = user.name() + '做了一个小小的后空翻!';
      break;

    case 'SALLI SPEED UP': //SALLI SPEED UP
      text = user.name() + '开始在房间里飞速奔跑！\r\n';
      if(!target._noStateMessage) {
        text += user.name() + '的速度上升了！';
      }
      else {text += parseNoStateChange(user.name(), "速度", "更高了！")}
      break;

    case 'SALLI DODGE ANNOY': //SALLI STARE
      text = user.name() + '开始全神贯注地集中！';
      break;

    //CINDI//
    case 'CINDI ATTACK': //CINDI ATTACK
      text = user.name() + '揍了' + targetSp + target.name() + targetSp + '一拳！\r\n';
      text += hpDamageText;
      break;

    case 'CINDI NOTHING': //CINDI NOTHING
      text = user.name() + '原地跑圈圈。';
      break;

    case 'CINDI SLAM': //CINDI SLAM
      text = user.name() + '大臂一挥，击中了' + targetSp + target.name() + '！\r\n';
      text += hpDamageText;
      break;

    case 'CINDI COUNTER ATTACK': //CINDI COUNTER ATTACK
      text = user.name() + '做好了准备！';
      break;

    //DOROTHI//
    case 'DOROTHI ATTACK': //DOROTHI ATTACK
      text = user.name() + '跺了' + targetSp + target.name() + targetSp + '一脚！\r\n';
      text += hpDamageText;
      break;

    case 'DOROTHI NOTHING': //DOROTHI NOTHING
      text = user.name() + '对着黑暗哭了起来。';
      break;

    case 'DOROTHI KICK': //DOROTHI KICK
      text = user.name() + '踢了' + targetSp + target.name() + targetSp + '一脚！\r\n';
      text += hpDamageText;
      break;

    case 'DOROTHI HAPPY': //DOROTHI HAPPY
      text = user.name() + '开心地踱来踱去。';
      break;

    //NANCI//
    case 'NANCI ATTACK': //NANCI ATTACK
      text = user.name() + '的爪子向' + targetSp + target.name() + targetSp + '袭来！\r\n';
      text += hpDamageText;
      break;

    case 'NANCI NOTHING': //NANCI NOTHING
      text = user.name() + '来回摇晃。';
      break;

    case 'NANCI ANGRY': //NANCI ANGRY
      text = user.name() + '开始沸腾了！';
      break;

    //MERCI//
    case 'MERCI ATTACK': //MERCI ATTACK
      text = user.name() + '触碰了' + targetSp + target.name() + targetSp + '的胸膛。\r\n';
      text += target.name() + targetSp + '感觉自己的器官被撕裂了！\r\n';
      text += hpDamageText;
      break;

    case 'MERCI NOTHING': //MERCI NOTHING
      text = user.name() + '露出了阴冷的笑容。';
      break;

    case 'MERCI MELODY': //MERCI LAUGH
      text = user.name() + '唱了一首歌。\r\n';
      text += target.name() + targetSp + '听到了熟悉的旋律。\r\n';
      if(target.isStateAffected(6)) {text += target.name() + targetSp + "变得开心了！\r\n"}
      else if(target.isStateAffected(7)) {text += target.name() + targetSp + "变得狂喜了！！\r\n"}
      else if(target.isStateAffected(8)) {text += target.name() + targetSp + "陷入了癫狂！！！\r\n"}
      break;

    case 'MERCI SCREAM': //MERCI SCREAM
      text = user.name() + '发出了可怕的嘶吼声！\r\n';
      text += hpDamageText;
      break;


    //LILI//
    case 'LILI ATTACK': //LILI ATTACK
      text = user.name() + '凝视着' + targetSp + target.name() + targetSp + '的灵魂！\r\n';
      text += hpDamageText;
      break;

    case 'LILI NOTHING': //LILI NOTHING
      text = user.name() + '眨了眨眼。';
      break;

    case 'LILI MULTIPLY': //LILI MULTIPLY
      text = user.name() + '的一只眼球掉了出来！\r\n';
      text += '眼球长成了另一只' + user.name() + '！';
      break;

    case 'LILI CRY': //LILI CRY
      text = '泪水在' + user.name() + '的眼球里打转。\r\n';
      text += target.name() + "变得悲伤了。"
      break;

    case 'LILI SAD EYES': //LILI SAD EYES
      text = target.name() + targetSp + '在' + user.name() + '的眼球里看到了悲伤。\r\n';
      text += target.name() + targetSp + '变得不愿意攻击' + user.name(); + '了。\r\n'
      break;

    //HOUSEFLY//
    case 'HOUSEFLY ATTACK': //HOUSEFLY ATTACK
      text = user.name() + '降落在' + targetSp + target.name() + targetSp + '的脸上。\r\n';
      text += target.name() + targetSp + '扇了自己一巴掌！\r\n';
      text += hpDamageText;
      break;

    case 'HOUSEFLY NOTHING': //HOUSEFLY NOTHING
      text = user.name() + '嗡嗡作响！';
      break;

    case 'HOUSEFLY ANNOY': //HOUSEFLY ANNOY
      text = user.name() + '在' + targetSp + target.name() + targetSp + '的耳边嗡嗡作响！\r\n';
      if(!target._noEffectMessage) {text += target.name() + '变得生气了！';}
      else {text += parseNoEffectEmotion(target.name(), "更生气了！")}
      break;

    //RECYCLIST//
    case 'FLING TRASH': //FLING TRASH
      text = user.name() + '朝着' + targetSp + target.name() + targetSp + '扔垃圾！\r\n';
      text += hpDamageText;
      break;

    case 'GATHER TRASH': //GATHER TRASH
      text = user.name() + '把地上的垃圾\r\n';
      text += '扫进了自己的袋子里！\r\n';
      text += hpDamageText;
      break;

    case 'RECYCLIST CALL FOR FRIENDS': //RECYCLIST CALL FOR FRIENDS
      text = user.name() + '正在召唤其他教徒！';
      break;

    //STRAY DOG//
    case 'STRAY DOG ATTACK': //STRAY DOG ATTACK
      text = user.name() + '采用了咬人的攻击方式！\r\n';
      text += hpDamageText;
      break;

    case 'STRAY DOG HOWL': //STRAY DOG HOWL
      text = user.name() + '发出刺耳的吠叫声！';
      break;

    //CROW//
    case 'CROW ATTACK': //CROW ATTACK
      text = user.name() + '啄了啄' + targetSp + target.name() + targetSp + '的眼睛。\r\n';
      text += hpDamageText;
      break;

    case 'CROW GRIN': //CROW GRIN
      text = user.name() + '脸上挂着大大的笑容。';
      break;

    case 'CROW STEAL': //CROW STEAL
      text = user.name() + '偷走了什么东西！';
      break;

    // BEE //
    case 'BEE ATTACK': //BEE Attack
      text = user.name() + '蛰了' + targetSp + target.name() + targetSp + '一下。\r\n';
      text += hpDamageText;
      break;

    case 'BEE NOTHING': //BEE NOTHING
      text = user.name() + '快速地飞来飞去！';
      break;

    // GHOST BUNNY //
    case 'GHOST BUNNY ATTACK': //GHOST BUNNY ATTACK
      text = user.name() + '穿过了' + targetSp + target.name() + targetSp + '的身体！\r\n';
      text += target.name() + '感到疲累。\r\n';
      text += mpDamageText;
      break;

    case 'GHOST BUNNY NOTHING': //GHOST BUNNY DO NOTHING
      text = user.name() + '在原地漂浮。';
      break;

    //TOAST GHOST//
    case 'TOAST GHOST ATTACK': //TOAST GHOST ATTACK
      text = user.name() + '穿过了' + targetSp + target.name() + targetSp + '的身体！\r\n';
      text += target.name() + '感到疲累。\r\n';
      text += hpDamageText;
      break;

    case 'TOAST GHOST NOTHING': //TOAST GHOST NOTHING
      text = user.name() + '发出令人毛骨悚然的声音。';
      break;

    //SPROUT BUNNY//
    case 'SPROUT BUNNY ATTACK': //SPROUT BUNNY ATTACK
      text = user.name() + '撞了' + targetSp + target.name() + targetSp + '一下。\r\n';
      text += hpDamageText;
      break;

    case 'SPROUT BUNNY NOTHING': //SPROUT BUNNY NOTHING
      text = user.name() + '正在啃草。';
      break;

    case 'SPROUT BUNNY FEED': //SPROUT BUNNY FEED
      text = user.name() + '正在饲喂' + targetSp + target.name() + '。\r\n';
      text += `${user.name()}回复了 ${Math.abs(hpDam)} 点心心！`
      break;

    //CELERY//
    case 'CELERY ATTACK': //CELERY ATTACK
      text = user.name() + '撞向' + targetSp + target.name() + '。\r\n';
      text += hpDamageText;
      break;

    case 'CELERY NOTHING': //CELERY NOTHING
      text = user.name() + '摔了一跤。';
      break;

    //CILANTRO//
    case 'CILANTRO ATTACK': //CILANTRO ATTACK
      text = user.name() + '在捶打' + targetSp + target.name() + '。\r\n';
      text += hpDamageText;
      break;

    case 'CILANTRO NOTHING': //CILANTRO DO NOTHING
      text = user.name() + '在沉思人生。';
      break;

    case 'GARNISH': //CILANTRO GARNISH
      text = user.name() + '牺牲了自己来\r\n';
      text += '成全' + targetSp + target.name() + '。'; // 注：unused
      break;

    //GINGER//
    case 'GINGER ATTACK': //GINGER ATTACK
      text = user.name() + '爆发了，并攻击了' + targetSp + target.name() + '。\r\n';
      text += hpDamageText;
      break;

    case 'GINGER NOTHING': //GINGER NOTHING
      text = user.name() + '找到了内心的安宁。';
      break;

    case 'GINGER SOOTHE': //GINGER SOOTHE
      text = user.name() + '让' + targetSp + target.name() + targetSp + '冷静了下来。\r\n';
      break;

    //YE OLD MOLE//
    case 'YE OLD ROLL OVER': //MEGA SPROUT MOLE ROLL OVER
      text = user.name() + '到处翻滚撞人！';
      text += hpDamageText;
      break;

    //KITE KID//
    case 'KITE KID ATTACK':  // KITE KID ATTACK
      text = user.name() + '朝着' + targetSp + target.name() + targetSp + '丢出了金属掷子！\r\n';
      text += hpDamageText;
      break;

    case 'KITE KID BRAG':  // KITE KID BRAG
      text = user.name() + '夸赞了男孩的风筝！\r\n';
      if(!target._noEffectMessage) {
        text += target.name() + '变得开心了！';
      }
      else {text += parseNoEffectEmotion(target.name(), "更开心了！")}
      break;

    case 'REPAIR':  // REPAIR
      text = user.name() + '包扎了男孩的风筝！\r\n';
      text += '男孩的风筝焕然一新！';
      break;

    //KID'S KITE//
    case 'KIDS KITE ATTACK': // KIDS KITE ATTACK
      text = user.name() + '朝着' + targetSp + target.name() + targetSp + '俯冲而去！\r\n';
      text += hpDamageText;
      break;

    case 'KITE NOTHING': // KITE NOTHING
      text = user.name() + '骄傲地挺起了胸脯！';
      break;

    case 'FLY 1':  // FLY 1
      text = user.name() + '高高地飞了起来！';
      break;

    case 'FLY 2':  // FLY 2
      text = user.name() + '猛地俯冲下来！！';
      break;

    //PLUTO//
    case 'PLUTO NOTHING':  // PLUTO NOTHING
      text = user.name() + '凹了个造型！\r\n';
      break;

    case 'PLUTO HEADBUTT':  // PLUTO HEADBUTT
      text = user.name() + '冲向前去，一头撞向' + targetSp + target.name() + targetSp + '！\r\n';
      text += hpDamageText;
      break;

    case 'PLUTO BRAG':  // PLUTO BRAG
      text = user.name() + '吹嘘了自己的肌肉！\r\n';
      if(!user._noEffectMessage) {
        text += user.name() + '变得开心了！';
      }
      else {text += parseNoEffectEmotion(user.name(), "更开心了！")}
      break;

    case 'PLUTO EXPAND':  // PLUTO EXPAND
      text = user.name() + '给自己加油鼓劲！！\r\n';
      if(!target._noStateMessage) {
        text += user.name() + '的攻击和防御上升了！！\r\n';
        text += user.name() + '的速度下降了。';
      }
      else {
        text += parseNoStateChange(user.name(), "攻击", "更高了！\r\n")
        text += parseNoStateChange(user.name(), "防御", "更高了！\r\n")
        text += parseNoStateChange(user.name(), "速度", "更低了！")
      }
      break;

    case 'EXPAND NOTHING':  // PLUTO NOTHING
      text = user.name() + '的肌肉\r\n';
      text += '令你感到恐惧。';
      break;

    //RIGHT ARM//
    case 'R ARM ATTACK':  // R ARM ATTACK
      text = user.name() + '砍了' + targetSp + target.name() + targetSp + '一掌！\r\n';
      text += hpDamageText;
      break;

    case 'GRAB':  // GRAB
      text = user.name() + '抓住了' + targetSp + target.name() + targetSp + '！\r\n';
      text += target.name() + targetSp + '的速度下降了。\r\n';
      text += hpDamageText;
      break;

    //LEFT ARM//
    case 'L ARM ATTACK':  // L ARM ATTACK
      text = user.name() + '揍了' + targetSp + target.name() + targetSp + '一拳！\r\n';
      text += hpDamageText;
      break;

    case 'POKE':  // POKE
      text = user.name() + '戳了' + targetSp + target.name() + targetSp + '一下！\r\n';
      if(!target._noEffectMessage) {
        text += target.name() + '变得生气了！\r\n';
      }
      else {text += parseNoEffectEmotion(target.name(), "更生气了！\r\n")}
      text += hpDamageText;
      break;

    //DOWNLOAD WINDOW//
    case 'DL DO NOTHING':  // DL DO NOTHING
      text = user.name() + '进度达到了 99%。';
      break;

    case 'DL DO NOTHING 2':  // DL DO NOTHING 2
      text = user.name() + '进度还卡在 99%……';
      break;

    case 'DOWNLOAD ATTACK':  // DOWNLOAD ATTACK
      text = user.name() + '崩溃了，熊熊燃烧起来！';
      break;

    //SPACE EX-BOYFRIEND//
    case 'SXBF ATTACK':  // SXBF ATTACK
      text = user.name() + '踢了' + targetSp + target.name() + targetSp + '一脚！\r\n';
      text += hpDamageText;
      break;

    case 'SXBF NOTHING':  // SXBF NOTHING
      text = user.name() + '伤感地凝望着\r\n';
      text += '远方。';
      break;

    case 'ANGRY SONG':  // ANGRY SONG
      text = user.name() + '嚎啕大哭！';
      break;

    case 'ANGSTY SONG':  // ANGSTY SONG
      text = user.name() + '悲伤地唱着歌……\r\n';
      if(target.isStateAffected(10)) {text += target.name() + '变得悲伤了。';}
      else if(target.isStateAffected(11)) {text += target.name() + '变得抑郁了……';}
      else if(target.isStateAffected(12)) {text += target.name() + '陷入了痛苦…………';}
      break;

    case 'BIG LASER':  // BIG LASER
      text = user.name() + '发射了激光！\r\n';
      text += hpDamageText;
      break;

    case 'BULLET HELL':  // BULLET HELL
      text = user.name() + '陷入了绝望，\r\n';
      text += '胡乱地发射了激光！';
      break;

    case 'SXBF DESPERATE':  // SXBF NOTHING
      text = user.name() + '\r\n';
      text += '呲了呲牙！';
      break;

    //THE EARTH//
    case 'EARTH ATTACK':  // EARTH ATTACK
      text = user.name() + '攻击了' + targetSp + target.name() + targetSp + '！\r\n';
      text += hpDamageText
      break;

    case 'EARTH NOTHING':  // EARTH NOTHING
      text = user.name() + '正缓缓地旋转。';
      break;

    case 'EARTH CRUEL':  // EARTH CRUEL
      text = user.name() + '对' + targetSp + target.name() + targetSp + '十分冷酷无情！\r\n';
      if(target.isStateAffected(10)) {text += target.name() + targetSp + '变得悲伤了。';}
      else if(target.isStateAffected(11)) {text += target.name() + targetSp + '变得抑郁了……';}
      else if(target.isStateAffected(12)) {text += target.name() + targetSp + '陷入了痛苦…………';}
      break;

    case 'CRUEL EPILOGUE':  // EARTH CRUEL
      if(target.index() <= unitLowestIndex) {
        text = user.name() + "对大家都十分冷酷无情……\r\n";
        text += "大家都变得悲伤了。"
      }
      break;

    case 'PROTECT THE EARTH':  // PROTECT THE EARTH
      text = user.name() + '使出了它最强的一击！';
      break;

    //SPACE BOYFRIEND//
    case 'SBF ATTACK': //SPACE BOYFRIEND ATTACK
      text = user.name() + '敏捷地踹了' + targetSp + target.name() + targetSp + '一脚！\r\n';
      text += hpDamageText;
      break;

    case 'SBF LASER': //SPACE BOYFRIEND LASER
      text = user.name() + '发射了激光！\r\n';
      text += hpDamageText;
      break;

    case 'SBF CALM DOWN': //SPACE BOYFRIEND CALM DOWN
      text = user.name() + '放空了头脑，\r\n';
      text += '去除了所有的情绪。';
      break;

    case 'SBF ANGRY SONG': //SPACE BOYFRIEND ANGRY SONG
      if(target.index() <= unitLowestIndex) {
        text = user.name() + '大声嚎哭，释放了自己所有的怒火！\r\n';
        text += "大家都变得生气了！\r\n";
      }
      text += hpDamageText;
      break;

    case 'SBF ANGSTY SONG': //SPACE BOYFRIEND ANGSTY SONG
      if(target.index() <= unitLowestIndex) {
        text = user.name() + '歌唱起来，唱出了他灵魂深处\r\n';
        text += '所有的黑暗！\r\n';
        text += "大家都变得悲伤了。\r\n";
      }
      text += mpDamageText;
      break;

    case 'SBF JOYFUL SONG': //SPACE BOYFRIEND JOYFUL SONG
      if(target.index() <= unitLowestIndex) {
        text = user.name() + '歌唱起来，唱出了他心中\r\n';
        text += "所有的欢喜！\r\n"
        text += "大家都变得开心了！\r\n";
      }
      text += hpDamageText;
      break;

    //NEFARIOUS CHIP//
    case 'EVIL CHIP ATTACK': //NEFARIOUS CHIP ATTACK
      text = user.name() + '蓄力冲向了' + targetSp + target.name() + targetSp + '！\r\n';
      text += hpDamageText;
      break;

    case 'EVIL CHIP NOTHING': //NEFARIOUS CHIP NOTHING
      text = user.name() + '摸了摸他邪恶的\r\n';
      text += '小胡子！';
      break;


    case 'EVIL LAUGH': //NEFARIOUS LAUGH
      text = user.name() + '发出了符合他邪恶反派\r\n';
      text += '身份的笑声！\r\n';
      if(!target._noEffectMessage) {text += target.name() + "变得开心了！"}
      else {text += parseNoEffectEmotion(target.name(), "更开心了！")}
      break;

    case 'EVIL COOKIES': //NEFARIOUS COOKIES
      text = user.name() + '把燕麦饼干扔向了大家！\r\n';
      text += '真是邪恶！';
      break;

    //BISCUIT AND DOUGHIE//
    case 'BD ATTACK': //BISCUIT AND DOUGHIE ATTACK
      text = user.name() + '一齐攻击！\r\n';
      text += hpDamageText;
      break;

    case 'BD NOTHING': //BISCUIT AND DOUGHIE NOTHING
      text = user.name() + '好像把什么东西\r\n';
      text += '忘在烤箱里了！';
      break;

    case 'BD BAKE BREAD': //BISCUIT AND DOUGHIE BAKE BREAD
      text = user.name() + '从烤箱里\r\n';
      text += '拿出了一些面包！';
      break;

    case 'BD COOK': //BISCUIT AND DOUGHIE CHEER UP
      text = user.name() + '烤了一份饼干！\r\n';
      text += `${target.name() + targetSp}回复了 ${Math.abs(hpDam)}\r\n点心心！`
      break;

    case 'BD CHEER UP': //BISCUIT AND DOUGHIE CHEER UP
      text = user.name() + ' 努力忍住\r\n';
      text += '不要伤心。';
      break;

    //KING CRAWLER//
    case 'KC ATTACK': //KING CRAWLER ATTACK
      text = user.name() + '撞向了' + targetSp + target.name() + targetSp + '！\r\n';
      text += hpDamageText;
      break;

    case 'KC NOTHING': //KING CRAWLER NOTHING
      text = user.name() + '发出了一声震耳欲聋的\r\n';
      text += '尖叫！\r\n';
      if(!target._noEffectMessage) {
        text += target.name() + "变得生气了！";
      }
      else {text += parseNoEffectEmotion(target.name(), "更生气了！")}
      break;

    case 'KC CONSUME': //KING CRAWLER CONSUME
      text = user.name() + '吃了一只\r\n';
      text += "迷路的树苗鼹鼠！\r\n"
      text += `${target.name()} 回复了 ${Math.abs(hpDam)} 点心心！\r\n`;
      break;

    case 'KC RECOVER': //KING CRAWLER CONSUME
      text = `${target.name()} 回复了 ${Math.abs(hpDam)} 点心心！\r\n`;
      if(!target._noEffectMessage) {text += target.name() + "变得开心了！"}
      else {text += parseNoEffectEmotion(target.name(), "更开心了！")}
      break;

    case 'KC CRUNCH': //KING CRAWLER CRUNCH
      text = user.name() + '咬住' + targetSp + target.name() + targetSp + '并咀嚼起来！\r\n';
      text += hpDamageText;
      break;

    case 'KC RAM': //KING CRAWLER RAM
      text = user.name() + '在队伍中横冲直撞！\r\n';
      text += hpDamageText;
      break;

    //KING CARNIVORE//

    case "SWEET GAS":
      if(target.index() <= unitLowestIndex) {
        text = user.name() + "释放了气体！\r\n";
        text += "闻起来甜甜的！\r\n";
        text += "大家都变得开心了！";
      }
      target._noEffectMessage = undefined;
      break;

    //SPROUTMOLE LADDER//
    case 'SML NOTHING': //SPROUT MOLE LADDER NOTHING
      text = user.name() + '牢牢地立在原地。';
      break;

    case 'SML SUMMON MOLE': //SPROUT MOLE LADDER SUMMON SPROUT MOLE
      text = '一只树苗鼹鼠爬上了' + user.name() + '！';
      break;

    case 'SML REPAIR': //SPROUT MOLE LADDER REPAIR
      text = user.name() + '被修好了。';
      break;

    //UGLY PLANT CREATURE//
    case 'UPC ATTACK': //UGLY PLANT CREATURE ATTACK
      text = user.name() + '用藤蔓抽打了\r\n';
      text += target.name() + targetSp + '！\r\n';
      text += hpDamageText;
      break;

    case 'UPC NOTHING': //UGLY PLANT CRATURE NOTHING
      text = user.name() + '大声吼叫！';
      break;

    //ROOTS//
    case 'ROOTS NOTHING': //ROOTS NOTHING
      text = user.name() + '扭来扭去。';
      break;

    case 'ROOTS HEAL': //ROOTS HEAL
      text = user.name() + '为\r\n';
      text += target.name() + targetSp + '提供了营养。';
      break;

    //BANDITO MOLE//
    case 'BANDITO ATTACK': //BANDITO ATTACK
      text = user.name() + '刺伤了' + targetSp + target.name() + targetSp + '！\r\n';
      text += hpDamageText;
      break;

    case 'BANDITO STEAL': //BANDITO STEAL
      text = user.name() + '快速地从队伍里\r\n';
      text += '偷走了一件物品！'
      break;

    case 'B.E.D.': //B.E.D.
      text = user.name() + '拿出了持·无·昂！\r\n';
      text += hpDamageText;
      break;

    //SIR MAXIMUS//
    case 'MAX ATTACK': //SIR MAXIMUS ATTACK
      text = user.name() + '挥下他的剑！\r\n';
      text += hpDamageText;
      break;

    case 'MAX NOTHING': //SIR MAXIMUS NOTHING
      text = user.name() + '挺直了背……\r\n';
      if(!target._noEffectMessage) {
        text += target.name() + '变得悲伤了。'
      }
      else {text += parseNoEffectEmotion(target.name(), "更悲伤了！")}
      break;

    case 'MAX STRIKE': //SIR MAXIMUS SWIFT STRIKE
      text = user.name() + '攻击了两次！';
      break;

    case 'MAX ULTIMATE ATTACK': //SIR MAXIMUS ULTIMATE ATTACK
      text = '“现在我要使出终极绝招了！”';
      text += hpDamageText;
      break;

    case 'MAX SPIN': //SIR MAXIMUS SPIN
        break;

    //SIR MAXIMUS II//
    case 'MAX 2 NOTHING': //SIR MAXIMUS II NOTHING
      text = user.name() + '想起了他\r\n';
      text += '父亲的遗言。\r\n';
      if(!target._noEffectMessage) {
        text += target.name() + '变得悲伤了。'
      }
      else {text += parseNoEffectEmotion(target.name(), "更悲伤了！")}
      break;

    //SIR MAXIMUS III//
    case 'MAX 3 NOTHING': //SIR MAXIMUS III NOTHING
      text = user.name() + '想起了他\r\n';
      text += '祖父的遗言。\r\n';
      text += target.name() + '变得悲伤了。'
      break;

    //SWEETHEART//
    case 'SH ATTACK': //SWEET HEART ATTACK
      text = user.name() + '扇了' + targetSp + target.name() + targetSp + '一巴掌。\r\n';
      text += hpDamageText;
      break;

    case 'SH INSULT': //SWEET HEART INSULT
      if(target.index() <= unitLowestIndex) {
        text = user.name() + "侮辱了所有人！\r\n"
        text += "大家都变得生气了！\r\n";
      }
      text += hpDamageText;
      target._noEffectMessage = undefined;
      break;

    case 'SH SNACK': //SWEET HEART SNACK
      text = user.name() + '命令仆人为她呈上\r\n';
      text += '点心。\r\n';
      text += hpDamageText;
      break;

    case 'SH SWING MACE': //SWEET HEART SWING MACE
      text = user.name() + '狂热地甩着她的链锤！\r\n';
      text += hpDamageText;
      break;

    case 'SH BRAG': //SWEET HEART BRAG
      text = user.name() + '吹嘘自己天赋过人，\r\n';
      text += '而且这只是她众多天赋中的一项！\r\n';
      if(!target._noEffectMessage) {
        if(target.isStateAffected(8)) {text += target.name() + '陷入了癫狂！！！';}
        else if(target.isStateAffected(7)) {text += target.name() + '变得狂喜了！！';}
        else if(target.isStateAffected(6)) {text += target.name() + '变得开心了！';}
      }
      else {text += parseNoEffectEmotion(target.name(), "更开心了！")}

      break;

      //MR. JAWSUM //
      case 'DESK SUMMON MINION': //MR. JAWSUM DESK SUMMON MINION
        text = user.name() + '拿起电话，\r\n';
        text += '叫来了一位鳄鱼男！';
        break;

      case 'JAWSUM ATTACK ORDER': //MR. JAWSUM DESK ATTACK ORDER
        if(target.index() <= unitLowestIndex) {
          text = user.name() + '下令攻击！\r\n';
          text += "所有人都变得生气了！";
        }
        break;

      case 'DESK NOTHING': //MR. JAWSUM DESK DO NOTHING
        text = user.name() + '开始清点蚌币。';
        break;

      //PLUTO EXPANDED//
      case 'EXPANDED ATTACK': //PLUTO EXPANDED ATTACK
        text = user.name() + '把月亮丢向了' + targetSp + target.name() + '！\r\n';
        text += hpDamageText;
        break;

      case 'EXPANDED SUBMISSION HOLD': //PLUTO EXPANDED SUBMISSION HOLD
        text = user.name() + '对' + targetSp + target.name() + targetSp + '\r\n';
        text += '使用了锁技！\r\n';
        text += target.name() + targetSp + '的速度下降了。\r\n';
        text += hpDamageText;
        break;

      case 'EXPANDED HEADBUTT': //PLUTO EXPANDED HEADBUTT
        text = user.name() + '一头撞向了\r\n';
        text += target.name() + targetSp + '！\r\n';
        text += hpDamageText;
        break;

      case 'EXPANDED FLEX COUNTER': //PLUTO EXPANDED FLEX COUNTER
        text = user.name() + '显摆肌肉，\r\n'
        text += '做好了准备！';
        break;

      case 'EXPANDED EXPAND FURTHER': //PLUTO EXPANDED EXPAND FURTHER
        text = user.name() + '扩得更加大了！\r\n';
        if(!target._noStateMessage) {
          text += target.name() + '的攻击上升了！\r\n';
          text += target.name() + '的防御上升了！\r\n';
          text += target.name() + '的速度下降了。';
        }
        else {
          text += parseNoStateChange(user.name(), "攻击", "更高了！\r\n")
          text += parseNoStateChange(user.name(), "防御", "更高了！\r\n")
          text += parseNoStateChange(user.name(), "速度", "更低了！")
        }
        break;

      case 'EXPANDED EARTH SLAM': //PLUTO EXPANDED EARTH SLAM
        text = user.name() + '抬起了地球，\r\n';
        text += '向着所有人扔了过来！';
        break;

      case 'EXPANDED ADMIRATION': //PLUTO EXPANDED ADMIRATION
        text = user.name() + '对凯的进步感到十分欣慰！\r\n';
        if(target.isStateAffected(8)) {text += target.name() + targetSp + '陷入了癫狂！！！';}
        else if(target.isStateAffected(7)) {text += target.name() + targetSp + '变得狂喜了！！';}
        else if(target.isStateAffected(6)) {text += target.name() + targetSp + '变得开心了！';}
        break;

      //ABBI TENTACLE//
      case 'TENTACLE ATTACK': //ABBI TENTACLE ATTACK
        text = user.name() + '抽打了' + targetSp + target.name() + targetSp + '！\r\n';
        text += hpDamageText;
        break;

      case 'TENTACLE TICKLE': //ABBI TENTACLE TICKLE
        text = user.name() + "让" + targetSp + target.name() + targetSp + "变弱了！\r\n";
        text += `${target.name() + targetSp}放松了警惕！`
        break;

      case 'TENTACLE GRAB': //ABBI TENTACLE GRAB
        text = user.name() + '在' + targetSp + target.name() + targetSp + '四周扭动！\r\n';
        if(result.isHit()) {
          if(target.name() !== "OMORI" && !target._noEffectMessage) {text += target.name() + targetSp + "感到害怕。\r\n";}
          else {text += parseNoEffectEmotion(target.name(), "害怕")}
        }
        text += hpDamageText;
        break;

      case 'TENTACLE GOOP': //ABBI TENTACLE GOOP
        text = target.name() + targetSp + '被黑暗的液体淹没了！\r\n';
        text += target.name() + targetSp + '感觉自己变弱了……\r\n';
        text += target.name() + targetSp + '的攻击下降了。\r\n';
        text += target.name() + targetSp + '的防御下降了。\r\n';
        text += target.name() + targetSp + '的速度下降了。';
        break;

      //ABBI//
      case 'ABBI ATTACK': //ABBI ATTACK
        text = user.name() + '攻击了' + targetSp + target.name() + targetSp + '！\r\n';
        text += hpDamageText;
        break;

      case 'ABBI REVIVE TENTACLE': //ABBI REVIVE TENTACLE
        text = user.name() + '集中了心心。';
        break;

      case 'ABBI VANISH': //ABBI VANISH
        text = user.name() + '消失在了阴影之中……';
        break;

      case 'ABBI ATTACK ORDER': //ABBI ATTACK ORDER
        if(target.index() <= unitLowestIndex) {
          text = user.name() + '伸展了她的触手。\r\n';
          text += "所有人的攻击都上升了！！\r\n"
          text += "所有人都变得生气了！"
        }
        break;

      case 'ABBI COUNTER TENTACLE': //ABBI COUNTER TENTACLES
        text = user.name() + '在阴影中穿行……';
        break;

      //ROBO HEART//
      case 'ROBO HEART ATTACK': //ROBO HEART ATTACK
        text = user.name() + '发射了手炮！\r\n';
        text += hpDamageText;
        break;

      case 'ROBO HEART NOTHING': //ROBO HEART NOTHING
        text = user.name() + '正在充能……';
        break;

      case 'ROBO HEART LASER': //ROBO HEART LASER
        text = user.name() + '张开了她的嘴，\r\n';
        text += '发射了激光！\r\n';
        text += hpDamageText;
        break;

      case 'ROBO HEART EXPLOSION': //ROBO HEART EXPLOSION
        text = user.name() + '流下了一滴机器人的眼泪。\r\n';
        text += user.name() + '爆炸了！';
        break;

      case 'ROBO HEART SNACK': //ROBO HEART SNACK
        text = user.name() + '张开了她的嘴。\r\n';
        text += '出现了一份营养丰富的点心！\r\n';
        text += hpDamageText;
        break;

      //MUTANT HEART//
      case 'MUTANT HEART ATTACK': //MUTANT HEART ATTACK
        text = user.name() + '为' + targetSp + target.name() + targetSp + '唱了一首歌！\r\n';
        text += '并不是非常动听……\r\n';
        text += hpDamageText;
        break;

      case 'MUTANT HEART NOTHING': //MUTANT HEART NOTHING
        text = user.name() + '凹了个造型！';
        break;

      case 'MUTANT HEART HEAL': //MUTANT HEART HEAL
        text = user.name() + '修补好了自己的裙子！';
        text += hpDamageText;
        break;

      case 'MUTANT HEART WINK': //MUTANT HEART WINK
        text = user.name() + '冲着' + targetSp + target.name() + targetSp + '眨了眨眼！\r\n';
        text += '还挺可爱的……\r\n';
        if(!target._noEffectMessage){text += target.name() + targetSp + '变得开心了！';}
        else {text += parseNoEffectEmotion(target.name(), "更开心了！")}
        break;

      case 'MUTANT HEART INSULT': //MUTANT HEART INSULT
        text = user.name() + '不小心说了些\r\n';
        text += '很刻薄的话。\r\n';
        if(!target._noEffectMessage){text += target.name() + targetSp + '变得生气了！';}
        else {text += parseNoEffectEmotion(target.name(), "更生气了！")}
        break;

      case 'MUTANT HEART KILL': //MUTANT HEART KILL
        text = '异变甜心扇了' + user.name() + userSp + '一巴掌！\r\n';
        text += hpDamageText;
        break;

        //PERFECT HEART//
        case 'PERFECT STEAL HEART': //PERFECT HEART STEAL HEART
          text = user.name() + '偷走了' + targetSp + target.name() + targetSp + '的\r\n';
          text += '心心。\r\n';
          text += hpDamageText + "\r\n";
          if(user.result().hpDamage < 0) {text += `${user.name() + userSp}回复了 ${Math.abs(user.result().hpDamage)} 点心心！\r\n`}
          break;

        case 'PERFECT STEAL BREATH': //PERFECT HEART STEAL BREATH
          text = user.name() + '夺走了' + targetSp + target.name() + targetSp + '的\r\n';
          text += '呼吸。\r\n';
          text += mpDamageText + "\r\n";
          if(user.result().mpDamage < 0) {text += `${user.name() + userSp}回复了 ${Math.abs(user.result().mpDamage)} 点体力……\r\n`}
          break;

        case 'PERFECT EXPLOIT EMOTION': //PERFECT HEART EXPLOIT EMOTION
          text = user.name() + '抢走了' + targetSp + target.name() + targetSp + '的\r\n';
          text += '情绪！\r\n';
          text += hpDamageText;
          break;

        case 'PERFECT SPARE': //PERFECT SPARE
          text = user.name() + '决定饶\r\n';
          text += target.name() + targetSp + '一命。\r\n';
          text += hpDamageText;
          break;

        case 'PERFECT ANGELIC VOICE': //UPLIFTING HYMN
          if(target.index() <= unitLowestIndex) {
            text = user.name() + '唱了一首深情的歌……\r\n';
            if(!user._noEffectMessage) {text += user.name() + "变得悲伤了。\r\n"}
            else {text += parseNoEffectEmotion(user.name(), "更悲伤了！\r\n")}
            text += '大家都变得开心了！';
          }
          break;

        case "PERFECT ANGELIC WRATH":
          if(target.index() <= unitLowestIndex) {text = user.name() + "释放了她的怒火。\r\n";}
          if(!target._noEffectMessage) {
              if(target.isStateAffected(8)) {text += target.name() + targetSp + '陷入了癫狂！！！\r\n';}
              else if(target.isStateAffected(7)) {text += target.name() + targetSp + '变得狂喜了！！\r\n';}
              else if(target.isStateAffected(6)) {text += target.name() + targetSp + '变得开心了！\r\n';}
              else if(target.isStateAffected(12)) {text += target.name() + targetSp + '陷入了痛苦…………\r\n';}
              else if(target.isStateAffected(11)) {text += target.name() + targetSp + '变得抑郁了……\r\n';}
              else if(target.isStateAffected(10)) {text += target.name() + targetSp + '变得悲伤了。\r\n';}
              else if(target.isStateAffected(12)) {text += target.name() + targetSp + '变得愤怒了！！\r\n';}
              else if(target.isStateAffected(11)) {text += target.name() + targetSp + '陷入了狂怒！！！\r\n';}
              else if(target.isStateAffected(10)) {text += target.name() + targetSp + '变得生气了！\r\n';}
          }
          else {
            if(target.isEmotionAffected("happy")) {text += parseNoEffectEmotion(target.name(), "更开心了！\r\n")}
            else if(target.isEmotionAffected("sad")) {text += parseNoEffectEmotion(target.name(), "更悲伤了！\r\n")}
            else if(target.isEmotionAffected("angry")) {text += parseNoEffectEmotion(target.name(), "更生气了！\r\n")}
          }
          text += hpDamageText;
          break;

        //SLIME GIRLS//
        case 'SLIME GIRLS COMBO ATTACK': //SLIME GIRLS COMBO ATTACK
          text = '所有的' + user.name() + '一齐攻击！\r\n';
          text += hpDamageText;
          break;

        case 'SLIME GIRLS DO NOTHING': //SLIME GIRLS DO NOTHING
          text = '美杜莎扔了一个烧瓶……\r\n';
          text += '但是什么都没有发生……';
          break;

        case 'SLIME GIRLS STRANGE GAS': //SLIME GIRLS STRANGE GAS
            if(!target._noEffectMessage) {
              if(target.isStateAffected(8)) {text += target.name() + targetSp + '陷入了癫狂！！！\r\n';}
              else if(target.isStateAffected(7)) {text += target.name() + targetSp + '变得狂喜了！！\r\n';}
              else if(target.isStateAffected(6)) {text += target.name() + targetSp + '变得开心了！\r\n';}
              else if(target.isStateAffected(12)) {text += target.name() + targetSp + '陷入了痛苦…………\r\n';}
              else if(target.isStateAffected(11)) {text += target.name() + targetSp + '变得抑郁了……\r\n';}
              else if(target.isStateAffected(10)) {text += target.name() + targetSp + '变得悲伤了。\r\n';}
              else if(target.isStateAffected(16)) {text += target.name() + targetSp + '变得愤怒了！！\r\n';}
              else if(target.isStateAffected(15)) {text += target.name() + targetSp + '陷入了狂怒！！！\r\n';}
              else if(target.isStateAffected(14)) {text += target.name() + targetSp + '变得生气了！\r\n';}
          }
          else {
            if(target.isEmotionAffected("happy")) {text += parseNoEffectEmotion(target.name(), "更开心了！\r\n")}
            else if(target.isEmotionAffected("sad")) {text += parseNoEffectEmotion(target.name(), "更悲伤了！\r\n")}
            else if(target.isEmotionAffected("angry")) {text += parseNoEffectEmotion(target.name(), "更生气了！\r\n")}
          }
          break;

        case 'SLIME GIRLS DYNAMITE': //SLIME GIRLS DYNAMITE
          text = '美杜莎扔了一个烧瓶……\r\n';
          text += '烧瓶爆炸了！\r\n';
          text += hpDamageText;
          break;

        case 'SLIME GIRLS STING RAY': //SLIME GIRLS STING RAY
          text = '莫莉发射了螯刺！\r\n';
          text += target.name() + '被蛰了！\r\n';
          text += hpDamageText;
          break;

        case 'SLIME GIRLS SWAP': //SLIME GIRLS SWAP
          text = '美杜莎作法了！\r\n';
          text += '你的心心和体力互换了！';
          break;

        case 'SLIME GIRLS CHAIN SAW': //SLIME GIRLS CHAIN SAW
          text = '玛丽娜拿出了一把电锯！\r\n';
          text += hpDamageText;
          break;

      //HUMPHREY SWARM//
      case 'H SWARM ATTACK': //HUMPHREY SWARM ATTACK
        text = '汉弗莱困住' + targetSp + target.name() + targetSp + '并发起了攻击！\r\n';
        text += hpDamageText;
        break;

      //HUMPHREY LARGE//
      case 'H LARGE ATTACK': //HUMPHREY LARGE ATTACK
        text = '汉弗莱一头撞向' + targetSp + target.name() + targetSp + '！\r\n';
        text += hpDamageText;
        break;

      //HUMPHREY FACE//
      case 'H FACE CHOMP': //HUMPHREY FACE CHOMP
        text = '汉弗莱一口咬住' + targetSp + target.name() + targetSp + '，牙齿嵌了进去！!\r\n';
        text += hpDamageText;
        break;

      case 'H FACE DO NOTHING': //HUMPHREY FACE DO NOTHING
        text = '汉弗莱盯着' + targetSp + target.name() + targetSp + '！\r\n';
        text += '汉弗莱一直淌者口水。';
        break;

      case 'H FACE HEAL': //HUMPHREY FACE HEAL
        text = '汉弗莱吞掉了一名敌人！\r\n';
        text += `汉弗莱回复了 ${Math.abs(hpDam)} 点心心！`
        break;

      //HUMPHREY UVULA//
      case 'UVULA DO NOTHING 1': //HUMPHREY UVULA DO NOTHING
        text = user.name() + '冲着' + targetSp + target.name() + targetSp + '坏笑。\r\n';
      break;

      case 'UVULA DO NOTHING 2': //HUMPHREY UVULA DO NOTHING
      text = user.name() + '冲着' + targetSp + target.name() + targetSp + '使眼色。\r\n';
      break;

      case 'UVULA DO NOTHING 3': //HUMPHREY UVULA DO NOTHING
      text = user.name() + '冲着' + targetSp + target.name() + targetSp + '吐了口口水。\r\n';
      break;

      case 'UVULA DO NOTHING 4': //HUMPHREY UVULA DO NOTHING
      text = user.name() + '瞪着' + targetSp + target.name() + targetSp + '看。\r\n';
      break;

      case 'UVULA DO NOTHING 5': //HUMPHREY UVULA DO NOTHING
      text = user.name() + '冲着' + targetSp + target.name() + targetSp + '眨了眨眼。\r\n';
      break;

      //FEAR OF FALLING//
      case 'DARK NOTHING': //SOMETHING IN THE DARK NOTHING
        text = user.name() + '嘲笑了' + targetSp + target.name() + targetSp + '\r\n';
        text += '坠落时的样子。';
        break;

      case 'DARK ATTACK': //SOMETHING IN THE DARK ATTACK
        text = user.name() + '推了' + targetSp + target.name() + targetSp + '一把。\r\n';
        text += hpDamageText;
        break;

      //FEAR OF BUGS//
      case 'BUGS ATTACK': //FEAR OF BUGS ATTACK
        text = user.name() + '咬了' + targetSp + target.name() + targetSp + '一口！\r\n';
        text += hpDamageText;
        break;

      case 'BUGS NOTHING': //FEAR OF BUGS NOTHING
        text = user.name() + '试着跟你说话……';
        break;

      case 'SUMMON BABY SPIDER': //SUMMON BABY SPIDER
        text = '蜘蛛蛋孵化了，\r\n';
        text += '出现了一只小蜘蛛。';
        break;

      case 'BUGS SPIDER WEBS': //FEAR OF BUGS SPIDER WEBS
        text = user.name() + '抓住了' + targetSp + target.name() + targetSp + '，\r\n';
        text += '把对方困在黏黏的网中。\r\n';
        text += target.name() + targetSp + '的速度下降了！\r\n';
        break;

      //BABY SPIDER//
      case 'BABY SPIDER ATTACK': //BABY SPIDER ATTACK
        text = user.name() + '咬了' + targetSp + target.name() + targetSp + '！\r\n';
        text += hpDamageText;
        break;

      case 'BABY SPIDER NOTHING': //BABY SPIDER NOTHING
        text = user.name() + '发出了奇怪的声音。';
        break;

      //FEAR OF DROWNING//
      case 'DROWNING ATTACK': //FEAR OF DROWNING ATTACK
        text = '水把' + targetSp + target.name() + targetSp + '向不同的\r\n';
        text += '方向拉扯。\r\n';
        text += hpDamageText;
        break;

      case 'DROWNING NOTHING': //FEAR OF DROWNING NOTHING
        text = user.name() + '静静听着' + targetSp + target.name() + targetSp + "挣扎扑腾。";
        break;

      case 'DROWNING DRAG DOWN': //FEAR OF DROWNING DRAG DOWN
        text = user.name() + '抓住了\r\n';
        text += target.name() + targetSp + '的腿，并把他往下拖！\r\n';
        text = hpDamageText;
        break;

      //OMORI'S SOMETHING//
      case 'O SOMETHING ATTACK': //OMORI SOMETHING ATTACK
        text = user.name() + '伸手穿过了' + targetSp + target.name() + targetSp + '。\r\n';
        text += hpDamageText;
        break;

      case 'O SOMETHING NOTHING': //OMORI SOMETHING NOTHING
        text = user.name() + '的视线穿过了' + targetSp + target.name() + targetSp + '。\r\n';
        break;

      case 'O SOMETHING BLACK SPACE': //OMORI SOMETHING BLACK SPACE
        text = user.name() + '把' + targetSp + target.name() + targetSp + '拖进了\r\n';
        text += '阴影之中。';
        text = hpDamageText;
        break;

      case 'O SOMETHING SUMMON': //OMORI SOMETHING SUMMON SOMETHING
        text = user.name() + '从黑暗中叫出了\r\n';
        text += '某个东西。';
        break;

      case 'O SOMETHING RANDOM EMOTION': //OMORI SOMETHING RANDOM EMOTION
        text = user.name() + '玩弄了' + targetSp + target.name() + targetSp +'的情绪。';
        break;

      //BLURRY IMAGE//
      case 'BLURRY NOTHING': //BLURRY IMAGE NOTHING
        text = '某个东西在风中摇晃。';
        break;

      //HANGING BODY//
      case 'HANG WARNING':
          text = '你感到脊背发凉。';
          break;

      case 'HANG NOTHING 1':
          text = '你感到有些头晕。';
          break;

      case 'HANG NOTHING 2':
          text = '你感到肺部收紧了。';
          break;

      case 'HANG NOTHING 3':
          text = '你感到胃部产生了\r\n';
          text += '下坠感。';
          break;

      case 'HANG NOTHING 4':
          text = '你感到心脏要从你的胸膛中\r\n';
          text += '跳出来了。';
          break;

      case 'HANG NOTHING 5':
          text = '你感到自己在颤抖。';
          break;

      case 'HANG NOTHING 6':
          text = '你感到膝盖软弱无力。';
          break;

      case 'HANG NOTHING 7':
          text = '你感到冷汗从前额上\r\n';
          text += '流了下来。';
          break;

      case 'HANG NOTHING 8':
          text = '你感到你的拳头擅自捏紧了。';
          break;

      case 'HANG NOTHING 9':
          text = '你听到你的心跳声。';
          break;

      case 'HANG NOTHING 10':
          text = '你听到你的心跳趋于稳定。';
          break;

      case 'HANG NOTHING 11':
          text = '你听到你的呼吸趋于稳定。';
          break;

      case 'HANG NOTHING 12':
          text = '你集中注意，看向\r\n';
          text += '你的正对面。';
          break;

      //AUBREY//
      case 'AUBREY NOTHING': //AUBREY NOTHING
        text = user.name() + '冲你的鞋子吐了口口水。';
        break;

      case 'AUBREY TAUNT': //AUBREY TAUNT
        text = user.name() + '说' + targetSp + target.name() + targetSp + '很弱！\r\n';
        text += target.name() + "变得生气了！";
        break;

      //THE HOOLIGANS//
      case 'CHARLIE ATTACK': //HOOLIGANS CHARLIE ATTACK
        text = '查理使出浑身解数发起了攻击！\r\n';
        text += hpDamageText;
        break;

      case 'ANGEL ATTACK': //HOOLIGANS ANGEL ATTACK
        text = '安吉尔迅速地攻击了' + targetSp + target.name() + targetSp + '！\r\n';
        text += hpDamageText;
        break;

      case 'MAVERICK CHARM': //HOOLIGANS MAVERICK CHARM
        text = '独行侠冲着' + targetSp + target.name() + targetSp + '眨了眨眼！\r\n';
        text += target.name() + '的攻击下降了。'
        break;

      case 'KIM HEADBUTT': //HOOLIGANS KIM HEADBUTT
        text = '小金一头撞向' + targetSp + target.name() + targetSp + '！\r\n';
        text += hpDamageText;
        break;

      case 'VANCE CANDY': //HOOLIGANS VANCE CANDY
        text = '万斯扔了一把糖果！\r\n';
        text += hpDamageText;
        break;

      case 'HOOLIGANS GROUP ATTACK': //THE HOOLIGANS GROUP ATTACK
        text = user.name() + '全力攻击！\r\n';
        text += hpDamageText;
        break;

      //BASIL//
      case 'BASIL ATTACK': //BASIL ATTACK
        text = user.name() + '伸手摸向' + targetSp + target.name() + targetSp + '的内心深处。\r\n';
        text += hpDamageText;
        break;

      case 'BASIL NOTHING': //BASIL NOTHING
        text = user.name() + '哭得太多了，眼眶红红的。';
        break;

      case 'BASIL PREMPTIVE STRIKE': //BASIL PREMPTIVE STRIKE
        text = user.name() + '划伤了' + targetSp + target.name() + targetSp + '的手臂。\r\n';
        text += hpDamageText;
        break;

      //BASIL'S SOMETHING//
      case 'B SOMETHING ATTACK': //BASIL'S SOMETHING ATTACK
        text = user.name() + '勒住了' + targetSp + target.name() + targetSp + '。\r\n';
        text += hpDamageText;
        break;

      case 'B SOMETHING TAUNT': //BASIL'S SOMETHING TAUNT BASIL
        text = user.name() + '伸手摸向' + targetSp + target.name() + targetSp + '的内心深处。\r\n';
        break;

      //PLAYER SOMETHING BASIL FIGHT//
      case 'B PLAYER SOMETHING STRESS': //B PLAYER SOMETHING STRESS
        text = user.name() + '对\r\n';
        text += target.name() + targetSp + '做了些什么。\r\n';
        text += hpDamageText;
        break;

      case 'B PLAYER SOMETHING HEAL': //B PLAYER SOMETHING HEAL
        text = user.name() + '渗入了' + targetSp + target.name() + targetSp + '的伤口。\r\n';
        text += hpDamageText;
        break;

      case 'B OMORI SOMETHING CONSUME EMOTION': //B OMORI SOMETHING CONSUME EMOTION
        text = user.name() + '吞噬了' + targetSp + target.name() + targetSp + '的情绪。';
        break;

      //CHARLIE//
      case 'CHARLIE RELUCTANT ATTACK': //CHARLIE RELUCTANT ATTACK
        text = user.name() + '揍了' + targetSp + target.name() + targetSp + '一拳！\r\n';
        text += hpDamageText;
        break;

      case 'CHARLIE NOTHING': //CHARLIE NOTHING
        text = user.name() + '只是站在那里。';
        break;

      case 'CHARLIE LEAVE': //CHARLIE LEAVE
        text = user.name() + '不打了。';
        break;

      //ANGEL//
      case 'ANGEL ATTACK': //ANGEL ATTACK
        text = user.name() + '快速地踢了' + targetSp + target.name() + targetSp + '一脚！\r\n';
        text += hpDamageText;
        break;

      case 'ANGEL NOTHING': //ANGEL NOTHING
        text = user.name() + '表演了后空翻并凹了个造型！';
        break;

      case 'ANGEL QUICK ATTACK': //ANGEL QUICK ATTACK
        text = user.name() + '传送到了' + targetSp + target.name() + targetSp + '背后！\r\n';
        text += hpDamageText;
        break;

      case 'ANGEL TEASE': //ANGEL TEASE
        text = user.name() + '对' + targetSp + target.name() + targetSp + '说了些刻薄话！';
        break;

      //THE MAVERICK//
      case 'MAVERICK ATTACK': //THE MAVERICK ATTACK
        text = user.name() + '攻击了' + targetSp + target.name() + targetSp + '！\r\n';
        text += hpDamageText;
        break;

      case 'MAVERICK NOTHING': //THE MAVERICK NOTHING
        text = user.name() + '对着崇拜他的粉丝们\r\n';
        text += '吹捧自己！';
        break;

      case 'MAVERICK SMILE': //THE MAVERICK SMILE
        text = user.name() + '魅惑一笑！\r\n';
        text += target.name() + targetSp + '的攻击下降了。';
        break;

      case 'MAVERICK TAUNT': //THE MAVERICK TAUNT
        text = user.name() + '嘲笑了' + targetSp + target.name() + '！\r\n';
        text += target.name() + targetSp + "变得生气了！"
        break;

      //KIM//
      case 'KIM ATTACK': //KIM ATTACK
        text = user.name() + '揍了' + targetSp + target.name() + targetSp + '一拳！\r\n';
        text += hpDamageText;
        break;

      case 'KIM NOTHING': //KIM DO NOTHING
        text = user.name() + '的手机响了……\r\n';
        text += '有人打错电话了。';
        break;

      case 'KIM SMASH': //KIM SMASH
        text = user.name() + '抓住了' + targetSp + target.name() + targetSp + '的衬衫，然后\r\n';
        text += '一拳揍在对方脸上！\r\n';
        text += hpDamageText;
        break;

      case 'KIM TAUNT': //KIM TAUNT
        text = user.name() + '嘲笑了' + targetSp + target.name() + targetSp + '！\r\n';
        text += target.name() + targetSp + "变得悲伤了。";
        break;

      //VANCE//
      case 'VANCE ATTACK': //VANCE ATTACK
        text = user.name() + '揍了' + targetSp + target.name() + targetSp + '一拳！\r\n';
        text += hpDamageText;
        break;

      case 'VANCE NOTHING': //VANCE NOTHING
        text = user.name() + '挠了挠自己的肚子。';
        break;

      case 'VANCE CANDY': //VANCE CANDY
        text = user.name() + '把过期糖果扔向' + targetSp + target.name() + targetSp + '！\r\n';
        text += '恶……黏黏的……\r\n';
        text += hpDamageText;
        break;

      case 'VANCE TEASE': //VANCE TEASE
        text = user.name() + '冲着' + targetSp + target.name() + targetSp + '说了些刻薄话！\r\n';
        text += target.name() + targetSp +  "变得悲伤了。"
        break;

      //JACKSON//
      case 'JACKSON WALK SLOWLY': //JACKSON WALK SLOWLY
        text = user.name() + '正步步逼近你……\r\n';
        text += '你觉得自己无法逃脱！';
        break;

      case 'JACKSON KILL': //JACKSON AUTO KILL
        text = user.name() + '抓住你了！！！\r\n';
        text += '你眼前浮现了人生的跑马灯！';
        break;

      //RECYCLEPATH//
      case 'R PATH ATTACK': //RECYCLEPATH ATTACK
        text = user.name() + '用包攻击了' + targetSp + target.name() + targetSp + '！\r\n';
        text += hpDamageText;
        break;

      case 'R PATH SUMMON MINION': //RECYCLEPATH SUMMON MINION
        text = user.name() + '唤来一位信徒！\r\n';
        text += '一位回收教徒出现了！';
        break;

      case 'R PATH FLING TRASH': //RECYCLEPATH FLING TRASH
        text = user.name() + '冲着\r\n';
        text +=target.name() + targetSp + '把所有的垃圾扔了出去！\r\n'
        text += hpDamageText;
        break;

      case 'R PATH GATHER TRASH': //RECYCLEPATH GATHER TRASH
        text = user.name() + '捡起了垃圾！';
        break;

    //SOMETHING IN THE CLOSET//
      case 'CLOSET ATTACK': //SOMETHING IN THE CLOSET ATTACK
        text = user.name() + '缠住了' + targetSp + target.name() + targetSp + '！\r\n';
        text += hpDamageText;
        break;

      case 'CLOSET NOTHING': //SOMETHING IN THE CLOSET DO NOTHING
        text = user.name() + '发出令人毛骨悚然的喃喃细语。';
        break;

      case 'CLOSET MAKE AFRAID': //SOMETHING IN THE CLOSET MAKE AFRAID
        text = user.name() + '知道你的秘密！';
        break;

      case 'CLOSET MAKE WEAK': //SOMETHING IN THE CLOSET MAKE WEAK
        text = user.name() + '让' + targetSp + target.name() + targetSp + '丧失了求生欲！';
        break;

    //BIG STRONG TREE//
      case 'BST SWAY': //BIG STRONG TREE NOTHING 1
        text = '微风轻拂树叶。';
        break;

      case 'BST NOTHING': //BIG STRONG TREE NOTHING 2
        text = user.name() + '在原地一动不动，因为\r\n';
        text += '它是一棵树。';
        break;

    //DREAMWORLD FEAR EXTRA BATTLES//
    //HEIGHTS//
    case 'DREAM HEIGHTS ATTACK': //DREAM FEAR OF HEIGHTS ATTACK
      text = user.name() + '攻击了' + targetSp + target.name() + targetSp + '。\r\n';
      text += hpDamageText;
      break;

    case 'DREAM HEIGHTS GRAB': //DREAM FEAR OF HEIGHTS GRAB
      if(target.index() <= unitLowestIndex) {
        text = '手出现了，抓住了所有人！\r\n';
        text += '所有人' + '的攻击下降了……';
      }

      break;

    case 'DREAM HEIGHTS HANDS': //DREAM FEAR OF HEIGHTS HANDS
      text = '更多的手出现了，环绕在\r\n';
      text += user.name() + userSp + '身边。\r\n';
      if(!target._noStateMessage) {text += user.name() + userSp + '的防御上升了！';}
      else {text += parseNoStateChange(user.name(), "防御", "更高了！")}
      break;

    case 'DREAM HEIGHTS SHOVE': //DREAM FEAR OF HEIGHTS SHOVE
      text = user.name() + '推了' + targetSp + target.name() + targetSp + '一下。\r\n';
      text += hpDamageText + '\r\n';
      if(!target._noEffectMessage && target.name() !== "OMORI"){text += target.name() + targetSp + '感到害怕。';}
      else {text += parseNoEffectEmotion(target.name(), "害怕")}
      break;

    case 'DREAM HEIGHTS RELEASE ANGER': //DREAM FEAR OF HEIGHTS RELEASE ANGER
      text = user.name() + '把怒火发泄在大家身上！';
      break;

    //SPIDERS//
    case 'DREAM SPIDERS CONSUME': //DREAM FEAR OF SPIDERS CONSUME
      text = user.name() + '把' + targetSp + target.name() + targetSp + '卷成一团，吃掉了。\r\n';
      text += hpDamageText;
      break;

    //DROWNING//
    case 'DREAM DROWNING SMALL': //DREAM FEAR OF DROWNING SMALL
      text = '大家都呼吸困难。';
      break;

    case 'DREAM DROWNING BIG': //DREAM FEAR OF DROWNING BIG
      text = '大家都感觉快昏迷了。';
      break;

    // BLACK SPACE EXTRA //
    case 'BS LIAR': // BLACK SPACE LIAR
      text = '骗子。';
      break;

    //BACKGROUND ACTORS//
    //BERLY//
      case 'BERLY ATTACK': //BERLY ATTACK
        text = '波利头槌了' + targetSp + target.name() + targetSp + '！\r\n';
        text += hpDamageText;
        break;

      case 'BERLY NOTHING 1': //BERLY NOTHING 1
        text = '波利勇敢地藏在角落里。';
        break;

      case 'BERLY NOTHING 2': //BERLY NOTHING 2
        text = '波利修好了她的眼镜。';
        break;

      //TOYS//
      case 'CAN':  // CAN
        text = user.name() + '踢了易拉罐。';
        break;

      case 'DANDELION':  // DANDELION
        text = user.name() + '吹散了蒲公英。\r\n';
        text += user.name() + '重新找回了自我。';
        break;

      case 'DYNAMITE':  // DYNAMITE
        text = user.name() + '扔出了炸药！';
        break;

      case 'LIFE JAM':  // LIFE JAM
        text = user.name() + '对吐司使用了生命果酱！\r\n';
        text += '吐司变成了' + targetSp + target.name() + targetSp + '！';
        break;

      case 'PRESENT':  // PRESENT
        text = target.name() + '打开了礼物！\r\n';
        text += '并不是' + targetSp + target.name() + targetSp + '想要的东西……\r\n';
        if(!target._noEffectMessage){text += target.name() + targetSp + '变得生气了！ ';}
        else {text += parseNoEffectEmotion(target.name(), "更生气了！")}
        break;

      case 'SILLY STRING':  // DYNAMITE
        if(target.index() <= unitLowestIndex) {
          text = user.name() + '使用了喷彩摩丝！\r\n';
          text += '哇哦！！派对开始了！\r\n';
          text += '大家都变得开心了！ ';
        }
        break;

      case 'SPARKLER':  // SPARKLER
        text = user.name() + '点燃了烟花棒！\r\n';
        text += '哇哦！！派对开始了！\r\n';
        if(!target._noEffectMessage){text += target.name() + targetSp + '变得开心了！';}
        else {text += parseNoEffectEmotion(target.name(), "更开心了！")}
        break;

      case 'COFFEE': // COFFEE
        text = user.name() + '喝了咖啡……\r\n';
        text += user.name() + '感觉好极了！';
        break;

      case 'RUBBERBAND': // RUBBERBAND
        text = user.name() + '弹了' + targetSp + target.name() + targetSp + '一下！\r\n';
        text += hpDamageText;
        break;

      //OMORI BATTLE//

      case "OMORI ERASES":
        text = user.name() + "抹去了敌人。\r\n";
        text += hpDamageText;
        break;

      case "MARI ATTACK":
        text = user.name() + "抹去了敌人。\r\n";
        text += target.name() + targetSp + "感到害怕。\r\n";
        text += hpDamageText;
        break;

      //STATES//
      case 'HAPPY':
        if(!target._noEffectMessage){text = target.name() + targetSp + '变得开心了！';}
        else {text = parseNoEffectEmotion(target.name(), "更开心了！")}
        break;

      case 'ECSTATIC':
        if(!target._noEffectMessage){text = target.name() + targetSp + '变得狂喜了！！';}
        else {text = parseNoEffectEmotion(target.name(), "更开心了！")}
        break;

      case 'MANIC':
        if(!target._noEffectMessage){text = target.name() + targetSp + '陷入了癫狂！！！';}
        else {text = parseNoEffectEmotion(target.name(), "更开心了！")}
        break;

      case 'SAD':
        if(!target._noEffectMessage){text = target.name() + targetSp + '变得悲伤了。';}
        else {text = parseNoEffectEmotion(target.name(), "更悲伤了！")}
        break;

      case 'DEPRESSED':
        if(!target._noEffectMessage){text = target.name() + targetSp + '变得抑郁了……';}
        else {text = parseNoEffectEmotion(target.name(), "更悲伤了！")}
        break;

      case 'MISERABLE':
        if(!target._noEffectMessage){text = target.name() + targetSp + '陷入了痛苦…………';}
        else {text = parseNoEffectEmotion(target.name(), "更悲伤了！")}
        break;

      case 'ANGRY':
        if(!target._noEffectMessage){text = target.name() + targetSp + '变得生气了！';}
        else {text = parseNoEffectEmotion(target.name(), "更生气了！")}
        break;

      case 'ENRAGED':
        if(!target._noEffectMessage){text = target.name() + targetSp + '变得愤怒了！！';}
        else {text = parseNoEffectEmotion(target.name(), "更生气了！")}
        break;

      case 'FURIOUS':
        if(!target._noEffectMessage){text = target.name() + targetSp + '陷入了狂怒！！！'}
        else {text = parseNoEffectEmotion(target.name(), "更生气了！")}
        break;

      case 'AFRAID':
        if(!target._noEffectMessage){text = target.name() + targetSp + '变得害怕了！';}
        else {text = parseNoEffectEmotion(target.name(), "更害怕了！")}
        break;

      case 'CANNOT MOVE':
        text = target.name() + targetSp + '无法动弹！';
        break;

      case 'INFATUATION':
        text = target.name() + targetSp + '因为爱而无法动弹！';
        break;



  }
  // Return Text
  return text;
};
//=============================================================================
// * Display Custom Action Text
//=============================================================================
Window_BattleLog.prototype.displayCustomActionText = function(subject, target, item) {
  // Make Custom Action Text
  var text = this.makeCustomActionText(subject, target, item);
  // If Text Length is more than 0
  if (text.length > 0) {
    if(!!this._multiHitFlag && !!item.isRepeatingSkill) {return;}
    // Get Get
    text = text.split(/\r\n/);
    for (var i = 0; i < text.length; i++) { this.push('addText', text[i]); }
    // Add Wait
    this.push('wait', 15);

  }
  if(!!item.isRepeatingSkill) {this._multiHitFlag = true;}
};
//=============================================================================
// * Display Action
//=============================================================================
Window_BattleLog.prototype.displayAction = function(subject, item) {
  // Return if Item has Custom Battle Log Type
  if (item.meta.BattleLogType) { return; }
  // Run Original Function
  _TDS_.CustomBattleActionText.Window_BattleLog_displayAction.call(this, subject, item);
};
//=============================================================================
// * Display Action Results
//=============================================================================
Window_BattleLog.prototype.displayActionResults = function(subject, target) {
  // Get Item Object
  var item = BattleManager._action._item.object();
  // If Item has custom battle log type
  if (item && item.meta.BattleLogType) {
    // Display Custom Action Text
    this.displayCustomActionText(subject, target, item);
    // Return
  }
  // Run Original Function
  else {
    _TDS_.CustomBattleActionText.Window_BattleLog_displayActionResults.call(this, subject, target);
  }
};

const _old_window_battleLog_displayHpDamage = Window_BattleLog.prototype.displayHpDamage
Window_BattleLog.prototype.displayHpDamage = function(target) {
  let result = target.result();
  if(result.isHit() && result.hpDamage > 0) {
    if(!!result.elementStrong) {
      this.push("addText","……迅捷一击！");
      this.push("waitForNewLine");
    }
    else if(!!result.elementWeak) {
      this.push("addText", "……疲软一击。");
      this.push("waitForNewLine")
    }
  }
  return _old_window_battleLog_displayHpDamage.call(this, target)
};

//=============================================================================
// * CLEAR
//=============================================================================
_TDS_.CustomBattleActionText.Window_BattleLog_endAction= Window_BattleLog.prototype.endAction;
Window_BattleLog.prototype.endAction = function() {
  _TDS_.CustomBattleActionText.Window_BattleLog_endAction.call(this);
  this._multiHitFlag = false;
};

//=============================================================================
// * DISPLAY ADDED STATES
//=============================================================================
