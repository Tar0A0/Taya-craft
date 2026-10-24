// ═══ TAYACRAFT GAME STATE, QUESTIONNAIRE & UI INTERACTIONS (interactions.js) ═══
// shortcut: single-tab localStorage JSON blob (<50KB), migrate to IndexedDB or cloud sync if multi-room blueprints are added
// ─── 2. GAME STATE & DATA DEFINITIONS ───
const simStorageKey = 'tayacraft-life-sim-v3';
const simDefaultState = {
  name: '小日',
  stage: 'starter', // 'starter' | 'family' | 'senior'
  needs: { hunger: 76, energy: 80, hygiene: 72, social: 64, fun: 70 },
  money: 800,
  day: 1,
  minutes: 510, // 08:30
  paused: true,
  speed: 1,
  camAngleIndex: 0,
  lastAction: '歡迎來到全新空屋！請至「🛋️ 家具商城」或「🛠️ 軌道工坊」添購並自由擺設家具。',
  player: { x: 4.8, y: 4.5, angle: 0.85, targetAngle: 0.85, targetX: null, targetY: null, pendingAction: null },
  quest: null,
  profile: { area: 18, people: 2 },
  furniture: [],
  dlcs: { work: false, family: false, storage: false, safe: false },
  trackPos: { work: 5.1, family: 2.1, storage: 7.35, safe: 2.05 },
  esgScore: 30,
  xrayMode: false,
  actionCounter: 0,
  wallMode: 'cutaway', // 'cutaway' | 'full' | 'none'
  showGrid: true,
  showHitbox: false,
  panoramic: false
};

const simNeedData = [
  { id: 'hunger', label: '飽足', icon: '🍜' },
  { id: 'energy', label: '精力', icon: '⚡' },
  { id: 'hygiene', label: '清潔', icon: '🫧' },
  { id: 'social', label: '社交', icon: '💬' },
  { id: 'fun', label: '娛樂', icon: '🎨' }
];

const simActions = [
  { id: 'work', label: '居家工作', icon: '💻', targetObj: 'work', text: '完成了一段遠端工作。', changes: { energy: -14, hunger: -8, fun: -5, hygiene: -2 }, minutes: 90, cost: -75 },
  { id: 'eat', label: '料理用餐', icon: '🥪', targetObj: 'family', text: '享用了熱騰騰的餐點。', changes: { hunger: 30, energy: 2, hygiene: -1 }, minutes: 35, cost: 12 },
  { id: 'relax', label: '沙發放鬆', icon: '🛋️', targetObj: 'sofa', text: '在客廳放鬆看了一會兒節目。', changes: { fun: 28, social: 4, energy: -3 }, minutes: 45, cost: 0 },
  { id: 'sleep', label: '上床睡覺', icon: '🛏️', targetObj: 'bed', text: '在舒適的床上睡了一覺。', changes: { energy: 45, hunger: -9, hygiene: -3, fun: 4 }, minutes: 180, cost: 0 },
  { id: 'shower', label: '衛浴沖澡', icon: '🚿', targetObj: 'shower', text: '洗完熱水澡，全身神清氣爽！', changes: { hygiene: 45, energy: -2, fun: 4 }, minutes: 30, cost: 0 },
  { id: 'chat', label: '親友聯絡', icon: '📱', targetObj: 'sofa', text: '與朋友暢聊近況，心情大好！', changes: { social: 32, fun: 10, energy: -3 }, minutes: 35, cost: 0 }
];

const simQuestCatalog = [
  { id: 'work-sprint', title: '遠端專案衝刺', description: '在工作區完成 1 次居家工作，體驗 WORK DLC 高效檯面。', actionId: 'work', target: 1, reward: 65 },
  { id: 'home-chef', title: '中島料理時光', description: '在料理區享用 1 次餐點，補充今日飽足感。', actionId: 'eat', target: 1, reward: 45 },
  { id: 'cozy-break', title: '客廳充電時刻', description: '到沙發區放鬆休息 1 次，釋放日常壓力。', actionId: 'relax', target: 1, reward: 40 },
  { id: 'social-warmth', title: '與親友分享新家', description: '執行 1 次親友聯絡，提升社交能量。', actionId: 'chat', target: 1, reward: 45 },
  { id: 'fresh-bath', title: '清爽衛浴重開機', description: '到衛浴區沖澡 1 次，恢復滿滿潔淨感。', actionId: 'shower', target: 1, reward: 40 },
  { id: 'deep-sleep', title: '安穩睡眠計畫', description: '在臥床睡一覺，為明天儲備充沛精力。', actionId: 'sleep', target: 1, reward: 55 }
];

const extraFurnitureCatalog = [
  { id: 'bed-set', sceneId: 'bed', name: '舒適雙人臥床', icon: '🛏️', area: 2.2, price: 120, desc: '安穩睡眠恢復精力核心' },
  { id: 'shower-pod', sceneId: 'shower', name: '乾濕分離衛浴艙', icon: '🚿', area: 1.5, price: 95, desc: '清爽沖澡恢復潔淨感' },
  { id: 'sofa-set', sceneId: 'sofa', name: '北歐雙人沙發組', icon: '🛋️', area: 1.8, price: 110, desc: '舒適客廳休憩核心' },
  { id: 'tv-wall', sceneId: 'tv', name: '智慧影音電視牆', icon: '📺', area: 0.9, price: 90, desc: '娛樂與家庭劇院加成' },
  { id: 'kitchen-cart', sceneId: 'cart', name: '移動式料理推車', icon: '🥘', area: 0.6, price: 65, desc: '彈性增加備料空間' },
  { id: 'plant-deco', sceneId: 'plant', name: '琴葉榕大型植栽', icon: '🌿', area: 0.4, price: 45, desc: '綠意淨化提升心情' }
];

const stagePresets = {
  starter: {
    label: '25~40歲 建立生活階段',
    area: 18,
    people: 2,
    dlcs: { work: true, family: false, storage: false, safe: false },
    msg: '🌱 已切換至「25~40歲 建立生活階段」：已自動在 3D 軌道扣入 WORK DLC 折疊工作桌！'
  },
  family: {
    label: '40~65歲 家庭轉換階段',
    area: 25,
    people: 3,
    dlcs: { work: true, family: true, storage: true, safe: false },
    msg: '👨‍👩‍👧 已切換至「40~65歲 家庭轉換階段」：已擴充 FAMILY 料理中島與 STORAGE 頂天立地收納牆！'
  },
  senior: {
    label: '65歲+ 樂齡安老階段',
    area: 25,
    people: 2,
    dlcs: { work: false, family: true, storage: true, safe: true },
    msg: '🌿 已切換至「65歲+ 樂齡安老階段」：已啟用 SAFE DLC 樂齡防撞扶手與夜間感應引導地燈！'
  }
};

function clampNeed(val) {
  return Math.max(0, Math.min(100, val));
}

function createRandomSimQuest(prevId = '') {
  const pool = simQuestCatalog.filter(q => q.id !== prevId);
  const picked = pool[Math.floor(Math.random() * pool.length)] || simQuestCatalog[0];
  return { id: picked.id, progress: 0 };
}

function loadSimState() {
  const makeCleanDefault = () => ({
    ...simDefaultState,
    needs: { ...simDefaultState.needs },
    player: { ...simDefaultState.player },
    quest: createRandomSimQuest(),
    profile: { ...simDefaultState.profile },
    furniture: [...simDefaultState.furniture],
    dlcs: { ...simDefaultState.dlcs },
    trackPos: { ...simDefaultState.trackPos }
  });
  try {
    const raw = localStorage.getItem(simStorageKey);
    if (!raw) return makeCleanDefault();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return makeCleanDefault();

    const safeNeeds = { ...simDefaultState.needs };
    if (parsed.needs && typeof parsed.needs === 'object') {
      Object.keys(safeNeeds).forEach(k => {
        const v = Number(parsed.needs[k]);
        safeNeeds[k] = clampNeed(Number.isFinite(v) ? v : safeNeeds[k]);
      });
    }

    const legacyFurnMap = {
      bed: 'bed-set',
      shower: 'shower-pod',
      sofa: 'sofa-set',
      tv: 'tv-wall',
      cart: 'kitchen-cart',
      plant: 'plant-deco'
    };
    const validBaseIds = new Set(extraFurnitureCatalog.map(b => b.id));
    const safeFurniture = Array.isArray(parsed.furniture)
      ? Array.from(new Set(
          parsed.furniture
            .map(id => (typeof id === 'string' ? (legacyFurnMap[id] || id) : ''))
            .filter(id => validBaseIds.has(id))
        ))
      : [];

    const areaVal = Number(parsed.profile?.area);
    const peopleVal = Number(parsed.profile?.people);
    const moneyVal = Number(parsed.money);
    const dayVal = Number(parsed.day);
    const minVal = Number(parsed.minutes);
    const spdVal = Number(parsed.speed);

    return {
      ...simDefaultState,
      ...parsed,
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim().slice(0, 18) : simDefaultState.name,
      stage: ['starter', 'family', 'senior'].includes(parsed.stage) ? parsed.stage : 'starter',
      day: Number.isFinite(dayVal) && dayVal >= 1 ? Math.floor(dayVal) : 1,
      minutes: Number.isFinite(minVal) ? ((Math.floor(minVal) % 1440) + 1440) % 1440 : 510,
      money: Number.isFinite(moneyVal) ? Math.max(0, Math.round(moneyVal)) : simDefaultState.money,
      speed: [1, 2, 3].includes(spdVal) ? spdVal : 1,
      needs: safeNeeds,
      player: {
        x: Number.isFinite(Number(parsed.player?.x)) ? Math.max(0.75, Math.min(12.5, Number(parsed.player.x))) : 4.8,
        y: Number.isFinite(Number(parsed.player?.y)) ? Math.max(1.15, Math.min(8.0, Number(parsed.player.y))) : 4.5,
        angle: Number.isFinite(Number(parsed.player?.angle)) ? Number(parsed.player.angle) : 0.85,
        targetAngle: Number.isFinite(Number(parsed.player?.targetAngle)) ? Number(parsed.player.targetAngle) : 0.85,
        targetX: null,
        targetY: null,
        pendingAction: null
      },
      quest: (parsed.quest && typeof parsed.quest.id === 'string' && simQuestCatalog.some(q => q.id === parsed.quest.id))
        ? { id: parsed.quest.id, progress: Number.isFinite(Number(parsed.quest.progress)) ? Math.max(0, Math.floor(Number(parsed.quest.progress))) : 0 }
        : createRandomSimQuest(),
      profile: {
        area: [5, 12, 18, 25, 32].includes(areaVal) ? areaVal : 18,
        people: [1, 2, 3, 4].includes(peopleVal) ? peopleVal : 2
      },
      furniture: safeFurniture,
      dlcs: {
        work: Boolean(parsed.dlcs?.work),
        family: Boolean(parsed.dlcs?.family),
        storage: Boolean(parsed.dlcs?.storage),
        safe: Boolean(parsed.dlcs?.safe)
      },
      trackPos: {
        work: Number.isFinite(Number(parsed.trackPos?.work)) ? Math.max(1.8, Math.min(11.0, Number(parsed.trackPos.work))) : 5.1,
        family: Number.isFinite(Number(parsed.trackPos?.family)) ? Math.max(1.75, Math.min(9.0, Number(parsed.trackPos.family))) : 2.1,
        storage: Number.isFinite(Number(parsed.trackPos?.storage)) ? Math.max(1.8, Math.min(11.6, Number(parsed.trackPos.storage))) : 7.35,
        safe: Number.isFinite(Number(parsed.trackPos?.safe)) ? Math.max(1.85, Math.min(7.0, Number(parsed.trackPos.safe))) : 2.05
      },
      esgScore: Number.isFinite(Number(parsed.esgScore)) ? Math.max(0, Math.round(Number(parsed.esgScore))) : 30,
      xrayMode: Boolean(parsed.xrayMode),
      actionCounter: Number.isFinite(Number(parsed.actionCounter)) ? Math.max(0, Math.floor(Number(parsed.actionCounter))) : 0,
      wallMode: ['cutaway', 'full', 'none'].includes(parsed.wallMode) ? parsed.wallMode : 'cutaway',
      showGrid: typeof parsed.showGrid === 'boolean' ? parsed.showGrid : true,
      showHitbox: Boolean(parsed.showHitbox),
      panoramic: Boolean(parsed.panoramic),
      paused: true
    };
  } catch (e) {
    return makeCleanDefault();
  }
}

let simState = loadSimState();
window.simState = simState;
const simMessage = document.getElementById('simMessage');
const simSoundButton = document.getElementById('simSound');
let simSoundEnabled = true;
let simAudioContext = null;

// shortcut: single-tab localStorage JSON blob (<50KB), migrate to IndexedDB or cloud sync if multi-room blueprints are added
function saveSimState() {
  try {
    localStorage.setItem(simStorageKey, JSON.stringify(simState));
  } catch (e) {
    // Ignore storage quota errors
  }
}

async function playSimSound(tone = 'tap') {
  if (!simSoundEnabled) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    if (!simAudioContext) simAudioContext = new AudioCtx();
    if (simAudioContext.state === 'suspended') await simAudioContext.resume();
    const osc = simAudioContext.createOscillator();
    const gain = simAudioContext.createGain();
    const now = simAudioContext.currentTime;
    const freqs = { tap: 520, action: 660, confirm: 740, error: 240, snap: 860, buff: 960 };

    if (tone === 'snap') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.065);
    } else if (tone === 'buff') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(1120, now + 0.13);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqs[tone] || 520, now);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(gain);
    gain.connect(simAudioContext.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  } catch (e) {
    // Ignore audio context errors
  }
}

function showSimMessage(msg, isError = false) {
  if (!simMessage) return;
  simMessage.textContent = msg;
  simMessage.classList.toggle('error', isError);
}

let roomMessageTimer = null;
function showRoomBanner(text, isQuest = false) {
  const el = document.getElementById('simRoomMessage');
  if (!el) return;
  el.textContent = text;
  el.className = isQuest ? 'sim-room-message quest-complete' : 'sim-room-message';
  clearTimeout(roomMessageTimer);
  if (window.gsap) {
    gsap.killTweensOf(el);
    gsap.fromTo(el,
      { x: 0, xPercent: -50, y: -10, scale: 0.94, autoAlpha: 0 },
      { y: 0, scale: 1, autoAlpha: 1, duration: 0.42, ease: "back.out(1.6)" });
  }
  roomMessageTimer = setTimeout(() => {
    if (!window.gsap) { el.textContent = ''; return; }
    gsap.to(el, { y: -6, autoAlpha: 0, duration: 0.3, ease: "power2.in", onComplete: () => { el.textContent = ''; } });
  }, 2800);
}

function isDlcActive(type) {
  return Boolean(simState.dlcs && simState.dlcs[type]);
}

function getSpaceScore() {
  const areaPerPerson = simState.profile.area / simState.profile.people;
  let score = areaPerPerson >= 8 ? 78 : areaPerPerson >= 6 ? 70 : areaPerPerson >= 4.5 ? 62 : 52;
  if (isDlcActive('work')) score += 8;
  if (isDlcActive('family')) score += 8;
  if (isDlcActive('storage')) score += 9;
  else score -= 6; // Clutter penalty when storage DLC is off
  if (isDlcActive('safe')) score += 6;
  score += Math.min(8, simState.furniture.length * 2);
  if (typeof getActiveCombos === 'function') {
    score += getActiveCombos().reduce((s, c) => s + c.bonus, 0);
  }
  if (typeof checkMepPowerStatus === 'function') {
    score -= checkMepPowerStatus().penalty;
  }
  if (Array.isArray(simState.v4Items)) {
    score += Math.min(12, simState.v4Items.length * 2);
  }
  if (Array.isArray(simState.flawedItems)) {
    score -= simState.flawedItems.length * 3;
  }
  return Math.max(35, Math.min(100, Math.round(score)));
}



