'use strict';

/* ============================================================================
 * emotion-data.js — 情绪定义、初始数值、离线衰减、说话情绪判断
 * （从网页版 game/game.js 迁移，数值保持一致）
 * ==========================================================================*/

var SAVE_KEY = 'sunflower-pet-v1';

var DEFAULTS = {
  water: 66, light: 60, bond: 34, energy: 74,
  growth: 10, lastSeen: Date.now(), introSeen: false, seed: 20251107
};

var FACE_BASE = {
  eyeOpen: 0.88, eyeCurve: 0, pupilX: 0, pupilY: 0,
  mouthOpen: 0, smile: 0.22, blush: 0.1,
  tears: 0, anger: 0, sleep: 0, sparkle: 0,
  brow: 0, browTilt: 0, browRaise: 0, blink: 1
};

var BODY_BASE = {
  pitch: 0, roll: 0, petal: 0.04, twist: 0,
  tint: [1, 1, 1], light: 1, bob: 0.5, lean: 0
};

var EMOTIONS = {
  happy: {
    label: '开心', mood: '阳光',
    face: { eyeOpen: 0.02, eyeCurve: 1, mouthOpen: 0.55, smile: 1, blush: 0.4, sparkle: 0.9 },
    body: { pitch: -0.05, roll: 0.02, petal: 0.12, tint: [1.04, 1.0, 0.92], light: 1.08, bob: 1.0 },
    tip: '弯眼、张嘴笑，花瓣张开轻轻晃'
  },
  angry: {
    label: '生气', mood: '不满',
    face: { eyeOpen: 0.55, pupilY: 0.05, brow: 1, browTilt: 1, smile: -0.8, anger: 0.9, blush: 0.2 },
    body: { pitch: 0.12, roll: -0.04, petal: 0.18, twist: 0.08, tint: [1.06, 0.88, 0.78], light: 0.95, bob: 0.35 },
    tip: '压低眉毛、撇嘴，花头向前压'
  },
  sad: {
    label: '难过', mood: '低落',
    face: { eyeOpen: 0.78, pupilY: 0.45, brow: 0.6, browTilt: -0.8, smile: -0.9, tears: 0.9, blush: 0.05 },
    body: { pitch: 0.2, roll: 0.03, petal: -0.22, tint: [0.82, 0.86, 0.96], light: 0.72, bob: 0.2, lean: 0.05 },
    tip: '眼神下垂、流泪，花瓣跟着蔫'
  },
  sleepy: {
    label: '困倦', mood: '困了',
    face: { eyeOpen: 0.16, pupilY: 0.2, mouthOpen: 0.3, smile: 0.05, sleep: 1, blush: 0.08 },
    body: { pitch: 0.1, roll: 0.09, petal: -0.1, tint: [0.9, 0.9, 0.84], light: 0.7, bob: 0.35 },
    tip: '半闭眼、打哈欠，点头慢摆'
  },
  shy: {
    label: '害羞', mood: '害羞',
    face: { eyeOpen: 0.02, eyeCurve: 0.9, smile: 0.55, blush: 0.95, sparkle: 0.15 },
    body: { pitch: -0.01, roll: -0.12, petal: 0.22, tint: [1.05, 0.94, 0.94], light: 1.0, bob: 0.5 },
    tip: '弯眼、强腮红，偏头躲开'
  },
  curious: {
    label: '好奇', mood: '好奇',
    face: {
      eyeOpen: 1, pupilX: 0.4, pupilY: -0.2, mouthOpen: 0.22, smile: 0.15,
      brow: 0.5, browTilt: -0.4, browRaise: 0.8, blush: 0.1, sparkle: 0.2
    },
    body: { pitch: -0.03, roll: 0.12, petal: 0.14, tint: [1.02, 0.99, 0.92], light: 1.05, bob: 0.7 },
    tip: '睁大眼、歪着头，花瓣前倾'
  },
  calm: {
    label: '平静', mood: '安静',
    face: {},
    body: {},
    tip: '安安静静地待着'
  }
};

var IDLE_LINES = {
  happy: ['今天的光刚刚好。', '你在的时候，花瓣都轻一点。', '要不要陪我待一会儿？'],
  angry: ['哼。', '我现在不太想说话。', '水有点多了。'],
  sad: ['有点蔫……', '可以陪陪我吗？', '我好像需要一点水。'],
  sleepy: ['眼皮好重……', '天黑了，我想睡了。', '晚安的时候记得叫我。'],
  shy: ['别一直看我……', '再摸一下也可以。', '花瓣有点烫。'],
  curious: ['你在做什么？', '刚刚那是什么声音？', '今天会发生什么？'],
  calm: ['风很轻。', '我在这里。', '慢慢来就好。']
};

var REPLY = {
  happy: ['我也是！', '和你在一起真开心。', '今天的花瓣都亮起来了。'],
  sad: ['我在这里陪着你。', '难过的时候，可以靠一会儿。', '不用急着好起来。'],
  sleepy: ['那我们一起休息吧。', '晚安，明天见。', '先闭上眼睛，好不好？'],
  curious: ['然后呢？', '我在听。', '你今天发生了什么？']
};

var QUICK_LINES = ['今天很开心', '有点累了', '想你了'];

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function choose(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function emotionPose(name) {
  var e = EMOTIONS[name] || EMOTIONS.calm;
  var face = {};
  var body = {};
  var k;
  for (k in FACE_BASE) face[k] = FACE_BASE[k];
  for (k in BODY_BASE) body[k] = BODY_BASE[k];
  if (e.face) for (k in e.face) face[k] = e.face[k];
  if (e.body) for (k in e.body) body[k] = e.body[k];
  body.tint = (e.body && e.body.tint) ? e.body.tint.slice() : [1, 1, 1];
  return { face: face, body: body };
}

function sentiment(text) {
  var t = text || '';
  if (/(累|困|睡|熬夜|晚安)/.test(t)) return 'sleepy';
  if (/(难过|伤心|哭|烦|压力|焦虑|孤单|讨厌|生气|不好|失望)/.test(t)) return 'sad';
  if (/(开心|喜欢|爱你|漂亮|谢谢|棒|可爱|想你|陪你|好耶)/.test(t)) return 'happy';
  return 'curious';
}

/* 离线衰减：最多累计 48 小时 */
function applyOffline(state, now) {
  now = now || Date.now();
  var hours = Math.max(0, Math.min(48, (now - (state.lastSeen || now)) / 3600000));
  if (hours >= 0.05) {
    state.water = clamp(state.water - hours * 1.6, 8, 100);
    state.light = clamp(state.light - hours * 0.9, 8, 100);
    state.energy = clamp(state.energy - hours * 0.7, 12, 100);
    state.bond = clamp(state.bond - hours * 0.12, 5, 100);
  }
  return hours;
}

module.exports = {
  SAVE_KEY: SAVE_KEY,
  DEFAULTS: DEFAULTS,
  FACE_BASE: FACE_BASE,
  BODY_BASE: BODY_BASE,
  EMOTIONS: EMOTIONS,
  IDLE_LINES: IDLE_LINES,
  REPLY: REPLY,
  QUICK_LINES: QUICK_LINES,
  clamp: clamp,
  choose: choose,
  emotionPose: emotionPose,
  sentiment: sentiment,
  applyOffline: applyOffline
};