// ─── 5. GAME MECHANICS, BUFFS, QUESTS & UI RENDERING ───
function formatSimClock() {
  const h = Math.floor(simState.minutes / 60);
  const m = simState.minutes % 60;
  const isNight = simState.minutes >= 1140 || simState.minutes < 360;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${isNight ? '🌙' : '☀️'}`;
}

function getSimMood() {
  const vals = Object.values(simState.needs);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (Math.min(...vals) < 20) return { label: '需要照顧', icon: '💭', face: '😟', score: avg };
  if (avg >= 75) return { label: '超開心', icon: '🤩', face: '😄', score: avg };
  if (avg >= 50) return { label: '愉快', icon: '✨', face: '😊', score: avg };
  return { label: '普通', icon: '🙂', face: '😐', score: avg };
}

function advanceSimTime(mins) {
  const total = simState.minutes + mins;
  simState.day += Math.floor(total / 1440);
  simState.minutes = total % 1440;
}

function applySimTimeDecay(mins) {
  const rates = { hunger: 0.07, energy: 0.045, hygiene: 0.025, social: 0.02, fun: 0.025 };
  Object.entries(rates).forEach(([k, r]) => {
    simState.needs[k] = clampNeed(simState.needs[k] - r * mins);
  });
}

function advanceSimQuest(actionId) {
  const quest = simQuestCatalog.find(q => q.id === simState.quest?.id);
  if (!quest || quest.actionId !== actionId) return null;
  simState.quest.progress += 1;
  if (simState.quest.progress < quest.target) return null;
  simState.money += quest.reward;
  simState.quest = createRandomSimQuest(quest.id);
  return quest;
}

function executeSimAction(action, objId) {
  if (simState.money < action.cost) {
    playSimSound('error');
    showSimMessage('⚠️ 家庭基金不足，先執行「居家工作」賺取基金吧！', true);
    return false;
  }

  let finalChanges = { ...action.changes };
  let finalCost = action.cost;
  let feedbackText = action.text;
  let tone = 'action';
  const isNight = simState.minutes >= 1320 || simState.minutes < 360;

  if (action.id === 'work') {
    if (isDlcActive('work')) {
      finalCost = -130;
      finalChanges = { energy: -7, hunger: -5, fun: 2, hygiene: -1 };
      feedbackText = '✨ [WORK DLC 加成] 在 3D 壁掛折疊工作桌高效辦公！收入雙倍 +§130，精力消耗大幅降低！';
      tone = 'buff';
    } else {
      finalCost = -60;
      finalChanges = { energy: -18, hunger: -10, fun: -8, hygiene: -3 };
      feedbackText = '⚠️ [未裝 WORK DLC] 在臨時小桌彎腰用筆電，腰酸背痛效率低… 僅賺得 §60（可至建造工坊安裝 WORK DLC）';
    }
  } else if (action.id === 'eat') {
    if (isDlcActive('family')) {
      finalChanges = { hunger: 46, energy: 8, hygiene: 0, social: 14 };
      feedbackText = '🍳 [FAMILY DLC 加成] 在 3D 變形延伸中島愉快下廚共餐！飽足 +46、社交 +14！';
      tone = 'buff';
    } else {
      finalChanges = { hunger: 24, energy: 2, hygiene: -2 };
      feedbackText = '🍜 [未裝 FAMILY DLC] 流理台空間狹小，只能微波簡單點心果腹。';
    }
  } else if (action.id === 'relax') {
    if (isDlcActive('storage')) {
      finalChanges = { fun: 38, social: 6, energy: 2 };
      feedbackText = '📦 [STORAGE DLC 加成] 頂天立地櫃收齊所有雜物，客廳寬敞清爽，放鬆效果加倍！';
      tone = 'buff';
    } else {
      finalChanges = { fun: 20, social: 2, energy: -3 };
      feedbackText = '📺 在客廳休息，但地面散落的紙箱雜物讓空間顯得有些擁擠。';
    }
  } else if (action.id === 'sleep') {
    if (isDlcActive('storage')) {
      finalChanges = { energy: 55, hunger: -7, hygiene: -2, fun: 6 };
      feedbackText = '🛏️ [STORAGE DLC 加成] 掀床與牆櫃井然有序，一覺醒來精神百倍！';
      tone = 'buff';
    }
  }

  if (isNight) {
    if (isDlcActive('safe')) {
      feedbackText += '（🛡️ SAFE DLC 夜間感應地燈自動護航）';
    } else {
      feedbackText += '（⚠️ 夜間無引導照明，差點踢到家具桌角）';
      finalChanges.energy = (finalChanges.energy || 0) - 3;
    }
  }

  advanceSimTime(action.minutes);
  applySimTimeDecay(action.minutes);
  Object.entries(finalChanges).forEach(([k, v]) => {
    simState.needs[k] = clampNeed(simState.needs[k] + v);
  });
  simState.money -= finalCost;
  simState.lastAction = feedbackText;

  activeInteraction = {
    objId: objId || action.targetObj,
    actionId: action.id,
    startAt: performance.now(),
    duration: 1200
  };

  // Spawn 3D Floating Text above character (Idea C)
  if (finalCost < 0) {
    spawnFloatingText(`+§${Math.abs(finalCost)}`, simState.player.x, simState.player.y, 1.75, '#fde047');
  }
  const mainGain = Object.entries(finalChanges).sort((a, b) => b[1] - a[1])[0];
  if (mainGain && mainGain[1] > 0) {
    const needMeta = simNeedData.find(n => n.id === mainGain[0]);
    spawnFloatingText(`${needMeta ? needMeta.icon : '✨'}+${mainGain[1]}`, simState.player.x + 0.25, simState.player.y, 1.55, '#86efac');
  }

  simState.actionCounter = (simState.actionCounter || 0) + 1;
  if (simState.actionCounter % 4 === 0) {
    setTimeout(() => triggerLifeEvent(), 950);
  }

  const doneQuest = advanceSimQuest(action.id);
  saveSimState();
  renderSim();
  playSimSound(tone);
  showSimMessage(feedbackText);

  if (doneQuest) {
    playSimSound('buff');
    showRoomBanner(`🎉 完成委託「${doneQuest.title}」！獲得獎勵 § ${doneQuest.reward}`, true);
  } else {
    showRoomBanner(`${action.icon} ${action.label} 完成！`);
  }
  return true;
}

function toggleDlc(type) {
  simState.dlcs[type] = !simState.dlcs[type];
  if (simState.dlcs[type]) {
    triggerSnapEffect(type);
  }
  saveSimState();
  playSimSound(simState.dlcs[type] ? 'snap' : 'tap');
  renderSim();
  const names = {
    work: 'WORK DLC (3D 壁掛折疊工作桌)',
    family: 'FAMILY DLC (3D 變形料理中島)',
    storage: 'STORAGE DLC (3D 頂天立地收納櫃)',
    safe: 'SAFE DLC (3D 樂齡扶手與夜燈)'
  };
  showRoomBanner(simState.dlcs[type] ? `⚡ 已扣入軌道：${names[type]}` : `已卸下：${names[type]}`);
  showSimMessage(simState.dlcs[type]
    ? `✨ 已將「${names[type]}」扣入 3D 牆面滑軌，空間評分與行動加成已生效！`
    : `已從滑軌卸下「${names[type]}」，房間回復未升級狀態。`);
}

function switchLifeStage(stageKey) {
  const preset = stagePresets[stageKey];
  if (!preset) return;
  simState.stage = stageKey;
  simState.profile.area = preset.area;
  simState.profile.people = preset.people;
  simState.dlcs = { ...preset.dlcs };
  ['work', 'family', 'storage', 'safe'].forEach(k => {
    if (simState.dlcs[k]) triggerSnapEffect(k);
  });
  saveSimState();
  playSimSound('buff');
  renderSim();
  if (typeof syncGameToLifecycleCalc === 'function') syncGameToLifecycleCalc(false);
  showRoomBanner(`✨ 切換至：${preset.label}`);
  showSimMessage(preset.msg);
}

function renderSim() {
  const mood = getSimMood();
  const score = getSpaceScore();
  const stageInfo = stagePresets[simState.stage] || stagePresets.starter;

  document.getElementById('simDay').textContent = `第 ${simState.day} 天`;
  document.getElementById('simClock').textContent = formatSimClock();
  document.getElementById('simMoney').textContent = `§ ${simState.money}`;
  document.getElementById('simSpaceScore').textContent = `${score} 分`;
  const esgEl = document.getElementById('simEsgScore');
  if (esgEl) esgEl.textContent = `🌱 ${simState.esgScore || 30} kg`;
  const circBadge = document.getElementById('circularEsgBadge');
  if (circBadge) circBadge.textContent = `已減碳 ${simState.esgScore || 30} kg CO₂e`;
  const xrayBtn = document.getElementById('simCamXray');
  if (xrayBtn) xrayBtn.classList.toggle('active', Boolean(simState.xrayMode));
  document.getElementById('simMood').textContent = `${mood.label} ${mood.icon}`;
  const ageFace = simState.stage === 'senior' ? '👴' : (simState.stage === 'family' ? '👨' : mood.face);
  document.getElementById('simPortrait').textContent = ageFace;
  document.getElementById('simStageLabel').textContent = `${stageInfo.label} · ${simState.profile.area} 坪 (${simState.profile.people}人)`;
  const shapeNames = { rect: '標準矩形', lshape: 'L型畸零格局', balcony: '陽台外推格局' };
  const curShape = shapeNames[simState.hardscape?.shape || 'rect'] || '標準矩形';
  document.getElementById('simRoomCaption').textContent = `${simState.profile.area} 坪 · ${curShape} · ${stageInfo.label}`;
  const timeSlider = document.getElementById('simTimeSlider');
  if (timeSlider) timeSlider.value = String(simState.minutes);
  const periodLbl = document.getElementById('simTimePeriodLabel');
  if (periodLbl) {
    const isN = simState.minutes >= 1200 || simState.minutes < 360;
    const isD = !isN && simState.minutes >= 1020 && simState.minutes < 1200;
    periodLbl.textContent = isN ? '🌙 深夜發光' : isD ? '🌇 黃昏夕照' : '☀️ 白天自然光';
  }
  if (typeof syncSimTopBarUI === 'function') syncSimTopBarUI();
  if (typeof renderSimDockShelf === 'function') renderSimDockShelf();
  if (typeof renderV4Panels === 'function') renderV4Panels();

  // Stage buttons active state
  document.querySelectorAll('.sim-stage-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.stage === simState.stage);
  });

  // Play/Pause & Speed buttons
  const toggleBtn = document.getElementById('simToggle');
  toggleBtn.textContent = simState.paused ? '▶ 開始生活' : '⏸ 暫停';
  toggleBtn.setAttribute('aria-pressed', String(!simState.paused));
  toggleBtn.setAttribute('aria-label', simState.paused ? '開始生活' : '暫停生活');
  document.getElementById('simSpeed').textContent = `速度 ${simState.speed}×`;

  // Needs bars
  const needsEl = document.getElementById('simNeeds');
  needsEl.innerHTML = '';
  simNeedData.forEach(need => {
    const val = Math.round(simState.needs[need.id]);
    const div = document.createElement('div');
    div.className = 'sim-need';
    div.innerHTML = `
      <div class="sim-need-head"><span>${need.icon} ${need.label}</span><span>${val}%</span></div>
      <div class="sim-meter"><div class="sim-meter-fill${val < 25 ? ' low' : ''}" style="width:${val}%"></div></div>
    `;
    needsEl.appendChild(div);
  });

  // Quest card
  const quest = simQuestCatalog.find(q => q.id === simState.quest?.id) || simQuestCatalog[0];
  const prog = Math.min(quest.target, simState.quest?.progress || 0);
  document.getElementById('simQuestTitle').textContent = quest.title;
  document.getElementById('simQuestDescription').textContent = quest.description;
  document.getElementById('simQuestReward').textContent = `獎勵 § ${quest.reward}`;
  document.getElementById('simQuestCount').textContent = `${prog} / ${quest.target}`;
  document.getElementById('simQuestMeter').style.width = `${(prog / quest.target) * 100}%`;

  // DLC Workshop cards & Buff tags
  const dlcMeta = [
    { id: 'work', btn: 'dlcBtnWork', tag: 'tagDlcWork', buff: 'buffDlcWork',
      on: '✨ 已扣入軌道：展開 3D 雙螢幕工作檯，工作收入 +§130',
      off: '⚠️ 未安裝：餐桌彎腰筆電辦公，效率低且精力消耗快' },
    { id: 'family', btn: 'dlcBtnFamily', tag: 'tagDlcFamily', buff: 'buffDlcFamily',
      on: '🍳 已扣入軌道：3D 延伸中島＋水槽 IH 爐，飽足社交大增',
      off: '⚠️ 未安裝：流理台狹窄，僅能簡單微波點心' },
    { id: 'storage', btn: 'dlcBtnStorage', tag: 'tagDlcStorage', buff: 'buffDlcStorage',
      on: '📦 已扣入軌道：3D 頂天立地收納櫃，消除地面雜物堆',
      off: '⚠️ 未安裝：紙箱雜物散落地面，降低空間適配分' },
    { id: 'safe', btn: 'dlcBtnSafe', tag: 'tagDlcSafe', buff: 'buffDlcSafe',
      on: '🛡️ 已扣入軌道：3D 樂齡扶手＋夜間感應光帶護航',
      off: '⚠️ 未安裝：夜間視線昏暗，缺乏防撞與引導保護' }
  ];
  dlcMeta.forEach(m => {
    const active = isDlcActive(m.id);
    const btn = document.getElementById(m.btn);
    if (btn) btn.classList.toggle('active', active);
    const tag = document.getElementById(m.tag);
    if (tag) tag.textContent = active ? '已扣入 ✓' : '點擊安裝';
    const buff = document.getElementById(m.buff);
    if (buff) buff.textContent = active ? m.on : m.off;
  });

  const buffTagsEl = document.getElementById('simBuffTags');
  if (buffTagsEl) {
    buffTagsEl.innerHTML = '';
    if (isDlcActive('work')) buffTagsEl.innerHTML += '<span class="sim-buff-badge">⚡ WORK 3D工作桌</span>';
    if (isDlcActive('family')) buffTagsEl.innerHTML += '<span class="sim-buff-badge teal">🍳 FAMILY 3D中島</span>';
    if (isDlcActive('storage')) buffTagsEl.innerHTML += '<span class="sim-buff-badge">📦 STORAGE 3D收納牆</span>';
    if (isDlcActive('safe')) buffTagsEl.innerHTML += '<span class="sim-buff-badge green">🛡️ SAFE 3D夜燈扶手</span>';
  }

  // Build Tab selects & Live Furniture Status Summary
  document.getElementById('plannerArea').value = String(simState.profile.area);
  document.getElementById('plannerPeople').value = String(simState.profile.people);
  document.getElementById('buildFitSummary').textContent = `適配度 ${score} 分`;

  const bSummaryEl = document.getElementById('buildFurnSummaryText');
  if (bSummaryEl) {
    const fCount = (simState.furniture?.length || 0) + (simState.v4Items?.length || 0);
    const dlcCount = Object.values(simState.dlcs || {}).filter(Boolean).length;
    bSummaryEl.innerHTML = `已啟用 <strong>${dlcCount}</strong> 項 TAYA 軌道模組，並在 3D 空間擺放 <strong>${fCount}</strong> 件家具與單品。所有家具均已整合至「商城＆盲盒」，可在 3D 地板自由拖曳與旋轉。`;
  }

  // Toggle Empty Room Quick-Start Studio Guide & Object Inspector
  const emptyGuideEl = document.getElementById('simEmptyGuide');
  if (emptyGuideEl) {
    const anyDlc = Object.values(simState.dlcs || {}).some(Boolean);
    const hasAnyFurn = (simState.furniture && simState.furniture.length > 0) || (simState.v4Items && simState.v4Items.length > 0);
    emptyGuideEl.classList.toggle('hidden', anyDlc || hasAnyFurn);
  }
  if (typeof updateObjInspectorUI === 'function') updateObjInspectorUI();
}

// ─── UNIFIED DECK TAB SWITCHER & DEEP LINK JUMPING ───
function switchDeckTab(target, category = null) {
  const tabs = document.querySelectorAll('.sim-deck-tab');
  const targetTab = Array.from(tabs).find(t => t.dataset.deckTab === target) || tabs[0];
  tabs.forEach(t => t.classList.remove('active'));
  targetTab?.classList.add('active');

  document.getElementById('deckPanelLive')?.classList.toggle('active', target === 'live');
  document.getElementById('deckPanelHardscape')?.classList.toggle('active', target === 'hardscape');
  document.getElementById('deckPanelShop')?.classList.toggle('active', target === 'shop');
  document.getElementById('deckPanelBuild')?.classList.toggle('active', target === 'build');

  // Sync quickpills state in 3D viewport
  document.querySelectorAll('.quickpill-btn[data-jump-deck]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.jumpDeck === target);
  });

  // If a category is requested for shop
  if (target === 'shop' && category) {
    currentShopCat = category;
    document.querySelectorAll('.shop-cat-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.cat === category);
    });
    renderV4Panels();
  }

  playSimSound('tap');
}

// Render Quick Actions
function initSimActionsUI() {
  const container = document.getElementById('simActions');
  container.innerHTML = '';
  simActions.forEach(action => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sim-action';
    btn.dataset.action = action.id;
    btn.innerHTML = `<span>${action.icon}</span>${action.label}`;
    btn.addEventListener('click', () => walkAndPerformAction(action));
    container.appendChild(btn);
  });
}

// Bind Game UI Events
document.querySelectorAll('.sim-stage-btn').forEach(btn => {
  btn.addEventListener('click', () => switchLifeStage(btn.dataset.stage));
});

document.querySelectorAll('.sim-deck-tab').forEach(tab => {
  tab.addEventListener('click', () => switchDeckTab(tab.dataset.deckTab));
});

document.querySelectorAll('.quickpill-btn[data-jump-deck]').forEach(btn => {
  btn.addEventListener('click', () => switchDeckTab(btn.dataset.jumpDeck));
});

document.getElementById('btnQuickQuoteModal')?.addEventListener('click', () => {
  document.getElementById('btnExportQuote')?.click();
});

document.getElementById('btnJumpToShopFromBuild')?.addEventListener('click', () => {
  switchDeckTab('shop');
});

document.getElementById('btnQuickKitFromBuild')?.addEventListener('click', () => {
  document.getElementById('btnQuickStarterKit')?.click();
});

document.getElementById('btnClearAllFurnFromBuild')?.addEventListener('click', () => {
  simState.furniture = [];
  simState.v4Items = [];
  selectedObjectId = null;
  saveSimState();
  playSimSound('tap');
  renderSim();
  showRoomBanner('🧹 已清空房間內所有地面與桌上家具！');
});

// Concept to Game Jump Buttons
document.querySelectorAll('.concept-to-game-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const stage = btn.dataset.stage;
    const dlc = btn.dataset.dlc;
    switchLifeStage(stage);
    if (dlc) {
      simState.dlcs[dlc] = true;
      triggerSnapEffect(dlc);
      saveSimState();
      renderSim();
    }
    switchDeckTab('build');
    document.getElementById('game')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showRoomBanner(`🚀 已跳轉至 3D 模擬器並載入「${stage === 'starter' ? 'STARTER' : stage === 'family' ? 'FAMILY' : 'LIFE+'}」階段！`, true);
  });
});

// Lifecycle Calculator to Game Sync Button
document.getElementById('btnSyncCalcToSimGame')?.addEventListener('click', () => {
  const targetStage = calcYears <= 15 ? 'starter' : calcYears <= 25 ? 'family' : 'senior';
  switchLifeStage(targetStage);
  simState.profile.area = calcArea;
  clampEntitiesToRoomBounds();
  saveSimState();
  renderSim();
  switchDeckTab('build');
  document.getElementById('game')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showRoomBanner(`🎮 已將試算規格（${calcYears}年 · ${calcArea}坪 · ${targetStage.toUpperCase()}）同步至 3D 空間遊戲！`, true);
});

['work', 'family', 'storage', 'safe'].forEach(type => {
  const btn = document.getElementById(`dlcBtn${type.charAt(0).toUpperCase() + type.slice(1)}`);
  if (btn) btn.addEventListener('click', () => toggleDlc(type));
});

document.getElementById('plannerArea').addEventListener('change', e => {
  simState.profile.area = Number(e.target.value);
  clampEntitiesToRoomBounds();
  saveSimState();
  playSimSound('confirm');
  renderSim();
  const rDim = getRoomDimensions(simState.profile.area);
  const totalTiles = rDim.gridTilesX * rDim.gridTilesY;
  showRoomBanner(`📐 格局切換至 ${rDim.label}！地板真實擴展至 ${rDim.w}m × ${rDim.d}m（共 ${totalTiles} 格地面模組磁磚）`, true);
});

document.getElementById('plannerPeople').addEventListener('change', e => {
  simState.profile.people = Number(e.target.value);
  saveSimState();
  playSimSound('confirm');
  renderSim();
});

document.getElementById('simCamRotate').addEventListener('click', () => {
  simState.camAngleIndex = ((simState.camAngleIndex || 0) + 1) % camAngles.length;
  targetYaw = camAngles[simState.camAngleIndex];
  playSimSound('tap');
});

document.getElementById('simCamTime').addEventListener('click', () => {
  if (simState.minutes < 1020) simState.minutes = 1050; // Switch to Dusk 17:30
  else if (simState.minutes < 1200) simState.minutes = 1320; // Switch to Night 22:00
  else simState.minutes = 540; // Switch to Day 09:00
  saveSimState();
  playSimSound('tap');
  renderSim();
});

document.getElementById('simName').addEventListener('change', e => {
  simState.name = e.target.value.trim().slice(0, 18) || '小日';
  saveSimState();
  renderSim();
});

document.getElementById('simToggle').addEventListener('click', () => {
  simState.paused = !simState.paused;
  saveSimState();
  renderSim();
  playSimSound('tap');
  showSimMessage(simState.paused ? '⏸ 遊戲時間已暫停。' : '▶ 時間開始流動！點擊 3D 家具或行動按鈕體驗生活。');
});

document.getElementById('simSpeed').addEventListener('click', () => {
  simState.speed = simState.speed === 3 ? 1 : simState.speed + 1;
  saveSimState();
  renderSim();
  playSimSound('tap');
});

simSoundButton.addEventListener('click', () => {
  simSoundEnabled = !simSoundEnabled;
  simSoundButton.textContent = simSoundEnabled ? '♫ 音效開' : '♪ 音效關';
  if (simSoundEnabled) playSimSound('confirm');
});

document.getElementById('simReset').addEventListener('click', () => {
  localStorage.removeItem(simStorageKey);
  simState = loadSimState();
  simState.furniture = [];
  simState.dlcs = { work: false, family: false, storage: false, safe: false };
  simState.v4Items = [];
  simState.v4Positions = {};
  simState.rotatedItems = {};
  simState.lockedItems = [];
  simState.flawedItems = [];
  selectedObjectId = null;
  ensureV4State();
  simState.hardscape.partition = false;
  simState.hardscape.pillar = false;
  simState.hardscape.cableRaceway = false;
  simState.scenario = 'sandbox';
  const scenSelect = document.getElementById('scenarioSelect');
  if (scenSelect) scenSelect.value = 'sandbox';
  saveSimState();
  renderSim();
  playSimSound('confirm');
  showRoomBanner('↺ 已重新開始！房間已清空為無家具空屋狀態，請從零開始自由佈置！');
  showSimMessage('🏠 已重置為全新空屋狀態（無任何預設家具），請前往「🛋️ 家具商城」或點擊畫面中央「一鍵配置基礎生活組」開始裝潢！');
});

document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) return;
  const dir = keyDirectionMap[e.key];
  if (dir && document.activeElement === roomCanvas) {
    e.preventDefault();
    roomKeys.add(dir);
  } else if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && document.activeElement === roomCanvas) {
    e.preventDefault();
    const near = getNearestSceneObject();
    if (near) {
      const act = simActions.find(a => a.id === near.action) || simActions[0];
      executeSimAction(act, near.id);
    }
  } else if ((e.key === 'r' || e.key === 'R') && (selectedObjectId || hoveredObject)) {
    e.preventDefault();
    if (!selectedObjectId && hoveredObject) selectedObjectId = hoveredObject.id;
    rotateSelectedObject();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId && document.activeElement === roomCanvas) {
    e.preventDefault();
    removeSelectedObject();
  }
});

document.addEventListener('keyup', e => {
  const dir = keyDirectionMap[e.key];
  if (dir) roomKeys.delete(dir);
});

document.querySelectorAll('.sim-dpad button').forEach(btn => {
  const dir = btn.dataset.direction;
  btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    roomKeys.add(dir);
  });
  const stop = () => roomKeys.delete(dir);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointercancel', stop);
  btn.addEventListener('pointerleave', stop);
});

document.getElementById('simInteract').addEventListener('click', () => {
  const near = getNearestSceneObject() || getSceneObjects()[0];
  if (near) {
    const act = simActions.find(a => a.id === near.action) || simActions[0];
    walkAndPerformAction(act, near);
  }
});

setInterval(() => {
  if (simState.paused) return;
  advanceSimTime(simState.speed * 5);
  applySimTimeDecay(simState.speed * 2);
  saveSimState();
  renderSim();
}, 3000);


// ─── V3 FEATURES: X-RAY, LIFE EVENTS, CIRCULAR MARKET, COMPARISON & SYNC ───
const simLifeEventCatalog = [
  {
    id: 'remote-crunch',
    kicker: '💼 職涯突發事件 · WORK LIFE',
    title: '遠距工作專案暴增週！',
    desc: '本週急件專案湧入，但若在狹小餐桌彎腰用筆電，不僅腰痠背痛（精力 -15），工作效率也大打折扣！',
    dlc: 'work',
    primaryLabel: '⚡ 立即在軌道扣入「WORK DLC 折疊工作桌」(獲得專案獎金 +§150 · 🌱+15kg)',
    secondaryLabel: '😣 硬撐在餐桌彎腰加班 (精力 -15 · 僅得 +§45)',
    rewardMoney: 150,
    rewardEsg: 15
  },
  {
    id: 'family-gathering',
    kicker: '👨‍👩‍👧 家庭轉折事件 · FAMILY LIFE',
    title: '親友來訪與家庭聚餐日！',
    desc: '週末家人與朋友來新家聚會，傳統小流理台根本擠不下，客廳散落的雜物箱也讓動線卡住！',
    dlc: 'family',
    extraDlc: 'storage',
    primaryLabel: '🍳 一鍵扣入「FAMILY 中島 ＋ STORAGE 收納櫃」(社交飽足全滿 · +§120 · 🌱+25kg)',
    secondaryLabel: '🥡 勉強點外送坐在紙箱旁吃 (心情與社交下降)',
    rewardMoney: 120,
    rewardEsg: 25
  },
  {
    id: 'senior-night-safety',
    kicker: '🌿 樂齡照護事件 · SAFE LIFE',
    title: '長輩留宿的深夜起居安全！',
    desc: '家中長輩半夜起床上廁所，走廊缺乏感應導引夜燈與防滑扶手，視線昏暗十分危險！',
    dlc: 'safe',
    primaryLabel: '🛡️ 立即在軌道扣入「SAFE DLC 樂齡感應扶手與夜燈」(安全護航 · +§110 · 🌱+20kg)',
    secondaryLabel: '🔦 暫時拿手電筒摸黑引導 (精力 -12)',
    rewardMoney: 110,
    rewardEsg: 20
  }
];

function triggerLifeEvent(forcedStage = null) {
  const modal = document.getElementById('simEventModal');
  if (!modal) return;
  let ev = simLifeEventCatalog[0];
  if (forcedStage === 'family' || simState.stage === 'family') ev = simLifeEventCatalog[1];
  else if (forcedStage === 'senior' || simState.stage === 'senior') ev = simLifeEventCatalog[2];
  else {
    ev = simLifeEventCatalog[Math.floor(Math.random() * simLifeEventCatalog.length)];
  }

  document.getElementById('simEventKicker').textContent = ev.kicker;
  document.getElementById('simEventTitle').textContent = ev.title;
  document.getElementById('simEventDesc').textContent = ev.desc;

  const choicesEl = document.getElementById('simEventChoices');
  choicesEl.innerHTML = '';

  const btnPrimary = document.createElement('button');
  btnPrimary.type = 'button';
  btnPrimary.className = 'sim-event-choice primary';
  btnPrimary.textContent = ev.primaryLabel;
  btnPrimary.addEventListener('click', () => {
    modal.classList.remove('open');
    simState.dlcs[ev.dlc] = true;
    triggerSnapEffect(ev.dlc);
    if (ev.extraDlc) {
      simState.dlcs[ev.extraDlc] = true;
      triggerSnapEffect(ev.extraDlc);
    }
    simState.money += ev.rewardMoney;
    simState.esgScore = (simState.esgScore || 30) + ev.rewardEsg;
    simState.needs.fun = clampNeed(simState.needs.fun + 20);
    simState.needs.social = clampNeed(simState.needs.social + 20);
    trackPulseUntil = performance.now() + 1800;
    spawnFloatingText(`+§${ev.rewardMoney} · 🌱+${ev.rewardEsg}kg`, simState.player.x, simState.player.y, 1.85, '#fde047');
    saveSimState();
    playSimSound('buff');
    renderSim();
    showRoomBanner(`🎉 危機化解！已透過 TAYA 軌道快拆完成升級，獲得 §${ev.rewardMoney}！`, true);
  });

  const btnSecondary = document.createElement('button');
  btnSecondary.type = 'button';
  btnSecondary.className = 'sim-event-choice secondary';
  btnSecondary.textContent = ev.secondaryLabel;
  btnSecondary.addEventListener('click', () => {
    modal.classList.remove('open');
    simState.needs.energy = clampNeed(simState.needs.energy - 14);
    simState.needs.fun = clampNeed(simState.needs.fun - 10);
    simState.money += 35;
    saveSimState();
    playSimSound('error');
    renderSim();
    showRoomBanner('⚠️ 空間未升級，勉強應付導致精力與心情下滑…');
  });

  choicesEl.appendChild(btnPrimary);
  choicesEl.appendChild(btnSecondary);
  modal.classList.add('open');
  playSimSound('confirm');
}

document.getElementById('simTriggerEvent')?.addEventListener('click', () => triggerLifeEvent());

// Idea A: Toggle X-Ray Track View
document.getElementById('simCamXray')?.addEventListener('click', () => {
  simState.xrayMode = !simState.xrayMode;
  saveSimState();
  playSimSound('snap');
  renderSim();
  showRoomBanner(simState.xrayMode
    ? '🔍 已開啟「軌道 X 光透視」：顯示牆內 6063-T6 鋁軌、水電管路與自鎖卡扣'
    : '已關閉 X 光透視，回復溫潤木質牆面視圖');
});

// Idea D: Circular Economy Trade-in & Refurbished Market
document.getElementById('btnCircularTradeIn')?.addEventListener('click', () => {
  const activeKeys = ['work', 'family', 'storage', 'safe'].filter(k => simState.dlcs[k]);
  if (activeKeys.length === 0) {
    playSimSound('error');
    showSimMessage('⚠️ 目前尚未安裝可回售的 DLC 模組，請先點擊上方模組或租購認證整新包！', true);
    return;
  }
  const traded = activeKeys[0];
  simState.dlcs[traded] = false;
  simState.money += 90;
  simState.esgScore = (simState.esgScore || 30) + 20;
  spawnFloatingText('♻️ 回售 +§90 · 🌱+20kg', simState.player.x, simState.player.y, 1.8, '#86efac');
  saveSimState();
  playSimSound('buff');
  renderSim();
  showRoomBanner('♻️ 原廠循環回購成功！舊模組已回廠整新，獲得 §90 與 🌱20kg 減碳積分！', true);
  showSimMessage('♻️ 已透過大雅原廠循環機制回售舊階段模組，獲得 §90 折抵金並減少 20kg 碳排放！');
});

document.getElementById('btnCircularRefurb')?.addEventListener('click', () => {
  const inactiveKeys = ['work', 'family', 'storage', 'safe'].filter(k => !simState.dlcs[k]);
  const targetKey = inactiveKeys[0] || 'family';
  if (simState.money < 60) {
    playSimSound('error');
    showSimMessage('⚠️ 家庭基金不足 §60，請先執行工作或回售舊模組！', true);
    return;
  }
  simState.money -= 60;
  simState.dlcs[targetKey] = true;
  simState.esgScore = (simState.esgScore || 30) + 25;
  triggerSnapEffect(targetKey);
  spawnFloatingText('♻️ 整新模組扣入 · 🌱+25kg', simState.player.x, simState.player.y, 1.8, '#38bdf8');
  saveSimState();
  playSimSound('snap');
  renderSim();
  showRoomBanner(`♻️ 已以 7 折優惠扣入「原廠認證整新 ${targetKey.toUpperCase()} DLC」！減碳 +25kg！`, true);
});

// Idea E: Traditional Demolition vs TAYA Track Snap-Fit Live 3D Simulation
document.getElementById('btnDemoTradRenov')?.addEventListener('click', () => {
  const now = performance.now();
  renovShakeUntil = now + 2600;
  // Spawn 45 billowing construction dust clouds across the 3D room
  for (let i = 0; i < 45; i++) {
    dustParticles.push({
      x: 1.0 + Math.random() * 7.0,
      y: 0.4 + Math.random() * 4.5,
      z: 0.1 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 1.4,
      vy: (Math.random() - 0.5) * 1.4,
      vz: 0.4 + Math.random() * 1.1,
      size: 14 + Math.random() * 22,
      startAt: now + Math.random() * 400,
      duration: 2400 + Math.random() * 800,
      isSpark: false
    });
  }
  simState.day += 30;
  simState.money = Math.max(0, simState.money - 220);
  simState.needs.hygiene = clampNeed(simState.needs.hygiene - 30);
  simState.needs.fun = clampNeed(simState.needs.fun - 25);
  spawnFloatingText('💥 施工30天 · -§220 · 粉塵污染', simState.player.x, simState.player.y, 1.9, '#fca5a5');
  saveSimState();
  playSimSound('error');
  renderSim();
  showRoomBanner('🚧 傳統打牆施工：滿屋粉塵噪音、耗時 30 天、扣款 §220 且產生大量營建廢棄物！');
  showSimMessage('💥 【傳統裝修痛點實測】打牆動工造成嚴重粉塵與噪音，生活停擺 30 天並損失 §220 預算！', true);
});

document.getElementById('btnDemoTayaSnap')?.addEventListener('click', () => {
  const now = performance.now();
  renovShakeUntil = 0;
  dustParticles = [];
  trackPulseUntil = now + 2400;
  ['work', 'family', 'storage', 'safe'].forEach(k => {
    simState.dlcs[k] = true;
    triggerSnapEffect(k);
  });
  for (let i = 0; i < 28; i++) {
    dustParticles.push({
      x: 1.2 + Math.random() * 6.8,
      y: 0.15 + Math.random() * 0.6,
      z: 0.8 + Math.random() * 1.2,
      vx: (Math.random() - 0.5) * 0.8,
      vy: 0.3 + Math.random() * 0.6,
      vz: 0.5 + Math.random() * 0.9,
      size: 4 + Math.random() * 5,
      startAt: now,
      duration: 1200 + Math.random() * 500,
      isSpark: true
    });
  }
  simState.esgScore = (simState.esgScore || 30) + 30;
  simState.needs.fun = clampNeed(simState.needs.fun + 25);
  simState.needs.energy = clampNeed(simState.needs.energy + 20);
  spawnFloatingText('⚡ 零粉塵30分鐘快拆 · 🌱+30kg', simState.player.x, simState.player.y, 1.9, '#fde047');
  saveSimState();
  playSimSound('buff');
  renderSim();
  showRoomBanner('✨ TAYA 軌道快拆完成：0% 粉塵破壞 · 30 分鐘當日鎖定 · 四大 3D 模組全數到位！', true);
  showSimMessage('⚡ 【TAYA 軌道快拆實測】免敲牆、零粉塵！30 分鐘內將四大 3D 模組扣入鋁合金滑軌，累積 🌱+30kg 減碳效益！');
});

// Cross-Section Sync: #insight -> #game, and #game -> #lifecycleCalculator
function syncGameToLifecycleCalc(scrollToCalc = false) {
  const stageYearsMap = { starter: 10, family: 20, senior: 30 };
  calcYears = stageYearsMap[simState.stage] || 30;
  calcArea = simState.profile.area <= 15 ? 15 : simState.profile.area <= 25 ? 25 : 35;

  document.querySelectorAll('#calcYearBtns .calc-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.years, 10) === calcYears);
  });
  document.querySelectorAll('#calcAreaBtns .calc-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.area, 10) === calcArea);
  });
  if (typeof updateLifecycleCalc === 'function') updateLifecycleCalc();
  if (scrollToCalc) {
    document.getElementById('lifecycleCalculator')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    playSimSound('confirm');
  }
}

document.getElementById('btnSyncToCalc')?.addEventListener('click', () => syncGameToLifecycleCalc(true));

document.querySelectorAll('.insight-to-game-btn, .hero-dock-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    const st = btn.dataset.gotoStage || 'starter';
    switchLifeStage(st);
    switchDeckTab('build');
    syncGameToLifecycleCalc(false);
    document.getElementById('game')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// V4 DEEP RENOVATION, THEMED CATALOG, HARDSCAPE, COMBOS, SCENARIOS & QUOTE
// ═══════════════════════════════════════════════════════════════════════════

// 1. Complete 5-Category Themed 3D Furniture & Prop Catalog
const V4_SHOP_CATALOG = [
  // 🎮 電競與科技 (tech)
  { id: 'standing-desk', cat: 'tech', name: '電動雙馬達升降桌', icon: '🖥️', price: 140, powerReq: true, isSurface: true, surfaceZ: 0.82, x: 4.8, y: 0.32, dx: 1.75, dy: 0.9, dz: 0.82, desc: '記憶高度升降，可承載桌上電競設備' },
  { id: 'rgb-pc-rig', cat: 'tech', name: '全透側水冷 RGB 主機＋三螢幕', icon: '🌈', price: 210, powerReq: true, isSubgrid: true, emitsLight: 'rgb', x: 5.2, y: 0.42, dx: 1.15, dy: 0.45, dz: 0.58, desc: '[桌上小物] 深夜發七彩流光，電競角核心' },
  { id: 'ergo-chair', cat: 'tech', name: '旗艦人體工學電競椅', icon: '💺', price: 110, powerReq: false, x: 5.3, y: 1.35, dx: 0.65, dy: 0.65, dz: 1.15, desc: '全網布護腰頭枕，久坐工作精力不減' },
  { id: 'pegboard', cat: 'tech', name: '極客洞洞板 (掛鍵盤/耳機/手把)', icon: '🎮', price: 65, powerReq: false, isWall: true, x: 5.0, y: 0.05, dx: 1.4, dy: 0.12, dz: 0.85, zBase: 1.15, desc: '牆面垂直收納電競周邊，觸發極致電競角' },
  { id: 'monitor-bar', cat: 'tech', name: '非對稱光學螢幕掛燈', icon: '🔦', price: 48, powerReq: true, isSubgrid: true, emitsLight: 'warm', x: 5.4, y: 0.4, dx: 0.55, dy: 0.15, dz: 0.52, desc: '[桌上小物] 深夜護眼照明不反光' },

  // 🏆 收藏與娛樂 (collect)
  { id: 'figure-cab', cat: 'collect', name: '玻璃公仔展示櫃 (內建投射燈)', icon: '🏆', price: 165, powerReq: true, emitsLight: 'showcase', x: 3.85, y: 0.25, dx: 0.95, dy: 0.55, dz: 1.95, desc: '深夜自動點亮層板投射燈，收藏家必備' },
  { id: 'vinyl-player', cat: 'collect', name: '復古黑膠唱片機＋專輯展示架', icon: 'レコード', iconText: '💿', price: 95, powerReq: true, isSubgrid: true, x: 2.6, y: 4.1, dx: 0.52, dy: 0.45, dz: 0.38, desc: '[桌上小物] 播放溫暖類比音樂提升心情' },
  { id: 'mahjong-table', cat: 'collect', name: '靜音過山車電動麻將桌', icon: '🀄', price: 190, powerReq: true, x: 3.4, y: 3.8, dx: 1.15, dy: 1.15, dz: 0.78, desc: '親友聚會神器，社交與娛樂大幅飆升' },
  { id: 'beanbag', cat: 'collect', name: '雲朵包覆懶骨頭沙發', icon: '🥟', price: 60, powerReq: false, x: 2.1, y: 5.1, dx: 0.82, dy: 0.82, dz: 0.62, desc: '隨處可窩的極致耍廢角落' },
  { id: 'projector', cat: 'collect', name: '4K 雷射投影機＆120吋升降布幕', icon: '📽️', price: 185, powerReq: true, emitsLight: 'screen', x: 2.45, y: 3.7, dx: 0.22, dy: 1.65, dz: 1.45, desc: '搭配沙發立即組成【家庭劇院 Combo】' },

  // ☕ 生活與家電 (appliance)
  { id: 'kitchen-island-suite', cat: 'appliance', name: '北歐現代 U 型廚房中島組 (含水槽/爐台/雙門冰箱)', icon: '🍳', price: 230, powerReq: true, x: 1.6, y: 0.22, dx: 2.35, dy: 1.85, dz: 1.95, desc: '【Sims 經典款】雙門大冰箱＋下嵌水槽中島＋黑晶烤箱爐台與吧台' },
  { id: 'fridge-2d', cat: 'appliance', name: '雙門變頻鏡面冰箱', icon: '🧊', price: 155, powerReq: true, x: 1.82, y: 0.25, dx: 0.85, dy: 0.78, dz: 1.82, desc: '小宅必備食材儲藏核心' },
  { id: 'coffee-maker', cat: 'appliance', name: '義式膠囊咖啡機', icon: '☕', price: 68, powerReq: true, isSubgrid: true, x: 2.5, y: 0.55, dx: 0.36, dy: 0.35, dz: 0.36, desc: '[桌上小物] 隨時沖泡香醇濃縮咖啡' },
  { id: 'air-fryer', cat: 'appliance', name: '智慧觸控氣炸鍋', icon: '🍟', price: 55, powerReq: true, isSubgrid: true, x: 3.1, y: 0.55, dx: 0.36, dy: 0.36, dz: 0.38, desc: '[桌上小物] 無油煙快速料理宵夜' },
  { id: 'robot-vac', cat: 'appliance', name: 'AI 雷射導航掃地機器人', icon: '🤖', price: 115, powerReq: false, isAutonomous: true, x: 4.2, y: 3.2, dx: 0.42, dy: 0.42, dz: 0.14, desc: '會在 3D 地板上自動巡航移動清潔！' },
  { id: 'garment-steamer', cat: 'appliance', name: '直立式蒸氣掛燙機', icon: '👔', price: 52, powerReq: true, x: 6.9, y: 1.35, dx: 0.42, dy: 0.42, dz: 1.38, desc: '快速撫平衣物皺褶，提升清潔感' },

  // 💡 照明與氛圍 (lighting)
  { id: 'floor-lamp', cat: 'lighting', name: '北歐極簡弧形落地氣氛燈', icon: '🏮', price: 75, powerReq: true, emitsLight: 'warm', x: 0.55, y: 5.55, dx: 0.45, dy: 0.45, dz: 1.65, desc: '深夜散發溫暖琥珀光暈' },
  { id: 'neon-sign', cat: 'lighting', name: '賽博霓虹造型燈條 (Cyber Neon)', icon: '⚡', price: 80, powerReq: true, isWall: true, emitsLight: 'neon', x: 5.15, y: 0.04, dx: 1.35, dy: 0.08, dz: 0.45, zBase: 1.82, desc: '深夜綻放紫青雙色霓虹光暈，實況背景首選' },
  { id: 'track-spot', cat: 'lighting', name: '磁吸軌道投射燈組', icon: '✨', price: 70, powerReq: false, isWall: true, emitsLight: 'warm', x: 2.3, y: 0.04, dx: 2.2, dy: 0.12, dz: 0.16, zBase: 2.35, desc: '直接扣入 TAYA 頂部軌道免拉線' },

  // 🐾 寵物與植栽 (pet)
  { id: 'cat-tree', cat: 'pet', name: '頂天立地透明太空艙貓跳台', icon: '🐱', price: 135, powerReq: false, x: 8.05, y: 1.35, dx: 0.78, dy: 0.78, dz: 2.18, desc: '含透明太空艙與立體黑貓，貓奴委託必備' },
  { id: 'monstera-xl', cat: 'pet', name: '設計師大型龜背芋盆栽', icon: '🪴', price: 65, powerReq: false, x: 0.55, y: 2.65, dx: 0.68, dy: 0.68, dz: 1.42, desc: '熱帶寬葉綠意，大幅美化空間角落' },
  { id: 'aqua-tank', cat: 'pet', name: 'ADA 超白玻璃水草造景缸', icon: '🐠', price: 125, powerReq: true, isSubgrid: true, emitsLight: 'aqua', x: 2.6, y: 4.5, dx: 0.68, dy: 0.42, dz: 0.48, desc: '[桌上小物] 深夜散發清澈水藍綠光暈' }
];

// Wall Power Outlets fixed positions (for MEP Power check)
const WALL_OUTLETS = [
  { x: 2.0, y: 0.08, z: 0.35, label: '廚房牆面插座 A' },
  { x: 6.2, y: 0.08, z: 0.35, label: '書房牆面插座 B' },
  { x: 0.08, y: 4.6, z: 0.35, label: '客廳牆面插座 C' }
];

// 4 Scenarios + Sandbox Definitions
const V4_SCENARIOS = {
  sandbox: {
    title: '🏖️ 自由沙盒模式',
    budget: 650,
    area: 18,
    shape: 'rect',
    lockedItems: [],
    goals: [
      { text: '自由調整格局、材質與添購 3D 主題家具', check: () => true, jumpTab: 'shop', jumpText: '前往商城' },
      { text: '嘗試拖曳「🌅 光影時刻滑桿」至深夜欣賞發光家具', check: () => simState.minutes >= 1140 || simState.minutes < 360, jumpTab: 'live', jumpText: '生活劇本' }
    ]
  },
  micro5: {
    title: '📦 關卡1：極限 5 坪套房改造',
    budget: 380,
    area: 5,
    shape: 'rect',
    pillar: true,
    lockedItems: [],
    goals: [
      { text: '維持 5 坪極限空間且預算不透支 (≥ §0)', check: () => simState.profile.area === 5 && simState.money >= 0, jumpTab: 'hardscape', jumpText: '📐 調整坪數' },
      { text: '配置工作桌 (WORK DLC 或升降桌) 與收納櫃', check: () => (isDlcActive('work') || hasV4Item('standing-desk')) && isDlcActive('storage'), jumpTab: 'build', jumpText: '⚡ 配置軌道' },
      { text: '添購雙門冰箱或料理區，且「🚶 動線檢查」暢通無阻', check: () => (hasV4Item('fridge-2d') || isDlcActive('family')) && !isPathBlocked(), jumpTab: 'shop', jumpCat: 'appliance', jumpText: '🛋️ 選購冰箱' }
    ]
  },
  streamer: {
    title: '🎙️ 關卡2：委託人A（硬核實況主）',
    budget: 850,
    area: 18,
    shape: 'lshape',
    pillar: true,
    lockedItems: [],
    goals: [
      { text: '牆面改為「🔇 六角吸音棉牆」解決實況回音', check: () => simState.hardscape?.wallMat === 'acoustic', jumpTab: 'hardscape', jumpText: '🎨 更換牆面' },
      { text: '觸發【🔥 極致電競角 Combo】(升降桌/WORK + RGB主機 + 電競椅/洞洞板)', check: () => getActiveCombos().some(c => c.id === 'gaming-corner'), jumpTab: 'shop', jumpCat: 'tech', jumpText: '🎮 選購電競' },
      { text: '加裝「⚡ 賽博霓虹燈條」或「🏆 公仔展示櫃」美化鏡頭背景', check: () => hasV4Item('neon-sign') || hasV4Item('figure-cab'), jumpTab: 'shop', jumpCat: 'lighting', jumpText: '💡 選購燈飾' }
    ]
  },
  catlover: {
    title: '🐱 關卡3：委託人B（收藏家與貓奴）',
    budget: 920,
    area: 25,
    shape: 'balcony',
    pillar: false,
    lockedItems: [],
    goals: [
      { text: '地板鋪設「🪵 全室超耐磨木地板」保護貓咪肉球', check: () => simState.hardscape?.floorMat === 'wood', jumpTab: 'hardscape', jumpText: '🪵 鋪設木地板' },
      { text: '配置「🏆 玻璃公仔展示櫃」與「🐱 透明太空艙貓跳台」', check: () => hasV4Item('figure-cab') && hasV4Item('cat-tree'), jumpTab: 'shop', jumpCat: 'pet', jumpText: '🐾 選購貓跳台' },
      { text: '觸發【🐾 貓奴收藏家 Combo】且動線暢通', check: () => getActiveCombos().some(c => c.id === 'cat-collector') && !isPathBlocked(), jumpTab: 'shop', jumpText: '✨ 達成加成' }
    ]
  },
  moving: {
    title: '🚚 關卡4：無痛搬家挑戰（舊物融合）',
    budget: 500,
    area: 18,
    shape: 'rect',
    pillar: true,
    lockedItems: ['mahjong-table', 'fridge-2d', 'beanbag'],
    goals: [
      { text: '保留 3 件舊家帶來的不可賣家具 (麻將桌/冰箱/懶骨頭)', check: () => ['mahjong-table', 'fridge-2d', 'beanbag'].every(id => hasV4Item(id)), jumpTab: 'shop', jumpText: '🛋️ 查看家具' },
      { text: '不拆除承重柱、善用 TAYA 軌道模組將空間評分推上 88 分', check: () => getSpaceScore() >= 88, jumpTab: 'build', jumpText: '⚡ 啟用軌道' }
    ]
  }
};

// Initialize & sanitize V4 state fields defensively (handles legacy localStorage snapshots without NaN)
function ensureV4State() {
  if (!simState.profile || typeof simState.profile !== 'object') {
    simState.profile = { area: 18, people: 2 };
  }
  const areaNum = Number(simState.profile.area);
  simState.profile.area = [5, 12, 18, 25, 32].includes(areaNum) ? areaNum : 18;
  const peopleNum = Number(simState.profile.people);
  simState.profile.people = [1, 2, 3, 4].includes(peopleNum) ? peopleNum : 2;

  const { w: roomW, d: roomD } = getRoomDimensions(simState.profile.area);
  const rawHs = (simState.hardscape && typeof simState.hardscape === 'object' && !Array.isArray(simState.hardscape))
    ? simState.hardscape
    : {};
  const rawCfg = (rawHs.partitionConfig && typeof rawHs.partitionConfig === 'object' && !Array.isArray(rawHs.partitionConfig))
    ? rawHs.partitionConfig
    : {};
  const blindsVal = Number(rawHs.blindsOpen);
  const cfgX = Number(rawCfg.x);
  const cfgY = Number(rawCfg.y);
  const cfgLen = Number(rawCfg.length);

  // Parse & sanitize plural partition walls (with full backward-compatibility for legacy single partition)
  let cleanPartitions = [];
  if (Array.isArray(rawHs.partitions)) {
    cleanPartitions = rawHs.partitions.map((p, idx) => {
      const pid = (typeof p.id === 'string' && p.id.trim()) ? p.id.trim() : `partition-${idx + 1}`;
      const px = Number(p.x);
      const py = Number(p.y);
      const pLen = Number(p.length);
      return {
        id: pid,
        type: p.type === 'solid' ? 'solid' : 'door',
        x: Number.isFinite(px) ? Math.max(0.15, Math.min(roomW - 0.35, Number(px.toFixed(2)))) : Number((roomW * (0.35 + (idx % 3) * 0.18)).toFixed(2)),
        y: Number.isFinite(py) ? Math.max(0.15, Math.min(roomD - 0.35, Number(py.toFixed(2)))) : Number((roomD * (0.28 + (idx % 3) * 0.15)).toFixed(2)),
        length: Number.isFinite(pLen) ? Math.max(1.4, Math.min(4.8, Number(pLen.toFixed(2)))) : 2.6,
        orient: ['x', 'y'].includes(p.orient) ? p.orient : 'y',
        doorPos: ['center', 'start', 'end'].includes(p.doorPos) ? p.doorPos : 'center',
        doorStyle: ['glass-sliding', 'wood-hinged', 'open-arch'].includes(p.doorStyle) ? p.doorStyle : 'glass-sliding',
        doorOpen: Boolean(p.doorOpen),
        manualClosedUntil: Number.isFinite(p.manualClosedUntil) ? Number(p.manualClosedUntil) : 0
      };
    });
  } else if (rawHs.partition) {
    cleanPartitions = [{
      id: 'partition-1',
      type: rawCfg.type === 'solid' ? 'solid' : 'door',
      x: Number.isFinite(cfgX) ? Math.max(0.15, Math.min(roomW - 0.35, Number(cfgX.toFixed(2)))) : Number((roomW * 0.48).toFixed(2)),
      y: Number.isFinite(cfgY) ? Math.max(0.15, Math.min(roomD - 0.35, Number(cfgY.toFixed(2)))) : Number((roomD * 0.32).toFixed(2)),
      length: Number.isFinite(cfgLen) ? Math.max(1.4, Math.min(4.8, Number(cfgLen.toFixed(2)))) : 2.6,
      orient: ['x', 'y'].includes(rawCfg.orient) ? rawCfg.orient : 'y',
      doorPos: ['center', 'start', 'end'].includes(rawCfg.doorPos) ? rawCfg.doorPos : 'center',
      doorStyle: ['glass-sliding', 'wood-hinged', 'open-arch'].includes(rawCfg.doorStyle) ? rawCfg.doorStyle : 'glass-sliding',
      doorOpen: Boolean(rawCfg.doorOpen),
      manualClosedUntil: Number.isFinite(rawCfg.manualClosedUntil) ? Number(rawCfg.manualClosedUntil) : 0
    }];
  }

  const primaryCfg = cleanPartitions[0] || {
    id: 'partition-1',
    type: 'door',
    x: Number.isFinite(cfgX) ? Math.max(0.15, Math.min(roomW - 0.35, Number(cfgX.toFixed(2)))) : Number((roomW * 0.48).toFixed(2)),
    y: Number.isFinite(cfgY) ? Math.max(0.15, Math.min(roomD - 0.35, Number(cfgY.toFixed(2)))) : Number((roomD * 0.32).toFixed(2)),
    length: Number.isFinite(cfgLen) ? Math.max(1.4, Math.min(4.8, Number(cfgLen.toFixed(2)))) : 2.6,
    orient: ['x', 'y'].includes(rawCfg.orient) ? rawCfg.orient : 'y',
    doorPos: ['center', 'start', 'end'].includes(rawCfg.doorPos) ? rawCfg.doorPos : 'center',
    doorStyle: ['glass-sliding', 'wood-hinged', 'open-arch'].includes(rawCfg.doorStyle) ? rawCfg.doorStyle : 'glass-sliding',
    doorOpen: Boolean(rawCfg.doorOpen),
    manualClosedUntil: Number.isFinite(rawCfg.manualClosedUntil) ? Number(rawCfg.manualClosedUntil) : 0
  };

  simState.hardscape = {
    shape: ['rect', 'lshape', 'balcony'].includes(rawHs.shape) ? rawHs.shape : 'rect',
    partition: cleanPartitions.length > 0,
    partitions: cleanPartitions,
    pillar: Boolean(rawHs.pillar),
    walkup: Boolean(rawHs.walkup),
    floorMat: ['wood', 'zoned', 'tile'].includes(rawHs.floorMat) ? rawHs.floorMat : 'wood',
    wallMat: ['warm', 'stone', 'acoustic'].includes(rawHs.wallMat) ? rawHs.wallMat : 'warm',
    cableRaceway: Boolean(rawHs.cableRaceway),
    blindsOpen: Number.isFinite(blindsVal) ? Math.max(0, Math.min(100, Math.round(blindsVal))) : 80,
    blueprintMode: Boolean(rawHs.blueprintMode),
    partitionConfig: primaryCfg
  };

  // Normalize base furniture array (migrate legacy short IDs like 'bed' -> 'bed-set')
  const legacyFurnMap = {
    bed: 'bed-set',
    shower: 'shower-pod',
    sofa: 'sofa-set',
    tv: 'tv-wall',
    cart: 'kitchen-cart',
    plant: 'plant-deco'
  };
  const validBaseIds = new Set(extraFurnitureCatalog.map(b => b.id));
  simState.furniture = Array.isArray(simState.furniture)
    ? Array.from(new Set(
        simState.furniture
          .map(id => (typeof id === 'string' ? (legacyFurnMap[id] || id) : ''))
          .filter(id => validBaseIds.has(id))
      ))
    : [];

  // Normalize V4 catalog items array
  const validV4Ids = new Set(V4_SHOP_CATALOG.map(m => m.id));
  simState.v4Items = Array.isArray(simState.v4Items)
    ? Array.from(new Set(simState.v4Items.filter(id => typeof id === 'string' && validV4Ids.has(id))))
    : [];

  // Normalize v4Positions and migrate legacy customFurniturePos if present
  const mergedPos = {};
  const ingestPositions = src => {
    if (!src || typeof src !== 'object' || Array.isArray(src)) return;
    Object.entries(src).forEach(([k, v]) => {
      if (!v || typeof v !== 'object') return;
      const px = Number(v.x);
      const py = Number(v.y);
      if (Number.isFinite(px) && Number.isFinite(py)) {
        const normKey = legacyFurnMap[k] || k;
        mergedPos[normKey] = {
          x: Number(Math.max(0.04, Math.min(13.5, px)).toFixed(2)),
          y: Number(Math.max(0.04, Math.min(9.0, py)).toFixed(2))
        };
      }
    });
  };
  ingestPositions(simState.customFurniturePos);
  ingestPositions(simState.v4Positions);
  simState.v4Positions = mergedPos;
  delete simState.customFurniturePos;

  // Normalize rotatedItems (convert legacy boolean true/false or string/NaN into 0..3 quadrant integers)
  const cleanRot = {};
  if (simState.rotatedItems && typeof simState.rotatedItems === 'object' && !Array.isArray(simState.rotatedItems)) {
    Object.entries(simState.rotatedItems).forEach(([k, val]) => {
      const normKey = legacyFurnMap[k] || k;
      if (val === true || val === 'true') {
        cleanRot[normKey] = 1;
      } else if (val === false || val === 'false' || val === null || val === undefined) {
        cleanRot[normKey] = 0;
      } else {
        const num = parseInt(val, 10);
        cleanRot[normKey] = Number.isFinite(num) ? ((num % 4) + 4) % 4 : 0;
      }
    });
  }
  simState.rotatedItems = cleanRot;

  simState.lockedItems = Array.isArray(simState.lockedItems)
    ? simState.lockedItems.filter(id => typeof id === 'string')
    : [];
  simState.flawedItems = Array.isArray(simState.flawedItems)
    ? simState.flawedItems.filter(id => typeof id === 'string')
    : [];
  simState.scenario = (typeof simState.scenario === 'string' && V4_SCENARIOS[simState.scenario])
    ? simState.scenario
    : 'sandbox';
  const hcVal = Number(simState.hiddenCostsPaid);
  simState.hiddenCostsPaid = Number.isFinite(hcVal) && hcVal >= 0 ? Math.round(hcVal) : 0;
  simState.showHitbox = Boolean(simState.showHitbox);
  if (!simState.player || typeof simState.player !== 'object') {
    simState.player = { x: 4.8, y: 4.5, angle: 0.85, targetAngle: 0.85, targetX: null, targetY: null, waypoints: [], pendingAction: null };
  } else if (!Array.isArray(simState.player.waypoints)) {
    simState.player.waypoints = [];
  }
}
ensureV4State();

let currentShopChannel = 'new'; // 'new' | 'used' | 'blindbox'
let currentShopCat = 'all';
let usedMarketPool = [];
let robotVacState = { x: 4.2, y: 3.1, vx: 0.75, vy: 0.55 };
let pathCheckAnim = null; // { startAt, waypoints, blocked, reason }
let draggingSubgridItem = null; // { id }

function hasV4Item(id) {
  ensureV4State();
  return simState.v4Items.includes(id);
}

function getV4ItemPos(item) {
  ensureV4State();
  const { w: roomW, d: roomD } = getRoomDimensions(simState.profile?.area || 18);
  const rot = getObjRotation(item.id);
  const swapped = (rot % 2) === 1;
  const dx = swapped ? (item.dy || 0.4) : (item.dx || 0.4);
  const dy = swapped ? (item.dx || 0.4) : (item.dy || 0.4);
  const custom = simState.v4Positions[item.id];
  const rawX = custom && Number.isFinite(custom.x) ? custom.x : item.x;
  const rawY = custom && Number.isFinite(custom.y) ? custom.y : item.y;
  const x = Math.max(0.08, Math.min(roomW - dx - 0.12, rawX));
  const y = Math.max(0.04, Math.min(roomD - dy - 0.12, rawY));
  // Dynamic Auto-stacking check for sub-grid tabletop items!
  let z = item.zBase || 0;
  if (item.isSubgrid) {
    const tp = simState.trackPos || { work: 5.1, family: 2.1 };
    const workX = tp.work ?? 5.1;
    const famX = tp.family ?? 2.1;
    const sdCustom = simState.v4Positions['standing-desk'];
    const sdX = sdCustom && Number.isFinite(sdCustom.x) ? sdCustom.x : 4.8;
    const sdY = sdCustom && Number.isFinite(sdCustom.y) ? sdCustom.y : 0.32;
    const tvCustom = simState.v4Positions['tv-wall'];
    const tvX = tvCustom && Number.isFinite(tvCustom.x) ? tvCustom.x : 2.5;
    const tvY = tvCustom && Number.isFinite(tvCustom.y) ? tvCustom.y : 3.9;
    const cx = x + dx * 0.5;
    const cy = y + dy * 0.5;
    if (isDlcActive('work') && cx >= workX - 0.1 && cx <= workX + 2.0 && cy <= 1.45) {
      z = 0.84;
    } else if (hasV4Item('standing-desk') && cx >= sdX - 0.15 && cx <= sdX + 1.9 && cy >= sdY - 0.15 && cy <= sdY + 1.1) {
      z = 0.84;
    } else if (isDlcActive('family') && cx >= famX - 0.15 && cx <= famX + 2.35 && cy <= 2.05) {
      z = 0.95;
    } else if (simState.furniture.includes('tv-wall') && cx >= tvX - 0.15 && cx <= tvX + 1.45 && cy >= tvY - 0.15 && cy <= tvY + 1.55) {
      z = 0.44;
    }
  }
  return { x, y, z, dx, dy, rot };
}

// Check MEP Power Distance for high-power items
function checkMepPowerStatus() {
  ensureV4State();
  if (simState.hardscape.cableRaceway) {
    return { ok: true, msg: '✅ 已鋪設全室「隱藏式延長線與壓條」，所有跨區電器供電完美且零雜亂走線！', penalty: 0 };
  }
  const unpowered = [];
  simState.v4Items.forEach(id => {
    const meta = V4_SHOP_CATALOG.find(m => m.id === id);
    if (!meta || !meta.powerReq) return;
    const pos = getV4ItemPos(meta);
    // TAYA back wall track (y <= 1.4) provides integrated 110V power bus when WORK or FAMILY DLC is active
    if (pos.y <= 1.45 && (isDlcActive('work') || isDlcActive('family'))) return;
    const nearOutlet = WALL_OUTLETS.some(o => Math.hypot(pos.x - o.x, pos.y - o.y) <= 2.35);
    if (!nearOutlet) unpowered.push(meta.name);
  });
  if (unpowered.length === 0) {
    return { ok: true, msg: '🔌 所有高耗電設備皆位於牆面插座或 TAYA 電力軌道供電範圍內。', penalty: 0 };
  }
  return {
    ok: false,
    msg: `⚠️ 跨區走線警告：「${unpowered.slice(0, 2).join('、')}」距離牆面插座過遠，裸露延長線扣減 -${unpowered.length * 4} 美觀分！`,
    penalty: unpowered.length * 4
  };
}

// Check Room Combos (空間加乘)
function getActiveCombos() {
  ensureV4State();
  const combos = [];
  // 1. 極致電競角 Combo
  const hasDesk = isDlcActive('work') || hasV4Item('standing-desk');
  const hasRig = hasV4Item('rgb-pc-rig');
  const hasErgoOrPeg = hasV4Item('ergo-chair') || hasV4Item('pegboard');
  if (hasDesk && hasRig && hasErgoOrPeg) {
    combos.push({ id: 'gaming-corner', label: '🔥 極致電競角 Combo', bonus: 18 });
  }
  // 2. 家庭劇院 Combo
  const hasSofa = simState.furniture.includes('sofa-set') || hasV4Item('beanbag');
  const hasScreen = hasV4Item('projector') || simState.furniture.includes('tv-wall');
  if (hasSofa && hasScreen) {
    combos.push({ id: 'home-theater', label: '🎬 沉浸家庭劇院 Combo', bonus: 15 });
  }
  // 3. 貓奴收藏家 Combo
  if (hasV4Item('figure-cab') && hasV4Item('cat-tree') && simState.hardscape.floorMat === 'wood') {
    combos.push({ id: 'cat-collector', label: '🐾 貓奴收藏家 Combo', bonus: 15 });
  }
  // 4. 質感生活家 Combo
  if ((hasV4Item('coffee-maker') || isDlcActive('family')) && hasV4Item('vinyl-player') && (hasV4Item('monstera-xl') || simState.furniture.includes('plant-deco'))) {
    combos.push({ id: 'lifestyle-pro', label: '☕ 質感生活家 Combo', bonus: 12 });
  }
  return combos;
}

// Check if Circulation Path (動線) is blocked
function isPathBlocked() {
  ensureV4State();
  const partitions = Array.isArray(simState.hardscape?.partitions) ? simState.hardscape.partitions : [];
  const { w: roomW, d: roomD } = getRoomDimensions(simState.profile?.area || 18);
  for (let i = 0; i < partitions.length; i++) {
    const p = partitions[i];
    if (simState.profile.area <= 5 && (p.length || 2.6) > 2.2 && !p.doorOpen && p.doorStyle !== 'open-arch') {
      return `5 坪微型空間的隔間牆 #${i + 1} 長度過長且門扇緊閉，走道動線卡死！建議縮短長度或敞開門扇。`;
    }
    const spanLimit = p.orient === 'x' ? roomW - 0.7 : roomD - 0.7;
    if (p.type === 'solid' && (p.length || 2.6) >= spanLimit) {
      return `實心隔間牆 #${i + 1} 貫穿全室無任何開口通道，動線完全阻隔！建議切換為房門牆或縮短長度。`;
    }
  }
  if (!isDlcActive('storage') && simState.profile.area <= 12 && hasV4Item('mahjong-table')) {
    return '地面未收納的紙箱雜物與電動麻將桌卡住臥床走道（建議安裝 STORAGE DLC）！';
  }
  return null;
}

// Refresh Used Auction Market (3~7折)
function refreshUsedMarket() {
  const shuffled = [...V4_SHOP_CATALOG].sort(() => Math.random() - 0.5);
  usedMarketPool = shuffled.slice(0, 5).map(item => {
    const discount = [0.35, 0.45, 0.55, 0.65][Math.floor(Math.random() * 4)];
    return {
      ...item,
      usedPrice: Math.max(18, Math.round(item.price * discount)),
      discountLabel: `${Math.round(discount * 10)}折`,
      hasMinorFlaw: true
    };
  });
}
refreshUsedMarket();

// 2. Render 3D Hardscape & V4 3D Models (Depth-sorted & Clamped to Room Bounds)

function renderV4Panels() {
  ensureV4State();
  const hs = simState.hardscape;

  // A. Combo Tags
  const combos = getActiveCombos();
  const comboTotal = combos.reduce((s, c) => s + c.bonus, 0);
  const comboSummaryEl = document.getElementById('comboBonusSummary');
  if (comboTotal > 0 && comboSummaryEl) {
    comboSummaryEl.textContent = `已觸發 ${combos.length} 項加成 (+${comboTotal} 分)`;
  } else if (comboSummaryEl) {
    comboSummaryEl.textContent = '尚未觸發組合加成';
  }
  const comboBox = document.getElementById('comboTagsBox');
  if (comboBox) {
    const allComboDefs = [
      { id: 'gaming-corner', label: '🔥 極致電競角 (+18)' },
      { id: 'home-theater', label: '🎬 沉浸家庭劇院 (+15)' },
      { id: 'cat-collector', label: '🐾 貓奴收藏家 (+15)' },
      { id: 'lifestyle-pro', label: '☕ 質感生活家 (+12)' }
    ];
    comboBox.innerHTML = allComboDefs.map(cd => {
      const act = combos.some(c => c.id === cd.id);
      return `<span class="combo-chip${act ? ' active' : ''}">${act ? '✓ ' : ''}${cd.label}</span>`;
    }).join('');
  }

  // B. Scenario Goals Checklist
  const scen = V4_SCENARIOS[simState.scenario] || V4_SCENARIOS.sandbox;
  const scenSelect = document.getElementById('scenarioSelect');
  if (scenSelect) scenSelect.value = simState.scenario;
  const goalsEl = document.getElementById('scenarioGoalsList');
  let allDone = true;
  if (goalsEl) {
    goalsEl.innerHTML = scen.goals.map(g => {
      const ok = Boolean(g.check());
      if (!ok) allDone = false;
      const jumpBtn = (!ok && g.jumpTab)
        ? `<button type="button" class="scenario-goal-jump" data-target-tab="${g.jumpTab}" data-target-cat="${g.jumpCat || ''}">👉 ${g.jumpText || '前往配置'}</button>`
        : '';
      return `<li class="${ok ? 'done' : ''}">
        <span class="goal-text">${ok ? '✅' : '⬜'} ${g.text}</span>
        ${jumpBtn}
      </li>`;
    }).join('');

    goalsEl.querySelectorAll('.scenario-goal-jump').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabKey = btn.dataset.targetTab;
        const catKey = btn.dataset.targetCat;
        switchDeckTab(tabKey, catKey || null);
        showRoomBanner(`🎯 已為您跳轉至「${tabKey === 'hardscape' ? '硬裝＆水電' : tabKey === 'shop' ? '商城＆盲盒' : '軌道＆循環'}」！`);
      });
    });
  }
  const scenBadge = document.getElementById('scenarioStatusBadge');
  if (scenBadge) {
    scenBadge.textContent = allDone ? '🎉 委託達標！' : '進行中';
    scenBadge.style.color = allDone ? '#15803d' : '#98633f';
  }

  // C. Hardscape & MEP Status
  document.querySelectorAll('#layoutShapeBtns .hardscape-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.shape === hs.shape);
  });
  document.querySelectorAll('#floorMatBtns .hardscape-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.floor === hs.floorMat);
  });
  document.querySelectorAll('#wallMatBtns .hardscape-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.wall === hs.wallMat);
  });
  document.getElementById('btnTogglePartition')?.classList.toggle('active', Boolean(hs.partition));
  document.getElementById('btnTogglePillar')?.classList.toggle('active', Boolean(hs.pillar));
  document.getElementById('btnToggleWalkup')?.classList.toggle('active', Boolean(hs.walkup));

  // Sync Partition Customizer Box (規格、長度、門扇、複數隔間牆)
  const partBox = document.getElementById('partitionCustomizerBox');
  if (partBox) {
    const hasPartitions = Boolean(hs.partition && Array.isArray(hs.partitions) && hs.partitions.length > 0);
    partBox.style.display = hasPartitions ? 'flex' : 'none';
    if (hasPartitions) {
      const activeWall = getActivePartitionWall() || hs.partitions[0];
      const isSolid = activeWall.type === 'solid';
      const activeIdx = hs.partitions.findIndex(p => p.id === activeWall.id);
      const isHoriz = activeWall.orient === 'x';
      const { w: roomW, d: roomD } = getRoomDimensions(simState.profile?.area || 18);
      const maxL = Math.min(4.8, Math.max(1.8, Number(((isHoriz ? roomW : roomD) - 0.5).toFixed(1))));
      const curLen = Math.max(1.4, Math.min(maxL, activeWall.length || 2.6));

      // Wall Selector Chips
      const selectorBar = document.getElementById('partitionWallSelectorBar');
      if (selectorBar) {
        selectorBar.innerHTML = hs.partitions.map((p, idx) => {
          const isAct = p.id === activeWall.id;
          const icon = p.type === 'solid' ? '🧱' : '🚪';
          return `<button type="button" class="partition-chip-btn partition-wall-chip${isAct ? ' active' : ''}" data-wall-id="${p.id}" style="font-size:0.7rem; padding:0.2rem 0.45rem;">
            ${icon} 隔間 #${idx + 1} (${p.length.toFixed(1)}m)
          </button>`;
        }).join('') + `
          <button type="button" class="partition-chip-btn" id="btnQuickAddSolid" style="background:#f1f5f9; color:#475569; font-size:0.68rem; padding:0.2rem 0.4rem;" title="新增純實心隔間牆">+ 純牆</button>
          <button type="button" class="partition-chip-btn" id="btnQuickAddDoor" style="background:#f1f5f9; color:#475569; font-size:0.68rem; padding:0.2rem 0.4rem;" title="新增房門隔間牆">+ 房門</button>
        `;

        selectorBar.querySelectorAll('.partition-wall-chip').forEach(btn => {
          btn.addEventListener('click', () => {
            selectedObjectId = btn.dataset.wallId;
            renderV4Panels();
            renderSim();
            updateObjInspectorUI();
          });
        });
        selectorBar.querySelector('#btnQuickAddSolid')?.addEventListener('click', () => addPartitionWall('solid'));
        selectorBar.querySelector('#btnQuickAddDoor')?.addEventListener('click', () => addPartitionWall('door'));
      }

      // Dim Badge
      const badgeEl = document.getElementById('partitionDimBadge');
      if (badgeEl) {
        badgeEl.textContent = `隔間 #${activeIdx + 1} · ${isSolid ? '純實心' : '含門'} · ${isHoriz ? '橫向(X)' : '縱向(Y)'}`;
      }

      // Wall Type Buttons
      document.querySelectorAll('.partition-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === activeWall.type);
      });

      // Door settings row visibility
      const doorSettingsRow = document.getElementById('partitionDoorSettingsRow');
      if (doorSettingsRow) {
        doorSettingsRow.style.display = isSolid ? 'none' : 'flex';
      }

      // Length Slider & Buttons
      const lenEl = document.getElementById('partitionLenText');
      const sliderEl = document.getElementById('partitionLenSlider');
      if (lenEl) lenEl.textContent = `${curLen.toFixed(1)} 公尺`;
      if (sliderEl) {
        sliderEl.max = String(maxL);
        sliderEl.value = String(curLen);
      }
      document.querySelectorAll('.partition-len-btn').forEach(btn => {
        const bLen = parseFloat(btn.dataset.len);
        btn.classList.toggle('active', Math.abs(bLen - curLen) < 0.15);
        btn.style.opacity = bLen > maxL + 0.05 ? '0.55' : '1';
      });

      // Orient Buttons
      document.querySelectorAll('.partition-orient-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.orient === activeWall.orient);
      });

      // Door Controls (if door wall)
      if (!isSolid) {
        document.querySelectorAll('.partition-dpos-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.dpos === activeWall.doorPos);
        });
        document.querySelectorAll('.partition-dstyle-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.style === activeWall.doorStyle);
        });
        const doorBtn = document.getElementById('btnTogglePartitionDoor');
        if (doorBtn) {
          if (activeWall.doorStyle === 'open-arch') {
            doorBtn.textContent = '⛩️ 穿透拱門 (恆常暢通)';
            doorBtn.classList.add('active');
            doorBtn.style.opacity = '0.78';
          } else {
            doorBtn.textContent = activeWall.doorOpen ? '🚪 敞開通行中 (點擊關門)' : '🔒 闔上隱私中 (點擊開門)';
            doorBtn.classList.toggle('active', Boolean(activeWall.doorOpen));
            doorBtn.style.opacity = '1';
          }
        }
      }
    }
  }

  const mep = checkMepPowerStatus();
  const mepBar = document.getElementById('mepStatusBar');
  const mepBadge = document.getElementById('mepBadgeText');
  if (mepBar) {
    mepBar.textContent = mep.msg;
    mepBar.classList.toggle('warn', !mep.ok);
  }
  if (mepBadge) {
    mepBadge.textContent = mep.ok ? '⚡ 供電完美' : `⚠️ 扣減 ${mep.penalty} 分`;
    mepBadge.style.color = mep.ok ? '#527464' : '#b45309';
  }
  const racewayBtn = document.getElementById('btnBuyCableRaceway');
  if (racewayBtn) {
    racewayBtn.classList.toggle('active', Boolean(hs.cableRaceway));
    racewayBtn.textContent = hs.cableRaceway
      ? '✅ 已鋪設全室「隱藏式延長線與地板壓條」'
      : '🔌 鋪設「隱藏式延長線與地板壓條」(§25 · 消除跨區接電扣分)';
  }

  // D. Shop Channels (New / Used Auction / Blind Box)
  const refreshBtn = document.getElementById('btnRefreshUsed');
  const hintEl = document.getElementById('shopChannelHint');
  if (refreshBtn) refreshBtn.style.display = currentShopChannel === 'used' ? 'inline-block' : 'none';
  if (hintEl) {
    hintEl.textContent = currentShopChannel === 'new'
      ? '💡 所有 3D 家具皆可在畫面拖曳移動、按 R 旋轉 90°；[桌上小物] 會自動疊上桌面！'
      : currentShopChannel === 'used'
      ? '♻️ 二手拍賣網每日刷新 3~7 折單品（微瑕可花 §15 翻新）'
      : '🎁 花費 §35 隨機抽出高價驚喜電競／收藏／寵物盲盒單品！';
  }

  const shopGrid = document.getElementById('shopItemsGrid');
  if (!shopGrid) return;
  shopGrid.innerHTML = '';

  if (currentShopChannel === 'blindbox') {
    const boxCard = document.createElement('div');
    boxCard.className = 'shop-item-card';
    boxCard.style.padding = '0.85rem';
    boxCard.innerHTML = `
      <div class="shop-item-info">
        <strong>🎁 TAYA 驚喜特價盲盒／福利品福袋</strong>
        <small>僅需 §35！隨機開出價值 §65~§210 的 RGB 主機、公仔展示櫃、黑膠機、太空艙貓跳台或霓虹燈條！</small>
      </div>
      <button type="button" class="shop-buy-btn" id="btnOpenBlindBox">🎲 花費 §35 立即開箱</button>
    `;
    boxCard.querySelector('#btnOpenBlindBox').addEventListener('click', () => {
      if (simState.money < 35) {
        playSimSound('error');
        showSimMessage('⚠️ 預算不足 §35，先執行工作賺取資金吧！', true);
        return;
      }
      const unowned = V4_SHOP_CATALOG.filter(m => !hasV4Item(m.id));
      const pool = unowned.length > 0 ? unowned : V4_SHOP_CATALOG;
      const prize = pool[Math.floor(Math.random() * pool.length)];
      simState.money -= 35;
      if (!hasV4Item(prize.id)) simState.v4Items.push(prize.id);
      triggerSnapEffect(prize.id);
      spawnFloatingText(`🎁 開出：${prize.name}！`, simState.player.x, simState.player.y, 1.85, '#fde047');
      saveSimState();
      playSimSound('buff');
      renderSim();
      showRoomBanner(`🎉 盲盒大獎！僅花 §35 抽中「${prize.name}」(原價 §${prize.price})！`, true);
    });
    shopGrid.appendChild(boxCard);
    return;
  }

  // Render Basic Furniture first when in 'new' channel and 'all' or 'basic' category
  if (currentShopChannel === 'new' && (currentShopCat === 'all' || currentShopCat === 'basic') && typeof extraFurnitureCatalog !== 'undefined') {
    extraFurnitureCatalog.forEach(bItem => {
      const placed = simState.furniture.includes(bItem.id);
      const bCard = document.createElement('div');
      bCard.className = `shop-item-card${placed ? ' owned' : ''}`;
      bCard.innerHTML = `
        <div class="shop-item-info">
          <strong>${bItem.icon} [基礎] ${bItem.name}</strong>
          <small>${bItem.desc}（免費基礎家具 · 可在 3D 地板自由拖曳與旋轉）</small>
        </div>
        <div class="shop-item-actions">
          <button type="button" class="shop-buy-btn${placed ? ' owned' : ''}">
            ${placed ? '收起 ✓' : '+ 免費擺放'}
          </button>
        </div>
      `;
      bCard.querySelector('button').addEventListener('click', () => {
        if (placed) {
          simState.furniture = simState.furniture.filter(id => id !== bItem.id);
          showSimMessage(`📦 已收起基礎家具「${bItem.name}」。`);
        } else {
          simState.furniture.push(bItem.id);
          triggerSnapEffect(bItem.sceneId || bItem.id);
          showRoomBanner(`🏠 已在房間擺放「${bItem.name}」（可直接在 3D 地板拖曳移動或按 R 旋轉）！`);
        }
        saveSimState();
        playSimSound('snap');
        renderSim();
      });
      shopGrid.appendChild(bCard);
    });
  }

  const listSource = currentShopChannel === 'used' ? usedMarketPool : V4_SHOP_CATALOG;
  const filtered = listSource.filter(item => currentShopCat === 'all' || item.cat === currentShopCat);

  filtered.forEach(item => {
    const owned = hasV4Item(item.id);
    const isLocked = simState.lockedItems && simState.lockedItems.includes(item.id);
    const isFlawed = simState.flawedItems && simState.flawedItems.includes(item.id);
    const basePrice = currentShopChannel === 'used' ? item.usedPrice : item.price;
    const walkupFee = (!owned && hs.walkup && !item.isSubgrid && !item.isWall) ? Math.round(basePrice * 0.15) : 0;
    const totalCost = basePrice + walkupFee;

    const card = document.createElement('div');
    card.className = `shop-item-card${owned ? ' owned' : ''}`;
    const iconDisp = item.iconText || item.icon;
    const discountBadge = currentShopChannel === 'used' ? `<span style="color:#b45309; font-weight:800;">[${item.discountLabel}]</span> ` : '';
    const walkupNote = walkupFee > 0 ? ` (含無電梯搬運費+§${walkupFee})` : '';

    card.innerHTML = `
      <div class="shop-item-info">
        <strong>${iconDisp} ${discountBadge}${item.name} ${isFlawed ? '🔧(微瑕)' : ''}</strong>
        <small>${item.desc}${walkupNote}</small>
      </div>
      <div class="shop-item-actions">
        ${owned && isFlawed ? `<button type="button" class="shop-buy-btn" data-refurb="${item.id}">✨翻新§15</button>` : ''}
        <button type="button" class="shop-buy-btn${owned ? ' owned' : ''}${isLocked ? ' locked' : ''}">
          ${isLocked ? '🔒 舊家鎖定' : owned ? '售出 (+50%)' : `購買 §${totalCost}`}
        </button>
      </div>
    `;

    const refurbBtn = card.querySelector('[data-refurb]');
    if (refurbBtn) {
      refurbBtn.addEventListener('click', () => {
        if (simState.money < 15) {
          playSimSound('error');
          showSimMessage('⚠️ 預算不足 §15！', true);
          return;
        }
        simState.money -= 15;
        simState.flawedItems = simState.flawedItems.filter(f => f !== item.id);
        saveSimState();
        playSimSound('buff');
        renderSim();
        showRoomBanner(`✨ 已清潔翻新「${item.name}」，恢復全新美觀度！`, true);
      });
    }

    const mainBtn = card.querySelector('.shop-item-actions button:last-child');
    mainBtn.addEventListener('click', () => {
      if (isLocked) {
        playSimSound('error');
        showSimMessage('🔒 此為「無痛搬家挑戰」舊家帶來的既有家具，不可賣出，請搭配新配件融入格局！', true);
        return;
      }
      if (owned) {
        simState.v4Items = simState.v4Items.filter(i => i !== item.id);
        simState.flawedItems = (simState.flawedItems || []).filter(i => i !== item.id);
        const refund = Math.round(item.price * 0.5);
        simState.money += refund;
        playSimSound('tap');
        showSimMessage(`已售出「${item.name}」，退回 §${refund}。`);
      } else {
        if (simState.money < totalCost) {
          playSimSound('error');
          showSimMessage(`⚠️ 預算不足 §${totalCost}！可先執行工作或至「二手拍賣／盲盒」尋寶。`, true);
          return;
        }
        simState.money -= totalCost;
        if (walkupFee > 0) simState.hiddenCostsPaid = (simState.hiddenCostsPaid || 0) + walkupFee;
        simState.v4Items.push(item.id);
        if (currentShopChannel === 'used' && item.hasMinorFlaw) {
          simState.flawedItems.push(item.id);
        }
        triggerSnapEffect(item.id);
        playSimSound('snap');
        showRoomBanner(`🛋️ 已添購「${item.name}」${walkupFee > 0 ? `(含搬運費 §${walkupFee})` : ''}！`);
      }
      saveSimState();
      renderSim();
    });

    shopGrid.appendChild(card);
  });
}

// 4. Bind V4 Controls: Sliders, Hardscape, Shop, Scenarios, Path Check & Quote Export
document.querySelectorAll('.shop-channel-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.shop-channel-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentShopChannel = btn.dataset.channel;
    playSimSound('tap');
    renderV4Panels();
  });
});

document.querySelectorAll('.shop-cat-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    if (pill.dataset.cat === 'dlc') {
      switchDeckTab('build');
      showRoomBanner('⚡ 已為您跳轉至「TAYA 軌道核心 DLC 模組」工坊！');
      return;
    }
    document.querySelectorAll('.shop-cat-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentShopCat = pill.dataset.cat;
    playSimSound('tap');
    renderV4Panels();
  });
});

document.getElementById('btnRefreshUsed')?.addEventListener('click', () => {
  refreshUsedMarket();
  playSimSound('confirm');
  renderV4Panels();
  showRoomBanner('♻️ 二手拍賣網已刷新今日 3~7 折精選單品！');
});

// Scenario Selector
document.getElementById('scenarioSelect')?.addEventListener('change', e => {
  const key = e.target.value;
  const scen = V4_SCENARIOS[key];
  if (!scen) return;
  ensureV4State();
  simState.scenario = key;
  simState.money = scen.budget;
  simState.profile.area = scen.area;
  simState.hardscape.shape = scen.shape || 'rect';
  if (scen.pillar !== undefined) simState.hardscape.pillar = scen.pillar;
  simState.lockedItems = [...(scen.lockedItems || [])];
  scen.lockedItems?.forEach(id => {
    if (!simState.v4Items.includes(id)) simState.v4Items.push(id);
  });
  saveSimState();
  playSimSound('buff');
  renderSim();
  showRoomBanner(`🎬 已載入劇本：${scen.title}（初始預算 §${scen.budget}）`, true);
});

// Hardscape Buttons
document.querySelectorAll('#layoutShapeBtns .hardscape-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    ensureV4State();
    simState.hardscape.shape = btn.dataset.shape;
    saveSimState();
    playSimSound('snap');
    renderSim();
    const names = { rect: '標準矩形格局', lshape: 'L型畸零格局', balcony: '陽台外推採光格局' };
    showRoomBanner(`📐 已切換房型為：${names[btn.dataset.shape]}`);
  });
});

document.querySelectorAll('#floorMatBtns .hardscape-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    ensureV4State();
    simState.hardscape.floorMat = btn.dataset.floor;
    saveSimState();
    playSimSound('tap');
    renderSim();
  });
});

document.querySelectorAll('#wallMatBtns .hardscape-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    ensureV4State();
    simState.hardscape.wallMat = btn.dataset.wall;
    saveSimState();
    playSimSound('tap');
    renderSim();
    const wNames = { warm: '溫潤跳色乳膠漆', stone: '北歐文化石牆', acoustic: '專業六角吸音棉牆' };
    showRoomBanner(`🎨 牆面材質已更換為：${wNames[btn.dataset.wall]}`);
  });
});

// ─── PLURAL MOVABLE PARTITION WALLS (SOLID & DOORWAY WALLS) ───
function getActivePartitionWall() {
  ensureV4State();
  const partitions = simState.hardscape?.partitions;
  if (!Array.isArray(partitions) || partitions.length === 0) return null;
  if (selectedObjectId && isPartitionWall(selectedObjectId)) {
    const found = partitions.find(p => p.id === selectedObjectId);
    if (found) return found;
  }
  return partitions[0];
}

function addPartitionWall(type = 'door') {
  ensureV4State();
  const isSolid = type === 'solid';
  const cost = isSolid ? 40 : 60;
  if (simState.money < cost) {
    playSimSound('error');
    showSimMessage(`⚠️ 預算不足 §${cost}！建造${isSolid ? '純隔間牆' : '房門隔間牆'}需要 §${cost}。`, true);
    return;
  }
  simState.money -= cost;
  if (!Array.isArray(simState.hardscape.partitions)) {
    simState.hardscape.partitions = [];
  }
  const { w: roomW, d: roomD } = getRoomDimensions(simState.profile?.area || 18);
  const idx = simState.hardscape.partitions.length;
  const newId = `partition-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
  const isHoriz = (idx % 2) === 1;
  const newWall = {
    id: newId,
    type: isSolid ? 'solid' : 'door',
    x: Number(Math.max(0.2, Math.min(roomW - 0.5, roomW * (0.3 + (idx % 3) * 0.18))).toFixed(2)),
    y: Number(Math.max(0.2, Math.min(roomD - 0.5, roomD * (0.26 + (idx % 3) * 0.16))).toFixed(2)),
    length: 2.6,
    orient: isHoriz ? 'x' : 'y',
    doorPos: 'center',
    doorStyle: 'glass-sliding',
    doorOpen: false
  };
  simState.hardscape.partitions.push(newWall);
  simState.hardscape.partition = true;
  simState.hardscape.partitionConfig = newWall;
  selectedObjectId = newId;

  triggerSnapEffect(newId);
  saveSimState();
  playSimSound('snap');
  renderSim();
  renderV4Panels();
  updateObjInspectorUI();
  showRoomBanner(`🧱 已新增「${isSolid ? '純隔間牆' : '房門隔間牆'} #${idx + 1}」(長2.6m)！可在 3D 畫面自由拖曳位置、按 R 鍵 90° 旋轉。`);
}

function deletePartitionWall(id) {
  ensureV4State();
  const partitions = simState.hardscape?.partitions;
  if (!Array.isArray(partitions) || partitions.length === 0) return;
  const targetId = id || getActivePartitionWall()?.id;
  const targetIdx = partitions.findIndex(p => p.id === targetId);
  if (targetIdx === -1) return;

  const wall = partitions[targetIdx];
  const isSolid = wall.type === 'solid';
  const refund = isSolid ? 30 : 45;
  simState.money += refund;
  partitions.splice(targetIdx, 1);
  simState.hardscape.partition = partitions.length > 0;
  simState.hardscape.partitionConfig = partitions[0] || null;

  if (selectedObjectId === targetId) {
    selectedObjectId = partitions[0]?.id || null;
  }

  saveSimState();
  playSimSound('snap');
  renderSim();
  renderV4Panels();
  updateObjInspectorUI();
  showRoomBanner(`🔨 已拆除隔間牆 #${targetIdx + 1}，退還建材折讓金 +§${refund}！`);
}

document.getElementById('btnAddSolidPartition')?.addEventListener('click', () => addPartitionWall('solid'));
document.getElementById('btnAddDoorPartition')?.addEventListener('click', () => addPartitionWall('door'));
document.getElementById('btnDeleteCurrentPartition')?.addEventListener('click', () => {
  const activeWall = getActivePartitionWall();
  if (activeWall) deletePartitionWall(activeWall.id);
});

document.getElementById('btnTogglePartition')?.addEventListener('click', () => {
  ensureV4State();
  if (!simState.hardscape.partition) {
    addPartitionWall('door');
  } else {
    deletePartitionWall();
  }
});

// Wall type toggle (純實心牆 vs 房門牆)
document.querySelectorAll('.partition-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    ensureV4State();
    const cfg = getActivePartitionWall();
    if (!cfg) return;
    const newType = btn.dataset.type === 'solid' ? 'solid' : 'door';
    if (cfg.type !== newType) {
      cfg.type = newType;
      selectedObjectId = cfg.id;
      triggerSnapEffect(cfg.id);
      saveSimState();
      playSimSound('tap');
      renderSim();
      renderV4Panels();
      updateObjInspectorUI();
      showRoomBanner(`🧱 隔間牆已變更為「${newType === 'solid' ? '純實心牆 (無門)' : '房門隔間牆 (含門)'}」！`);
    }
  });
});

// ─── PARTITION CUSTOMIZER CONTROLS ───
function setPartitionLength(newLen) {
  ensureV4State();
  const cfg = getActivePartitionWall();
  if (!cfg) return;
  const { w: roomW, d: roomD } = getRoomDimensions(simState.profile?.area || 18);
  const isHoriz = cfg.orient === 'x';
  const maxL = Math.min(4.8, Math.max(1.8, (isHoriz ? roomW : roomD) - 0.5));
  const oldLen = cfg.length || 2.6;
  const clampedLen = Math.round(Math.max(1.4, Math.min(maxL, newLen)) * 10) / 10;

  // Preserve the center point of the partition wall when resizing its length
  const cp = simState.v4Positions?.[cfg.id];
  const curX = cp && Number.isFinite(cp.x) ? cp.x : (Number.isFinite(cfg.x) ? cfg.x : roomW * 0.48);
  const curY = cp && Number.isFinite(cp.y) ? cp.y : (Number.isFinite(cfg.y) ? cfg.y : roomD * 0.32);
  const wallThick = 0.16;
  const oldDx = isHoriz ? oldLen : wallThick;
  const oldDy = isHoriz ? wallThick : oldLen;
  const newDx = isHoriz ? clampedLen : wallThick;
  const newDy = isHoriz ? wallThick : clampedLen;
  const cx = curX + oldDx * 0.5;
  const cy = curY + oldDy * 0.5;
  const nextX = Number(Math.max(0.18, Math.min(roomW - newDx - 0.15, cx - newDx * 0.5)).toFixed(2));
  const nextY = Number(Math.max(0.18, Math.min(roomD - newDy - 0.15, cy - newDy * 0.5)).toFixed(2));

  cfg.length = clampedLen;
  cfg.x = nextX;
  cfg.y = nextY;
  if (!simState.v4Positions) simState.v4Positions = {};
  simState.v4Positions[cfg.id] = { x: nextX, y: nextY };
  selectedObjectId = cfg.id;

  saveSimState();
  playSimSound('tap');
  renderSim();
  renderV4Panels();
  updateObjInspectorUI();
  showRoomBanner(`📏 隔間牆長度已設定為 ${clampedLen.toFixed(1)} 公尺！`);
}

document.querySelectorAll('.partition-len-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setPartitionLength(parseFloat(btn.dataset.len));
  });
});

document.getElementById('partitionLenSlider')?.addEventListener('input', e => {
  setPartitionLength(parseFloat(e.target.value));
});

document.getElementById('btnPartitionLenMinus')?.addEventListener('click', () => {
  ensureV4State();
  const cur = getActivePartitionWall()?.length || 2.6;
  setPartitionLength(cur - 0.2);
});

document.getElementById('btnPartitionLenPlus')?.addEventListener('click', () => {
  ensureV4State();
  const cur = getActivePartitionWall()?.length || 2.6;
  setPartitionLength(cur + 0.2);
});

document.querySelectorAll('.partition-orient-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    ensureV4State();
    const cfg = getActivePartitionWall();
    if (!cfg) return;
    const nextOrient = btn.dataset.orient === 'x' ? 'x' : 'y';
    if (cfg.orient === nextOrient) {
      // Flip 180° along same axis
      const curRot = getObjRotation(cfg.id);
      simState.rotatedItems[cfg.id] = (curRot + 2) % 4;
    } else {
      // Rotate around wall center point
      const { w: roomW, d: roomD } = getRoomDimensions(simState.profile?.area || 18);
      const wasHoriz = cfg.orient === 'x';
      const nowHoriz = nextOrient === 'x';
      const wallThick = 0.16;
      const maxL = Math.min(4.8, Math.max(1.8, (nowHoriz ? roomW : roomD) - 0.5));
      const newLen = Math.round(Math.max(1.4, Math.min(maxL, cfg.length || 2.6)) * 10) / 10;
      const oldLen = cfg.length || 2.6;
      const oldDx = wasHoriz ? oldLen : wallThick;
      const oldDy = wasHoriz ? wallThick : oldLen;
      const newDx = nowHoriz ? newLen : wallThick;
      const newDy = nowHoriz ? wallThick : newLen;
      const cp = simState.v4Positions?.[cfg.id];
      const curX = cp && Number.isFinite(cp.x) ? cp.x : (Number.isFinite(cfg.x) ? cfg.x : roomW * 0.48);
      const curY = cp && Number.isFinite(cp.y) ? cp.y : (Number.isFinite(cfg.y) ? cfg.y : roomD * 0.32);
      const cx = curX + oldDx * 0.5;
      const cy = curY + oldDy * 0.5;
      const nextX = Number(Math.max(0.18, Math.min(roomW - newDx - 0.15, cx - newDx * 0.5)).toFixed(2));
      const nextY = Number(Math.max(0.18, Math.min(roomD - newDy - 0.15, cy - newDy * 0.5)).toFixed(2));

      cfg.orient = nextOrient;
      cfg.length = newLen;
      cfg.x = nextX;
      cfg.y = nextY;
      if (!simState.v4Positions) simState.v4Positions = {};
      simState.v4Positions[cfg.id] = { x: nextX, y: nextY };
      simState.rotatedItems[cfg.id] = nowHoriz ? 1 : 0;
    }
    selectedObjectId = cfg.id;
    triggerSnapEffect(cfg.id);
    saveSimState();
    playSimSound('snap');
    renderSim();
    renderV4Panels();
    updateObjInspectorUI();
    showRoomBanner(`🧭 隔間牆方位已設定為「${nextOrient === 'x' ? '橫向 (X軸)' : '縱向 (Y軸)'}」！可在 3D 畫面直接按 R 鍵 90° 旋轉。`);
  });
});

document.querySelectorAll('.partition-dpos-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    ensureV4State();
    const cfg = getActivePartitionWall();
    if (!cfg) return;
    cfg.doorPos = btn.dataset.dpos;
    selectedObjectId = cfg.id;
    triggerSnapEffect(cfg.id);
    saveSimState();
    playSimSound('tap');
    renderSim();
    renderV4Panels();
    updateObjInspectorUI();
    const pNames = { start: '靠左/前側', center: '置中', end: '靠右/後側' };
    showRoomBanner(`🚪 門洞位置已調整為「${pNames[btn.dataset.dpos] || btn.dataset.dpos}」！`);
  });
});

document.querySelectorAll('.partition-dstyle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    ensureV4State();
    const cfg = getActivePartitionWall();
    if (!cfg) return;
    cfg.doorStyle = btn.dataset.style;
    if (btn.dataset.style === 'open-arch') {
      cfg.doorOpen = true;
    }
    selectedObjectId = cfg.id;
    triggerSnapEffect(cfg.id);
    saveSimState();
    playSimSound('tap');
    renderSim();
    renderV4Panels();
    updateObjInspectorUI();
    const sNames = { 'glass-sliding': '黑框磨砂玻璃拉門', 'wood-hinged': '北歐溫潤實木門', 'open-arch': '穿透式拱門門洞' };
    showRoomBanner(`🪟 隔間門已變更為「${sNames[btn.dataset.style] || btn.dataset.style}」！`);
  });
});

document.getElementById('btnTogglePartitionDoor')?.addEventListener('click', () => {
  ensureV4State();
  const cfg = getActivePartitionWall();
  if (!cfg) return;
  if (cfg.doorStyle === 'open-arch') {
    playSimSound('tap');
    showRoomBanner('⛩️ 目前為「穿透式拱門門洞」（無門扇阻擋，恆常暢通）！如需開關門扇請選擇玻璃拉門或實木門。');
    return;
  }
  cfg.doorOpen = !cfg.doorOpen;
  cfg.manualClosedUntil = cfg.doorOpen ? 0 : performance.now() + 15000;
  selectedObjectId = cfg.id;
  triggerSnapEffect(cfg.id);
  saveSimState();
  playSimSound('snap');
  renderSim();
  renderV4Panels();
  updateObjInspectorUI();
  showRoomBanner(`🚪 已${cfg.doorOpen ? '敞開隔間房門（便於走動）' : '闔上隔間房門（保留獨立隱私）'}！`);
});

document.getElementById('btnTogglePillar')?.addEventListener('click', () => {
  ensureV4State();
  simState.hardscape.pillar = !simState.hardscape.pillar;
  saveSimState();
  playSimSound('tap');
  renderSim();
});

document.getElementById('btnToggleWalkup')?.addEventListener('click', () => {
  ensureV4State();
  simState.hardscape.walkup = !simState.hardscape.walkup;
  saveSimState();
  playSimSound('tap');
  renderSim();
  showSimMessage(simState.hardscape.walkup
    ? '🪜 已設為「無電梯公寓」：購買大型傳統家具將加收 +15% 樓層搬運費（TAYA 軌道模組免收！）'
    : '🏢 已設為「電梯大樓」：大型家具免收樓層搬運費。');
});

document.getElementById('btnBuyCableRaceway')?.addEventListener('click', () => {
  ensureV4State();
  if (simState.hardscape.cableRaceway) return;
  if (simState.money < 25) {
    playSimSound('error');
    showSimMessage('⚠️ 預算不足 §25！', true);
    return;
  }
  simState.money -= 25;
  simState.hardscape.cableRaceway = true;
  saveSimState();
  playSimSound('buff');
  renderSim();
  showRoomBanner('🔌 已鋪設「隱藏式延長線與地板壓條」，消除跨區走線扣分！', true);
});

// Time Slider (白天 / 黃昏 / 深夜) & Window Blinds Slider
document.getElementById('simTimeSlider')?.addEventListener('input', e => {
  simState.minutes = parseInt(e.target.value, 10);
  saveSimState();
  renderSim();
});

document.getElementById('simBlindsSlider')?.addEventListener('input', e => {
  ensureV4State();
  simState.hardscape.blindsOpen = parseInt(e.target.value, 10);
  const lbl = document.getElementById('simBlindsValLabel');
  if (lbl) lbl.textContent = `${simState.hardscape.blindsOpen}%`;
  saveSimState();
});

// 2D Top-Down Blueprint View Toggle
document.getElementById('simCamBlueprint')?.addEventListener('click', () => {
  ensureV4State();
  simState.hardscape.blueprintMode = !simState.hardscape.blueprintMode;
  document.getElementById('simCamBlueprint')?.classList.toggle('active', simState.hardscape.blueprintMode);
  playSimSound('tap');
  showRoomBanner(simState.hardscape.blueprintMode
    ? '🗺️ 已切換至「2D 平面藍圖俯視角」：清楚檢視全室動線與格局比例'
    : '📐 已切換回「3D 立體等距視角 (Isometric)」');
});

// Pathfinding Circulation Check (🚶 動線測試：大門 -> 床 -> 書桌 -> 衛浴)
document.getElementById('btnPathCheck')?.addEventListener('click', () => {
  const blockReason = isPathBlocked();
  const tp = simState.trackPos || { work: 5.1 };
  const waypoints = [
    { x: 0.85, y: 5.7, label: '玄關大門' },
    { x: 3.5, y: 4.5, label: '客廳走道' },
    { x: 5.85, y: 4.65, label: '雙人臥床' },
    { x: (tp.work ?? 5.1) + 0.8, y: 1.65, label: '工作書桌' },
    { x: 1.95, y: 1.25, label: '乾濕分離衛浴' }
  ];
  pathCheckAnim = {
    startAt: performance.now(),
    waypoints,
    blocked: Boolean(blockReason),
    reason: blockReason
  };
  // Also walk character along the test target
  simState.player.targetX = waypoints[3].x;
  simState.player.targetY = waypoints[3].y;

  if (blockReason) {
    playSimSound('error');
    showRoomBanner(`🚨 動線紅燈警告：${blockReason}`);
    showSimMessage(`🚨 【動線檢測未通過】${blockReason}`, true);
  } else {
    playSimSound('buff');
    showRoomBanner('✅ 動線綠燈暢通！從「玄關大門 → 臥床 → 書桌 → 衛浴」走道寬敞無阻礙！', true);
    showSimMessage('✅ 【動線檢測 100% 暢通】全室走道均大於 90cm，衣櫃門與衛浴動線完全無阻礙！');
  }
});

// Screenshot & Bill of Materials Quote Modal (🧾 裝潢估價單匯出)
function openQuoteModal() {
  ensureV4State();
  renderGameRoom(performance.now());
  const dataUrl = roomCanvas.toDataURL('image/png');
  const previewImg = document.getElementById('simQuotePreviewImg');
  const downloadLink = document.getElementById('btnDownloadQuoteImg');
  if (previewImg) previewImg.src = dataUrl;
  if (downloadLink) downloadLink.href = dataUrl;

  const rows = [];
  let totalSpent = 0;

  // 1. TAYA DLCs
  const dlcPrices = {
    work: { name: 'TAYA WORK DLC 壁掛折疊工作桌', price: 180 },
    family: { name: 'TAYA FAMILY DLC 變形延伸料理中島', price: 240 },
    storage: { name: 'TAYA STORAGE DLC 頂天立地收納櫃', price: 210 },
    safe: { name: 'TAYA SAFE DLC 樂齡感應扶手夜燈', price: 150 }
  };
  Object.entries(dlcPrices).forEach(([k, v]) => {
    if (isDlcActive(k)) {
      rows.push({ cat: '⚡ TAYA 軌道模組', name: v.name, note: '免打牆快拆 · 支援8折回購', cost: v.price });
      totalSpent += v.price;
    }
  });

  // 2. Hardscape (Plural Partitions Support)
  if (Array.isArray(simState.hardscape?.partitions) && simState.hardscape.partitions.length > 0) {
    simState.hardscape.partitions.forEach((cfg, idx) => {
      const isSolid = cfg.type === 'solid';
      const len = cfg.length || 2.6;
      const dName = isSolid ? '純實心牆' : (cfg.doorStyle === 'wood-hinged' ? '實木門' : cfg.doorStyle === 'open-arch' ? '穿透拱門' : '黑框玻璃拉門');
      const cost = isSolid ? 40 : 60;
      rows.push({
        cat: '🧱 硬裝隔間',
        name: `${isSolid ? '純隔間牆' : '房門隔間牆'} #${idx + 1} (${len.toFixed(1)}m · ${dName})`,
        note: isSolid ? '純實心無門扇' : '含門框與施工',
        cost
      });
      totalSpent += cost;
    });
  } else if (simState.hardscape?.partition) {
    const cfg = simState.hardscape.partitionConfig || {};
    const isSolid = cfg.type === 'solid';
    const len = cfg.length || 2.6;
    const dName = isSolid ? '純實心牆' : (cfg.doorStyle === 'wood-hinged' ? '實木門' : cfg.doorStyle === 'open-arch' ? '穿透拱門' : '黑框玻璃拉門');
    const cost = isSolid ? 40 : 60;
    rows.push({ cat: '🧱 硬裝隔間', name: `自訂實體隔間牆 (${len.toFixed(1)}m · 含${dName})`, note: '含施工', cost });
    totalSpent += cost;
  }
  if (simState.hardscape.cableRaceway) {
    rows.push({ cat: '🔌 水電工程', name: '全室隱藏式延長線與地板壓條', note: '消除跨區裸線', cost: 25 });
    totalSpent += 25;
  }

  // 3. V4 Themed Items
  simState.v4Items.forEach(id => {
    const item = V4_SHOP_CATALOG.find(m => m.id === id);
    if (!item) return;
    const isLocked = simState.lockedItems?.includes(id);
    const cost = isLocked ? 0 : item.price;
    rows.push({
      cat: '🛋️ 主題家具家電',
      name: `${item.iconText || item.icon} ${item.name}`,
      note: isLocked ? '舊家自備 (免購置費)' : '3D 空間配置單品',
      cost
    });
    totalSpent += cost;
  });

  if (simState.hiddenCostsPaid > 0) {
    rows.push({
      cat: '🚚 隱藏工程開銷',
      name: '拆牆清運費／無電梯樓層搬運費累計',
      note: '傳統裝修額外支出',
      cost: simState.hiddenCostsPaid
    });
    totalSpent += simState.hiddenCostsPaid;
  }

  const combos = getActiveCombos();
  const comboStr = combos.length > 0 ? combos.map(c => c.label).join('、') : '尚未觸發';

  const box = document.getElementById('simQuoteSummaryBox');
  if (box) {
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.65rem; font-size:0.8rem; color:#4b443b;">
        <span>📐 <strong>格局規模：</strong>${simState.profile.area} 坪 (${simState.hardscape.shape === 'lshape' ? 'L型畸零格局' : simState.hardscape.shape === 'balcony' ? '陽台外推格局' : '標準矩形'})</span>
        <span>🏆 <strong>空間綜合評分：</strong><strong style="color:#527464;">${getSpaceScore()} 分</strong></span>
        <span>✨ <strong>觸發 Combo：</strong><strong style="color:#d97706;">${comboStr}</strong></span>
      </div>
      <table class="sim-quote-table">
        <thead>
          <tr><th>分類</th><th>項目名稱</th><th>備註說明</th><th>估值 (§)</th></tr>
        </thead>
        <tbody>
          ${rows.map(r => `<tr><td>${r.cat}</td><td><strong>${r.name}</strong></td><td>${r.note}</td><td>§ ${r.cost}</td></tr>`).join('')}
        </tbody>
      </table>
      <div style="display:flex; justify-content:space-between; align-items:center; padding:0.65rem 0.85rem; background:#f5f1e8; border-radius:10px; font-size:0.85rem;">
        <span>🌱 <strong>ESG 循環減碳貢獻：</strong>累計減碳 ${simState.esgScore || 30} kg CO₂e</span>
        <strong style="font-size:1.05rem; color:#98633f;">🧾 裝潢配置總估值：§ ${totalSpent}（剩餘可用預算 § ${simState.money}）</strong>
      </div>
    `;
  }

  document.getElementById('simQuoteModal')?.classList.add('open');
  playSimSound('confirm');
}

document.getElementById('btnExportQuote')?.addEventListener('click', openQuoteModal);
document.getElementById('btnCloseQuote')?.addEventListener('click', () => {
  document.getElementById('simQuoteModal')?.classList.remove('open');
});
document.getElementById('btnQuoteSwitchBlueprint')?.addEventListener('click', () => {
  ensureV4State();
  simState.hardscape.blueprintMode = !simState.hardscape.blueprintMode;
  openQuoteModal();
});

// ─── THE SIMS 4 BUILD/BUY MODE & TOOLBAR CONTROLS ───
let currentDockCat = 'all';
let currentDockSearch = '';

function syncSimTopBarUI() {
  const mode = simState.wallMode || 'cutaway';
  document.getElementById('btnWallModeCutaway')?.classList.toggle('active', mode === 'cutaway');
  document.getElementById('btnWallModeFull')?.classList.toggle('active', mode === 'full');
  document.getElementById('btnWallModeNone')?.classList.toggle('active', mode === 'none');

  document.getElementById('btnToggleGrid')?.classList.toggle('active', simState.showGrid !== false);
  document.getElementById('btnToggleHitbox')?.classList.toggle('active', Boolean(simState.showHitbox));
  document.getElementById('btnTogglePanoramic')?.classList.toggle('active', Boolean(simState.panoramic));

  const layoutEl = document.querySelector('.sim-layout');
  if (layoutEl) {
    layoutEl.classList.toggle('sims-panoramic', Boolean(simState.panoramic));
  }
}

function renderSimDockShelf(cat = currentDockCat, query = currentDockSearch) {
  const shelf = document.getElementById('simDockShelf');
  if (!shelf) return;
  const fundsEl = document.getElementById('simDockFunds');
  if (fundsEl) fundsEl.textContent = `§ ${simState.money}`;

  const dlcDockDefs = [
    { key: 'work', name: 'WORK DLC 折疊工作桌', icon: '💻', price: 80, desc: '沿 6063 鋁軌道快拆滑動，工作效率加成' },
    { key: 'family', name: 'FAMILY DLC 料理中島', icon: '🍳', price: 120, desc: '隱蔽式水電整合槽，支援親友共煮與社交' },
    { key: 'storage', name: 'STORAGE DLC 頂天立地收納牆', icon: '📦', price: 90, desc: '原廠模組垂直收納，大容量不佔地面坪數' },
    { key: 'safe', name: 'SAFE DLC 樂齡防撞扶手與感應地燈', icon: '🌿', price: 70, desc: '全圓角防撞安全扶手，深夜引導地燈' }
  ];

  const placedPartitions = (simState.hardscape?.partitions || []).map((p, idx) => {
    const isSolid = p.type === 'solid';
    const isArch = p.doorStyle === 'open-arch';
    let doorDescSuffix = '';
    if (isSolid) {
      doorDescSuffix = ' (實心無門)';
    } else if (isArch) {
      doorDescSuffix = ' (開放式穿透拱門)';
    } else {
      doorDescSuffix = p.doorOpen ? ' (門已敞開 · 點擊立即闔上)' : ' (門已闔上 · 點擊立即敞開)';
    }
    return {
      id: p.id,
      targetId: p.id,
      cat: 'structure',
      name: `${isSolid ? '🧱 純隔間牆' : '🚪 房門隔間牆'} #${idx + 1}`,
      icon: isSolid ? '🧱' : (isArch ? '⛩️' : '🚪'),
      price: isSolid ? 40 : 60,
      desc: `長度 ${p.length.toFixed(1)}m · ${p.orient === 'x' ? '橫向' : '縱向'}${doorDescSuffix}`,
      isPlaced: () => true,
      onPlace: () => {},
      isPartition: true,
      partitionCfg: p
    };
  });

  const dockItems = [
    // 🧱 隔間＆結構 (structure - 支援複數純牆面與房門牆面)
    ...placedPartitions,
    {
      id: 'add-partition-solid',
      targetId: 'add-partition-solid',
      cat: 'structure',
      name: '+ 新增純隔間牆',
      icon: '🧱',
      price: 40,
      desc: '自選位置與長度，純實心隔間牆面（無門扇），可複數建造與旋轉',
      isPlaced: () => false,
      onPlace: () => addPartitionWall('solid')
    },
    {
      id: 'add-partition-door',
      targetId: 'add-partition-door',
      cat: 'structure',
      name: '+ 新增房門隔間牆',
      icon: '🚪',
      price: 60,
      desc: '自選位置與長度，含房門隔間牆，支援玻璃滑門/實木門/拱門獨立開關',
      isPlaced: () => false,
      onPlace: () => addPartitionWall('door')
    },
    {
      id: 'cable-raceway',
      cat: 'structure',
      name: '全室隱藏式延長線與地板壓條',
      icon: '🔌',
      price: 25,
      desc: '全室無死角供電，消除跨區接電扣分',
      isPlaced: () => Boolean(simState.hardscape?.cableRaceway),
      onPlace: () => {
        ensureV4State();
        simState.hardscape.cableRaceway = true;
      }
    },
    // ⚡ TAYA 軌道DLC (track)
    ...dlcDockDefs.map(d => ({
      id: `dlc-${d.key}`,
      targetId: d.key,
      cat: 'track',
      name: d.name,
      icon: d.icon,
      price: d.price,
      desc: d.desc,
      isPlaced: () => isDlcActive(d.key),
      onPlace: () => {
        simState.dlcs[d.key] = true;
        selectedObjectId = d.key;
      }
    })),
    // 🛋️ 舒適＆起居 (comfort) - 統一取自 extraFurnitureCatalog 確保 3D 房間正確渲染
    ...extraFurnitureCatalog.map(b => ({
      id: b.id,
      targetId: b.sceneId,
      cat: b.id === 'kitchen-cart' ? 'appliance' : b.id === 'plant-deco' ? 'decor' : 'comfort',
      name: b.name,
      icon: b.icon,
      price: b.price || 90,
      desc: b.desc,
      isPlaced: () => simState.furniture.includes(b.id),
      onPlace: () => {
        if (!simState.furniture.includes(b.id)) simState.furniture.push(b.id);
        selectedObjectId = b.sceneId;
      }
    }))
  ];

  // Also include items from V4_SHOP_CATALOG
  if (typeof V4_SHOP_CATALOG !== 'undefined') {
    V4_SHOP_CATALOG.forEach(v => {
      let dCat = 'decor';
      if (v.cat === 'appliance') dCat = 'appliance';
      else if (v.cat === 'tech') dCat = 'work';
      else if (v.id === 'beanbag' || v.id === 'ergo-chair') dCat = 'comfort';
      else if (v.cat === 'collect' || v.cat === 'lighting' || v.cat === 'pet') dCat = 'decor';

      dockItems.push({
        id: v.id,
        targetId: v.id,
        cat: dCat,
        name: v.name,
        icon: v.iconText || v.icon,
        price: v.price,
        desc: v.desc,
        isPlaced: () => hasV4Item(v.id),
        onPlace: () => {
          ensureV4State();
          if (!hasV4Item(v.id)) simState.v4Items.push(v.id);
          selectedObjectId = v.id;
        }
      });
    });
  }

  // Filter
  const q = (query || '').trim().toLowerCase();
  const filtered = dockItems.filter(item => {
    const matchCat = (cat === 'all' || item.cat === cat);
    if (!matchCat) return false;
    if (q) {
      return item.name.toLowerCase().includes(q) || (item.desc && item.desc.toLowerCase().includes(q));
    }
    return true;
  });

  shelf.innerHTML = '';
  if (filtered.length === 0) {
    shelf.innerHTML = '<div style="font-size:0.75rem; color:#8c8274; padding:1.2rem; text-align:center; width:100%;">未找到相符的家具或模組</div>';
    return;
  }

  filtered.forEach(item => {
    const placed = item.isPlaced();
    const pCfg = item.partitionCfg;
    const isDoorPartition = pCfg && pCfg.type !== 'solid' && pCfg.doorStyle !== 'open-arch';

    const card = document.createElement('div');
    card.className = `sim-dock-card${placed ? ' placed' : ''}${isDoorPartition ? ' partition-door-card' : ''}`;

    let priceBadgeText = placed ? '✓ 已放置' : `§ ${item.price}`;
    let priceBadgeStyle = '';
    if (isDoorPartition) {
      priceBadgeText = pCfg.doorOpen ? '🚪 門已開 (點擊關門)' : '🔒 門已關 (點擊開門)';
      priceBadgeStyle = pCfg.doorOpen
        ? 'color:#15803d; background:#dcfce7; border-color:#86efac; font-size:0.62rem; font-weight:800;'
        : 'color:#b45309; background:#fef3c7; border-color:#fde68a; font-size:0.62rem; font-weight:800;';
    }

    card.title = `${item.name}\n${item.desc}\n${placed ? (isDoorPartition ? '（點擊直接切換開門／關門，並可拖曳移位或按 R 旋轉）' : '（已放置於房間，點擊選取）') : `（點擊購買 §${item.price} 並放置）`}`;

    card.innerHTML = `
      <div class="sim-dock-card-icon">${item.icon}</div>
      <div class="sim-dock-card-title">${item.name}</div>
      <div class="sim-dock-card-price" style="${priceBadgeStyle}">${priceBadgeText}</div>
    `;

    card.addEventListener('click', () => {
      const targetId = item.targetId || item.id;
      if (placed) {
        ensureV4State();
        if (isDoorPartition) {
          const liveCfg = (simState.hardscape?.partitions || []).find(p => p.id === targetId);
          if (liveCfg) {
            liveCfg.doorOpen = !liveCfg.doorOpen;
            liveCfg.manualClosedUntil = liveCfg.doorOpen ? 0 : performance.now() + 15000;
            if (simState.hardscape?.partitionConfig && simState.hardscape.partitionConfig.id === targetId) {
              simState.hardscape.partitionConfig.doorOpen = liveCfg.doorOpen;
              simState.hardscape.partitionConfig.manualClosedUntil = liveCfg.manualClosedUntil;
            }
            selectedObjectId = targetId;
            triggerSnapEffect(targetId);
            saveSimState();
            playSimSound('snap');
            renderSim();
            renderV4Panels();
            updateObjInspectorUI();
            showRoomBanner(`🚪 已${liveCfg.doorOpen ? '敞開隔間房門（便於走動）' : '闔上隔間房門（保留獨立隱私）'}！可在 3D 畫面拖曳或按 R 旋轉`);
            return;
          }
        }
        selectedObjectId = targetId;
        if (typeof updateObjInspectorUI === 'function') updateObjInspectorUI();
        playSimSound('tap');
        showRoomBanner(`🎯 已選取「${item.name}」！可拖曳移位或按 R 鍵 90° 旋轉`);
        renderSim();
      } else {
        if (simState.money < item.price) {
          playSimSound('error');
          showSimMessage(`⚠️ 預算不足 §${item.price}！可先派小人工作或至二手拍賣。`, true);
          return;
        }
        simState.money -= item.price;
        item.onPlace();
        triggerSnapEffect(selectedObjectId || targetId);
        playSimSound('snap');
        showRoomBanner(`✨ 已添購並放置「${item.name}」！按住可直接拖曳移位 · 按 R 鍵 90° 旋轉`);
        saveSimState();
        renderSim();
      }
    });

    shelf.appendChild(card);
  });
}

// Bind Top Builder Toolbar
document.getElementById('btnWallModeCutaway')?.addEventListener('click', () => {
  simState.wallMode = 'cutaway';
  saveSimState();
  syncSimTopBarUI();
  playSimSound('tap');
  showRoomBanner('✂️ 已切換為「切牆剖面模式」：前方阻擋牆面降為半牆，家具完全通透！');
  renderSim();
});

document.getElementById('btnWallModeFull')?.addEventListener('click', () => {
  simState.wallMode = 'full';
  saveSimState();
  syncSimTopBarUI();
  playSimSound('tap');
  showRoomBanner('🧱 已切換為「全牆模式」：升起全室四面實體牆與隔間！');
  renderSim();
});

document.getElementById('btnWallModeNone')?.addEventListener('click', () => {
  simState.wallMode = 'none';
  saveSimState();
  syncSimTopBarUI();
  playSimSound('tap');
  showRoomBanner('📐 已切換為「去牆模式」：降下全室牆面至踢腳板，方便全觀地面陳設！');
  renderSim();
});

document.getElementById('btnToggleGrid')?.addEventListener('click', () => {
  simState.showGrid = (simState.showGrid === false) ? true : false;
  saveSimState();
  syncSimTopBarUI();
  playSimSound('tap');
  showRoomBanner(simState.showGrid ? '📐 已開啟 0.5m 建築地面參考網格！' : '📐 已隱藏地面網格');
  renderSim();
});

document.getElementById('btnToggleHitbox')?.addEventListener('click', () => {
  simState.showHitbox = !simState.showHitbox;
  saveSimState();
  syncSimTopBarUI();
  playSimSound('tap');
  showRoomBanner(simState.showHitbox ? '📦 已開啟「全場景 3D 碰撞箱 (Hitbox & Wireframe)」顯示！包含建築結構、隔間門扇、家具模組與角色' : '📦 已隱藏實體碰撞箱');
  renderSim();
});

document.getElementById('btnTogglePanoramic')?.addEventListener('click', () => {
  simState.panoramic = !simState.panoramic;
  saveSimState();
  syncSimTopBarUI();
  playSimSound('tap');
  showRoomBanner(simState.panoramic ? '🖥️ 已開啟「模擬市民全景大視野」！可由底部商品抽屜自由添購' : '🖥️ 已切回標準控制艙視角');
  renderSim();
});

// Bind Bottom Shelf Dock Categories
document.querySelectorAll('#simDockCats .sim-dock-cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#simDockCats .sim-dock-cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDockCat = btn.dataset.cat || 'all';
    playSimSound('tap');
    renderSimDockShelf(currentDockCat, currentDockSearch);
  });
});

// Bind Bottom Shelf Dock Search
document.getElementById('simDockSearch')?.addEventListener('input', (e) => {
  currentDockSearch = e.target.value;
  renderSimDockShelf(currentDockCat, currentDockSearch);
});

// Bind Bottom Shelf Dock Toggle
document.getElementById('btnToggleDockShelf')?.addEventListener('click', () => {
  const dock = document.getElementById('simBottomDock');
  const btn = document.getElementById('btnToggleDockShelf');
  if (dock) {
    const isCollapsed = dock.classList.toggle('collapsed');
    if (btn) btn.textContent = isCollapsed ? '展開商品欄 ▲' : '收合商品欄 ▼';
    playSimSound('tap');
  }
});

initSimActionsUI();
renderSim();
requestAnimationFrame(gameFrameLoop);


// ─── 7. 30-YEAR LIFECYCLE & ESG CALCULATOR (GSAP Animated Numbers & Bars) ───
var reduceMotionMQ = window.reduceMotionMQ || window.matchMedia('(prefers-reduced-motion: reduce)');
let calcYears = 30;
let calcArea = 25;
const calcTweenVals = { tradTotal: 0, tayaTotal: 0, savings: 0 };

function updateLifecycleCalc() {
  const renovations = Math.max(1, Math.round(calcYears / 10));
  const tradBase = calcArea * 46000;
  const tradTotal = Math.round(tradBase + (renovations - 1) * (tradBase * 1.08));
  const tradDays = renovations * 90;
  const tradWaste = (renovations * calcArea * 0.32).toFixed(1);

  const tayaBase = calcArea * 27000;
  const upgradeNetCost = 185000;
  const tayaTotal = Math.round(tayaBase + (renovations - 1) * upgradeNetCost);
  const tayaDays = (renovations * 0.5).toFixed(1);
  const tayaWaste = (tradWaste * 0.26).toFixed(1);

  const savings = tradTotal - tayaTotal;
  const savingsPct = Math.round((savings / tradTotal) * 100);

  document.getElementById('calcTradRenovations').textContent = `${renovations} 次大規模拆除施工`;
  document.getElementById('calcTayaRenovations').textContent = `0 次打牆（${Math.max(1, renovations - 1)} 次模組快拆升級）`;
  document.getElementById('calcTradDays').textContent = `${tradDays} 天 (需外宿租屋)`;
  document.getElementById('calcTayaDays').textContent = `僅 ${tayaDays} 天 (單日快拆換裝)`;
  document.getElementById('calcTradWaste').textContent = `${tradWaste} 噸營建廢料`;
  document.getElementById('calcTayaWasteReduction').textContent = `減廢 74%（僅約 ${tayaWaste} 噸，舊模組回廠整新）`;
  document.getElementById('calcTayaClv').textContent = `1 次基底＋${renovations} 階段持續服務關係`;

  const tradCostWan = Math.round(tradTotal / 10000);
  const tayaCostWan = Math.round(tayaTotal / 10000);
  document.getElementById('chartCostDiffLabel').textContent = `節省 ${savingsPct}% 長期預算`;
  document.getElementById('chartTradCostLabel').textContent = `${tradCostWan}萬`;
  document.getElementById('chartTayaCostLabel').textContent = `${tayaCostWan}萬`;

  const wasteDiff = (tradWaste - tayaWaste).toFixed(1);
  document.getElementById('chartWasteDiffLabel').textContent = `減廢 74%（減少 ${wasteDiff} 噸廢棄物）`;
  document.getElementById('chartTradWasteLabel').textContent = `${tradWaste}噸`;
  document.getElementById('chartTayaWasteLabel').textContent = `${tayaWaste}噸`;

  // 硬體加速 scaleX 進度條計算 (基底寬度固定 100%，透過 scaleX 與 transformOrigin: "left center" 縮放)
  const costScale = gsap.utils.clamp(0.15, 1, tayaTotal / tradTotal);
  const wasteScale = gsap.utils.clamp(0.15, 1, parseFloat(tayaWaste) / parseFloat(tradWaste));

  // 透過 gsap.matchMedia() 支援 prefers-reduced-motion: reduce
  const mm = gsap.matchMedia();
  mm.add(
    {
      canAnimate: "(prefers-reduced-motion: no-preference)",
      reduceMotion: "(prefers-reduced-motion: reduce)"
    },
    context => {
      const { reduceMotion } = context.conditions;

      if (reduceMotion) {
        // 若用戶開啟減少動態效果，直接 set 最終數值而不播放補間
        gsap.set('#barTayaCost', {
          scaleX: costScale,
          transformOrigin: "left center"
        });
        gsap.set('#barTayaWaste', {
          scaleX: wasteScale,
          transformOrigin: "left center"
        });
        calcTweenVals.tradTotal = tradTotal;
        calcTweenVals.tayaTotal = tayaTotal;
        calcTweenVals.savings = savings;
        document.getElementById('calcTradCost').textContent = `NT$ ${Math.round(tradTotal).toLocaleString()}`;
        document.getElementById('calcTayaCost').textContent = `NT$ ${Math.round(tayaTotal).toLocaleString()}`;
        document.getElementById('calcSavingsCallout').textContent =
          `⚡ 累計節省 NT$ ${Math.round(savings).toLocaleString()}（降低約 ${savingsPct}% 長期改裝支出）`;
      } else {
        // 使用 scaleX 與 transformOrigin: "left center" 進行硬體加速縮放，避免直接 Tween "width"
        gsap.to('#barTayaCost', {
          scaleX: costScale,
          transformOrigin: "left center",
          duration: 0.65,
          ease: "power3.out",
          overwrite: "auto"
        });
        gsap.to('#barTayaWaste', {
          scaleX: wasteScale,
          transformOrigin: "left center",
          duration: 0.65,
          ease: "power3.out",
          overwrite: "auto"
        });
        gsap.to(calcTweenVals, {
          tradTotal,
          tayaTotal,
          savings,
          duration: 0.65,
          ease: "power2.out",
          overwrite: "auto",
          onUpdate: () => {
            document.getElementById('calcTradCost').textContent = `NT$ ${Math.round(calcTweenVals.tradTotal).toLocaleString()}`;
            document.getElementById('calcTayaCost').textContent = `NT$ ${Math.round(calcTweenVals.tayaTotal).toLocaleString()}`;
            document.getElementById('calcSavingsCallout').textContent =
              `⚡ 累計節省 NT$ ${Math.round(calcTweenVals.savings).toLocaleString()}（降低約 ${savingsPct}% 長期改裝支出）`;
          }
        });
      }
    }
  );
}

document.querySelectorAll('#calcYearBtns .calc-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#calcYearBtns .calc-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    calcYears = parseInt(btn.dataset.years, 10);
    playSimSound('tap');
    updateLifecycleCalc();
  });
});

document.querySelectorAll('#calcAreaBtns .calc-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#calcAreaBtns .calc-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    calcArea = parseInt(btn.dataset.area, 10);
    playSimSound('tap');
    updateLifecycleCalc();
  });
});

updateLifecycleCalc();

// ─── 8. GSAP 3 PAGE & UI ANIMATIONS (gsap-core, gsap-timeline, gsap-scrolltrigger, gsap-performance) ───
gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: "power2.out", duration: 0.6 });

const nav = document.getElementById('nav');
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
});

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('open');
});

navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
  });
});

// Use gsap.matchMedia() for responsive & prefers-reduced-motion accessibility
const mm = gsap.matchMedia();
mm.add(
  {
    canAnimate: "(prefers-reduced-motion: no-preference)",
    reduceMotion: "(prefers-reduced-motion: reduce)"
  },
  context => {
    const { canAnimate } = context.conditions;

    // 5. Top Aluminium Track Scroll Progress Bar (GPU-friendly scaleX)
    gsap.to('.scroll-track-fill', {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        trigger: document.documentElement,
        start: 'top top',
        end: 'bottom bottom',
        scrub: canAnimate ? 0.15 : true
      }
    });

    // 6. DLC Progress Bars using GPU-composited scaleX
    document.querySelectorAll('.dlc-progress .bar').forEach(bar => {
      const targetScale = (parseFloat(bar.dataset.width) || 100) / 100;
      gsap.set(bar, { width: '100%', transformOrigin: 'left center', scaleX: canAnimate ? 0 : targetScale });
    });
    if (canAnimate) {
      ScrollTrigger.create({
        trigger: '.dlc-grid',
        start: 'top 82%',
        once: true,
        onEnter: () => {
          document.querySelectorAll('.dlc-progress .bar').forEach(bar => {
            const targetScale = (parseFloat(bar.dataset.width) || 100) / 100;
            gsap.to(bar, { scaleX: targetScale, duration: 1.2, ease: "power3.out" });
          });
        }
      });
    }

    // 9. Benefit Stat Counters with GSAP snap (instant fallback under reduceMotion)
    document.querySelectorAll('.counter').forEach(counter => {
      const target = parseInt(counter.dataset.target, 10);
      if (!canAnimate) {
        counter.textContent = target;
        return;
      }
      ScrollTrigger.create({
        trigger: counter,
        start: 'top 86%',
        once: true,
        onEnter: () => {
          gsap.to(counter, {
            innerText: target,
            duration: 1.6,
            ease: "power2.out",
            snap: { innerText: 1 },
            onUpdate: () => { counter.textContent = Math.round(parseFloat(counter.textContent)); }
          });
        }
      });
    });

    if (!canAnimate) return;

    // 1. Hero Timeline with position parameters ("<0.12") instead of manual delays
    const heroTl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.72 } });
    heroTl
      .from('.hero-badge', { y: 20, autoAlpha: 0 }, 0.1)
      .from('.hero h1', { y: 30, autoAlpha: 0, duration: 0.85 }, "<0.12")
      .from('.hero-chinese', { y: 20, autoAlpha: 0 }, "<0.14")
      .from('.hero-tagline', { y: 20, autoAlpha: 0 }, "<0.12")
      .from('.hero-sub', { y: 16, autoAlpha: 0 }, "<0.1")
      .from('.hero-cta-group', { y: 16, autoAlpha: 0 }, "<0.1")
      .from('.hero-spec-strip .hero-spec-item', { y: 14, autoAlpha: 0, stagger: 0.08 }, "<0.12")
      .from('.hero-showcase-card', { x: 28, autoAlpha: 0, duration: 0.9 }, 0.22);

    // 2. Subtle Hero Showcase Image Parallax Scrub
    gsap.to('#heroBgImg', {
      yPercent: 6,
      scale: 1.05,
      ease: "none",
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 }
    });

    // 3. Section headers reveal as one unit (one calm motion per section, not per element)
    gsap.utils.toArray('.section-header-split').forEach(el => {
      gsap.from(el.children, {
        y: 24,
        autoAlpha: 0,
        duration: 0.7,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      });
    });

    // 3b. Game console settles into place once, like a module locking onto the track
    gsap.from('.sim-game', {
      y: 40, scale: 0.98, autoAlpha: 0, duration: 0.9, ease: "power3.out",
      scrollTrigger: { trigger: '.sim-game', start: 'top 85%', once: true }
    });

    // 3c. Hero showcase gently tilts toward the pointer (user-driven motion, fine pointers only)
    const showcase = document.querySelector('.hero-showcase-card');
    if (showcase && window.matchMedia('(pointer: fine)').matches) {
      gsap.set(showcase, { transformPerspective: 900 });
      const rotX = gsap.quickTo(showcase, 'rotationX', { duration: 0.6, ease: "power3.out" });
      const rotY = gsap.quickTo(showcase, 'rotationY', { duration: 0.6, ease: "power3.out" });
      showcase.addEventListener('pointermove', e => {
        const r = showcase.getBoundingClientRect();
        rotY(gsap.utils.mapRange(0, r.width, -4, 4, e.clientX - r.left));
        rotX(gsap.utils.mapRange(0, r.height, 3, -3, e.clientY - r.top));
      });
      showcase.addEventListener('pointerleave', () => { rotX(0); rotY(0); });
    }

    // 4. ScrollTrigger.batch() for all grid cards (high performance, zero layout thrashing)
    ScrollTrigger.batch('.dlc-card, .pain-card, .arch-card, .benefit-card, .step-box', {
      interval: 0.08,
      batchMax: 4,
      start: 'top 88%',
      onEnter: batch => {
        gsap.from(batch, {
          y: 34,
          autoAlpha: 0,
          stagger: 0.1,
          duration: 0.6,
          ease: "power2.out",
          overwrite: "auto"
        });
      }
    });
  }
);

// 7. Insight Age Tabs with GSAP transition
const tabs = document.querySelectorAll('.age-tab');
const panels = document.querySelectorAll('.age-panel');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const map = { young: 'panel-young', family: 'panel-family', senior: 'panel-senior' };
    const panel = document.getElementById(map[tab.dataset.tab]);
    if (panel && !reduceMotionMQ.matches) {
      panel.classList.add('active');
      gsap.fromTo(
        panel.children,
        { y: 14, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.35, stagger: 0.05, ease: "power2.out", overwrite: "auto" }
      );
    } else if (panel) {
      panel.classList.add('active');
    }
  });
});

// 8. Game Deck Tab & Stage Switching GSAP Micro-animations
document.querySelectorAll('.sim-deck-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const activePanel = document.querySelector('.sim-deck-panel.active');
    if (activePanel && !reduceMotionMQ.matches) {
      gsap.fromTo(
        activePanel.children,
        { y: 10, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.28, stagger: 0.03, ease: "power2.out", overwrite: "auto" }
      );
    }
  });
});

document.querySelectorAll('.sim-stage-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (reduceMotionMQ.matches) return;
    gsap.fromTo(
      '.sim-hud-item strong',
      { y: -5, autoAlpha: 0.4 },
      { y: 0, autoAlpha: 1, duration: 0.32, stagger: 0.03, ease: "power2.out", overwrite: "auto" }
    );
  });
});

const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a:not(.nav-cta-pill)');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 140) current = sec.getAttribute('id');
  });
  navAnchors.forEach(a => {
    a.classList.toggle('is-current', a.getAttribute('href') === '#' + current);
  });
});

// ─── 9. PONYTAIL SELF-CHECK INVARIANT VERIFICATION ───
function runSelfCheck() {
  // 1. 4-Quadrant 90° Rotation Modulo Invariant
  const rotCycle = [0, 1, 2, 3, 4].map(n => ((n % 4) + 4) % 4);
  console.assert(rotCycle[0] === 0 && rotCycle[1] === 1 && rotCycle[2] === 2 && rotCycle[3] === 3 && rotCycle[4] === 0, 'SelfCheck: 90° rotation cycle failed');

  // 2. Base Furniture Catalog <-> 3D Scene Graph ID Mapping Invariant
  console.assert(
    extraFurnitureCatalog.every(b => typeof b.id === 'string' && typeof b.sceneId === 'string'),
    'SelfCheck: extraFurnitureCatalog missing sceneId mapping'
  );

  // 3. Dynamic Room Dimensions Monotonicity Invariant
  const d12 = getRoomDimensions(12), d25 = getRoomDimensions(25);
  console.assert(d25.w > d12.w && d25.d > d12.d, 'SelfCheck: Room dimensions must scale monotonically with area');

  // 4. Legacy localStorage Rotation & Position Normalization Invariant
  simState.rotatedItems['__test_legacy_bool'] = true;
  simState.rotatedItems['__test_legacy_nan'] = 'invalid-nan';
  ensureV4State();
  console.assert(
    simState.rotatedItems['__test_legacy_bool'] === 1 && simState.rotatedItems['__test_legacy_nan'] === 0,
    'SelfCheck: ensureV4State failed to sanitize legacy rotatedItems'
  );
  delete simState.rotatedItems['__test_legacy_bool'];
  delete simState.rotatedItems['__test_legacy_nan'];

  // 5. Partition Door Independent Sub-component Hit-Box Invariant
  const mockWall = { id: 'partition-wall', x: 3.2, y: 2.2, z: 0, dx: 0.16, dy: 2.6, dz: 2.35 };
  const doorSub = getPartitionDoorSubbox(mockWall);
  console.assert(
    doorSub && doorSub.leafBox.dy > 0.7 && doorSub.seg1Box.dy + doorSub.doorW + doorSub.seg2Box.dy <= mockWall.dy + 0.05,
    'SelfCheck: Partition door sub-component geometry invalid'
  );

  // 6. Volumetric Wall Hitbox Structure & Room Wall Retrieval Invariant
  const wallHitboxes = getWallHitboxes();
  console.assert(
    wallHitboxes.some(b => b.id === 'room-wall-back') && wallHitboxes.some(b => b.id === 'room-wall-left'),
    'SelfCheck: getWallHitboxes must return back and left perimeter walls'
  );

  // 7. Physical Sliding Collision Resolver Obstacle Invariant
  const rDim = getRoomDimensions(18);
  const colRes = resolveWallCollisions(2.0, 2.0, 0.1, 2.0, 0.22, rDim.w, rDim.d);
  console.assert(
    colRes.x >= 0.35 + 0.22,
    'SelfCheck: resolveWallCollisions must clamp characters within room boundaries'
  );

  // 8. Doorway Waypoint Navigation Invariant
  const roomPath = findRoomPath(2.0, 3.0, 6.0, 3.0);
  console.assert(
    Array.isArray(roomPath) && roomPath.length >= 1,
    'SelfCheck: findRoomPath must return valid waypoints array'
  );
  return true;
}
runSelfCheck();


