// ═══ TAYACRAFT 2.5D ISOMETRIC ROOM & DLC CANVAS ENGINE (room-canvas.js) ═══
// shortcut: 2.5D isometric projection on Canvas 2D (<80 visible entities), upgrade to WebGL z-buffer if scene >200

// ─── 1. CORE 3D ISOMETRIC VOLUMETRIC ENGINE ───
function shadeHex(hex, percent) {
  if (!hex || hex[0] !== '#' || hex.length !== 7) return hex;
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

function createIsoProjector(ctx, cfg) {
  const cosY = Math.cos(cfg.yaw);
  const sinY = Math.sin(cfg.yaw);
  const sinP = Math.sin(cfg.pitch);
  const cosP = Math.cos(cfg.pitch);

  function project(x, y, z) {
    const dx = x - cfg.cx;
    const dy = y - cfg.cy;
    const rx = dx * cosY - dy * sinY;
    const ry = dx * sinY + dy * cosY;
    return {
      x: cfg.ox + rx * cfg.scale,
      y: cfg.oy + ry * cfg.scale * sinP - z * cfg.scale * cosP,
      depth: ry + z * 0.12
    };
  }

  function unprojectFloor(sx, sy) {
    const rx = (sx - cfg.ox) / cfg.scale;
    const ry = (sy - cfg.oy) / (cfg.scale * sinP);
    const dx = rx * cosY + ry * sinY;
    const dy = -rx * sinY + ry * cosY;
    return { x: dx + cfg.cx, y: dy + cfg.cy };
  }

  function drawPoly(pts, fill, stroke = 'rgba(45,35,25,0.16)', lineWidth = 0.8) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  // Draws a 3D Volumetric Box (x, y, z, dx, dy, dz) with 3-face shading & dynamic depth sorting
  function drawBox(x, y, z, dx, dy, dz, baseColor, opts = {}) {
    const p000 = project(x, y, z);
    const p100 = project(x + dx, y, z);
    const p110 = project(x + dx, y + dy, z);
    const p010 = project(x, y + dy, z);

    const p001 = project(x, y, z + dz);
    const p101 = project(x + dx, y, z + dz);
    const p111 = project(x + dx, y + dy, z + dz);
    const p011 = project(x, y + dy, z + dz);

    const topCol = opts.topColor || shadeHex(baseColor, 14);
    const frontXCol = opts.rightColor || shadeHex(baseColor, -7);
    const frontYCol = opts.leftColor || shadeHex(baseColor, -19);
    const stroke = opts.stroke !== undefined ? opts.stroke : 'rgba(45,35,25,0.18)';
    const lineWidth = opts.lineWidth !== undefined ? opts.lineWidth : 0.8;

    // Determine camera-facing visible side faces based on camera yaw
    const isPosX = sinY >= 0;
    const faceXPts = isPosX ? [p100, p110, p111, p101] : [p000, p010, p011, p001];
    const depthX = project(isPosX ? x + dx : x, y + dy * 0.5, z + dz * 0.5).depth;

    const isPosY = cosY >= 0;
    const faceYPts = isPosY ? [p010, p110, p111, p011] : [p000, p100, p101, p001];
    const depthY = project(x + dx * 0.5, isPosY ? y + dy : y, z + dz * 0.5).depth;

    // Draw side faces back-to-front (farther face first, closer face second) to eliminate corner z-fighting & tearing
    if (depthX < depthY) {
      drawPoly(faceXPts, frontXCol, stroke, lineWidth);
      drawPoly(faceYPts, frontYCol, stroke, lineWidth);
    } else {
      drawPoly(faceYPts, frontYCol, stroke, lineWidth);
      drawPoly(faceXPts, frontXCol, stroke, lineWidth);
    }

    // Top face (+Z) is drawn last (closest to overhead isometric camera)
    drawPoly([p001, p101, p111, p011], topCol, stroke, lineWidth);
  }

  function drawShadow(x, y, dx, dy, alpha = 0.16) {
    const pad = 0.06;
    const pts = [
      project(x - pad, y - pad, 0.005),
      project(x + dx + pad, y - pad, 0.005),
      project(x + dx + pad, y + dy + pad, 0.005),
      project(x - pad, y + dy + pad, 0.005)
    ];
    drawPoly(pts, `rgba(40, 28, 18, ${alpha})`, null);
  }

  return { project, unprojectFloor, drawPoly, drawBox, drawShadow };
}


// ─── 2B. DYNAMIC ROOM PING DIMENSIONS & GRID SYSTEM ───
// Calculates real physical dimensions (meters) so tile grid count truly increases with 坪數 instead of just zooming the camera!
function getRoomDimensions(area) {
  const a = Number(area) || 18;
  if (a <= 5) {
    return { w: 5.2, d: 4.2, label: '5 坪 (極限微型套房)', tileW: 1.0, tileD: 1.0, gridTilesX: 5, gridTilesY: 4 };
  } else if (a <= 12) {
    return { w: 7.2, d: 5.4, label: '12 坪 (都會小宅)', tileW: 1.0, tileD: 1.0, gridTilesX: 7, gridTilesY: 5 };
  } else if (a <= 18) {
    return { w: 9.0, d: 6.6, label: '18 坪 (標準兩房)', tileW: 1.0, tileD: 1.1, gridTilesX: 9, gridTilesY: 6 };
  } else if (a <= 25) {
    return { w: 11.2, d: 7.6, label: '25 坪 (家庭三房)', tileW: 1.0, tileD: 1.1, gridTilesX: 11, gridTilesY: 7 };
  } else {
    return { w: 13.2, d: 8.5, label: '32 坪 (寬敞大宅)', tileW: 1.1, tileD: 1.1, gridTilesX: 12, gridTilesY: 8 };
  }
}

function clampEntitiesToRoomBounds() {
  const { w: roomW, d: roomD } = getRoomDimensions(simState.profile?.area || 18);
  if (simState.player) {
    simState.player.x = Math.max(0.75, Math.min(roomW - 0.75, simState.player.x));
    simState.player.y = Math.max(1.15, Math.min(roomD - 0.65, simState.player.y));
  }
  if (typeof companionAgents !== 'undefined') {
    companionAgents.forEach(comp => {
      comp.x = Math.max(0.75, Math.min(roomW - 0.75, comp.x));
      comp.y = Math.max(1.15, Math.min(roomD - 0.65, comp.y));
      if (comp.targetX !== null) comp.targetX = Math.max(0.8, Math.min(roomW - 0.8, comp.targetX));
      if (comp.targetY !== null) comp.targetY = Math.max(1.2, Math.min(roomD - 0.7, comp.targetY));
    });
  }
}

// ─── 3. 3D ROOM MODELS & SCENE GRAPH (Dynamic Area Grid) ───
const roomCanvas = document.getElementById('simRoomCanvas');
const roomCtx = roomCanvas.getContext('2d');
const camAngles = [0.68, 1.18, 0.25, 0.92];
let currentYaw = camAngles[0];
let targetYaw = camAngles[0];
let snapDropEffects = []; // { id, startAt }
let activeInteraction = null; // { objId, actionId, startAt, duration }
let hoveredObject = null;
let hoveredSubpart = null; // 'partition-door' | null
let floatingTexts = []; // { text, x, y, z, col, startAt }
let dustParticles = []; // { x, y, z, vx, vy, vz, size, startAt, duration }
let renovShakeUntil = 0;
let trackPulseUntil = 0;
let draggingModule = null; // { id, axis: 'x'|'y', min, max }
let cameraDragging = false;
let cameraDragStartX = 0;
let lastSlideTickVal = 0;

// Animation polish state: frame-rate independent timing, period crossfade, snap ripples, ambient motes
let lastRenderAt = performance.now();
let lastPeriodKey = null;
let periodFade = null; // { canvas, startAt }
let snapRings = []; // { x, y, r, startAt }
const charMoveBlend = new WeakMap(); // character object -> { v, t }
var reduceMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const ambientMotes = Array.from({ length: 26 }, () => ({
  x: Math.random(), y: Math.random(), z: Math.random(), seed: Math.random() * 1000
}));
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

function spawnFloatingText(text, x, y, z = 1.65, col = '#fef08a') {
  floatingTexts.push({ text, x, y, z, col, startAt: performance.now() });
}

function triggerSnapEffect(id) {
  const now = performance.now();
  snapDropEffects.push({ id, startAt: now });
  const obj = typeof getSceneObjects === 'function' ? getSceneObjects().find(o => o.id === id) : null;
  if (obj) {
    snapRings.push({ x: obj.x + obj.dx / 2, y: obj.y + obj.dy / 2, r: Math.max(obj.dx, obj.dy) * 0.6, startAt: now });
  }
}

function getSnapLift(id, now) {
  const eff = snapDropEffects.find(e => e.id === id);
  if (!eff) return 0;
  const elapsed = (now - eff.startAt) / 420;
  if (elapsed >= 1) {
    snapDropEffects = snapDropEffects.filter(e => e !== eff);
    return 0;
  }
  return (1 - elapsed) * Math.cos(elapsed * Math.PI * 2.5) * 0.9;
}

let selectedObjectId = null; // Currently selected 3D object ID for Inspector & Rotation
let draggingFloorObj = null; // { id, storeKey, dx, dy, isWall, isSubgrid }

// 4-Quadrant 90° Incremental Rotation Helpers (0: 0°, 1: 90°, 2: 180°, 3: 270°)
function getObjRotation(key) {
  if (!simState.rotatedItems) return 0;
  const val = simState.rotatedItems[key];
  if (val === true) return 1;
  const num = parseInt(val, 10);
  return Number.isFinite(num) ? ((num % 4) + 4) % 4 : 0;
}

function isObjRotated(key) {
  return (getObjRotation(key) % 2) === 1;
}

function isPartitionWall(id) {
  return typeof id === 'string' && (id === 'partition-wall' || id.startsWith('partition-'));
}

// shortcut: painter's algorithm depth sort on 2D canvas (<60 AABB boxes), switch to Three.js WebGL z-buffer if object count >200
// Returns interactive 3D furniture, DLC & V4 models in the room (all draggable, clickable & depth-sorted)
function getSceneObjects() { if (window._inFrameLoop && window._frameSceneObjs) return window._frameSceneObjs;
  ensureV4State();
  const list = [];
  const { w: roomW, d: roomD } = getRoomDimensions(simState.profile?.area || 18);
  const clampX = (x, dx) => Math.max(0.22, Math.min(roomW - dx - 0.18, x));
  const clampY = (y, dy) => Math.max(0.22, Math.min(roomD - dy - 0.18, y));
  const clampIX = x => Math.max(0.75, Math.min(roomW - 0.75, x));
  const clampIY = y => Math.max(1.15, Math.min(roomD - 0.65, y));
  const customPos = simState.v4Positions || {};

  const hasShower = simState.furniture.includes('shower-pod');
  const showerRot = getObjRotation('shower-pod');
  const showerDx = (showerRot % 2 === 1) ? 1.55 : 1.45;
  const showerDy = (showerRot % 2 === 1) ? 1.45 : 1.55;
  const showerCp = customPos['shower-pod'];
  const showerX = clampX(showerCp && Number.isFinite(showerCp.x) ? showerCp.x : 0.22, showerDx);
  const showerY = clampY(showerCp && Number.isFinite(showerCp.y) ? showerCp.y : 0.25, showerDy);
  const backTrackMinX = (hasShower && showerX < 1.5 && showerY < 1.4)
    ? Number((showerX + showerDx + 0.08).toFixed(2))
    : 0.22;
  const hasPillar = Boolean(simState.hardscape?.pillar);
  const leftTrackMinY = hasPillar
    ? 2.55
    : ((hasShower && showerX < 1.4 && showerY < 1.5) ? Number((showerY + showerDy + 0.05).toFixed(2)) : 0.22);

  // Prevent back-wall track modules from ever overlapping shower or each other
  const occupiedBackRanges = [];
  if (hasShower && showerY < 1.65) {
    occupiedBackRanges.push({ start: showerX, end: showerX + showerDx });
  }
  const resolveBackWallX = (id, desiredX, dx, sMin, sMax) => {
    const clamped = Math.max(sMin, Math.min(sMax, clampX(desiredX, dx)));
    const overlaps = x => occupiedBackRanges.some(r => x < r.end + 0.04 && x + dx + 0.04 > r.start);
    let finalX = clamped;
    if (overlaps(clamped)) {
      let bestX = null;
      let bestDist = Infinity;
      for (let stepX = sMin; stepX <= sMax + 0.001; stepX += 0.05) {
        const cx = Number(Math.min(sMax, stepX).toFixed(2));
        if (!overlaps(cx)) {
          const d = Math.abs(cx - clamped);
          if (d < bestDist) {
            bestDist = d;
            bestX = cx;
          }
        }
      }
      if (bestX !== null) {
        finalX = bestX;
        if (simState.trackPos) simState.trackPos[id] = finalX;
      }
    }
    occupiedBackRanges.push({ start: finalX, end: finalX + dx });
    return finalX;
  };

  const tp = simState.trackPos || { work: 5.1, family: 2.1, storage: 7.35, safe: 2.05 };
  const backDlcDefs = [
    {
      id: 'work',
      active: isDlcActive('work'),
      dx: Number(Math.min(2.0, roomW * 0.28).toFixed(2)),
      dy: 1.05, dz: 1.55, y: 0.22, iy: 1.65,
      defX: 5.1,
      label: 'WORK DLC · 壁掛折疊工作桌 (可沿軌道滑移)',
      action: 'work'
    },
    {
      id: 'family',
      active: isDlcActive('family'),
      dx: Number(Math.min(2.3, roomW * 0.30).toFixed(2)),
      dy: 1.55, dz: 1.25, y: 0.25, iy: 2.15,
      defX: 2.1,
      label: 'FAMILY DLC · 變形延伸料理中島 (可沿軌道滑移)',
      action: 'eat'
    },
    {
      id: 'storage',
      active: isDlcActive('storage'),
      dx: Number(Math.min(1.4, roomW * 0.20).toFixed(2)),
      dy: 0.82, dz: 2.35, y: 0.22, iy: 1.4,
      defX: Number((roomW - Math.min(1.4, roomW * 0.20) - 0.25).toFixed(2)),
      label: 'STORAGE DLC · 頂天立地收納櫃 (可沿軌道滑移)',
      action: 'relax'
    }
  ].filter(d => d.active);

  // Resolve stationary modules first, then currently dragged module so dragged module stops flush against stationary ones
  const activeDragId = draggingModule?.id;
  const orderedBackDlcs = [
    ...backDlcDefs.filter(d => d.id !== activeDragId),
    ...backDlcDefs.filter(d => d.id === activeDragId)
  ];
  const resolvedBackMap = {};
  orderedBackDlcs.forEach(d => {
    const sMin = backTrackMinX;
    const sMax = Math.max(sMin, Number((roomW - d.dx - 0.22).toFixed(2)));
    const wx = resolveBackWallX(d.id, tp[d.id] ?? d.defX, d.dx, sMin, sMax);
    resolvedBackMap[d.id] = {
      id: d.id, storeKey: d.id,
      label: d.label,
      action: d.action,
      x: wx, y: d.y, z: 0, dx: d.dx, dy: d.dy, dz: d.dz,
      ix: clampIX(wx + d.dx * 0.5), iy: clampIY(d.iy),
      isDlc: true, slideAxis: 'x', slideMin: sMin, slideMax: sMax
    };
  });
  backDlcDefs.forEach(d => {
    if (resolvedBackMap[d.id]) list.push(resolvedBackMap[d.id]);
  });

  // 4. SAFE DLC Handrails (Slidable along full Left Wall Track!)
  if (isDlcActive('safe')) {
    const dy = 1.35;
    const sMin = leftTrackMinY;
    const sMax = Math.max(sMin, Number((roomD - dy - 0.25).toFixed(2)));
    const sy = Math.max(sMin, Math.min(sMax, clampY(tp.safe ?? 2.05, dy)));
    list.push({
      id: 'safe', storeKey: 'safe',
      label: 'SAFE DLC · 樂齡感應扶手與夜燈組 (可沿軌道滑移)',
      action: 'shower',
      x: 0.22, y: sy, z: 0, dx: 0.35, dy, dz: 1.05,
      ix: clampIX(0.95), iy: clampIY(sy + 0.65),
      isDlc: true, slideAxis: 'y', slideMin: sMin, slideMax: sMax
    });
  }

  // Helper for Base Furniture with free floor dragging & 4-way 90° rotation
  const addBaseFurn = (id, storeKey, label, action, defX, defY, baseDx, baseDy, dz) => {
    if (!simState.furniture.includes(storeKey)) return;
    const rot = getObjRotation(storeKey);
    const swapped = (rot % 2) === 1;
    const dx = swapped ? baseDy : baseDx;
    const dy = swapped ? baseDx : baseDy;
    const cp = customPos[storeKey];
    const x = clampX(cp && Number.isFinite(cp.x) ? cp.x : defX, dx);
    const y = clampY(cp && Number.isFinite(cp.y) ? cp.y : defY, dy);
    list.push({
      id, storeKey, label, action,
      x, y, z: 0, dx, dy, dz,
      rot,
      ix: clampIX(x + dx * 0.5),
      iy: clampIY(y + dy + 0.35 < roomD - 0.5 ? y + dy + 0.35 : y - 0.35),
      isBaseFurn: true, canRotate: true
    });
  };

  addBaseFurn('shower', 'shower-pod', '乾濕分離衛浴艙', 'shower', 0.22, 0.25, 1.45, 1.55, 2.15);
  addBaseFurn('sofa', 'sofa-set', '北歐雙人舒適沙發', 'relax', 0.55, Math.min(3.55, roomD - 2.35), 1.2, Math.min(2.0, roomD * 0.38), 0.95);
  addBaseFurn('tv', 'tv-wall', '智慧影音電視櫃', 'chat', Math.min(2.55, roomW * 0.38), Math.min(3.9, roomD - 1.75), 0.72, Math.min(1.4, roomD * 0.32), 1.15);
  addBaseFurn('bed', 'bed-set', isDlcActive('storage') ? '掀床高密度收納雙人床' : '舒適雙人臥床', 'sleep', roomW - 2.55, Math.min(3.65, roomD - 2.2), Math.min(2.2, roomW * 0.38), Math.min(1.85, roomD * 0.38), 1.15);
  addBaseFurn('cart', 'kitchen-cart', '移動式料理推車', 'eat', Math.min(4.45, roomW * 0.52), Math.min(1.95, roomD * 0.38), 0.75, 0.65, 0.85);
  addBaseFurn('plant', 'plant-deco', '琴葉榕大型植栽', 'relax', roomW - 0.95, Math.min(2.3, roomD * 0.45), 0.65, 0.65, 1.45);

  // Include all placed V4 Themed Catalog Items so they are clickable, draggable, rotatable & interactive!
  if (typeof V4_SHOP_CATALOG !== 'undefined' && Array.isArray(simState.v4Items)) {
    const catActionMap = { tech: 'work', collect: 'chat', appliance: 'eat', lighting: 'relax', pet: 'relax' };
    simState.v4Items.forEach(id => {
      if (id === 'robot-vac') return;
      const meta = V4_SHOP_CATALOG.find(m => m.id === id);
      if (!meta) return;
      const pos = typeof getV4ItemPos === 'function' ? getV4ItemPos(meta) : { x: meta.x, y: meta.y, z: meta.zBase || 0, dx: meta.dx, dy: meta.dy, rot: 0 };
      const dx = pos.dx || meta.dx;
      const dy = pos.dy || meta.dy;
      const rot = pos.rot ?? getObjRotation(meta.id);
      list.push({
        id: meta.id,
        storeKey: meta.id,
        label: meta.name,
        action: catActionMap[meta.cat] || 'relax',
        x: pos.x, y: pos.y, z: pos.z,
        dx, dy, dz: meta.dz,
        rot,
        ix: clampIX(pos.x + dx * 0.5),
        iy: clampIY(pos.y + dy + 0.4 < roomD - 0.5 ? pos.y + dy + 0.4 : pos.y + 0.5),
        isV4: true,
        isSubgrid: Boolean(meta.isSubgrid),
        isWall: Boolean(meta.isWall),
        canRotate: !meta.isWall
      });
    });
  }

  // Include Customizable 3D Partition Walls (支援複數：純牆面 或 房門牆面)
  if (Array.isArray(simState.hardscape?.partitions) && simState.hardscape.partitions.length > 0) {
    simState.hardscape.partitions.forEach((cfg, idx) => {
      const isHoriz = cfg.orient === 'x';
      let rot = getObjRotation(cfg.id);
      if (isHoriz && rot % 2 === 0) {
        rot = 1;
        simState.rotatedItems[cfg.id] = 1;
      } else if (!isHoriz && rot % 2 === 1) {
        rot = 0;
        simState.rotatedItems[cfg.id] = 0;
      }
      const wallLen = Math.max(1.4, Math.min(isHoriz ? roomW - 0.5 : roomD - 0.5, cfg.length || 2.6));
      const wallThick = 0.16;
      const dx = isHoriz ? wallLen : wallThick;
      const dy = isHoriz ? wallThick : wallLen;
      const cp = customPos[cfg.id];
      const defX = Number.isFinite(cfg.x) ? cfg.x : Number((roomW * (0.35 + (idx % 3) * 0.18)).toFixed(2));
      const defY = Number.isFinite(cfg.y) ? cfg.y : Number((roomD * (0.28 + (idx % 3) * 0.15)).toFixed(2));
      const x = clampX(cp && Number.isFinite(cp.x) ? cp.x : defX, dx);
      const y = clampY(cp && Number.isFinite(cp.y) ? cp.y : defY, dy);
      cfg.x = x;
      cfg.y = y;

      const isSolid = cfg.type === 'solid';
      const dStyleName = isSolid ? '純實心' : (cfg.doorStyle === 'wood-hinged' ? '實木門' : cfg.doorStyle === 'open-arch' ? '穿透拱門' : '玻璃拉門');
      list.push({
        id: cfg.id,
        storeKey: cfg.id,
        label: `${isSolid ? '純隔間牆' : '房門隔間牆'} #${idx + 1} (長${wallLen.toFixed(1)}m · ${dStyleName})`,
        action: 'relax',
        x, y, z: 0,
        dx, dy, dz: 2.40,
        rot,
        ix: clampIX(x + dx * 0.5),
        iy: clampIY(y + dy * 0.5 + 0.45 < roomD - 0.4 ? y + dy * 0.5 + 0.45 : y + dy * 0.5 - 0.45),
        isHardscape: true,
        canRotate: true,
        isPartition: true,
        cfg
      });
    });
  }

  return list;
}

// Compute independent 3D sub-component geometry for Partition Wall Doorway & Door Leaf
function getPartitionDoorSubbox(obj) {
  if (!obj || !isPartitionWall(obj.id)) return null;
  const cfg = obj.cfg || simState.hardscape?.partitions?.find(p => p.id === obj.id) || simState.hardscape?.partitionConfig || {};
  if (cfg.type === 'solid') return null; // 純牆面無門扇！
  const isHoriz = obj.dx > obj.dy;
  const totalLen = isHoriz ? obj.dx : obj.dy;
  const wallThick = isHoriz ? obj.dy : obj.dx;
  const wallMode = simState.wallMode || 'cutaway';
  const wallH = (wallMode === 'none') ? 0.08 : 2.40;
  const doorH = (wallMode === 'none') ? 0.08 : 2.05;
  const doorW = Math.min(0.92, Math.max(0.75, totalLen * 0.35));
  const dStyle = cfg.doorStyle || 'glass-sliding';
  const dPos = cfg.doorPos || 'center';
  const isOpen = Boolean(cfg.doorOpen);
  const rot = obj.rot ?? getObjRotation(obj.id);
  const swingNeg = rot >= 2;

  let doorOffset = (totalLen - doorW) * 0.5;
  if (dPos === 'start') doorOffset = Math.max(0.18, (totalLen - doorW) * 0.18);
  else if (dPos === 'end') doorOffset = Math.max(0.18, totalLen - doorW - 0.18);
  const seg1Len = Math.max(0.12, doorOffset);
  const seg2Len = Math.max(0.12, totalLen - doorOffset - doorW);

  // Doorway frame 3D box
  const frameBox = isHoriz
    ? { x: obj.x + doorOffset, y: obj.y - 0.05, z: obj.z || 0, dx: doorW, dy: wallThick + 0.1, dz: doorH }
    : { x: obj.x - 0.05, y: obj.y + doorOffset, z: obj.z || 0, dx: wallThick + 0.1, dy: doorW, dz: doorH };

  // Active Door Leaf 3D box (shifts or swings when open)
  let leafBox = { ...frameBox };
  if (dStyle === 'glass-sliding') {
    const slideShift = isOpen ? -Math.min(seg1Len - 0.08, doorW * 0.82) : 0;
    leafBox = isHoriz
      ? { x: obj.x + doorOffset + slideShift, y: obj.y - 0.06, z: obj.z || 0, dx: doorW, dy: wallThick + 0.12, dz: doorH }
      : { x: obj.x - 0.06, y: obj.y + doorOffset + slideShift, z: obj.z || 0, dx: wallThick + 0.12, dy: doorW, dz: doorH };
  } else if (dStyle === 'wood-hinged' && isOpen) {
    leafBox = isHoriz
      ? {
          x: obj.x + doorOffset - 0.04,
          y: swingNeg ? (obj.y - doorW * 0.88 + wallThick) : obj.y,
          z: obj.z || 0,
          dx: 0.28,
          dy: doorW * 0.88,
          dz: doorH
        }
      : {
          x: swingNeg ? (obj.x - doorW * 0.88 + wallThick) : obj.x,
          y: obj.y + doorOffset - 0.04,
          z: obj.z || 0,
          dx: doorW * 0.88,
          dy: 0.28,
          dz: doorH
        };
  }

  // Solid Wall Segments 1 & 2 (excluding doorway so wall AABB never intercepts door clicks)
  const seg1Box = isHoriz
    ? { x: obj.x, y: obj.y, z: obj.z || 0, dx: seg1Len, dy: wallThick, dz: wallH }
    : { x: obj.x, y: obj.y, z: obj.z || 0, dx: wallThick, dy: seg1Len, dz: wallH };
  const seg2Box = isHoriz
    ? { x: obj.x + doorOffset + doorW, y: obj.y, z: obj.z || 0, dx: seg2Len, dy: wallThick, dz: wallH }
    : { x: obj.x, y: obj.y + doorOffset + doorW, z: obj.z || 0, dx: wallThick, dy: seg2Len, dz: wallH };

  return {
    isHoriz, totalLen, wallThick, wallH,
    doorH, doorW, doorOffset, seg1Len, seg2Len,
    dStyle, dPos, isOpen,
    frameBox, leafBox, seg1Box, seg2Box
  };
}

function draw3DFurnitureObject(iso, obj, now, isNight) {
  const lift = getSnapLift(obj.id, now);
  const isInteracting = activeInteraction && activeInteraction.objId === obj.id;
  const bounce = isInteracting ? Math.sin((now - activeInteraction.startAt) / 80) * 0.04 : 0;
  const z0 = obj.z + lift + Math.max(0, bounce);
  const { x, y, dx, dy } = obj;

  iso.drawShadow(x, y, dx, dy, lift > 0.05 ? 0.08 : 0.18);

  // Highlight ring if hovered, selected, or interacting
  const isSelected = selectedObjectId === obj.id;
  if (hoveredObject?.id === obj.id || isSelected || isInteracting) {
    const pad = 0.12;
    const pts = [
      iso.project(x - pad, y - pad, 0.02),
      iso.project(x + dx + pad, y - pad, 0.02),
      iso.project(x + dx + pad, y + dy + pad, 0.02),
      iso.project(x - pad, y + dy + pad, 0.02)
    ];
    const fillCol = isInteracting
      ? 'rgba(245, 196, 83, 0.30)'
      : isSelected
      ? 'rgba(56, 189, 248, 0.25)'
      : 'rgba(100, 136, 121, 0.22)';
    const strokeCol = isSelected ? '#38bdf8' : '#d49b3b';
    iso.drawPoly(pts, fillCol, strokeCol, isSelected ? 2.5 : 2);
  }

  if (obj.id === 'work') {
    if (isDlcActive('work')) {
      // 3D TAYA Snap-Lock Brackets onto back wall track
      iso.drawBox(x + 0.15, y, z0 + 0.72, 0.12, 0.25, 0.28, '#475569');
      iso.drawBox(x + dx - 0.27, y, z0 + 0.72, 0.12, 0.25, 0.28, '#475569');
      // 3D Cantilevered Walnut Tabletop
      iso.drawBox(x, y + 0.05, z0 + 0.76, dx, dy - 0.15, 0.08, '#9c6639');
      // 3D Dual Monitor + Stand
      iso.drawBox(x + 0.75, y + 0.15, z0 + 0.84, 0.35, 0.15, 0.18, '#334155');
      iso.drawBox(x + 0.32, y + 0.18, z0 + 0.98, 1.15, 0.08, 0.52, '#1e293b');
      // Glowing Monitor Screen
      iso.drawBox(x + 0.36, y + 0.25, z0 + 1.02, 1.07, 0.03, 0.44, '#38bdf8', { topColor: '#7dd3fc', leftColor: '#38bdf8' });
      // 3D Desk Lamp with warm light
      iso.drawBox(x + 1.65, y + 0.2, z0 + 0.84, 0.14, 0.14, 0.48, '#d97706');
      iso.drawBox(x + 1.52, y + 0.2, z0 + 1.28, 0.26, 0.2, 0.09, '#fbbf24');
      // 3D Ergonomic Task Chair
      const cx = x + 0.72, cy = y + 0.65;
      iso.drawBox(cx + 0.2, cy + 0.2, z0, 0.12, 0.12, 0.42, '#334155');
      iso.drawBox(cx, cy, z0 + 0.42, 0.52, 0.48, 0.09, '#527464');
      iso.drawBox(cx + 0.04, cy + 0.4, z0 + 0.51, 0.44, 0.09, 0.52, '#436253');
    } else {
      // Cramped unequipped desk with laptop
      iso.drawBox(x + 0.1, y + 0.1, z0, 0.08, 0.08, 0.68, '#785a40');
      iso.drawBox(x + dx - 0.18, y + 0.1, z0, 0.08, 0.08, 0.68, '#785a40');
      iso.drawBox(x, y, z0 + 0.68, dx, dy, 0.07, '#b58d67');
      iso.drawBox(x + 0.3, y + 0.2, z0 + 0.75, 0.42, 0.3, 0.04, '#64748b');
      iso.drawBox(x + 0.3, y + 0.2, z0 + 0.79, 0.42, 0.05, 0.26, '#94a3b8');
    }
    return;
  }

  if (obj.id === 'family') {
    if (isDlcActive('family')) {
      // 3D TAYA Modular Kitchen Island
      iso.drawBox(x, y, z0, dx, dy - 0.35, 0.86, '#5d7b6b'); // Sage green cabinet base
      iso.drawBox(x - 0.05, y - 0.04, z0 + 0.86, dx + 0.1, dy - 0.15, 0.09, '#f5f0e6'); // Quartz countertop overhang
      // 3D Recessed Sink & Faucet
      iso.drawBox(x + 0.25, y + 0.2, z0 + 0.88, 0.65, 0.45, 0.08, '#94a3b8');
      iso.drawBox(x + 0.52, y + 0.12, z0 + 0.95, 0.08, 0.18, 0.28, '#cbd5e1');
      // 3D Induction Cooktop & Simmering Pot
      iso.drawBox(x + 1.25, y + 0.22, z0 + 0.88, 0.72, 0.48, 0.08, '#1e293b');
      iso.drawBox(x + 1.42, y + 0.32, z0 + 0.96, 0.36, 0.32, 0.22, '#e11d48'); // Red Dutch oven pot
      iso.drawBox(x + 1.46, y + 0.36, z0 + 1.18, 0.28, 0.24, 0.05, '#f43f5e');
      // 2x 3D Barstools in front of island
      [x + 0.45, x + 1.35].forEach(sx => {
        iso.drawBox(sx + 0.12, y + dy - 0.28, z0, 0.1, 0.1, 0.56, '#7c5335');
        iso.drawBox(sx, y + dy - 0.4, z0 + 0.56, 0.36, 0.34, 0.08, '#c89666');
      });
    } else {
      // Cramped tiny counter with microwave
      iso.drawBox(x, y, z0, dx, dy, 0.82, '#a3917b');
      iso.drawBox(x, y, z0 + 0.82, dx, dy, 0.06, '#e2d9c8');
      iso.drawBox(x + 0.2, y + 0.12, z0 + 0.88, 0.55, 0.38, 0.34, '#475569'); // Microwave
      iso.drawBox(x + 0.26, y + 0.48, z0 + 0.93, 0.32, 0.04, 0.22, '#fef08a');
    }
    return;
  }

  if (obj.id === 'storage') {
    // 3D Floor-to-ceiling Modular Storage Cabinet Wall
    iso.drawBox(x, y, z0, dx, dy, 2.25, '#8c5e3c');
    // Matte cream cabinet doors
    iso.drawBox(x + 0.06, y + dy - 0.04, z0 + 0.08, dx * 0.44, 0.06, 1.05, '#f4efe4');
    iso.drawBox(x + dx * 0.52, y + dy - 0.04, z0 + 0.08, dx * 0.42, 0.06, 1.05, '#f4efe4');
    // Illuminated Display Niche in middle
    iso.drawBox(x + 0.08, y + 0.1, z0 + 1.2, dx - 0.16, dy - 0.08, 0.48, '#fde68a');
    iso.drawBox(x + 0.18, y + 0.2, z0 + 1.24, 0.32, 0.35, 0.32, '#527464'); // Decorative box
    iso.drawBox(x + 0.68, y + 0.2, z0 + 1.24, 0.42, 0.35, 0.26, '#c27849');
    // Upper doors
    iso.drawBox(x + 0.06, y + dy - 0.04, z0 + 1.72, dx - 0.12, 0.06, 0.46, '#f4efe4');
    return;
  }

  if (obj.id === 'clutter') {
    // Unorganized cardboard boxes on floor (Pain point when STORAGE DLC is off)
    iso.drawBox(x, y, z0, 0.58, 0.52, 0.48, '#c28f5a');
    iso.drawBox(x + 0.55, y + 0.18, z0, 0.52, 0.48, 0.38, '#b07d48');
    iso.drawBox(x + 0.18, y + 0.08, z0 + 0.48, 0.42, 0.38, 0.32, '#d4a373');
    return;
  }

  if (obj.id === 'shower') {
    // 3D Walk-in Shower & Bath Pod
    iso.drawBox(x, y, z0, dx, dy, 0.12, '#cbd5e1'); // Ceramic base tray
    // Back & Left waterproof tile panels
    iso.drawBox(x, y, z0 + 0.12, 0.1, dy, 1.95, '#94a3b8');
    iso.drawBox(x, y, z0 + 0.12, dx, 0.1, 1.95, '#94a3b8');
    // Overhead Chrome Shower Pipe & Rainfall Head
    iso.drawBox(x + 0.12, y + 0.65, z0 + 0.9, 0.08, 0.08, 1.05, '#e2e8f0');
    iso.drawBox(x + 0.12, y + 0.62, z0 + 1.92, 0.48, 0.24, 0.06, '#f8fafc');
    // Frosted Glass Partition Panel
    iso.drawBox(x + dx - 0.08, y + 0.05, z0 + 0.12, 0.06, dy * 0.68, 1.85, '#bae6fd', {
      topColor: 'rgba(224,242,254,0.65)',
      rightColor: 'rgba(186,230,253,0.42)',
      leftColor: 'rgba(125,211,252,0.38)'
    });
    return;
  }

  if (obj.id === 'safe') {
    // 3D Ergonomic Handrail & Glowing Nightlight Strip
    iso.drawBox(x, y, z0 + 0.78, 0.18, dy, 0.09, '#d97706');
    iso.drawBox(x, y + 0.1, z0 + 0.1, 0.12, 0.12, 0.68, '#94a3b8');
    iso.drawBox(x, y + dy - 0.22, z0 + 0.1, 0.12, 0.12, 0.68, '#94a3b8');
    // Glowing green/amber safety floor light strip
    iso.drawBox(x + 0.02, y, z0 + 0.02, 0.16, dy, 0.06, '#84cc16', { topColor: '#bef264' });
    return;
  }

  if (obj.id === 'sofa') {
    // 3D Nordic Sofa (supports 4-way 90° incremental rotation)
    const rot = obj.rot ?? getObjRotation(obj.storeKey || obj.id);
    iso.drawBox(x, y, z0, dx, dy, 0.36, '#648272'); // Base seat
    if (rot === 0) {
      // Facing +X (backrest on left edge x)
      iso.drawBox(x, y, z0 + 0.36, 0.28, dy, 0.52, '#526d5e'); // Backrest
      iso.drawBox(x + 0.28, y, z0 + 0.36, dx - 0.28, 0.22, 0.32, '#526d5e'); // Left armrest
      iso.drawBox(x + 0.28, y + dy - 0.22, z0 + 0.36, dx - 0.28, 0.22, 0.32, '#526d5e'); // Right armrest
      iso.drawBox(x + 0.3, y + 0.32, z0 + 0.36, 0.22, 0.42, 0.28, '#e09f67');
      iso.drawBox(x + 0.3, y + dy - 0.75, z0 + 0.36, 0.22, 0.42, 0.28, '#e9c46a');
    } else if (rot === 1) {
      // Facing +Y (backrest along back edge y)
      iso.drawBox(x, y, z0 + 0.36, dx, 0.28, 0.52, '#526d5e'); // Backrest along Y=0
      iso.drawBox(x, y + 0.28, z0 + 0.36, 0.22, dy - 0.28, 0.32, '#526d5e');
      iso.drawBox(x + dx - 0.22, y + 0.28, z0 + 0.36, 0.22, dy - 0.28, 0.32, '#526d5e');
      iso.drawBox(x + 0.32, y + 0.3, z0 + 0.36, 0.42, 0.22, 0.28, '#e09f67');
      iso.drawBox(x + dx - 0.75, y + 0.3, z0 + 0.36, 0.42, 0.22, 0.28, '#e9c46a');
    } else if (rot === 2) {
      // Facing -X (backrest on right edge x + dx - 0.28)
      iso.drawBox(x + dx - 0.28, y, z0 + 0.36, 0.28, dy, 0.52, '#526d5e'); // Backrest
      iso.drawBox(x, y, z0 + 0.36, dx - 0.28, 0.22, 0.32, '#526d5e'); // Top armrest
      iso.drawBox(x, y + dy - 0.22, z0 + 0.36, dx - 0.28, 0.22, 0.32, '#526d5e'); // Bottom armrest
      iso.drawBox(x + dx - 0.52, y + 0.32, z0 + 0.36, 0.22, 0.42, 0.28, '#e09f67');
      iso.drawBox(x + dx - 0.52, y + dy - 0.75, z0 + 0.36, 0.22, 0.42, 0.28, '#e9c46a');
    } else {
      // Facing -Y (backrest along front edge y + dy - 0.28)
      iso.drawBox(x, y + dy - 0.28, z0 + 0.36, dx, 0.28, 0.52, '#526d5e'); // Backrest
      iso.drawBox(x, y, z0 + 0.36, 0.22, dy - 0.28, 0.32, '#526d5e');
      iso.drawBox(x + dx - 0.22, y, z0 + 0.36, 0.22, dy - 0.28, 0.32, '#526d5e');
      iso.drawBox(x + 0.32, y + dy - 0.52, z0 + 0.36, 0.42, 0.22, 0.28, '#e09f67');
      iso.drawBox(x + dx - 0.75, y + dy - 0.52, z0 + 0.36, 0.42, 0.22, 0.28, '#e9c46a');
    }
    return;
  }

  if (obj.id === 'tv') {
    // 3D Media Console & Smart TV (supports 4-way 90° incremental rotation)
    const rot = obj.rot ?? getObjRotation(obj.storeKey || obj.id);
    iso.drawBox(x, y, z0, dx, dy, 0.42, '#8c5e3c');
    if (rot === 0) {
      iso.drawBox(x + 0.15, y + 0.18, z0 + 0.42, 0.12, dy - 0.36, 0.68, '#1e293b');
      iso.drawBox(x + 0.24, y + 0.22, z0 + 0.46, 0.04, dy - 0.44, 0.58, '#38bdf8');
    } else if (rot === 1) {
      iso.drawBox(x + 0.18, y + 0.15, z0 + 0.42, dx - 0.36, 0.12, 0.68, '#1e293b');
      iso.drawBox(x + 0.22, y + 0.24, z0 + 0.46, dx - 0.44, 0.04, 0.58, '#38bdf8');
    } else if (rot === 2) {
      iso.drawBox(x + dx - 0.27, y + 0.18, z0 + 0.42, 0.12, dy - 0.36, 0.68, '#1e293b');
      iso.drawBox(x + dx - 0.28, y + 0.22, z0 + 0.46, 0.04, dy - 0.44, 0.58, '#38bdf8');
    } else {
      iso.drawBox(x + 0.18, y + dy - 0.27, z0 + 0.42, dx - 0.36, 0.12, 0.68, '#1e293b');
      iso.drawBox(x + 0.22, y + dy - 0.28, z0 + 0.46, dx - 0.44, 0.04, 0.58, '#38bdf8');
    }
    return;
  }

  if (obj.id === 'bed') {
    // 3D Double Bed with Headboard, Pillows & Duvet (supports 4-way 90° incremental rotation)
    const rot = obj.rot ?? getObjRotation(obj.storeKey || obj.id);
    const frameCol = isDlcActive('storage') ? '#7c5335' : '#9c6b46';
    iso.drawBox(x, y, z0, dx, dy, 0.34, frameCol); // Bed frame
    if (rot === 0) {
      // Headboard along back wall (y=0 side)
      iso.drawBox(x, y, z0 + 0.34, dx, 0.2, 0.72, '#6b442a');
      iso.drawBox(x + 0.08, y + 0.2, z0 + 0.34, dx - 0.16, dy - 0.28, 0.22, '#faf6ee');
      iso.drawBox(x + 0.06, y + 0.2 + (dy - 0.28) * 0.35, z0 + 0.36, dx - 0.12, (dy - 0.28) * 0.65, 0.23, '#6b8e78');
      iso.drawBox(x + 0.18, y + 0.28, z0 + 0.56, Math.min(0.56, (dx - 0.4) * 0.48), 0.38, 0.12, '#ffffff');
      iso.drawBox(x + dx - Math.min(0.56, (dx - 0.4) * 0.48) - 0.18, y + 0.28, z0 + 0.56, Math.min(0.56, (dx - 0.4) * 0.48), 0.38, 0.12, '#ffffff');
    } else if (rot === 1) {
      // Headboard along right edge (x+dx side)
      iso.drawBox(x + dx - 0.2, y, z0 + 0.34, 0.2, dy, 0.72, '#6b442a');
      iso.drawBox(x + 0.08, y + 0.08, z0 + 0.34, dx - 0.28, dy - 0.16, 0.22, '#faf6ee');
      iso.drawBox(x + 0.06, y + 0.06, z0 + 0.36, (dx - 0.28) * 0.65, dy - 0.12, 0.23, '#6b8e78');
      iso.drawBox(x + dx - 0.68, y + 0.22, z0 + 0.56, 0.4, Math.min(0.62, (dy - 0.4) * 0.45), 0.12, '#ffffff');
      iso.drawBox(x + dx - 0.68, y + dy - Math.min(0.62, (dy - 0.4) * 0.45) - 0.22, z0 + 0.56, 0.4, Math.min(0.62, (dy - 0.4) * 0.45), 0.12, '#ffffff');
    } else if (rot === 2) {
      // Headboard along front edge (y+dy side)
      iso.drawBox(x, y + dy - 0.2, z0 + 0.34, dx, 0.2, 0.72, '#6b442a');
      iso.drawBox(x + 0.08, y + 0.08, z0 + 0.34, dx - 0.16, dy - 0.28, 0.22, '#faf6ee');
      iso.drawBox(x + 0.06, y + 0.06, z0 + 0.36, dx - 0.12, (dy - 0.28) * 0.65, 0.23, '#6b8e78');
      iso.drawBox(x + 0.18, y + dy - 0.66, z0 + 0.56, Math.min(0.56, (dx - 0.4) * 0.48), 0.38, 0.12, '#ffffff');
      iso.drawBox(x + dx - Math.min(0.56, (dx - 0.4) * 0.48) - 0.18, y + dy - 0.66, z0 + 0.56, Math.min(0.56, (dx - 0.4) * 0.48), 0.38, 0.12, '#ffffff');
    } else {
      // Headboard along left edge (x side)
      iso.drawBox(x, y, z0 + 0.34, 0.2, dy, 0.72, '#6b442a');
      iso.drawBox(x + 0.2, y + 0.08, z0 + 0.34, dx - 0.28, dy - 0.16, 0.22, '#faf6ee');
      iso.drawBox(x + 0.2 + (dx - 0.28) * 0.35, y + 0.06, z0 + 0.36, (dx - 0.28) * 0.65, dy - 0.12, 0.23, '#6b8e78');
      iso.drawBox(x + 0.28, y + 0.22, z0 + 0.56, 0.4, Math.min(0.62, (dy - 0.4) * 0.45), 0.12, '#ffffff');
      iso.drawBox(x + 0.28, y + dy - Math.min(0.62, (dy - 0.4) * 0.45) - 0.22, z0 + 0.56, 0.4, Math.min(0.62, (dy - 0.4) * 0.45), 0.12, '#ffffff');
    }
    return;
  }

  if (obj.id === 'cart') {
    const rot = obj.rot ?? getObjRotation(obj.storeKey || obj.id);
    iso.drawBox(x, y, z0 + 0.08, dx, dy, 0.72, '#b07d4f');
    iso.drawBox(x - 0.03, y - 0.03, z0 + 0.78, dx + 0.06, dy + 0.06, 0.07, '#f4efe6');
    if (rot === 0) {
      iso.drawBox(x + dx + 0.02, y + 0.08, z0 + 0.65, 0.05, dy - 0.16, 0.18, '#cbd5e1');
    } else if (rot === 1) {
      iso.drawBox(x + 0.08, y + dy + 0.02, z0 + 0.65, dx - 0.16, 0.05, 0.18, '#cbd5e1');
    } else if (rot === 2) {
      iso.drawBox(x - 0.07, y + 0.08, z0 + 0.65, 0.05, dy - 0.16, 0.18, '#cbd5e1');
    } else {
      iso.drawBox(x + 0.08, y - 0.07, z0 + 0.65, dx - 0.16, 0.05, 0.18, '#cbd5e1');
    }
    return;
  }

  if (obj.id === 'plant') {
    // 3D Potted Monstera Plant
    iso.drawBox(x + 0.12, y + 0.12, z0, 0.42, 0.42, 0.45, '#b86b43');
    iso.drawBox(x + 0.26, y + 0.26, z0 + 0.45, 0.14, 0.14, 0.55, '#4d7c4f');
    iso.drawBox(x + 0.04, y + 0.08, z0 + 0.75, 0.56, 0.48, 0.22, '#5c945e');
    iso.drawBox(x + 0.12, y + 0.14, z0 + 0.97, 0.4, 0.38, 0.25, '#74ad76');
    return;
  }

  if (obj.isPartition || isPartitionWall(obj.id)) {
    // Custom Movable Partition Wall (Solid or Doorway with Plural Instances)
    const cfg = obj.cfg || simState.hardscape?.partitions?.find(p => p.id === obj.id) || simState.hardscape?.partitionConfig || {};
    const isSolid = cfg.type === 'solid';
    const isHoriz = dx > dy;
    const totalLen = isHoriz ? dx : dy;
    const wallThick = isHoriz ? dy : dx;
    const wallMode = simState.wallMode || 'cutaway';
    const wallH = (wallMode === 'none') ? 0.08 : 2.40;

    // Wall colors based on wallMat
    const wallMat = simState.hardscape?.wallMat || 'warm';
    let wallCol = '#f5eee6', wallSideCol = '#e7ded4', wallTopCol = '#fffdfa';
    if (wallMat === 'stone') {
      wallCol = '#cbd5e1'; wallSideCol = '#94a3b8'; wallTopCol = '#e2e8f0';
    } else if (wallMat === 'acoustic') {
      wallCol = '#334155'; wallSideCol = '#1e293b'; wallTopCol = '#475569';
    }

    // Branch A: Pure Solid Partition Wall (純隔間牆 - 無門洞、無門扇)
    if (isSolid) {
      iso.drawShadow(x, y, dx, dy, 0.16);
      iso.drawBox(x, y, z0, dx, dy, wallH, wallCol, {
        topColor: wallTopCol, rightColor: wallSideCol, leftColor: wallCol
      });
      iso.drawBox(x, y, z0, dx + (isHoriz ? 0 : 0.01), dy + (isHoriz ? 0.01 : 0), 0.08, '#7c5335');
      // Architectural vertical panel seams
      const seamDist = 0.8;
      if (isHoriz) {
        for (let sx = x + seamDist; sx < x + dx - 0.25; sx += seamDist) {
          iso.drawBox(sx, y - 0.005, z0 + 0.08, 0.015, wallThick + 0.01, wallH - 0.08, wallSideCol);
        }
      } else {
        for (let sy = y + seamDist; sy < y + dy - 0.25; sy += seamDist) {
          iso.drawBox(x - 0.005, sy, z0 + 0.08, wallThick + 0.01, 0.015, wallH - 0.08, wallSideCol);
        }
      }
      return;
    }

    // Branch B: Doorway Partition Wall (含門隔間牆)
    const doorH = (wallMode === 'none') ? 0.08 : 2.05;
    const doorW = Math.min(0.92, Math.max(0.75, totalLen * 0.35));
    const dStyle = cfg.doorStyle || 'glass-sliding';
    const dPos = cfg.doorPos || 'center';
    const isOpen = Boolean(cfg.doorOpen);

    // Compute Doorway Offset along the wall length
    let doorOffset = (totalLen - doorW) * 0.5;
    if (dPos === 'start') doorOffset = Math.max(0.18, (totalLen - doorW) * 0.18);
    else if (dPos === 'end') doorOffset = Math.max(0.18, totalLen - doorW - 0.18);
    const seg1Len = Math.max(0.12, doorOffset);
    const seg2Len = Math.max(0.12, totalLen - doorOffset - doorW);

    if (isHoriz) {
      // Horizontal Wall (extends along X-axis, width is dx, depth is wallThick)
      iso.drawShadow(x, y, seg1Len, wallThick, 0.16);
      iso.drawShadow(x + doorOffset + doorW, y, seg2Len, wallThick, 0.16);

      // Wall Segment 1
      iso.drawBox(x, y, z0, seg1Len, wallThick, wallH, wallCol, {
        topColor: wallTopCol, rightColor: wallSideCol, leftColor: wallCol
      });
      iso.drawBox(x, y, z0, seg1Len, wallThick + 0.01, 0.08, '#7c5335');

      // Wall Segment 2
      iso.drawBox(x + doorOffset + doorW, y, z0, seg2Len, wallThick, wallH, wallCol, {
        topColor: wallTopCol, rightColor: wallSideCol, leftColor: wallCol
      });
      iso.drawBox(x + doorOffset + doorW, y, z0, seg2Len, wallThick + 0.01, 0.08, '#7c5335');

      // Doorway Frame
      const frameCol = '#1e293b';
      const frameThick = 0.04;
      iso.drawBox(x + doorOffset, y, z0, frameThick, wallThick, doorH, frameCol);
      iso.drawBox(x + doorOffset + doorW - frameThick, y, z0, frameThick, wallThick, doorH, frameCol);
      iso.drawBox(x + doorOffset, y, z0 + doorH - frameThick, doorW, wallThick, frameThick, frameCol);

      // Transom wall above door
      iso.drawBox(x + doorOffset, y, z0 + doorH, doorW, wallThick, wallH - doorH, wallCol, {
        topColor: wallTopCol, rightColor: wallSideCol, leftColor: wallCol
      });

      // Door Panel
      if (dStyle === 'glass-sliding') {
        iso.drawBox(x + doorOffset - 0.08, y - 0.02, z0 + doorH, doorW + 0.45, 0.04, 0.05, '#0f172a');
        const slideShift = isOpen ? -Math.min(seg1Len - 0.08, doorW * 0.82) : 0;
        const panelX = x + doorOffset + slideShift;
        iso.drawBox(panelX, y - 0.015, z0 + 0.04, doorW, 0.03, doorH - 0.06, '#bae6fd', {
          topColor: 'rgba(224,242,254,0.65)',
          rightColor: 'rgba(186,230,253,0.45)',
          leftColor: 'rgba(125,211,252,0.38)',
          stroke: '#1e293b'
        });
        iso.drawBox(panelX + doorW * 0.5 - 0.015, y - 0.016, z0 + 0.04, 0.03, 0.032, doorH - 0.06, '#0f172a');
        iso.drawBox(panelX + (isOpen ? 0.08 : doorW - 0.12), y - 0.03, z0 + 0.82, 0.03, 0.05, 0.45, '#e2e8f0');
      } else if (dStyle === 'wood-hinged') {
        const swingNeg = (obj.rot ?? getObjRotation(obj.id)) >= 2;
        if (isOpen) {
          const swingY = swingNeg ? (y - doorW * 0.88 + wallThick) : y;
          const handleY = swingNeg ? (y - doorW * 0.75 + wallThick) : (y + doorW * 0.75);
          iso.drawBox(x + doorOffset + 0.04, swingY, z0 + 0.04, 0.04, doorW * 0.88, doorH - 0.06, '#9c6b46');
          iso.drawBox(x + doorOffset + 0.02, handleY, z0 + 0.95, 0.08, 0.08, 0.04, '#f59e0b');
        } else {
          iso.drawBox(x + doorOffset + frameThick, y + 0.03, z0 + 0.04, doorW - frameThick * 2, 0.05, doorH - 0.06, '#9c6b46', {
            topColor: '#b07d4f', rightColor: '#7c5335', leftColor: '#b07d4f'
          });
          iso.drawBox(x + doorOffset + doorW - 0.14, y - 0.01, z0 + 0.95, 0.08, 0.09, 0.04, '#f59e0b');
        }
      } else {
        iso.drawBox(x + doorOffset - 0.02, y - 0.01, z0, doorW + 0.04, wallThick + 0.02, 0.06, '#7c5335');
        iso.drawBox(x + doorOffset + 0.04, y - 0.01, z0 + doorH - 0.12, 0.12, wallThick + 0.02, 0.12, '#cbd5e1');
        iso.drawBox(x + doorOffset + doorW - 0.16, y - 0.01, z0 + doorH - 0.12, 0.12, wallThick + 0.02, 0.12, '#cbd5e1');
      }
    } else {
      // Vertical Wall (extends along Y-axis, depth is dy, width is wallThick)
      iso.drawShadow(x, y, wallThick, seg1Len, 0.16);
      iso.drawShadow(x, y + doorOffset + doorW, wallThick, seg2Len, 0.16);

      // Wall Segment 1
      iso.drawBox(x, y, z0, wallThick, seg1Len, wallH, wallCol, {
        topColor: wallTopCol, rightColor: wallSideCol, leftColor: wallCol
      });
      iso.drawBox(x, y, z0, wallThick + 0.01, seg1Len, 0.08, '#7c5335');

      // Wall Segment 2
      iso.drawBox(x, y + doorOffset + doorW, z0, wallThick, seg2Len, wallH, wallCol, {
        topColor: wallTopCol, rightColor: wallSideCol, leftColor: wallCol
      });
      iso.drawBox(x, y + doorOffset + doorW, z0, wallThick + 0.01, seg2Len, 0.08, '#7c5335');

      // Doorway Frame
      const frameCol = '#1e293b';
      const frameThick = 0.04;
      iso.drawBox(x, y + doorOffset, z0, wallThick, frameThick, doorH, frameCol);
      iso.drawBox(x, y + doorOffset + doorW - frameThick, z0, wallThick, frameThick, doorH, frameCol);
      iso.drawBox(x, y + doorOffset, z0 + doorH - frameThick, wallThick, doorW, frameThick, frameCol);

      // Transom wall above door
      iso.drawBox(x, y + doorOffset, z0 + doorH, wallThick, doorW, wallH - doorH, wallCol, {
        topColor: wallTopCol, rightColor: wallSideCol, leftColor: wallCol
      });

      // Door Panel
      if (dStyle === 'glass-sliding') {
        iso.drawBox(x - 0.02, y + doorOffset - 0.08, z0 + doorH, 0.04, doorW + 0.45, 0.05, '#0f172a');
        const slideShift = isOpen ? -Math.min(seg1Len - 0.08, doorW * 0.82) : 0;
        const panelY = y + doorOffset + slideShift;
        iso.drawBox(x - 0.015, panelY, z0 + 0.04, 0.03, doorW, doorH - 0.06, '#bae6fd', {
          topColor: 'rgba(224,242,254,0.65)',
          rightColor: 'rgba(186,230,253,0.45)',
          leftColor: 'rgba(125,211,252,0.38)',
          stroke: '#1e293b'
        });
        iso.drawBox(x - 0.016, panelY + doorW * 0.5 - 0.015, z0 + 0.04, 0.032, 0.03, doorH - 0.06, '#0f172a');
        iso.drawBox(x - 0.03, panelY + (isOpen ? 0.08 : doorW - 0.12), z0 + 0.82, 0.05, 0.03, 0.45, '#e2e8f0');
      } else if (dStyle === 'wood-hinged') {
        const swingNeg = (obj.rot ?? getObjRotation(obj.id)) >= 2;
        if (isOpen) {
          const swingX = swingNeg ? (x - doorW * 0.88 + wallThick) : x;
          const handleX = swingNeg ? (x - doorW * 0.75 + wallThick) : (x + doorW * 0.75);
          iso.drawBox(swingX, y + doorOffset + 0.04, z0 + 0.04, doorW * 0.88, 0.04, doorH - 0.06, '#9c6b46');
          iso.drawBox(handleX, y + doorOffset + 0.02, z0 + 0.95, 0.08, 0.08, 0.04, '#f59e0b');
        } else {
          iso.drawBox(x + 0.03, y + doorOffset + frameThick, z0 + 0.04, 0.05, doorW - frameThick * 2, doorH - 0.06, '#9c6b46', {
            topColor: '#b07d4f', rightColor: '#7c5335', leftColor: '#b07d4f'
          });
          iso.drawBox(x - 0.01, y + doorOffset + doorW - 0.14, z0 + 0.95, 0.09, 0.08, 0.04, '#f59e0b');
        }
      } else {
        iso.drawBox(x - 0.01, y + doorOffset - 0.02, z0, wallThick + 0.02, doorW + 0.04, 0.06, '#7c5335');
        iso.drawBox(x - 0.01, y + doorOffset + 0.04, z0 + doorH - 0.12, wallThick + 0.02, 0.12, 0.12, '#cbd5e1');
        iso.drawBox(x - 0.01, y + doorOffset + doorW - 0.16, z0 + doorH - 0.12, wallThick + 0.02, 0.12, 0.12, '#cbd5e1');
      }
    }

    // Highlight Door Sub-component & floating interactive pill when door is hovered or wall is selected
    const doorGeo = getPartitionDoorSubbox(obj);
    const isDoorHovered = Boolean(hoveredObject && hoveredObject.id === obj.id && hoveredSubpart === 'partition-door');
    if (doorGeo && (isDoorHovered || isSelected)) {
      const lb = doorGeo.leafBox;
      const pad = 0.04;
      const doorFloorPts = [
        iso.project(lb.x - pad, lb.y - pad, z0 + 0.03),
        iso.project(lb.x + lb.dx + pad, lb.y - pad, z0 + 0.03),
        iso.project(lb.x + lb.dx + pad, lb.y + lb.dy + pad, z0 + 0.03),
        iso.project(lb.x - pad, lb.y + lb.dy + pad, z0 + 0.03)
      ];
      iso.drawPoly(
        doorFloorPts,
        isDoorHovered ? 'rgba(52, 211, 153, 0.36)' : 'rgba(56, 189, 248, 0.20)',
        isDoorHovered ? '#10b981' : '#38bdf8',
        isDoorHovered ? 2.5 : 1.6
      );

      // Floating pill above the doorway opening / door leaf so user knows clicking the door toggles it directly
      const anchorBox = (isOpen && dStyle !== 'open-arch') ? doorGeo.frameBox : lb;
      const badgeAnchor = iso.project(
        anchorBox.x + anchorBox.dx * 0.5,
        anchorBox.y + anchorBox.dy * 0.5,
        z0 + doorH + 0.24
      );
      const badgeText = dStyle === 'open-arch'
        ? '✨ 穿透拱門'
        : (isOpen ? '🚪 點擊門扇：關門' : '🚪 點擊門扇：開門');
      roomCtx.save();
      roomCtx.font = '700 11px "Noto Sans TC", sans-serif';
      const tw = roomCtx.measureText(badgeText).width;
      const bw = tw + 16, bh = 22;
      roomCtx.fillStyle = isDoorHovered ? 'rgba(6, 95, 70, 0.94)' : 'rgba(15, 23, 42, 0.86)';
      roomCtx.strokeStyle = isDoorHovered ? '#34d399' : '#38bdf8';
      roomCtx.lineWidth = 1.5;
      roomCtx.beginPath();
      roomCtx.roundRect(badgeAnchor.x - bw * 0.5, badgeAnchor.y - bh * 0.5, bw, bh, 11);
      roomCtx.fill();
      roomCtx.stroke();
      roomCtx.fillStyle = '#f8fafc';
      roomCtx.textAlign = 'center';
      roomCtx.textBaseline = 'middle';
      roomCtx.fillText(badgeText, badgeAnchor.x, badgeAnchor.y + 0.5);
      roomCtx.restore();
    }
    return;
  }
}

// ─── 3B. ORIENTED 3D CHARACTER RENDERER & AUTONOMOUS COMPANION AI (360° Turning) ───
function lerpAngleShortest(cur, target, t) {
  let diff = ((target - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return cur + diff * Math.min(1, t);
}

// Companion autonomous agents (active whenever people >= 2)
const companionAgents = [
  {
    id: 'comp-1',
    name: '小雅',
    x: 2.35,
    y: 4.35,
    angle: 0.45,
    targetAngle: 0.45,
    targetX: 3.6,
    targetY: 2.8,
    isMoving: false,
    shirtCol: '#e07a5f',
    pantsCol: '#3d405b',
    hairCol: '#5c3317',
    hasPonytail: true,
    blinkSeed: 1300,
    activeAct: null, // { icon, label, startAt, duration, lookX, lookY }
    nextDecisionAt: 800
  },
  {
    id: 'comp-2',
    name: '樂樂',
    x: 6.1,
    y: 4.8,
    angle: 2.2,
    targetAngle: 2.2,
    targetX: null,
    targetY: null,
    isMoving: false,
    shirtCol: '#f59e0b',
    pantsCol: '#334155',
    hairCol: '#292524',
    hasPonytail: false,
    blinkSeed: 2500,
    activeAct: null,
    nextDecisionAt: 1600
  }
];

let lastPlayerInputAt = performance.now();

// Helper to compute & draw an oriented 3D box rotated by (angle) around (cx, cy)
function createOrientedPart(iso, cx, cy, zBase, angle, f0, s0, z0, df, ds, dz, baseColor, opts = {}) {
  const fx = Math.cos(angle);
  const fy = Math.sin(angle);
  const rx = -fy;
  const ry = fx;

  const toWorld = (f, s, z) => ({
    x: cx + f * fx + s * rx,
    y: cy + f * fy + s * ry,
    z: zBase + z
  });

  const cMid = toWorld(f0 + df * 0.5, s0 + ds * 0.5, z0 + dz * 0.5);
  const sortDepth = iso.project(cMid.x, cMid.y, cMid.z).depth + (z0 + dz * 0.5) * 0.28 + (opts.priority || 0);

  return {
    depth: sortDepth,
    draw() {
      const w00 = toWorld(f0, s0, z0);
      const w10 = toWorld(f0 + df, s0, z0);
      const w11 = toWorld(f0 + df, s0 + ds, z0);
      const w01 = toWorld(f0, s0 + ds, z0);

      const p000 = iso.project(w00.x, w00.y, zBase + z0);
      const p100 = iso.project(w10.x, w10.y, zBase + z0);
      const p110 = iso.project(w11.x, w11.y, zBase + z0);
      const p010 = iso.project(w01.x, w01.y, zBase + z0);

      const p001 = iso.project(w00.x, w00.y, zBase + z0 + dz);
      const p101 = iso.project(w10.x, w10.y, zBase + z0 + dz);
      const p111 = iso.project(w11.x, w11.y, zBase + z0 + dz);
      const p011 = iso.project(w01.x, w01.y, zBase + z0 + dz);

      const stroke = opts.stroke !== undefined ? opts.stroke : 'rgba(40,30,20,0.16)';
      const faces = [
        {
          // Front (+F)
          depth: (p100.depth + p110.depth + p111.depth + p101.depth) * 0.25,
          pts: [p100, p110, p111, p101],
          col: shadeHex(baseColor, Math.round((fx * 0.5 + fy * 0.5) * 10 - 4))
        },
        {
          // Back (-F)
          depth: (p000.depth + p010.depth + p011.depth + p001.depth) * 0.25,
          pts: [p010, p000, p001, p011],
          col: shadeHex(baseColor, Math.round((-fx * 0.5 - fy * 0.5) * 10 - 14))
        },
        {
          // Right (+S)
          depth: (p010.depth + p110.depth + p111.depth + p011.depth) * 0.25,
          pts: [p110, p010, p011, p111],
          col: shadeHex(baseColor, Math.round((rx * 0.5 + ry * 0.5) * 10 - 10))
        },
        {
          // Left (-S)
          depth: (p000.depth + p100.depth + p101.depth + p001.depth) * 0.25,
          pts: [p000, p100, p101, p001],
          col: shadeHex(baseColor, Math.round((-rx * 0.5 - ry * 0.5) * 10 - 10))
        }
      ];

      // Sort 4 vertical faces back-to-front and draw the 2 camera-facing ones
      faces.sort((a, b) => a.depth - b.depth);
      faces.slice(2).forEach(f => iso.drawPoly(f.pts, f.col, stroke, 0.65));

      // Top face (+Z)
      const topCol = opts.topColor || shadeHex(baseColor, 14);
      iso.drawPoly([p001, p101, p111, p011], topCol, stroke, 0.65);
    }
  };
}


function getCharacterAgeProfile(isMainPlayer, compAgent, stage) {
  const s = stage || simState.stage || 'starter';
  if (s === 'senior') {
    return {
      ageGroup: 'senior',
      age: isMainPlayer ? 70 : (compAgent?.id === 'comp-2' ? 38 : 68),
      title: isMainPlayer ? '小日爺爺' : (compAgent?.id === 'comp-2' ? '樂樂 (長子)' : '小雅奶奶'),
      subLabel: '樂齡長者',
      hairCol: '#cbd5e1', // Silver white hair
      hairSilverTemple: '#e2e8f0',
      shirtCol: isMainPlayer ? '#6d28d9' : (compAgent?.id === 'comp-2' ? '#047857' : '#9333ea'), // Warm soft knit
      pantsCol: '#475569',
      skinCol: '#ebd0b9', // Mature gentle skin
      hasGlasses: true, // 👓 Silver reading glasses
      hasCane: isMainPlayer || compAgent?.id === 'comp-1', // 🦯 Walking cane
      hasSilverEyebrows: true,
      stoopOffsetZ: -0.035, // Gentle elderly spine curve
      stoopOffsetF: 0.04,
      walkSpeedFactor: 0.82
    };
  } else if (s === 'family') {
    return {
      ageGroup: 'family',
      age: isMainPlayer ? 48 : (compAgent?.id === 'comp-2' ? 16 : 46),
      title: isMainPlayer ? '小日' : (compAgent?.id === 'comp-2' ? '樂樂' : '小雅'),
      subLabel: '壯年階段',
      hairCol: isMainPlayer ? '#382f2d' : (compAgent?.id === 'comp-2' ? '#292524' : '#4a3728'),
      hairSilverTemple: isMainPlayer ? '#94a3b8' : null, // Subtle silver temples
      shirtCol: isMainPlayer ? '#2563eb' : (compAgent?.id === 'comp-2' ? '#f59e0b' : '#b45309'),
      pantsCol: '#334155',
      skinCol: '#f3c697',
      hasGlasses: false,
      hasCane: false,
      hasSilverEyebrows: false,
      stoopOffsetZ: 0,
      stoopOffsetF: 0,
      walkSpeedFactor: 0.96
    };
  } else {
    // starter: young adult
    return {
      ageGroup: 'starter',
      age: isMainPlayer ? 30 : (compAgent?.id === 'comp-2' ? 7 : 28),
      title: isMainPlayer ? '小日' : (compAgent?.id === 'comp-2' ? '樂樂' : '小雅'),
      subLabel: '青年階段',
      hairCol: isMainPlayer ? '#3f2e21' : (compAgent?.id === 'comp-2' ? '#1c1917' : '#5c3317'),
      hairSilverTemple: null,
      shirtCol: isMainPlayer ? '#527464' : (compAgent?.id === 'comp-2' ? '#f59e0b' : '#e07a5f'),
      pantsCol: isMainPlayer ? '#475569' : '#3d405b',
      skinCol: '#f3c697',
      hasGlasses: false,
      hasCane: false,
      hasSilverEyebrows: false,
      stoopOffsetZ: 0,
      stoopOffsetF: 0,
      walkSpeedFactor: 1.0
    };
  }
}

// Draws a lively, directional 3D Character Model that turns toward its movement/interaction direction
function draw3DCharacter(iso, px, py, now, isMainPlayer = true, compAgent = null) {
  const isMoving = isMainPlayer
    ? (roomKeys.size > 0 || simState.player.targetX !== null)
    : Boolean(compAgent && compAgent.isMoving);

  const actState = isMainPlayer ? activeInteraction : (compAgent ? compAgent.activeAct : null);
  const isInteracting = Boolean(actState && (now - actState.startAt < actState.duration));

  // Dynamic Age Profile based on current life stage (Starter 25~40 -> Family 40~65 -> Senior 65+)
  const ageProfile = getCharacterAgeProfile(isMainPlayer, compAgent, simState.stage);

  // Idle subtle head-turn look-around when standing still
  const baseAngle = isMainPlayer
    ? (simState.player.angle ?? 0.85)
    : (compAgent ? compAgent.angle : 0.45);
  const idleSway = (!isMoving && !isInteracting) ? Math.sin((now + (isMainPlayer ? 0 : 900)) / 1400) * 0.14 : 0;
  const angle = baseAngle + idleSway;

  const stridePhase = (now + (isMainPlayer ? 0 : 350)) / 92 * ageProfile.walkSpeedFactor;
  // Ease between idle and walking so limbs settle instead of snapping to rest
  const blendKey = isMainPlayer ? simState.player : compAgent;
  let mb = isMoving ? 1 : 0;
  if (blendKey) {
    const st = charMoveBlend.get(blendKey) || { v: mb, t: now };
    const k = 1 - Math.exp(-Math.max(0, Math.min(0.1, (now - st.t) / 1000)) * 10);
    st.v += (mb - st.v) * k;
    st.t = now;
    charMoveBlend.set(blendKey, st);
    mb = st.v;
  }
  const legSwing = Math.sin(stridePhase) * 0.14 * mb;
  const armSwing = Math.sin(stridePhase) * 0.16 * mb + Math.sin(now / 700) * 0.025 * (1 - mb);
  const leftLift = Math.max(0, Math.sin(stridePhase)) * 0.065 * mb;
  const rightLift = Math.max(0, -Math.sin(stridePhase)) * 0.065 * mb;
  const idleBob = isInteracting ? Math.abs(Math.sin(now / 150)) * 0.035 : Math.sin(now / 520) * 0.02;
  const bob = Math.abs(Math.sin(stridePhase)) * 0.055 * mb + idleBob * (1 - mb);
  const zBase = bob + (ageProfile.stoopOffsetZ || 0);

  // Ground shadow
  iso.drawShadow(px - 0.22, py - 0.22, 0.44, 0.44, 0.24);

  const shirtCol = ageProfile.shirtCol;
  const pantsCol = ageProfile.pantsCol;
  const hairCol = ageProfile.hairCol;
  const skinCol = ageProfile.skinCol;
  const stoopF = ageProfile.stoopOffsetF || 0; // Gentle forward stoop for elderly posture

  const parts = [];
  const addPart = (f0, s0, z0, df, ds, dz, col, opts) => {
    parts.push(createOrientedPart(iso, px, py, zBase, angle, f0, s0, z0, df, ds, dz, col, opts));
  };

  // 1. Two-tone Sneakers & Legs (swing along forward axis F!)
  // Left shoe & leg
  addPart(-0.07 + legSwing, -0.15, leftLift, 0.19, 0.13, 0.09, '#f8fafc');
  addPart(-0.06 + legSwing, -0.145, leftLift + 0.05, 0.15, 0.12, 0.07, ageProfile.ageGroup === 'senior' ? '#334155' : (isMainPlayer ? '#334155' : '#9a3412'));
  addPart(-0.07 + legSwing * 0.75, -0.145, leftLift + 0.11, 0.14, 0.12, 0.31, pantsCol);

  // Right shoe & leg
  addPart(-0.07 - legSwing, 0.02, rightLift, 0.19, 0.13, 0.09, '#f8fafc');
  addPart(-0.06 - legSwing, 0.025, rightLift + 0.05, 0.15, 0.12, 0.07, ageProfile.ageGroup === 'senior' ? '#334155' : (isMainPlayer ? '#334155' : '#9a3412'));
  addPart(-0.07 - legSwing * 0.75, 0.025, rightLift + 0.11, 0.14, 0.12, 0.31, pantsCol);

  // 2. Waist Belt & Torso (with slight elderly stoop lean when senior!)
  addPart(-0.12 + stoopF * 0.5, -0.17, 0.40, 0.24, 0.34, 0.06, '#292524');
  addPart(-0.12 + stoopF, -0.17, 0.45, 0.24, 0.34, 0.44, shirtCol);
  // Front collar / cardigan detail (+F side)
  addPart(0.09 + stoopF, -0.08, 0.76, 0.045, 0.16, 0.12, ageProfile.ageGroup === 'senior' ? '#e2e8f0' : '#faf6ee', { priority: 0.02 });
  // Back sling pack or warm cardigan accent (-F side)
  addPart(-0.18 + stoopF, -0.12, 0.50, 0.06, 0.24, 0.28, ageProfile.ageGroup === 'senior' ? shadeHex(shirtCol, -12) : (isMainPlayer ? '#b07d4f' : '#f4a261'));

  // 3. Animated Arms & Hands (+ Walking Cane for Seniors!)
  const actWave = isInteracting ? Math.sin(now / 95) * 0.08 : 0;
  const leftArmF = isInteracting ? 0.08 + actWave : -0.05 - armSwing + stoopF;
  const rightArmF = isInteracting ? 0.08 - actWave : -0.05 + armSwing + stoopF;
  const armZ = isInteracting ? 0.56 : 0.48;
  const armLenF = isInteracting ? 0.22 : 0.12;
  const armH = isInteracting ? 0.26 : 0.36;

  // Left sleeve, arm & hand
  addPart(leftArmF, -0.26, armZ, armLenF, 0.09, armH, skinCol);
  addPart(leftArmF - 0.01, -0.265, 0.72, 0.13, 0.10, 0.15, shadeHex(shirtCol, -6));
  // Right sleeve, arm & hand
  addPart(rightArmF, 0.17, armZ, armLenF, 0.09, armH, skinCol);
  addPart(rightArmF - 0.01, 0.165, 0.72, 0.13, 0.10, 0.15, shadeHex(shirtCol, -6));

  // 🦯 Senior Walking Cane in right hand!
  if (ageProfile.hasCane && !isInteracting) {
    const caneSwing = legSwing * 0.6;
    addPart(rightArmF + 0.12 + caneSwing, 0.20, 0.02, 0.04, 0.04, 0.72, '#92400e'); // Polished wooden cane shaft
    addPart(rightArmF + 0.09 + caneSwing, 0.18, 0.72, 0.09, 0.06, 0.06, '#d97706'); // Golden curved handle
  }

  // 4. Neck & Head
  addPart(-0.05 + stoopF * 1.2, -0.06, 0.88, 0.10, 0.12, 0.06, skinCol);
  addPart(-0.14 + stoopF * 1.4, -0.15, 0.92, 0.28, 0.30, 0.31, skinCol, { priority: 0.05 });
  // Left & Right Ears
  addPart(-0.03 + stoopF * 1.4, -0.18, 1.02, 0.07, 0.04, 0.09, shadeHex(skinCol, -6));
  addPart(-0.03 + stoopF * 1.4, 0.14, 1.02, 0.07, 0.04, 0.09, shadeHex(skinCol, -6));

  // 5. Expressive Face: Blinking Eyes, Rosy Cheeks, Glasses & Eyebrows
  const blinkSeed = isMainPlayer ? 400 : (compAgent?.blinkSeed || 1300);
  const isBlinking = ((now + blinkSeed) % 3400) < 140;
  const eyeH = isBlinking ? 0.018 : (ageProfile.ageGroup === 'senior' ? 0.055 : 0.065);
  const eyeZ = isBlinking ? 1.06 : 1.04;
  const headFX = 0.125 + stoopF * 1.4;

  // Left & Right Eyes
  addPart(headFX, -0.105, eyeZ, 0.03, 0.048, eyeH, '#1e293b', { stroke: null, priority: 0.09 });
  addPart(headFX, 0.057, eyeZ, 0.03, 0.048, eyeH, '#1e293b', { stroke: null, priority: 0.09 });

  // Eyebrows (Silver eyebrows for seniors, subtle eyebrows for others)
  const browCol = ageProfile.hasSilverEyebrows ? '#cbd5e1' : shadeHex(hairCol, -10);
  addPart(headFX + 0.005, -0.115, 1.11, 0.025, 0.06, 0.025, browCol, { stroke: null, priority: 0.10 });
  addPart(headFX + 0.005, 0.055, 1.11, 0.025, 0.06, 0.025, browCol, { stroke: null, priority: 0.10 });

  // 👓 Reading Glasses for Seniors!
  if (ageProfile.hasGlasses) {
    // Left & Right round frame
    addPart(headFX + 0.015, -0.12, 1.02, 0.025, 0.075, 0.085, '#94a3b8', { stroke: '#475569', priority: 0.11 });
    addPart(headFX + 0.015, 0.045, 1.02, 0.025, 0.075, 0.085, '#94a3b8', { stroke: '#475569', priority: 0.11 });
    // Bridge between lenses
    addPart(headFX + 0.015, -0.045, 1.06, 0.02, 0.09, 0.02, '#94a3b8', { stroke: '#475569', priority: 0.11 });
  }

  // Rosy blush / warm smile cheeks
  addPart(headFX - 0.003, -0.125, 0.98, 0.025, 0.05, 0.038, ageProfile.ageGroup === 'senior' ? '#e29578' : '#f48c8c', { stroke: null, priority: 0.08 });
  addPart(headFX - 0.003, 0.075, 0.98, 0.025, 0.05, 0.038, ageProfile.ageGroup === 'senior' ? '#e29578' : '#f48c8c', { stroke: null, priority: 0.08 });

  // 6. Hair & Hairstyle (Silver Crown & Bun for Seniors!)
  const headCenterF = stoopF * 1.4;
  addPart(-0.16 + headCenterF, -0.17, 1.17, 0.32, 0.34, 0.11, hairCol, { priority: 0.12 }); // Top crown
  addPart(0.08 + headCenterF, -0.16, 1.11, 0.085, 0.32, 0.08, hairCol, { priority: 0.11 }); // Front bangs
  addPart(-0.17 + headCenterF, -0.165, 0.95, 0.12, 0.33, 0.24, hairCol, { priority: 0.06 }); // Back hair cover
  addPart(-0.08 + headCenterF, -0.175, 1.04, 0.16, 0.04, 0.15, hairCol, { priority: 0.07 }); // Left sideburn
  addPart(-0.08 + headCenterF, 0.135, 1.04, 0.16, 0.04, 0.15, hairCol, { priority: 0.07 }); // Right sideburn

  // Salt & Pepper silver temple streaks for Family stage
  if (ageProfile.hairSilverTemple) {
    addPart(-0.04 + headCenterF, -0.18, 1.06, 0.10, 0.035, 0.09, ageProfile.hairSilverTemple, { priority: 0.08 });
    addPart(-0.04 + headCenterF, 0.145, 1.06, 0.10, 0.035, 0.09, ageProfile.hairSilverTemple, { priority: 0.08 });
  }

  if (!isMainPlayer) {
    if (ageProfile.ageGroup === 'senior') {
      // Elegant silver grandma bun on back of head with pearl clip!
      addPart(-0.24 + headCenterF, -0.07, 1.06, 0.11, 0.14, 0.14, hairCol, { priority: 0.08 });
      addPart(-0.25 + headCenterF, -0.02, 1.12, 0.04, 0.05, 0.04, '#ffffff', { priority: 0.09 }); // Pearl hair clip
    } else if (compAgent?.hasPonytail) {
      const tailBounce = isMoving ? Math.sin(stridePhase * 2) * 0.04 : 0;
      addPart(-0.25 + headCenterF, -0.06, 1.03 + tailBounce, 0.10, 0.12, 0.16, hairCol, { priority: 0.07 });
    }
  }

  // Sort all character sub-parts back-to-front for accurate 360-degree rotation!
  parts.sort((a, b) => a.depth - b.depth);
  parts.forEach(p => p.draw());

  // 7. Overhead Plumbob & Status / Action Bubble
  const cz = zBase + 1.48 + Math.sin(now / 300) * 0.05;
  if (isMainPlayer) {
    const mood = getSimMood();
    const crystalCol = mood.score >= 70 ? '#4ade80' : mood.score >= 45 ? '#facc15' : '#f87171';
    iso.drawBox(px - 0.065, py - 0.065, cz, 0.13, 0.13, 0.17, crystalCol, { stroke: '#ffffff' });
  }

  const headPt = iso.project(px, py, cz + (isMainPlayer ? 0.26 : 0.08));
  roomCtx.save();
  if (isInteracting && actState) {
    const prog = Math.min(1, (now - actState.startAt) / actState.duration);
    const actObj = isMainPlayer ? simActions.find(a => a.id === actState.actionId) : null;
    const icon = actState.icon || (actObj ? actObj.icon : '⚡');
    const bx = headPt.x, by = headPt.y - 24;
    roomCtx.fillStyle = 'rgba(255, 254, 250, 0.95)';
    roomCtx.beginPath();
    roomCtx.arc(bx, by, 17, 0, Math.PI * 2);
    roomCtx.fill();
    roomCtx.strokeStyle = '#e2d9c8';
    roomCtx.lineWidth = 3.2;
    roomCtx.beginPath();
    roomCtx.arc(bx, by, 17, 0, Math.PI * 2);
    roomCtx.stroke();
    roomCtx.strokeStyle = isMainPlayer ? '#527464' : '#e07a5f';
    roomCtx.beginPath();
    roomCtx.arc(bx, by, 17, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    roomCtx.stroke();
    roomCtx.font = '14px sans-serif';
    roomCtx.textAlign = 'center';
    roomCtx.textBaseline = 'middle';
    roomCtx.fillText(icon, bx, by + 1);

    if (actState.label) {
      roomCtx.font = '700 10.5px "Noto Sans TC", sans-serif';
      const lw = roomCtx.measureText(actState.label).width + 12;
      roomCtx.fillStyle = isMainPlayer ? 'rgba(82, 116, 100, 0.92)' : 'rgba(180, 83, 9, 0.9)';
      roomCtx.beginPath();
      roomCtx.roundRect(bx - lw / 2, by - 36, lw, 16, 8);
      roomCtx.fill();
      roomCtx.fillStyle = '#ffffff';
      roomCtx.fillText(actState.label, bx, by - 27);
    }
  } else {
    roomCtx.font = '700 11px "Noto Sans TC", sans-serif';
    roomCtx.textAlign = 'center';
    const tagText = ageProfile.title;
    const tw = roomCtx.measureText(tagText).width + 12;
    roomCtx.fillStyle = isMainPlayer ? 'rgba(40, 32, 24, 0.78)' : 'rgba(124, 45, 18, 0.78)';
    roomCtx.beginPath();
    roomCtx.roundRect(headPt.x - tw / 2, headPt.y - 16, tw, 18, 9);
    roomCtx.fill();
    roomCtx.fillStyle = '#fffaf0';
    roomCtx.fillText(tagText, headPt.x, headPt.y - 3);
  }
  roomCtx.restore();
}

// Updates autonomous AI for companions (and idle main player when unpaused)
function updateAutonomousCharacters(now, dt) {
  const { w: roomW, d: roomD } = getRoomDimensions(simState.profile?.area || 18);
  const activeCount = Math.max(0, Math.min(companionAgents.length, (simState.profile.people || 2) - 1));
  const sceneObjs = getSceneObjects();
  const v4List = (typeof V4_SHOP_CATALOG !== 'undefined' && Array.isArray(simState.v4Items))
    ? simState.v4Items.map(id => V4_SHOP_CATALOG.find(m => m.id === id)).filter(Boolean)
    : [];

  for (let i = 0; i < activeCount; i++) {
    const comp = companionAgents[i];

    // Check if active interaction finished
    if (comp.activeAct && now - comp.activeAct.startAt >= comp.activeAct.duration) {
      if (comp.activeAct.rewardMood) {
        simState.needs.social = clampNeed(simState.needs.social + 2);
        simState.needs.fun = clampNeed(simState.needs.fun + 2);
        spawnFloatingText(comp.activeAct.popText || '💬+2', comp.x, comp.y, 1.55, '#fde047');
      }
      comp.activeAct = null;
      comp.nextDecisionAt = now + 1100 + Math.random() * 1400;
    }

    // Move toward target if walking (with Doorway Waypoint Navigation & Auto-Door Opening)
    if (comp.targetX !== null && comp.targetY !== null) {
      const dx = comp.targetX - comp.x;
      const dy = comp.targetY - comp.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.18) {
        if (comp.waypoints && comp.waypoints.length > 0) {
          const nextWp = comp.waypoints.shift();
          comp.x = comp.targetX;
          comp.y = comp.targetY;
          comp.targetX = nextWp.x;
          comp.targetY = nextWp.y;
          checkAndAutoOpenDoorways(comp.x, comp.y, comp.name, 0.52);
        } else {
          comp.x = comp.targetX;
          comp.y = comp.targetY;
          comp.targetX = null;
          comp.targetY = null;
          comp.waypoints = [];
          comp.isMoving = false;
          if (comp.pendingAct) {
            comp.activeAct = {
              ...comp.pendingAct,
              startAt: now
            };
            if (Number.isFinite(comp.pendingAct.lookX) && Number.isFinite(comp.pendingAct.lookY)) {
              comp.targetAngle = Math.atan2(comp.pendingAct.lookY - comp.y, comp.pendingAct.lookX - comp.x);
            }
            comp.pendingAct = null;
          } else {
            comp.nextDecisionAt = now + 1200 + Math.random() * 1500;
          }
        }
      } else {
        comp.isMoving = true;
        const moveSpd = 2.15;
        const targetX = comp.x + (dx / dist) * moveSpd * dt;
        const targetY = comp.y + (dy / dist) * moveSpd * dt;
        const moved = resolveWallCollisions(comp.x, comp.y, targetX, targetY, 0.22, roomW, roomD);
        if (moved.collided && Math.hypot(moved.x - comp.x, moved.y - comp.y) < 0.005) {
          checkAndAutoOpenDoorways(comp.x, comp.y, comp.name, 0.52);
          if (comp.waypoints && comp.waypoints.length > 0) {
            const nextWp = comp.waypoints.shift();
            comp.targetX = nextWp.x;
            comp.targetY = nextWp.y;
          } else {
            comp.targetX = null;
            comp.targetY = null;
            comp.waypoints = [];
            comp.nextDecisionAt = now + 800;
          }
        } else {
          comp.x = moved.x;
          comp.y = moved.y;
          comp.targetAngle = Math.atan2(dy, dx);
        }
      }
    } else {
      comp.isMoving = false;
      // Pick next autonomous destination & interaction when timer fires
      if (!comp.activeAct && now >= comp.nextDecisionAt) {
        const candidates = [];

        // 1. Placed DLCs & Base Furniture
        sceneObjs.forEach(obj => {
          const actMap = {
            work: { icon: '💻', label: '遠端協作中', popText: '✨協作+§6' },
            family: { icon: '🍳', label: '備料料理中', popText: '🥪料理+飽足' },
            storage: { icon: '📦', label: '整理收納櫃', popText: '✨整潔UP' },
            shower: { icon: '🫧', label: '整理衛浴', popText: '🫧清爽' },
            safe: { icon: '🛡️', label: '檢查感應燈', popText: '🛡️安全確認' },
            sofa: { icon: '🛋️', label: '沙發閱讀放鬆', popText: '🎨心情+3' },
            tv: { icon: '📺', label: '觀看影音節目', popText: '🎵娛樂+3' },
            bed: { icon: '🛏️', label: '鋪床整理臥室', popText: '⚡舒適UP' },
            cart: { icon: '☕', label: '沖泡手沖咖啡', popText: '☕香氣滿滿' },
            plant: { icon: '🌿', label: '幫植栽澆水', popText: '🌿綠意療癒' }
          };
          const meta = actMap[obj.id] || { icon: '✨', label: '使用家具', popText: '✨+2' };
          candidates.push({
            tx: Math.max(0.85, Math.min(roomW - 0.85, obj.ix)),
            ty: Math.max(1.2, Math.min(roomD - 0.7, obj.iy)),
            lookX: obj.x + obj.dx * 0.5,
            lookY: obj.y + obj.dy * 0.5,
            icon: meta.icon,
            label: meta.label,
            popText: meta.popText,
            duration: 2600 + Math.random() * 900,
            rewardMood: true
          });
        });

        // 2. Placed V4 Shop Items
        v4List.forEach(item => {
          if (item.id === 'robot-vac') return;
          const pos = getV4ItemPos(item);
          candidates.push({
            tx: Math.max(0.85, Math.min(roomW - 0.85, pos.x + item.dx * 0.5 + 0.55)),
            ty: Math.max(1.2, Math.min(roomD - 0.7, pos.y + item.dy * 0.5 + 0.55)),
            lookX: pos.x + item.dx * 0.5,
            lookY: pos.y + item.dy * 0.5,
            icon: item.icon,
            label: `體驗${item.name.slice(0, 6)}`,
            popText: `${item.icon}好喜歡!`,
            duration: 2400 + Math.random() * 800,
            rewardMood: true
          });
        });

        // 3. Social wave near Main Player (25% chance)
        if (Math.random() < 0.25) {
          const offsetAngle = Math.random() * Math.PI * 2;
          candidates.push({
            tx: Math.max(0.9, Math.min(roomW - 0.9, simState.player.x + Math.cos(offsetAngle) * 0.85)),
            ty: Math.max(1.2, Math.min(roomD - 0.7, simState.player.y + Math.sin(offsetAngle) * 0.85)),
            lookX: simState.player.x,
            lookY: simState.player.y,
            icon: '👋',
            label: `與${simState.name}寒暄`,
            popText: '💬+3',
            duration: 2100,
            rewardMood: true
          });
        }

        // 4. Empty room exploration points (always available so companion moves even in an empty room!)
        const inspectSpots = [
          { tx: roomW * 0.5, ty: 1.4, lookX: roomW * 0.5, lookY: 0.1, icon: '📐', label: '巡視預埋軌道牆' },
          { tx: 1.35, ty: 1.55, lookX: 1.2, lookY: 0.1, icon: '☀️', label: '欣賞窗外採光' },
          { tx: roomW * 0.32, ty: roomD * 0.62, lookX: roomW * 0.5, lookY: roomD * 0.5, icon: '🔍', label: '構思客廳擺設' },
          { tx: roomW * 0.72, ty: roomD * 0.58, lookX: roomW - 0.5, lookY: roomD * 0.58, icon: '💭', label: '規劃臥室動線' },
          { tx: roomW * 0.5, ty: roomD * 0.68, lookX: simState.player.x, lookY: simState.player.y, icon: '😊', label: '期待新家具到來' }
        ];
        inspectSpots.forEach(s => candidates.push({ ...s, duration: 2200, rewardMood: false }));

        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        if (picked) {
          const path = findRoomPath(comp.x, comp.y, picked.tx, picked.ty);
          comp.waypoints = path.slice(1);
          comp.targetX = path[0].x;
          comp.targetY = path[0].y;
          comp.pendingAct = picked;
        }
      }
    }

    // Smoothly rotate companion angle toward targetAngle
    comp.angle = lerpAngleShortest(comp.angle ?? 0.45, comp.targetAngle ?? 0.45, dt * 10.5);
  }
}

function renderGameRoom(now = performance.now()) {
  if (!roomCtx) return;
  const frameDt = Math.max(0, Math.min(0.1, (now - lastRenderAt) / 1000));
  lastRenderAt = now;
  // Frame-rate independent camera yaw easing (same feel at 60Hz and 144Hz)
  currentYaw += (targetYaw - currentYaw) * (1 - Math.exp(-frameDt * 9));

  const W = roomCanvas.width;
  const H = roomCanvas.height;

  const isNight = simState.minutes >= 1200 || simState.minutes < 360;
  const isDusk = !isNight && (simState.minutes >= 1020 && simState.minutes < 1200);
  const isBlueprint = Boolean(simState.hardscape?.blueprintMode);

  // Crossfade lighting periods: snapshot the previous frame before it is cleared
  const periodKey = isBlueprint ? 'bp' : isNight ? 'night' : isDusk ? 'dusk' : 'day';
  if (lastPeriodKey && periodKey !== lastPeriodKey) {
    const snap = periodFade?.canvas || document.createElement('canvas');
    snap.width = W; snap.height = H;
    snap.getContext('2d').drawImage(roomCanvas, 0, 0);
    periodFade = { canvas: snap, startAt: now };
  }
  lastPeriodKey = periodKey;
  roomCtx.clearRect(0, 0, W, H);

  // Ambient studio backdrop gradient (Supports Day / Dusk / Night / 2D Blueprint)
  const bgGrad = roomCtx.createLinearGradient(0, 0, 0, H);
  if (isBlueprint) {
    bgGrad.addColorStop(0, '#0c4a6e');
    bgGrad.addColorStop(1, '#082f49');
  } else if (isNight) {
    bgGrad.addColorStop(0, '#1b2233');
    bgGrad.addColorStop(1, '#0b0f1a');
  } else if (isDusk) {
    bgGrad.addColorStop(0, '#d39a6a');
    bgGrad.addColorStop(0.55, '#a8674a');
    bgGrad.addColorStop(1, '#5c3a2c');
  } else {
    bgGrad.addColorStop(0, '#f4efe5');
    bgGrad.addColorStop(1, '#e2d8c6');
  }
  roomCtx.fillStyle = bgGrad;
  roomCtx.fillRect(0, 0, W, H);
  if (!isBlueprint) {
    // Soft studio spotlight pooling behind the room model
    const spot = roomCtx.createRadialGradient(W * 0.5, H * 0.55, 20, W * 0.5, H * 0.55, W * 0.62);
    spot.addColorStop(0, isNight ? 'rgba(120,140,190,0.16)' : 'rgba(255,248,232,0.55)');
    spot.addColorStop(1, 'rgba(255,248,232,0)');
    roomCtx.fillStyle = spot;
    roomCtx.fillRect(0, 0, W, H);
  }

  // Dynamic Physical Room Dimensions & Grid System based on 坪數!
  const roomDim = getRoomDimensions(simState.profile.area || 18);
  const roomW = roomDim.w;
  const roomD = roomDim.d;
  const wallH = 2.65;

  const isShaking = now < renovShakeUntil;
  const shakeX = isShaking ? (Math.random() - 0.5) * 9 : 0;
  const shakeY = isShaking ? (Math.random() - 0.5) * 7 : 0;

  // Consistent human/furniture scale: grid tiles truly expand, not just camera zooming!
  const roomCamScale = isBlueprint ? 48 : (roomW >= 12 ? 43 : roomW >= 10 ? 46 : roomW <= 6 ? 49 : 47);
  const iso = createIsoProjector(roomCtx, {
    yaw: isBlueprint ? 0.0 : currentYaw,
    pitch: isBlueprint ? 1.42 : 0.54,
    scale: roomCamScale,
    cx: roomW * 0.5,
    cy: roomD * 0.5,
    ox: W * 0.5 + shakeX,
    oy: (isBlueprint ? H * 0.52 : H * 0.61) + shakeY
  });
  window._currentRoomIso = iso;

  // 1. 3D Floor Foundation Slab
  iso.drawBox(0, 0, -0.22, roomW, roomD, 0.22, isNight ? '#7c6248' : '#b88b61');

  // Modular Architectural Floor Tile Grid (格數隨坪數真正增加：5坪約20格、18坪約54格、32坪達104格！)
  const stepX = roomDim.tileW || 1.0;
  const stepY = roomDim.tileD || 1.0;
  let totalTileCount = 0;

  for (let gx = 0; gx < roomW - 0.05; gx += stepX) {
    const curStepX = Math.min(stepX, roomW - gx);
    for (let gy = 0; gy < roomD - 0.05; gy += stepY) {
      const curStepY = Math.min(stepY, roomD - gy);
      totalTileCount++;
      const isAlt = (Math.floor(gx / stepX) + Math.floor(gy / stepY)) % 2 === 0;
      const tileCol = isAlt
        ? (isNight ? '#8b6c4f' : '#d5aa7e')
        : (isNight ? '#826447' : '#caa074');
      const pts = [
        iso.project(gx, gy, 0),
        iso.project(gx + curStepX, gy, 0),
        iso.project(gx + curStepX, gy + curStepY, 0),
        iso.project(gx, gy + curStepY, 0)
      ];
      iso.drawPoly(pts, tileCol, isNight ? 'rgba(30,20,10,0.22)' : 'rgba(90,65,40,0.18)', 0.75);

      // Subtle architectural sub-plank lines inside each 1m tile
      if (curStepY >= 0.7) {
        const midY = gy + curStepY * 0.5;
        const linePts = [iso.project(gx, midY, 0.002), iso.project(gx + curStepX, midY, 0.002)];
        iso.drawPoly(linePts, null, 'rgba(60,40,20,0.08)', 0.5);
      }
    }
  }

  // 1b. The Sims 4 Architectural 0.5m Building Grid & Magnetic Feedback
  if (simState.showGrid !== false) {
    const isDragging = Boolean(draggingFloorObj || draggingModule);
    const gridMajorStroke = isBlueprint ? 'rgba(56,189,248,0.45)' : (isDragging ? 'rgba(2,132,199,0.38)' : 'rgba(160,130,95,0.28)');
    const gridMinorStroke = isBlueprint ? 'rgba(56,189,248,0.22)' : (isDragging ? 'rgba(2,132,199,0.20)' : 'rgba(160,130,95,0.14)');
    const subStep = 0.5;

    // Grid lines along X (0.5m intervals)
    for (let x = 0; x <= roomW + 0.01; x += subStep) {
      const isMajor = Math.abs(x - Math.round(x)) < 0.05;
      const p1 = iso.project(x, 0, 0.003);
      const p2 = iso.project(x, roomD, 0.003);
      iso.drawPoly([p1, p2], null, isMajor ? gridMajorStroke : gridMinorStroke, isMajor ? 1.0 : 0.6);
    }
    // Grid lines along Y (0.5m intervals)
    for (let y = 0; y <= roomD + 0.01; y += subStep) {
      const isMajor = Math.abs(y - Math.round(y)) < 0.05;
      const p1 = iso.project(0, y, 0.003);
      const p2 = iso.project(roomW, y, 0.003);
      iso.drawPoly([p1, p2], null, isMajor ? gridMajorStroke : gridMinorStroke, isMajor ? 1.0 : 0.6);
    }

    // When dragging an object, highlight the snapped 0.5m magnetic tile under it
    if (draggingFloorObj) {
      const activeObj = getSceneObjects().find(o => o.id === draggingFloorObj.id) || draggingFloorObj;
      const snapX = Math.round(activeObj.x * 2) / 2;
      const snapY = Math.round(activeObj.y * 2) / 2;
      const snapPts = [
        iso.project(snapX, snapY, 0.004),
        iso.project(snapX + 0.5, snapY, 0.004),
        iso.project(snapX + 0.5, snapY + 0.5, 0.004),
        iso.project(snapX, snapY + 0.5, 0.004)
      ];
      iso.drawPoly(snapPts, 'rgba(2,132,199,0.22)', '#0284c7', 1.5);
    }
  }

  // Woven Living Area Rug (clamped to roomW & roomD so it never overflows small 5-ping rooms!)
  const rugY = Math.min(3.1, Math.max(1.6, roomD - 2.3));
  const rugW = Math.min(2.8, roomW - 0.9);
  const rugD = Math.min(2.2, roomD - rugY - 0.25);
  if (rugW > 0.8 && rugD > 0.8) {
    iso.drawBox(0.45, rugY, 0.006, rugW, rugD, 0.02, isNight ? '#8c7a65' : '#e6dcc8');
  }

  // Snap-fit lock ripple: two expanding rings on the floor where a module just clicked in
  snapRings = snapRings.filter(r => now - r.startAt < 900);
  snapRings.forEach(r => {
    [0, 160].forEach(delay => {
      const t = (now - r.startAt - delay) / 740;
      if (t <= 0 || t >= 1) return;
      const rad = r.r * (0.35 + easeOutCubic(t) * 1.1);
      const pts = [];
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const p = iso.project(r.x + Math.cos(a) * rad, r.y + Math.sin(a) * rad, 0.03);
        pts.push(p);
      }
      iso.drawPoly(pts, null, `rgba(196, 140, 82, ${(1 - t) * 0.85})`, 2.4 * (1 - t) + 0.6);
    });
  });

  // 2. 3D Cutaway Back Wall (y = 0) & Left Wall (x = 0) — Supports Sims 4 Wall Modes & X-Ray!
  const xray = Boolean(simState.xrayMode);
  const wallMode = simState.wallMode || 'cutaway';
  const wallColor = isNight ? '#948b7e' : '#f3ede1';
  const curWallH = (wallMode === 'none') ? 0.08 : wallH;

  if (xray) {
    const xOpts = {
      topColor: 'rgba(56, 189, 248, 0.18)',
      rightColor: 'rgba(15, 23, 42, 0.28)',
      leftColor: 'rgba(30, 58, 95, 0.25)',
      stroke: 'rgba(56, 189, 248, 0.55)'
    };
    iso.drawBox(-0.2, -0.2, 0, roomW + 0.2, 0.2, curWallH, '#0f172a', xOpts);
    iso.drawBox(-0.2, 0, 0, 0.2, roomD, curWallH, '#0f172a', xOpts);
    for (let sx = 0.5; sx < roomW; sx += 1.2) {
      iso.drawBox(sx, -0.16, 0, 0.1, 0.12, curWallH - 0.05, '#475569');
    }
    for (let sy = 0.8; sy < roomD; sy += 1.2) {
      iso.drawBox(-0.16, sy, 0, 0.12, 0.1, curWallH - 0.05, '#475569');
    }
    const pipeLen = Math.max(0.8, roomW - 0.4);
    iso.drawBox(0.2, -0.12, 0.38, pipeLen, 0.06, 0.06, '#0ea5e9');
    iso.drawBox(0.2, -0.12, 0.52, pipeLen, 0.06, 0.06, '#f97316');
  } else {
    iso.drawBox(-0.2, -0.2, 0, roomW + 0.2, 0.2, curWallH, wallColor);
    iso.drawBox(-0.2, 0, 0, 0.2, roomD, curWallH, wallColor);
    if (wallMode === 'none') {
      iso.drawBox(-0.2, -0.2, curWallH, roomW + 0.2, 0.2, 0.02, '#994639', { topColor: '#b91c1c' });
      iso.drawBox(-0.2, 0, curWallH, 0.2, roomD, 0.02, '#994639', { topColor: '#b91c1c' });
    }
  }

  // 3. 3D Panoramic Window on Back Wall
  const skyCol = isNight ? '#1d3557' : '#7dd3fc';
  iso.drawBox(0.65, -0.02, 1.05, Math.min(1.35, roomW * 0.32), 0.06, 1.15, skyCol, { leftColor: skyCol });

  // 4. 3D TAYA Base Track System (大雅專利基底軌道與水電匯流槽)
  const isTrackPulsing = now < trackPulseUntil;
  const trackGlow = (xray || isTrackPulsing) ? '#38bdf8' : (isNight && isDlcActive('safe') ? '#a3e635' : '#38bdf8');
  iso.drawBox(0.02, 0.0, 0.92, roomW - 0.1, 0.12, 0.14, xray ? '#0284c7' : '#64748b');
  iso.drawBox(0.05, 0.02, 0.96, roomW - 0.2, 0.14, 0.05, trackGlow);
  iso.drawBox(0.0, 0.12, 0.92, 0.12, roomD - 0.3, 0.14, xray ? '#0284c7' : '#64748b');

  const sceneObjs = getSceneObjects();

  // Glowing Orange Snap-Fit Cleats inside Track (aligned with clamped sceneObjs so never out-of-bounds!)
  if (xray || draggingModule || isTrackPulsing) {
    sceneObjs.forEach(so => {
      if (so.id === 'work' || so.id === 'family') {
        iso.drawBox(so.x + 0.2, 0.0, 0.9, 0.28, 0.18, 0.22, '#f59e0b');
        iso.drawBox(so.x + so.dx - 0.45, 0.0, 0.9, 0.28, 0.18, 0.22, '#f59e0b');
      } else if (so.id === 'storage') {
        iso.drawBox(so.x + 0.2, 0.0, 2.02, Math.min(0.95, so.dx - 0.3), 0.16, 0.18, '#f59e0b');
      } else if (so.id === 'safe') {
        iso.drawBox(0.0, so.y + 0.2, 0.9, 0.18, 0.35, 0.22, '#f59e0b');
      }
    });
  }

  // Upper wall module rail (spans available back wall track and clamped to roomW!)
  const upRailX = Math.min(2.05, 0.65 + Math.min(1.35, roomW * 0.32) + 0.08);
  const upRailW = Math.max(0.8, roomW - upRailX - 0.15);
  iso.drawBox(upRailX, 0.0, 2.05, upRailW, 0.1, 0.1, '#94a3b8');

  // SAFE DLC Glowing Baseboard Nightlight along walls
  if (isDlcActive('safe')) {
    iso.drawBox(0.02, 0.02, 0.03, roomW - 0.1, 0.08, 0.06, '#84cc16');
    iso.drawBox(0.02, 0.02, 0.03, 0.08, roomD - 0.2, 0.06, '#84cc16');
  }

  // 5. Collect & Depth-Sort All 3D Furniture, V4 Props & Characters Together (Zero Z-Order Glitch!)
  const renderables = [];

  // When wallMode is 'full' or 'none': push foreground perimeter walls to renderables with true foreground depth so interior furniture never clips through!
  if (wallMode === 'full') {
    const fgDepthBase = iso.project(roomW + 1, roomD + 1, wallH).depth + 100;
    const fgXOpts = xray ? {
      topColor: 'rgba(56, 189, 248, 0.18)',
      rightColor: 'rgba(15, 23, 42, 0.28)',
      leftColor: 'rgba(30, 58, 95, 0.25)',
      stroke: 'rgba(56, 189, 248, 0.55)'
    } : {};
    const fgCol = xray ? '#0f172a' : wallColor;
    renderables.push({
      depth: fgDepthBase,
      draw: () => iso.drawBox(roomW, -0.2, 0, 0.2, roomD + 0.2, curWallH, fgCol, fgXOpts)
    });
    renderables.push({
      depth: fgDepthBase + 1,
      draw: () => iso.drawBox(-0.2, roomD, 0, roomW + 0.4, 0.2, curWallH, fgCol, fgXOpts)
    });
  } else if (wallMode === 'none') {
    const fgDepthBase = iso.project(roomW + 1, roomD + 1, curWallH).depth + 100;
    renderables.push({
      depth: fgDepthBase,
      draw: () => {
        iso.drawBox(roomW, -0.2, 0, 0.2, roomD + 0.2, curWallH, wallColor);
        iso.drawBox(roomW, -0.2, curWallH, 0.2, roomD + 0.2, 0.02, '#994639', { topColor: '#b91c1c' });
      }
    });
    renderables.push({
      depth: fgDepthBase + 1,
      draw: () => {
        iso.drawBox(-0.2, roomD, 0, roomW + 0.4, 0.2, curWallH, wallColor);
        iso.drawBox(-0.2, roomD, curWallH, roomW + 0.4, 0.2, 0.02, '#994639', { topColor: '#b91c1c' });
      }
    });
  }

  if (typeof drawV4HardscapeAndProps === 'function') {
    drawV4HardscapeAndProps(iso, now, isNight, isDusk, renderables, roomW, roomD);
  }

  // Active Placement / Selection Grid Footprint Preview on Floor
  const activeInspectObj = sceneObjs.find(o => o.id === (draggingFloorObj?.id || draggingModule?.id || selectedObjectId));
  if (activeInspectObj) {
    const pad = 0.06;
    const fPts = [
      iso.project(activeInspectObj.x - pad, activeInspectObj.y - pad, 0.015),
      iso.project(activeInspectObj.x + activeInspectObj.dx + pad, activeInspectObj.y - pad, 0.015),
      iso.project(activeInspectObj.x + activeInspectObj.dx + pad, activeInspectObj.y + activeInspectObj.dy + pad, 0.015),
      iso.project(activeInspectObj.x - pad, activeInspectObj.y + activeInspectObj.dy + pad, 0.015)
    ];
    const isDraggingNow = Boolean(draggingFloorObj || draggingModule);
    const isCollidingNow = isDraggingNow && Boolean(draggingFloorObj?.isColliding || draggingModule?.isColliding);
    iso.drawPoly(
      fPts,
      isCollidingNow ? 'rgba(239, 68, 68, 0.38)' : (isDraggingNow ? 'rgba(56, 189, 248, 0.28)' : 'rgba(100, 136, 121, 0.22)'),
      isCollidingNow ? '#ef4444' : (isDraggingNow ? '#38bdf8' : '#f5c453'),
      isCollidingNow ? 2.6 : 2.2
    );
    if (isCollidingNow) {
      const topPt = iso.project(activeInspectObj.x + activeInspectObj.dx * 0.5, activeInspectObj.y + activeInspectObj.dy * 0.5, 0.85);
      roomCtx.save();
      roomCtx.font = '700 11px "Noto Sans TC", sans-serif';
      roomCtx.fillStyle = '#ef4444';
      roomCtx.textAlign = 'center';
      roomCtx.fillText('⚠️ 碰撞衝突：已貼齊鄰近模組/結構邊界', topPt.x, topPt.y);
      roomCtx.restore();
    }
  }

  sceneObjs.forEach(obj => {
    if (obj.isV4) return; // Rendered with full 3D models inside drawV4HardscapeAndProps
    const zDepth = (obj.z || 0) > 0.1 ? (obj.z * 3.0) : 0;
    const centerDepth = iso.project(obj.x + obj.dx / 2, obj.y + obj.dy / 2, zDepth).depth;
    renderables.push({
      depth: centerDepth,
      draw: () => draw3DFurnitureObject(iso, obj, now, isNight)
    });
  });

  // Main Player 3D Character
  const playerDepth = iso.project(simState.player.x, simState.player.y, 0.05).depth;
  renderables.push({
    depth: playerDepth,
    draw: () => draw3DCharacter(iso, simState.player.x, simState.player.y, now, true, null)
  });

  // Autonomous Companion 3D Character(s) when people >= 2
  const activeCompCount = Math.max(0, Math.min(companionAgents.length, (simState.profile.people || 2) - 1));
  for (let ci = 0; ci < activeCompCount; ci++) {
    const comp = companionAgents[ci];
    const compDepth = iso.project(comp.x, comp.y, 0.05).depth;
    renderables.push({
      depth: compDepth,
      draw: () => draw3DCharacter(iso, comp.x, comp.y, now + ci * 400, false, comp)
    });
  }

  // Sort all 3D objects & characters back-to-front
  renderables.sort((a, b) => a.depth - b.depth);
  renderables.forEach(r => r.draw());

  if (typeof drawV4PostOverlays === 'function') {
    drawV4PostOverlays(iso, now, isNight, isDusk, roomW, roomD);
  }

  // 5B. Volumetric Wall Hitbox Rendering (CAD / High-tech Engine Wireframe — only when showHitbox is enabled)
  const allWallBoxes = getWallHitboxes();
  const isHitboxGloballyOn = Boolean(simState.showHitbox);
  const selWallId = selectedObjectId;
  const hovWallId = hoveredObject?.id;

  if (isHitboxGloballyOn) {
    allWallBoxes.forEach(box => {
      const isTargeted = (box.id === selWallId || box.id === hovWallId);
      const isDoorLeaf = Boolean(box.isDoorLeaf);
      const isOpen = Boolean(box.isOpen);
      let color = '#38bdf8';
      let fillColor = 'rgba(56, 189, 248, 0.12)';
      let strokeColor = '#0284c7';

      if (box.isRoomWall) {
        color = isTargeted ? '#f59e0b' : '#38bdf8';
        fillColor = isTargeted ? 'rgba(245, 158, 11, 0.22)' : 'rgba(56, 189, 248, 0.10)';
        strokeColor = isTargeted ? '#d97706' : '#0284c7';
      } else if (isDoorLeaf) {
        color = isOpen ? '#34d399' : '#f43f5e';
        fillColor = isOpen ? 'rgba(52, 211, 153, 0.20)' : 'rgba(244, 63, 94, 0.20)';
        strokeColor = isOpen ? '#059669' : '#e11d48';
      } else if (box.isPartition) {
        color = isTargeted ? '#a855f7' : '#6366f1';
        fillColor = isTargeted ? 'rgba(168, 85, 247, 0.24)' : 'rgba(99, 102, 241, 0.12)';
        strokeColor = isTargeted ? '#9333ea' : '#4f46e5';
      }

      draw3DHitbox(iso, box, {
        color,
        fillColor,
        strokeColor,
        isSolid: box.isSolid,
        showBadge: true,
        label: box.label,
        dashed: !isTargeted
      });
    });

    // 5C. Furniture & DLC Modular Unit Hitboxes (CAD Wireframe for all active items)
    sceneObjs.forEach(obj => {
      if (obj.isPartition) return; // Handled under partition wall boxes above
      const isTargeted = (obj.id === selWallId || obj.id === hovWallId);
      const fBox = {
        id: obj.id,
        storeKey: obj.storeKey || obj.id,
        x: obj.x,
        y: obj.y,
        z: obj.z || 0,
        dx: obj.dx,
        dy: obj.dy,
        dz: obj.dz || 0.85,
        label: obj.label || '家具模組',
        isSolid: true
      };

      draw3DHitbox(iso, fBox, {
        color: isTargeted ? '#f59e0b' : '#0ea5e9',
        fillColor: isTargeted ? 'rgba(245, 158, 11, 0.24)' : 'rgba(14, 165, 233, 0.12)',
        strokeColor: isTargeted ? '#d97706' : '#0284c7',
        isSolid: true,
        showBadge: true,
        label: fBox.label,
        dashed: !isTargeted
      });
    });
  }

  // 5D. Living Entities Hitboxes (Player, Companions, Robot Vac)
  if (isHitboxGloballyOn) {
    const pBox = {
      id: 'player-hitbox',
      x: simState.player.x - 0.22,
      y: simState.player.y - 0.22,
      z: 0,
      dx: 0.44,
      dy: 0.44,
      dz: 1.65,
      label: '玩家角色碰撞體 (R=0.22m)',
      isSolid: true
    };
    draw3DHitbox(iso, pBox, {
      color: '#10b981',
      fillColor: 'rgba(16, 185, 129, 0.16)',
      strokeColor: '#059669',
      isSolid: true,
      showBadge: true,
      label: pBox.label,
      dashed: false
    });

    for (let ci = 0; ci < activeCompCount; ci++) {
      const comp = companionAgents[ci];
      const compBox = {
        id: `comp-hitbox-${ci}`,
        x: comp.x - 0.22,
        y: comp.y - 0.22,
        z: 0,
        dx: 0.44,
        dy: 0.44,
        dz: 1.65,
        label: `同住成員 #${ci + 1} 碰撞體`,
        isSolid: true
      };
      draw3DHitbox(iso, compBox, {
        color: '#06b6d4',
        fillColor: 'rgba(6, 182, 212, 0.16)',
        strokeColor: '#0891b2',
        isSolid: true,
        showBadge: true,
        label: compBox.label,
        dashed: false
      });
    }

    if (typeof hasV4Item === 'function' && hasV4Item('robot-vac') && typeof robotVacState !== 'undefined') {
      const rv = robotVacState;
      const rvBox = {
        id: 'robot-vac-hitbox',
        x: rv.x - 0.18,
        y: rv.y - 0.18,
        z: 0,
        dx: 0.36,
        dy: 0.36,
        dz: 0.16,
        label: '掃地機器人巡航碰撞體',
        isSolid: true
      };
      draw3DHitbox(iso, rvBox, {
        color: '#a855f7',
        fillColor: 'rgba(168, 85, 247, 0.16)',
        strokeColor: '#9333ea',
        isSolid: true,
        showBadge: true,
        label: rvBox.label,
        dashed: false
      });
    }
  }

  // 6. Draw 3D Floating Label over Hovered Furniture
  if (hoveredObject) {
    const pt = iso.project(
      hoveredObject.x + hoveredObject.dx / 2,
      hoveredObject.y + hoveredObject.dy / 2,
      hoveredObject.dz + 0.35
    );
    roomCtx.save();
    roomCtx.font = '700 12px "Noto Sans TC", sans-serif';
    roomCtx.textAlign = 'center';
    const label = `🖱️ ${hoveredObject.label}`;
    const w = roomCtx.measureText(label).width + 18;
    roomCtx.fillStyle = 'rgba(152, 99, 63, 0.94)';
    roomCtx.beginPath();
    roomCtx.roundRect(pt.x - w / 2, pt.y - 22, w, 24, 8);
    roomCtx.fill();
    roomCtx.fillStyle = '#fffefa';
    roomCtx.fillText(label, pt.x, pt.y - 6);
    roomCtx.restore();
  }

  // 7. Idea A: X-Ray Mode Technical Callout Tags
  if (xray) {
    const xTags = [
      { text: '⚡ L02 隱蔽式 110V/24V 電力匯流槽', x: 4.5, y: 0.0, z: 1.35, col: '#0284c7' },
      { text: '💧 預埋冷熱水給排水快接管路', x: 2.3, y: 0.0, z: 0.55, col: '#0369a1' },
      { text: '🔒 L03 重力自鎖安全卡扣節點', x: 6.1, y: 0.0, z: 1.15, col: '#d97706' }
    ];
    xTags.forEach(t => {
      const pt = iso.project(Math.min(t.x, roomW - 0.8), t.y, t.z);
      roomCtx.save();
      roomCtx.font = '700 10.5px "Noto Sans TC", sans-serif';
      const w = roomCtx.measureText(t.text).width + 14;
      roomCtx.fillStyle = t.col;
      roomCtx.beginPath();
      roomCtx.roundRect(pt.x - w / 2, pt.y - 10, w, 19, 6);
      roomCtx.fill();
      roomCtx.fillStyle = '#ffffff';
      roomCtx.textAlign = 'center';
      roomCtx.fillText(t.text, pt.x, pt.y + 3);
      roomCtx.restore();
    });
  }

  // 8. Idea B: Active 3D Track Sliding Indicator Banner
  if (draggingModule) {
    const val = simState.trackPos[draggingModule.id] || 0;
    const pt = iso.project(
      draggingModule.axis === 'x' ? val + 1.0 : 0.3,
      draggingModule.axis === 'y' ? val + 0.75 : 0.3,
      1.85
    );
    roomCtx.save();
    roomCtx.font = '800 12px "Noto Sans TC", sans-serif';
    const txt = `↔️ 軌道滑移定位：${val.toFixed(1)}m (放開即自動咬合鎖定)`;
    const w = roomCtx.measureText(txt).width + 18;
    roomCtx.fillStyle = '#0284c7';
    roomCtx.beginPath();
    roomCtx.roundRect(pt.x - w / 2, pt.y - 14, w, 24, 8);
    roomCtx.fill();
    roomCtx.fillStyle = '#ffffff';
    roomCtx.textAlign = 'center';
    roomCtx.fillText(txt, pt.x, pt.y + 2);
    roomCtx.restore();
  }

  // 9. Idea E: Construction Demolition Dust Clouds (Traditional Renovation Mode)
  dustParticles = dustParticles.filter(p => now - p.startAt < p.duration);
  dustParticles.forEach(p => {
    const t = (now - p.startAt) / p.duration;
    const curX = p.x + p.vx * t;
    const curY = p.y + p.vy * t;
    const curZ = p.z + p.vz * t;
    const pt = iso.project(curX, curY, curZ);
    roomCtx.save();
    roomCtx.fillStyle = p.isSpark
      ? `rgba(250, 204, 21, ${(1 - t) * 0.9})`
      : `rgba(140, 122, 105, ${(1 - t) * 0.65})`;
    roomCtx.beginPath();
    roomCtx.arc(pt.x, pt.y, p.size * (1 + t * 0.8), 0, Math.PI * 2);
    roomCtx.fill();
    roomCtx.restore();
  });

  // 10. Idea C: 3D Floating Reward / Stat Texts (pop-in scale + ease-out rise)
  floatingTexts = floatingTexts.filter(ft => now - ft.startAt < 1600);
  floatingTexts.forEach(ft => {
    const t = (now - ft.startAt) / 1600;
    const pt = iso.project(ft.x, ft.y, ft.z + easeOutCubic(t) * 0.9);
    const pop = t < 0.18 ? easeOutBack(t / 0.18) : 1;
    roomCtx.save();
    roomCtx.globalAlpha = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);
    roomCtx.translate(pt.x, pt.y);
    roomCtx.scale(pop, pop);
    roomCtx.font = '800 13px "Noto Sans TC", sans-serif';
    roomCtx.textAlign = 'center';
    roomCtx.lineJoin = 'round';
    roomCtx.strokeStyle = 'rgba(36, 28, 20, 0.85)';
    roomCtx.lineWidth = 3.5;
    roomCtx.strokeText(ft.text, 0, 0);
    roomCtx.fillStyle = ft.col;
    roomCtx.fillText(ft.text, 0, 0);
    roomCtx.restore();
  });

  // 11. Ambient light motes: sunlit dust by day, soft warm glow specks at night
  if (!isBlueprint && !reduceMotionMQ.matches) {
    roomCtx.save();
    ambientMotes.forEach(m => {
      const tt = now / 1000 + m.seed;
      const mx = 0.5 + m.x * (roomW - 1) + Math.sin(tt * 0.35) * 0.25;
      const my = 0.4 + m.y * (roomD - 0.8) + Math.cos(tt * 0.28) * 0.2;
      const mz = 0.3 + ((m.z + tt * 0.025) % 1) * 2.1;
      const p = iso.project(mx, my, mz);
      const tw = 0.5 + 0.5 * Math.sin(tt * 1.7);
      roomCtx.fillStyle = isNight
        ? `rgba(255, 214, 150, ${0.18 + tw * 0.32})`
        : `rgba(255, 250, 235, ${0.25 + tw * 0.4})`;
      roomCtx.beginPath();
      roomCtx.arc(p.x, p.y, isNight ? 1.6 : 1.2 + tw * 0.8, 0, Math.PI * 2);
      roomCtx.fill();
    });
    roomCtx.restore();
  }

  // 12. Gentle vignette to focus the eye on the room model
  const vig = roomCtx.createRadialGradient(W * 0.5, H * 0.55, H * 0.35, W * 0.5, H * 0.55, W * 0.72);
  vig.addColorStop(0, 'rgba(30, 22, 14, 0)');
  vig.addColorStop(1, isNight ? 'rgba(0, 0, 0, 0.38)' : 'rgba(60, 42, 26, 0.16)');
  roomCtx.fillStyle = vig;
  roomCtx.fillRect(0, 0, W, H);

  // 13. Lighting-period crossfade (previous frame fades out over the new lighting)
  if (periodFade) {
    const ft = (now - periodFade.startAt) / 650;
    if (ft >= 1) {
      periodFade = null;
    } else {
      roomCtx.save();
      roomCtx.globalAlpha = 1 - easeOutCubic(ft);
      roomCtx.drawImage(periodFade.canvas, 0, 0);
      roomCtx.restore();
    }
  }
}

// ─── 4. PLAYER MOVEMENT, PATHFINDING & INTERACTION LOOP ───
const roomKeys = new Set();
const keyDirectionMap = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right'
};

function getNearestSceneObject() {
  let best = null;
  let bestDist = 1.65;
  getSceneObjects().forEach(obj => {
    const dist = Math.hypot(simState.player.x - obj.ix, simState.player.y - obj.iy);
    if (dist < bestDist) {
      best = obj;
      bestDist = dist;
    }
  });
  return best;
}

// ─── 3C. VOLUMETRIC WALL HITBOX & PHYSICAL COLLISION SYSTEM ───
function getWallHitboxes() {
  ensureV4State();
  const { w: roomW, d: roomD } = getRoomDimensions(simState.profile?.area || 18);
  const hs = simState.hardscape || {};
  const wallMode = simState.wallMode || 'cutaway';
  const perimeterWallH = (wallMode === 'none') ? 0.08 : 2.65;
  const partWallH = (wallMode === 'none') ? 0.08 : 2.40;
  const doorH = (wallMode === 'none') ? 0.08 : 2.05;
  const boxes = [];

  // 1. Back Wall (建築後主牆 y=0)
  boxes.push({
    id: 'room-wall-back',
    storeKey: 'room-wall-back',
    label: '建築後主牆 (TAYA 專利軌道系統)',
    isRoomWall: true,
    wallType: 'back',
    x: -0.2,
    y: -0.2,
    z: 0,
    dx: roomW + 0.2,
    dy: 0.28,
    dz: perimeterWallH,
    isSolid: true
  });

  // 2. Left Wall (建築左側牆 x=0)
  boxes.push({
    id: 'room-wall-left',
    storeKey: 'room-wall-left',
    label: '建築左側牆 (樂齡採光窗牆面)',
    isRoomWall: true,
    wallType: 'left',
    x: -0.2,
    y: 0,
    z: 0,
    dx: 0.28,
    dy: roomD,
    dz: perimeterWallH,
    isSolid: true
  });

  // 3. Foreground Walls (When full wall mode is enabled)
  if (wallMode === 'full') {
    boxes.push({
      id: 'room-wall-front',
      storeKey: 'room-wall-front',
      label: '建築前側外牆',
      isRoomWall: true,
      wallType: 'front',
      x: -0.2,
      y: roomD,
      z: 0,
      dx: roomW + 0.4,
      dy: 0.2,
      dz: perimeterWallH,
      isSolid: true
    });
    boxes.push({
      id: 'room-wall-right',
      storeKey: 'room-wall-right',
      label: '建築右側外牆',
      isRoomWall: true,
      wallType: 'right',
      x: roomW,
      y: -0.2,
      z: 0,
      dx: 0.2,
      dy: roomD + 0.2,
      dz: perimeterWallH,
      isSolid: true
    });
  }

  // 4. Structural Pillar (結構承重柱)
  if (hs.pillar) {
    boxes.push({
      id: 'room-pillar',
      storeKey: 'room-pillar',
      label: '結構承重柱＆管道間',
      isRoomWall: true,
      isPillar: true,
      x: 0.22,
      y: 1.92,
      z: 0,
      dx: 0.58,
      dy: 0.58,
      dz: 2.62,
      isSolid: true
    });
  }

  // 5. L-shape Corner Wall (L型建築轉角牆)
  if (hs.shape === 'lshape') {
    const lw = Math.min(2.15, roomW * 0.28);
    const ld = Math.min(1.75, roomD * 0.28);
    boxes.push({
      id: 'room-wall-lshape',
      storeKey: 'room-wall-lshape',
      label: 'L型建築轉角結構牆',
      isRoomWall: true,
      x: roomW - lw,
      y: roomD - ld,
      z: 0,
      dx: lw,
      dy: ld,
      dz: 2.65,
      isSolid: true
    });
  }

  // 6. Plural Partition Walls (實體隔間牆與房門牆 Hitboxes)
  if (Array.isArray(hs.partitions)) {
    hs.partitions.forEach((p, idx) => {
      const isHoriz = p.orient === 'x';
      const wallLen = Math.max(1.4, Math.min(isHoriz ? roomW - 0.5 : roomD - 0.5, p.length || 2.6));
      const wallThick = 0.16;
      const dx = isHoriz ? wallLen : wallThick;
      const dy = isHoriz ? wallThick : wallLen;
      const x = p.x;
      const y = p.y;
      const isSolid = p.type === 'solid';

      if (isSolid) {
        boxes.push({
          id: p.id,
          storeKey: p.id,
          label: `純隔間牆 #${idx + 1}`,
          isPartition: true,
          isSolid: true,
          x, y, z: 0, dx, dy, dz: partWallH,
          subpart: 'solid-wall'
        });
      } else {
        const doorGeo = getPartitionDoorSubbox({ id: p.id, x, y, dx, dy, dz: partWallH, cfg: p });
        if (doorGeo) {
          boxes.push({
            id: p.id,
            storeKey: p.id,
            label: `隔間牆 #${idx + 1} 側段1`,
            isPartition: true,
            isSolid: true,
            x: doorGeo.seg1Box.x,
            y: doorGeo.seg1Box.y,
            z: doorGeo.seg1Box.z || 0,
            dx: doorGeo.seg1Box.dx,
            dy: doorGeo.seg1Box.dy,
            dz: doorGeo.seg1Box.dz || partWallH,
            subpart: 'seg1'
          });
          boxes.push({
            id: p.id,
            storeKey: p.id,
            label: `隔間牆 #${idx + 1} 側段2`,
            isPartition: true,
            isSolid: true,
            x: doorGeo.seg2Box.x,
            y: doorGeo.seg2Box.y,
            z: doorGeo.seg2Box.z || 0,
            dx: doorGeo.seg2Box.dx,
            dy: doorGeo.seg2Box.dy,
            dz: doorGeo.seg2Box.dz || partWallH,
            subpart: 'seg2'
          });
          const isOpen = Boolean(p.doorOpen) || p.doorStyle === 'open-arch';
          boxes.push({
            id: p.id,
            storeKey: p.id,
            label: `隔間牆 #${idx + 1} 門扇 (${isOpen ? '敞開通行' : '閉合阻擋'})`,
            isPartition: true,
            isDoorLeaf: true,
            isSolid: !isOpen,
            isOpen,
            x: doorGeo.leafBox.x,
            y: doorGeo.leafBox.y,
            z: doorGeo.leafBox.z || 0,
            dx: doorGeo.leafBox.dx,
            dy: doorGeo.leafBox.dy,
            dz: doorGeo.leafBox.dz || doorH,
            subpart: 'partition-door'
          });
        } else {
          boxes.push({
            id: p.id,
            storeKey: p.id,
            label: `房門隔間牆 #${idx + 1}`,
            isPartition: true,
            isSolid: true,
            x, y, z: 0, dx, dy, dz: partWallH
          });
        }
      }
    });
  }

  return boxes;
}

// ─── 3D. INTELLIGENT DOORWAY WAYPOINT ROUTER & AUTO-DOOR SENSOR ───
// Check if a line segment crosses a partition wall
function lineIntersectsWall(x1, y1, x2, y2, wall) {
  const isHoriz = wall.orient === 'x';
  const len = wall.length || 2.6;
  const thick = 0.16;
  const wx1 = wall.x, wy1 = wall.y;
  const wx2 = isHoriz ? wall.x + len : wall.x + thick;
  const wy2 = isHoriz ? wall.y + thick : wall.y + len;

  if (isHoriz) {
    const wallY = wy1 + thick * 0.5;
    if ((y1 - wallY) * (y2 - wallY) > 0) return false;
    if (Math.abs(y2 - y1) < 0.0001) return false;
    const t = (wallY - y1) / (y2 - y1);
    if (t < 0 || t > 1) return false;
    const crossX = x1 + t * (x2 - x1);
    return crossX >= wx1 - 0.15 && crossX <= wx2 + 0.15;
  } else {
    const wallX = wx1 + thick * 0.5;
    if ((x1 - wallX) * (x2 - wallX) > 0) return false;
    if (Math.abs(x2 - x1) < 0.0001) return false;
    const t = (wallX - x1) / (x2 - x1);
    if (t < 0 || t > 1) return false;
    const crossY = y1 + t * (y2 - y1);
    return crossY >= wy1 - 0.15 && crossY <= wy2 + 0.15;
  }
}

// Computes doorway center and dimensions for pathfinding
function getDoorwayGeom(wall) {
  const isHoriz = wall.orient === 'x';
  const len = wall.length || 2.6;
  const doorW = Math.min(0.92, Math.max(0.75, len * 0.35));
  let doorOffset = (len - doorW) * 0.5;
  if (wall.doorPos === 'start') doorOffset = Math.max(0.18, (len - doorW) * 0.18);
  else if (wall.doorPos === 'end') doorOffset = Math.max(0.18, len - doorW - 0.18);

  const cx = isHoriz ? wall.x + doorOffset + doorW * 0.5 : wall.x + 0.08;
  const cy = isHoriz ? wall.y + 0.08 : wall.y + doorOffset + doorW * 0.5;

  return { isHoriz, len, doorW, doorOffset, cx, cy };
}

// Multi-segment Waypoint Pathfinding across rooms and doorways
function findRoomPath(startX, startY, destX, destY) {
  ensureV4State();
  const partitions = Array.isArray(simState.hardscape?.partitions) ? simState.hardscape.partitions : [];
  const { w: roomW, d: roomD } = getRoomDimensions(simState.profile?.area || 18);

  // Check if direct straight line intersects any partition wall
  const hitWalls = partitions.filter(p => lineIntersectsWall(startX, startY, destX, destY, p));
  if (hitWalls.length === 0) {
    return [{ x: destX, y: destY }];
  }

  // Sort intersecting walls by distance from start position
  hitWalls.sort((a, b) => {
    const da = Math.hypot(startX - a.x, startY - a.y);
    const db = Math.hypot(startX - b.x, startY - b.y);
    return da - db;
  });

  const waypoints = [];
  let curX = startX, curY = startY;

  hitWalls.forEach(wall => {
    const isHoriz = wall.orient === 'x';
    const len = wall.length || 2.6;

    if (wall.type === 'door') {
      const dg = getDoorwayGeom(wall);
      if (isHoriz) {
        const approach1 = { x: dg.cx, y: curY < wall.y ? wall.y - 0.5 : wall.y + 0.16 + 0.5 };
        const approach2 = { x: dg.cx, y: curY < wall.y ? wall.y + 0.16 + 0.5 : wall.y - 0.5 };
        waypoints.push(approach1, approach2);
        curX = approach2.x;
        curY = approach2.y;
      } else {
        const approach1 = { x: curX < wall.x ? wall.x - 0.5 : wall.x + 0.16 + 0.5, y: dg.cy };
        const approach2 = { x: curX < wall.x ? wall.x + 0.16 + 0.5 : wall.x - 0.5, y: dg.cy };
        waypoints.push(approach1, approach2);
        curX = approach2.x;
        curY = approach2.y;
      }
    } else {
      // Solid wall: route around closest available end with clear room margin
      if (isHoriz) {
        const end1 = { x: Math.max(0.65, wall.x - 0.5), y: wall.y + 0.08 };
        const end2 = { x: Math.min(roomW - 0.65, wall.x + len + 0.5), y: wall.y + 0.08 };
        const d1 = Math.hypot(curX - end1.x, curY - end1.y) + Math.hypot(destX - end1.x, destY - end1.y);
        const d2 = Math.hypot(curX - end2.x, curY - end2.y) + Math.hypot(destX - end2.x, destY - end2.y);
        const bestEnd = d1 < d2 ? end1 : end2;
        waypoints.push(bestEnd);
        curX = bestEnd.x;
        curY = bestEnd.y;
      } else {
        const end1 = { x: wall.x + 0.08, y: Math.max(0.65, wall.y - 0.5) };
        const end2 = { x: wall.x + 0.08, y: Math.min(roomD - 0.65, wall.y + len + 0.5) };
        const d1 = Math.hypot(curX - end1.x, curY - end1.y) + Math.hypot(destX - end1.x, destY - end1.y);
        const d2 = Math.hypot(curX - end2.x, curY - end2.y) + Math.hypot(destX - end2.x, destY - end2.y);
        const bestEnd = d1 < d2 ? end1 : end2;
        waypoints.push(bestEnd);
        curX = bestEnd.x;
        curY = bestEnd.y;
      }
    }
  });

  waypoints.push({ x: destX, y: destY });
  return waypoints;
}

// Proximity Doorway Auto-Open Sensor: opens door automatically ONLY when character actively approaches to pass through
let lastDoorAutoOpenAt = 0;
function checkAndAutoOpenDoorways(charX, charY, agentName = '角色', radius = 0.52) {
  ensureV4State();
  const partitions = Array.isArray(simState.hardscape?.partitions) ? simState.hardscape.partitions : [];
  let openedAny = false;
  const now = performance.now();

  partitions.forEach(p => {
    if (p.type === 'solid' || p.doorOpen || p.doorStyle === 'open-arch') return;
    // If door was manually closed by the user, respect user's intention and keep it closed!
    if (p.manualClosedUntil && now < p.manualClosedUntil) return;

    const dg = getDoorwayGeom(p);
    const dist = Math.hypot(charX - dg.cx, charY - dg.cy);
    // Only open when character is in close physical contact with doorway (< 0.52m)
    if (dist < radius) {
      p.doorOpen = true;
      openedAny = true;
      triggerSnapEffect(p.id);
      if (now - lastDoorAutoOpenAt > 600) {
        lastDoorAutoOpenAt = now;
        playSimSound('snap');
        showRoomBanner(`🚪 ${agentName} 已順勢推開隔間房門通行！`);
      }
    }
  });

  if (openedAny) {
    saveSimState();
    renderSim();
    renderV4Panels();
    updateObjInspectorUI();
  }
}

// Gather all solid physical obstacles (architectural walls, partitions, and floor furniture)
function getAllPhysicalObstacles(excludeId = null) {
  const list = [];
  // 1. Solid wall hitboxes (back wall, left wall, front/right walls if full, pillars, partitions)
  const wallBoxes = getWallHitboxes().filter(b => b.isSolid && b.id !== excludeId);
  wallBoxes.forEach(b => {
    if (b.id === 'room-wall-back' || b.id === 'room-wall-left') return;
    list.push({
      id: b.id,
      label: b.label || '建築結構',
      x: b.x,
      y: b.y,
      dx: b.dx,
      dy: b.dy,
      dz: b.dz || 2.4,
      isWall: true
    });
  });

  // 2. All solid floor furniture & DLC modules
  if (typeof getSceneObjects === 'function') {
    const sceneObjs = getSceneObjects();
    sceneObjs.forEach(o => {
      if (o.id === excludeId || o.isSubgrid || o.isWall || (o.dz || 0.8) <= 0.28) return;
      list.push({
        id: o.id,
        label: o.label || '家具模組',
        x: o.x,
        y: o.y,
        dx: o.dx,
        dy: o.dy,
        dz: o.dz || 0.85,
        isFurniture: true
      });
    });
  }
  return list;
}

// Continuous Swept-Circle Collision Resolver (Prevents tunneling through thin partitions & furniture)
function resolveWallCollisions(curX, curY, nextX, nextY, radius = 0.22, roomW, roomD, excludeId = null) {
  const obstacles = getAllPhysicalObstacles(excludeId);
  const minX = 0.35 + radius;
  const maxX = roomW - 0.35 - radius;
  const minY = 0.35 + radius;
  const maxY = roomD - 0.45 - radius;

  let resX = Math.max(minX, Math.min(maxX, nextX));
  let resY = Math.max(minY, Math.min(maxY, nextY));

  const collidesWithObstacle = (cx, cy) => {
    for (let i = 0; i < obstacles.length; i++) {
      const b = obstacles[i];
      const nx = Math.max(b.x, Math.min(b.x + b.dx, cx));
      const ny = Math.max(b.y, Math.min(b.y + b.dy, cy));
      const dist = Math.hypot(cx - nx, cy - ny);
      if (dist < radius) return b;
    }
    return null;
  };

  const totalDist = Math.hypot(resX - curX, resY - curY);
  const stepSize = Math.max(0.04, radius * 0.4);
  const numSteps = Math.max(1, Math.ceil(totalDist / stepSize));

  let bestX = curX;
  let bestY = curY;
  let collided = false;
  let hitObstacle = null;

  // 1. Continuous Swept Line Sample Testing (prevents tunneling through thin walls / partition doors)
  for (let i = 1; i <= numSteps; i++) {
    const t = i / numSteps;
    const sx = curX + (resX - curX) * t;
    const sy = curY + (resY - curY) * t;
    const hit = collidesWithObstacle(sx, sy);
    if (hit) {
      collided = true;
      hitObstacle = hit;
      break;
    }
    bestX = sx;
    bestY = sy;
  }

  if (!collided) {
    return { x: resX, y: resY, collided: false };
  }

  // 2. Physical Sliding along X-axis
  let slideX = curX;
  const distX = Math.abs(resX - curX);
  const stepsX = Math.max(1, Math.ceil(distX / stepSize));
  let hitX = false;
  for (let i = 1; i <= stepsX; i++) {
    const sx = curX + (resX - curX) * (i / stepsX);
    if (collidesWithObstacle(sx, curY)) {
      hitX = true;
      break;
    }
    slideX = sx;
  }

  // 3. Physical Sliding along Y-axis
  let slideY = curY;
  const distY = Math.abs(resY - curY);
  const stepsY = Math.max(1, Math.ceil(distY / stepSize));
  let hitY = false;
  for (let i = 1; i <= stepsY; i++) {
    const sy = curY + (resY - curY) * (i / stepsY);
    if (collidesWithObstacle(curX, sy)) {
      hitY = true;
      break;
    }
    slideY = sy;
  }

  if (!hitX && distX > 0.001) {
    return { x: slideX, y: curY, collided: true, slideAxis: 'x', hit: hitObstacle };
  }
  if (!hitY && distY > 0.001) {
    return { x: curX, y: slideY, collided: true, slideAxis: 'y', hit: hitObstacle };
  }

  return { x: bestX, y: bestY, collided: true, hit: hitObstacle };
}

// Test furniture AABB collision against solid structural walls, pillars, partitions AND other furniture
function checkFurnitureCollision(testBox, ignoreId = null) {
  // 1. Check solid wall boxes (including pillars, L-shape, partition walls; skip outer perimeter walls)
  const solidBoxes = getWallHitboxes().filter(b => b.isSolid && b.id !== ignoreId);
  for (let i = 0; i < solidBoxes.length; i++) {
    const b = solidBoxes[i];
    if (b.wallType) continue;
    // 2D AABB overlap with 0.02m margin
    if (testBox.x < b.x + b.dx - 0.02 && testBox.x + testBox.dx > b.x + 0.02 &&
        testBox.y < b.y + b.dy - 0.02 && testBox.y + testBox.dy > b.y + 0.02) {
      return b;
    }
  }

  // 2. Check all other solid scene objects (furniture & DLC modules)
  if (typeof getSceneObjects === 'function') {
    const sceneObjs = getSceneObjects();
    for (let i = 0; i < sceneObjs.length; i++) {
      const o = sceneObjs[i];
      if (o.id === ignoreId || o.isSubgrid || o.isWall || (o.dz || 0.8) <= 0.25) continue;
      // 2D AABB overlap with 0.03m margin
      if (testBox.x < o.x + o.dx - 0.03 && testBox.x + testBox.dx > o.x + 0.03 &&
          testBox.y < o.y + o.dy - 0.03 && testBox.y + testBox.dy > o.y + 0.03) {
        return o;
      }
    }
  }

  return null;
}
window.getAllPhysicalObstacles = getAllPhysicalObstacles;
window.resolveWallCollisions = resolveWallCollisions;
window.checkFurnitureCollision = checkFurnitureCollision;
window.getWallHitboxes = getWallHitboxes;

// 3D Volumetric Hitbox Visualizer (Isometric Wireframe, Semi-transparent faces & L-brackets)
function draw3DHitbox(iso, box, opts = {}) {
  const color = opts.color || (opts.isSolid ? '#38bdf8' : '#34d399');
  const fillColor = opts.fillColor || (opts.isSolid ? 'rgba(56, 189, 248, 0.12)' : 'rgba(52, 211, 153, 0.14)');
  const strokeColor = opts.strokeColor || (opts.isSolid ? '#0284c7' : '#10b981');
  const z = box.z || 0;
  const dz = box.dz || 2.4;

  const corners = [
    iso.project(box.x, box.y, z),
    iso.project(box.x + box.dx, box.y, z),
    iso.project(box.x + box.dx, box.y + box.dy, z),
    iso.project(box.x, box.y + box.dy, z),
    iso.project(box.x, box.y, z + dz),
    iso.project(box.x + box.dx, box.y, z + dz),
    iso.project(box.x + box.dx, box.y + box.dy, z + dz),
    iso.project(box.x, box.y + box.dy, z + dz)
  ];

  // Dynamically determine camera-facing visible side faces based on current camera yaw
  const sinY = Math.sin(currentYaw);
  const cosY = Math.cos(currentYaw);

  const isPosX = sinY >= 0;
  const faceXPts = isPosX ? [corners[1], corners[2], corners[6], corners[5]] : [corners[0], corners[3], corners[7], corners[4]];
  const depthX = iso.project(isPosX ? box.x + box.dx : box.x, box.y + box.dy * 0.5, z + dz * 0.5).depth;

  const isPosY = cosY >= 0;
  const faceYPts = isPosY ? [corners[3], corners[2], corners[6], corners[7]] : [corners[0], corners[1], corners[5], corners[4]];
  const depthY = iso.project(box.x + box.dx * 0.5, isPosY ? box.y + box.dy : box.y, z + dz * 0.5).depth;

  // Draw semi-transparent isometric bounding faces back-to-front
  if (depthX < depthY) {
    iso.drawPoly(faceXPts, fillColor, strokeColor, 1.0);
    iso.drawPoly(faceYPts, fillColor, strokeColor, 1.0);
  } else {
    iso.drawPoly(faceYPts, fillColor, strokeColor, 1.0);
    iso.drawPoly(faceXPts, fillColor, strokeColor, 1.0);
  }

  // Top face (+Z)
  iso.drawPoly([corners[4], corners[5], corners[6], corners[7]], fillColor, strokeColor, 1.2);

  roomCtx.save();
  roomCtx.strokeStyle = strokeColor;
  roomCtx.lineWidth = opts.lineWidth || 1.4;
  roomCtx.setLineDash(opts.dashed !== false ? [4, 3] : []);

  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];
  edges.forEach(([i, j]) => {
    roomCtx.beginPath();
    roomCtx.moveTo(corners[i].x, corners[i].y);
    roomCtx.lineTo(corners[j].x, corners[j].y);
    roomCtx.stroke();
  });
  roomCtx.setLineDash([]);

  // Corner brackets (L-shapes) for CAD / high-tech game engine look
  const drawCornerL = (pt, vx, vy) => {
    const len = 7;
    roomCtx.beginPath();
    roomCtx.moveTo(pt.x + vx * len, pt.y);
    roomCtx.lineTo(pt.x, pt.y);
    roomCtx.lineTo(pt.x, pt.y + vy * len);
    roomCtx.stroke();
  };
  roomCtx.lineWidth = 2.2;
  roomCtx.strokeStyle = color;
  drawCornerL(corners[4], 1, 1);
  drawCornerL(corners[5], -1, 1);
  drawCornerL(corners[6], -1, -1);
  drawCornerL(corners[7], 1, -1);

  // Label badge
  if (opts.showBadge && opts.label) {
    const topCenter = iso.project(box.x + box.dx * 0.5, box.y + box.dy * 0.5, z + dz + 0.16);
    roomCtx.font = '700 10.5px "Inter", "Noto Sans TC", sans-serif';
    const text = opts.label;
    const tw = roomCtx.measureText(text).width;
    const bw = tw + 14, bh = 20;
    roomCtx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    roomCtx.strokeStyle = color;
    roomCtx.lineWidth = 1.3;
    roomCtx.beginPath();
    roomCtx.roundRect(topCenter.x - bw * 0.5, topCenter.y - bh * 0.5, bw, bh, 6);
    roomCtx.fill();
    roomCtx.stroke();
    roomCtx.fillStyle = '#f8fafc';
    roomCtx.textAlign = 'center';
    roomCtx.textBaseline = 'middle';
    roomCtx.fillText(text, topCenter.x, topCenter.y + 0.5);
  }

  roomCtx.restore();
}

let lastLoopTime = performance.now();
function gameFrameLoop(now) { if (!window._roomObs && typeof IntersectionObserver !== 'undefined' && roomCanvas) { window._roomVis = true; (window._roomObs = new IntersectionObserver(e => { window._roomVis = e[0].isIntersecting; })).observe(roomCanvas); } if (window._roomVis === false && !(typeof isTourActive !== 'undefined' && isTourActive)) { lastLoopTime = now; requestAnimationFrame(gameFrameLoop); return; } window._inFrameLoop = false; ensureV4State(); window._frameSceneObjs = getSceneObjects(); window._inFrameLoop = true;
  const dt = Math.min(0.05, (now - lastLoopTime) / 1000);
  lastLoopTime = now;

  const speed = 3.2; // meters per second
  let vx = Number(roomKeys.has('right')) - Number(roomKeys.has('left'));
  let vy = Number(roomKeys.has('down')) - Number(roomKeys.has('up'));

  if (vx !== 0 || vy !== 0) {
    // Manual control overrides auto-walk target & rotates character toward movement direction
    lastPlayerInputAt = now;
    simState.player.targetX = null;
    simState.player.targetY = null;
    simState.player.waypoints = [];
    simState.player.pendingAction = null;
    const len = Math.hypot(vx, vy);
    const curRDim = getRoomDimensions(simState.profile?.area || 18);
    const targetX = simState.player.x + (vx / len) * speed * dt;
    const targetY = simState.player.y + (vy / len) * speed * dt;
    const moved = resolveWallCollisions(simState.player.x, simState.player.y, targetX, targetY, 0.22, curRDim.w, curRDim.d);
    simState.player.x = moved.x;
    simState.player.y = moved.y;
    simState.player.targetAngle = Math.atan2(vy, vx);
    if (moved.collided) {
      checkAndAutoOpenDoorways(simState.player.x, simState.player.y, simState.name || '主角', 0.52);
    }
  } else if (simState.player.targetX !== null && simState.player.targetY !== null) {
    // Auto-walk pathfinding toward clicked 3D furniture or action target
    const dx = simState.player.targetX - simState.player.x;
    const dy = simState.player.targetY - simState.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.18) {
      if (simState.player.waypoints && simState.player.waypoints.length > 0) {
        const nextWp = simState.player.waypoints.shift();
        simState.player.x = simState.player.targetX;
        simState.player.y = simState.player.targetY;
        simState.player.targetX = nextWp.x;
        simState.player.targetY = nextWp.y;
        checkAndAutoOpenDoorways(simState.player.x, simState.player.y, simState.name || '主角', 0.52);
      } else {
        simState.player.x = simState.player.targetX;
        simState.player.y = simState.player.targetY;
        simState.player.targetX = null;
        simState.player.targetY = null;
        simState.player.waypoints = [];
        if (Number.isFinite(simState.player.lookAtX) && Number.isFinite(simState.player.lookAtY)) {
          simState.player.targetAngle = Math.atan2(simState.player.lookAtY - simState.player.y, simState.player.lookAtX - simState.player.x);
          simState.player.lookAtX = null;
          simState.player.lookAtY = null;
        }
        if (simState.player.pendingAction) {
          const act = simState.player.pendingAction;
          simState.player.pendingAction = null;
          executeSimAction(act.action, act.objId);
        }
      }
    } else {
      const curRDim = getRoomDimensions(simState.profile?.area || 18);
      const stepDist = speed * 1.15 * dt;
      const targetX = simState.player.x + (dx / dist) * stepDist;
      const targetY = simState.player.y + (dy / dist) * stepDist;
      const moved = resolveWallCollisions(simState.player.x, simState.player.y, targetX, targetY, 0.22, curRDim.w, curRDim.d);
      if (moved.collided && Math.hypot(moved.x - simState.player.x, moved.y - simState.player.y) < 0.005) {
        checkAndAutoOpenDoorways(simState.player.x, simState.player.y, simState.name || '主角', 0.52);
        if (simState.player.waypoints && simState.player.waypoints.length > 0) {
          const nextWp = simState.player.waypoints.shift();
          simState.player.targetX = nextWp.x;
          simState.player.targetY = nextWp.y;
        } else {
          simState.player.targetX = null;
          simState.player.targetY = null;
          simState.player.waypoints = [];
          playSimSound('tap');
          showRoomBanner('🛑 前方遇牆壁阻擋！如為隔間房門，請先點擊門扇開門。');
        }
      } else {
        simState.player.x = moved.x;
        simState.player.y = moved.y;
        simState.player.targetAngle = Math.atan2(dy, dx);
      }
    }
  } else if (!simState.paused && !activeInteraction && now - lastPlayerInputAt > 5500) {
    // Autonomous stroll for main player when game is running and player is idle
    lastPlayerInputAt = now + 2500;
    const objs = getSceneObjects();
    if (objs.length > 0 && Math.random() < 0.65) {
      const pick = objs[Math.floor(Math.random() * objs.length)];
      const path = findRoomPath(simState.player.x, simState.player.y, pick.ix, pick.iy);
      simState.player.waypoints = path.slice(1);
      simState.player.targetX = path[0].x;
      simState.player.targetY = path[0].y;
      simState.player.lookAtX = pick.x + pick.dx * 0.5;
      simState.player.lookAtY = pick.y + pick.dy * 0.5;
    } else {
      const destX = 1.4 + Math.random() * 6.0;
      const destY = 1.5 + Math.random() * 4.0;
      const path = findRoomPath(simState.player.x, simState.player.y, destX, destY);
      simState.player.waypoints = path.slice(1);
      simState.player.targetX = path[0].x;
      simState.player.targetY = path[0].y;
    }
  }

  // Smoothly interpolate main player facing angle
  simState.player.angle = lerpAngleShortest(
    simState.player.angle ?? 0.85,
    simState.player.targetAngle ?? 0.85,
    dt * 12
  );

  // Update autonomous companion AI every frame
  updateAutonomousCharacters(now, dt);

  if (activeInteraction && now - activeInteraction.startAt > activeInteraction.duration) {
    activeInteraction = null;
  }

  // Autonomous Robot Vacuum patrolling floor (會在地上自動移動的掃地機器人，遇牆壁碰撞箱自動彈跳轉向)
  if (typeof hasV4Item === 'function' && hasV4Item('robot-vac') && typeof robotVacState === 'object') {
    const rv = robotVacState;
    const curRDim = getRoomDimensions(simState.profile?.area || 18);
    const nX = rv.x + rv.vx * dt;
    const nY = rv.y + rv.vy * dt;
    const moved = resolveWallCollisions(rv.x, rv.y, nX, nY, 0.18, curRDim.w, curRDim.d);
    if (moved.collided) {
      if (moved.slideAxis === 'x') {
        rv.vy *= -1;
      } else if (moved.slideAxis === 'y') {
        rv.vx *= -1;
      } else {
        rv.vx *= -1;
        rv.vy *= -1;
      }
    }
    rv.x = moved.x;
    rv.y = moved.y;
  }

  const nearObj = getNearestSceneObject();
  const promptEl = document.getElementById('simInteractionPrompt');
  if (promptEl) {
    promptEl.textContent = nearObj
      ? `⚡ 按 E 或點擊互動：${nearObj.label}`
      : '💡 點擊 3D 家具模型自動尋路互動，或按 WASD／方向鍵移動';
  }

  renderGameRoom(now); window._inFrameLoop = false; window._frameSceneObjs = null;
  requestAnimationFrame(gameFrameLoop);
}

// Helper: project a 3D box's 8 vertices to 2D screen bounds and compute distance to cursor (sx, sy)
function getProjectedBoxHitDist(iso, sx, sy, box, padPx = 8) {
  const corners = [
    iso.project(box.x, box.y, box.z),
    iso.project(box.x + box.dx, box.y, box.z),
    iso.project(box.x, box.y + box.dy, box.z),
    iso.project(box.x + box.dx, box.y + box.dy, box.z),
    iso.project(box.x, box.y, box.z + box.dz),
    iso.project(box.x + box.dx, box.y, box.z + box.dz),
    iso.project(box.x, box.y + box.dy, box.z + box.dz),
    iso.project(box.x + box.dx, box.y + box.dy, box.z + box.dz)
  ];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  corners.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });
  const insideBounds = sx >= minX - padPx && sx <= maxX + padPx && sy >= minY - padPx && sy <= maxY + padPx;
  const samples = [0.22, 0.5, 0.78].flatMap(u =>
    [0.25, 0.55, 0.82].map(w =>
      iso.project(box.x + box.dx * u, box.y + box.dy * u, box.z + box.dz * w)
    )
  );
  const minSampleDist = Math.min(...samples.map(pt => Math.hypot(sx - pt.x, sy - pt.y)));
  return { insideBounds, dist: minSampleDist };
}

// Click, Drag, Rotate & Inspect on 3D Room Canvas (with Sub-component Hit-Test for Partition Door)
function getCanvasMouse3D(event) {
  const rect = roomCanvas.getBoundingClientRect();
  const sx = (event.clientX - rect.left) * (roomCanvas.width / rect.width);
  const sy = (event.clientY - rect.top) * (roomCanvas.height / rect.height);
  if (!window._currentRoomIso) return null;
  const iso = window._currentRoomIso;
  const objs = getSceneObjects();
  let hit = null;
  let hitSubpart = null;
  let bestScreenDist = 56;

  objs.forEach(obj => {
    if (obj.isPartition || isPartitionWall(obj.id)) {
      const doorGeo = getPartitionDoorSubbox(obj);
      if (doorGeo) {
        // 0. Check floating pill badge directly above doorway opening OR door leaf
        const bBox = (doorGeo.isOpen && doorGeo.dStyle !== 'open-arch') ? doorGeo.frameBox : doorGeo.leafBox;
        const badgeAnchor = iso.project(bBox.x + bBox.dx * 0.5, bBox.y + bBox.dy * 0.5, (bBox.z || 0) + doorGeo.doorH + 0.24);
        if (Math.hypot(sx - badgeAnchor.x, sy - badgeAnchor.y) < 36) {
          bestScreenDist = 5;
          hit = obj;
          hitSubpart = 'partition-door';
          return;
        }

        // 1. Test Door Leaf & Doorway Frame as high-priority independent sub-component hit-area
        const leafHit = getProjectedBoxHitDist(iso, sx, sy, doorGeo.leafBox, 16);
        const frameHit = getProjectedBoxHitDist(iso, sx, sy, doorGeo.frameBox, 16);
        const doorDist = Math.min(leafHit.dist, frameHit.dist);
        const doorInBounds = leafHit.insideBounds || frameHit.insideBounds;
        // Prioritize door sub-component when cursor is inside projected door bounds or close to door samples
        const effectiveDoorDist = doorInBounds ? Math.min(doorDist * 0.45, 18) : doorDist * 0.72;
        if (effectiveDoorDist < bestScreenDist && (doorInBounds || doorDist < 60)) {
          bestScreenDist = effectiveDoorDist;
          hit = obj;
          hitSubpart = 'partition-door';
        }

        // 2. Test Solid Wall Segments 1 & 2 separately ONLY if door subpart was not already matched
        if (hitSubpart !== 'partition-door') {
          const s1Hit = getProjectedBoxHitDist(iso, sx, sy, doorGeo.seg1Box, 6);
          const s2Hit = getProjectedBoxHitDist(iso, sx, sy, doorGeo.seg2Box, 6);
          const wallSegDist = Math.min(s1Hit.dist, s2Hit.dist);
          if (wallSegDist < bestScreenDist) {
            bestScreenDist = wallSegDist;
            hit = obj;
            hitSubpart = null;
          }
        }
        return;
      } else {
        // Pure Solid Partition Wall: test full bounding box with high precision
        const wallBox = { x: obj.x, y: obj.y, z: obj.z || 0, dx: obj.dx, dy: obj.dy, dz: obj.dz || 2.35 };
        const wallHit = getProjectedBoxHitDist(iso, sx, sy, wallBox, 8);
        const effectiveWallDist = wallHit.insideBounds ? Math.min(wallHit.dist * 0.7, 24) : wallHit.dist;
        if (effectiveWallDist < bestScreenDist) {
          bestScreenDist = effectiveWallDist;
          hit = obj;
          hitSubpart = null;
        }
        return;
      }
    }

    const fBox = {
      x: obj.x,
      y: obj.y,
      z: obj.z || 0,
      dx: obj.dx,
      dy: obj.dy,
      dz: obj.dz || 0.85
    };
    const fHit = getProjectedBoxHitDist(iso, sx, sy, fBox, 8);
    // Prioritize subgrid items when cursor is close so tabletop items on desks are easy to pick
    const weightDist = obj.isSubgrid ? (fHit.dist * 0.72) : fHit.dist;
    const effectiveDist = fHit.insideBounds ? Math.min(weightDist * 0.65, 22) : weightDist;
    if (effectiveDist < bestScreenDist && (fHit.insideBounds || weightDist < 54)) {
      bestScreenDist = effectiveDist;
      hit = obj;
      hitSubpart = null;
    }
  });

  // If no foreground furniture/partition hit with high confidence, test Pillar & (when showHitbox is on) Room Perimeter Walls
  if (!hit || bestScreenDist > 22) {
    const roomWallBoxes = getWallHitboxes().filter(b => b.isPillar || (simState.showHitbox && b.isRoomWall));
    roomWallBoxes.forEach(w => {
      const wHit = getProjectedBoxHitDist(iso, sx, sy, w, 6);
      if (wHit.insideBounds && wHit.dist < bestScreenDist) {
        bestScreenDist = wHit.dist;
        hit = w;
        hitSubpart = null;
      }
    });
  }

  return { sx, sy, hit, hitSubpart, floor: iso.unprojectFloor(sx, sy) };
}

function updateObjInspectorUI() {
  const bar = document.getElementById('simObjInspector');
  if (!bar) return;
  const allObjects = [...getSceneObjects(), ...getWallHitboxes().filter(b => b.isRoomWall)];
  let obj = selectedObjectId ? allObjects.find(o => o.id === selectedObjectId) : null;
  if (!obj && selectedObjectId && isPartitionWall(selectedObjectId)) {
    ensureV4State();
    const liveWall = (simState.hardscape?.partitions || []).find(p => p.id === selectedObjectId);
    if (liveWall) {
      const isSolid = liveWall.type === 'solid';
      const dStyleName = isSolid ? '純實心' : (liveWall.doorStyle === 'wood-hinged' ? '實木門' : liveWall.doorStyle === 'open-arch' ? '穿透拱門' : '玻璃拉門');
      obj = {
        id: liveWall.id,
        storeKey: liveWall.id,
        label: `${isSolid ? '純隔間牆' : '房門隔間牆'} (長${(liveWall.length || 2.6).toFixed(1)}m · ${dStyleName})`,
        action: 'relax',
        x: liveWall.x || 2,
        y: liveWall.y || 2,
        z: 0,
        dx: liveWall.orient === 'x' ? liveWall.length : 0.16,
        dy: liveWall.orient === 'x' ? 0.16 : liveWall.length,
        dz: 2.4,
        rot: liveWall.orient === 'x' ? 1 : 0,
        isHardscape: true,
        canRotate: true,
        isPartition: true,
        cfg: liveWall
      };
    }
  }
  if (!obj) {
    bar.classList.remove('visible', 'open');
    return;
  }
  bar.classList.add('visible', 'open');
  const titleEl = document.getElementById('simInspectorTitle');
  const curRot = getObjRotation(obj.storeKey || obj.id);
  const rotDeg = curRot * 90;
  if (titleEl) {
    if (obj.isRoomWall) {
      titleEl.textContent = `🧱 ${obj.label} (${obj.dx.toFixed(1)}×${obj.dy.toFixed(1)}m · H:${(obj.dz || 2.4).toFixed(1)}m)`;
    } else {
      titleEl.textContent = `${obj.label} (${obj.dx.toFixed(1)}×${obj.dy.toFixed(1)}m · ${rotDeg}°)`;
    }
  }
  const interactBtn = document.getElementById('btnInspectInteract');
  if (interactBtn) {
    if (obj.isRoomWall) {
      if (obj.isPillar) {
        interactBtn.textContent = '🧱 結構承重柱';
        interactBtn.title = '建築承重柱（無法拆除）';
      } else {
        const curFinish = simState.hardscape?.wallMat || 'warm';
        const finishName = curFinish === 'stone' ? '文化石' : curFinish === 'acoustic' ? '吸音木質' : '跳色乳膠漆';
        interactBtn.textContent = `🎨 切換飾面 (${finishName})`;
        interactBtn.title = '點擊循環切換牆面材質飾面 (跳色漆 / 文化石 / 吸音棉木格柵)';
      }
    } else if (isPartitionWall(obj.id)) {
      ensureV4State();
      const pCfg = (simState.hardscape?.partitions || []).find(p => p.id === obj.id)
        || (simState.hardscape?.partitionConfig && simState.hardscape.partitionConfig.id === obj.id ? simState.hardscape.partitionConfig : null)
        || obj.cfg
        || {};
      if (pCfg.type === 'solid') {
        interactBtn.textContent = '🧱 純隔間牆';
        interactBtn.title = '純實心隔間牆（實心無門）';
      } else if (pCfg.doorStyle === 'open-arch') {
        interactBtn.textContent = '⛩️ 穿透拱門';
        interactBtn.title = '目前為開放式穿透拱門（無門扇阻擋）';
      } else {
        interactBtn.textContent = pCfg.doorOpen ? '🔒 闔上房門' : '🚪 開啟房門';
        interactBtn.title = '點擊切換隔間門開關狀態';
      }
    } else {
      interactBtn.textContent = '⚡ 互動';
      interactBtn.title = '派遣角色走過去互動';
    }
  }
  const rotBtn = document.getElementById('btnInspectRotate');
  if (rotBtn) {
    rotBtn.style.display = (!obj.isRoomWall && obj.canRotate) ? 'inline-flex' : 'none';
    if (obj.canRotate) {
      const nextDeg = ((curRot + 1) % 4) * 90;
      rotBtn.innerHTML = `🔄 旋轉至 ${nextDeg}° (R)`;
      rotBtn.title = `順時針旋轉 90° 至 ${nextDeg}° (鍵盤快捷鍵 R)`;
    }
  }
  const jumpBtn = document.getElementById('btnInspectJumpTab');
  if (jumpBtn) {
    if (obj.isRoomWall) {
      jumpBtn.textContent = '🧱 前往硬裝設置';
      jumpBtn.dataset.targetTab = 'hardscape';
      jumpBtn.dataset.targetCat = '';
    } else if (isPartitionWall(obj.id)) {
      jumpBtn.textContent = '🧱 隔間規格設定';
      jumpBtn.dataset.targetTab = 'hardscape';
      jumpBtn.dataset.targetCat = '';
    } else if (obj.isDlc) {
      jumpBtn.textContent = '⚡ 軌道模組';
      jumpBtn.dataset.targetTab = 'build';
      jumpBtn.dataset.targetCat = '';
    } else if (obj.isBaseFurn) {
      jumpBtn.textContent = '🏠 基礎家具';
      jumpBtn.dataset.targetTab = 'shop';
      jumpBtn.dataset.targetCat = 'basic';
    } else if (obj.isV4) {
      const meta = typeof V4_SHOP_CATALOG !== 'undefined' ? V4_SHOP_CATALOG.find(m => m.id === obj.id) : null;
      jumpBtn.textContent = '🛋️ 前往商城';
      jumpBtn.dataset.targetTab = 'shop';
      jumpBtn.dataset.targetCat = meta?.cat || 'all';
    } else {
      jumpBtn.textContent = '🧱 硬裝設置';
      jumpBtn.dataset.targetTab = 'hardscape';
      jumpBtn.dataset.targetCat = '';
    }
  }
  const remBtn = document.getElementById('btnInspectRemove');
  if (remBtn) {
    if (obj.isRoomWall) {
      if (obj.isPillar) {
        remBtn.textContent = '🔒 結構管道柱';
        remBtn.disabled = true;
      } else {
        remBtn.disabled = false;
        const curMode = simState.wallMode || 'cutaway';
        const modeLabel = curMode === 'cutaway' ? '剖面模式 (切換全牆)' : curMode === 'full' ? '全牆模式 (切換隱藏)' : '隱藏模式 (切換剖面)';
        remBtn.textContent = `👁️ ${modeLabel}`;
        remBtn.title = '點擊切換牆面顯示模式 (剖面半高 / 完整高牆 / 隱藏)';
      }
    } else {
      remBtn.disabled = false;
      if (isPartitionWall(obj.id)) {
        const pCfg = obj.cfg || simState.hardscape?.partitions?.find(p => p.id === obj.id) || simState.hardscape?.partitionConfig || {};
        const refund = pCfg.type === 'solid' ? 30 : 45;
        remBtn.textContent = `🔨 拆除此牆 (退+§${refund})`;
      } else {
        remBtn.textContent = obj.isDlc ? '🔌 卸下模組' : '🗑️ 收起／售出';
      }
    }
  }
}

function rotateSelectedObject() {
  if (!selectedObjectId) return;
  const allObjects = [...getSceneObjects(), ...getWallHitboxes().filter(b => b.isRoomWall)];
  const obj = allObjects.find(o => o.id === selectedObjectId);
  if (!obj || !obj.canRotate) {
    if (obj?.isRoomWall) {
      showRoomBanner('🧱 建築實體外牆與承重柱固定於房屋邊界，不可旋轉！');
    } else {
      showRoomBanner('💡 壁掛軌道模組固定於牆面滑軌，可左右拖曳滑移位置！');
    }
    return;
  }
  ensureV4State();
  if (!simState.rotatedItems) simState.rotatedItems = {};
  const key = obj.storeKey || obj.id;
  const curRot = getObjRotation(key);
  const nextRot = (curRot + 1) % 4;
  simState.rotatedItems[key] = nextRot;

  // Preserve floor center point so object stays in place instead of jumping/resetting
  const oldCx = obj.x + obj.dx * 0.5;
  const oldCy = obj.y + obj.dy * 0.5;
  const newDx = obj.dy; // 90-degree step always swaps width and depth footprint
  const newDy = obj.dx;
  const { w: roomW, d: roomD } = getRoomDimensions(simState.profile?.area || 18);
  const snapStep = obj.isSubgrid ? 0.05 : 0.25;
  const rawX = Math.round((oldCx - newDx * 0.5) / snapStep) * snapStep;
  const rawY = Math.round((oldCy - newDy * 0.5) / snapStep) * snapStep;
  const clampedX = Math.max(0.15, Math.min(roomW - newDx - 0.15, rawX));
  const clampedY = Math.max(0.15, Math.min(roomD - newDy - 0.15, rawY));

  if (!simState.v4Positions) simState.v4Positions = {};
  simState.v4Positions[key] = {
    x: Number(clampedX.toFixed(2)),
    y: Number(clampedY.toFixed(2))
  };

  // Synchronize partition wall orientation and coordinates with its rotated dimensions
  if (isPartitionWall(obj.id)) {
    ensureV4State();
    const pCfg = simState.hardscape?.partitions?.find(p => p.id === obj.id) || simState.hardscape?.partitionConfig;
    if (pCfg) {
      pCfg.orient = (newDx >= newDy) ? 'x' : 'y';
      pCfg.x = Number(clampedX.toFixed(2));
      pCfg.y = Number(clampedY.toFixed(2));
    }
    renderV4Panels();
  }

  triggerSnapEffect(obj.id);
  playSimSound('snap');
  saveSimState();
  renderSim();
  updateObjInspectorUI();
  const degNames = ['0° (預設朝向)', '90° (順時針)', '180° (反向朝向)', '270° (逆時針)'];
  showRoomBanner(`🔄 已將「${obj.label}」旋轉 90° 至 ${degNames[nextRot]}！`);
}

function removeSelectedObject() {
  if (!selectedObjectId) return;
  const allObjects = [...getSceneObjects(), ...getWallHitboxes().filter(b => b.isRoomWall)];
  const obj = allObjects.find(o => o.id === selectedObjectId);
  if (!obj) return;
  if (obj.isRoomWall) {
    if (obj.isPillar) {
      playSimSound('error');
      showRoomBanner('⚠️ 結構管道柱屬於承重結構，無法拆除！');
      return;
    }
    const modes = ['cutaway', 'full', 'none'];
    const curIdx = modes.indexOf(simState.wallMode || 'cutaway');
    simState.wallMode = modes[(curIdx + 1) % modes.length];
    saveSimState();
    syncSimTopBarUI();
    playSimSound('tap');
    renderSim();
    updateObjInspectorUI();
    const modeNames = { cutaway: '剖面半高模式', full: '完整全牆模式', none: '牆面完全隱藏模式' };
    showRoomBanner(`👁️ 已切換牆面顯示模式為「${modeNames[simState.wallMode]}」！`);
    return;
  }
  if (isPartitionWall(obj.id)) {
    deletePartitionWall(obj.id);
    return;
  }
  if (obj.isDlc) {
    simState.dlcs[obj.id] = false;
    selectedObjectId = null;
    saveSimState();
    playSimSound('tap');
    renderSim();
    updateObjInspectorUI();
    showRoomBanner(`🔌 已從牆面軌道卸下「${obj.label}」`);
    return;
  }
  if (obj.isBaseFurn && obj.storeKey) {
    simState.furniture = (simState.furniture || []).filter(k => k !== obj.storeKey);
    selectedObjectId = null;
    saveSimState();
    playSimSound('tap');
    renderSim();
    updateObjInspectorUI();
    showRoomBanner(`📦 已將「${obj.label}」收回家具庫！`);
    return;
  }
  if (obj.isV4) {
    if (simState.lockedItems && simState.lockedItems.includes(obj.id)) {
      playSimSound('error');
      showSimMessage('🔒 此為劇本鎖定之舊家家具，不可賣出，請拖曳調整擺放位置！', true);
      return;
    }
    const meta = typeof V4_SHOP_CATALOG !== 'undefined' ? V4_SHOP_CATALOG.find(m => m.id === obj.id) : null;
    const refund = meta ? Math.round(meta.price * 0.5) : 35;
    simState.v4Items = (simState.v4Items || []).filter(k => k !== obj.id);
    simState.money += refund;
    selectedObjectId = null;
    saveSimState();
    playSimSound('tap');
    renderSim();
    updateObjInspectorUI();
    showRoomBanner(`♻️ 已售出「${obj.label}」，退回 §${refund}！`);
  }
}

document.getElementById('btnInspectInteract')?.addEventListener('click', () => {
  const allObjects = [...getSceneObjects(), ...getWallHitboxes().filter(b => b.isRoomWall)];
  let obj = selectedObjectId ? allObjects.find(o => o.id === selectedObjectId) : null;
  if (!obj && selectedObjectId && isPartitionWall(selectedObjectId)) {
    ensureV4State();
    const liveWall = (simState.hardscape?.partitions || []).find(p => p.id === selectedObjectId);
    if (liveWall) {
      obj = { id: liveWall.id, isPartition: true, cfg: liveWall };
    }
  }
  if (!obj) return;
  if (obj.isRoomWall) {
    if (obj.isPillar) {
      playSimSound('tap');
      showRoomBanner('🧱 結構承重柱：穩固支撐房屋樑柱與管道間');
      return;
    }
    ensureV4State();
    if (!simState.hardscape) simState.hardscape = {};
    const finishes = ['warm', 'stone', 'acoustic'];
    const curIdx = finishes.indexOf(simState.hardscape.wallMat || 'warm');
    simState.hardscape.wallMat = finishes[(curIdx + 1) % finishes.length];
    saveSimState();
    playSimSound('snap');
    renderSim();
    renderV4Panels();
    updateObjInspectorUI();
    const finishNames = { warm: '溫潤跳色乳膠漆', stone: '北歐文化石牆', acoustic: '專業六角吸音棉牆' };
    showRoomBanner(`🎨 已變更建築主牆飾面為「${finishNames[simState.hardscape.wallMat]}」！`);
    return;
  }
  if (isPartitionWall(obj.id)) {
    ensureV4State();
    const pCfg = (simState.hardscape?.partitions || []).find(p => p.id === obj.id)
      || (simState.hardscape?.partitionConfig && simState.hardscape.partitionConfig.id === obj.id ? simState.hardscape.partitionConfig : null)
      || obj.cfg;
    if (!pCfg) return;
    if (pCfg.type === 'solid') {
      playSimSound('tap');
      showRoomBanner('🧱 此為「純實心隔間牆」（無門扇），可拖曳調整位置或自訂長度！');
      return;
    }
    if (pCfg.doorStyle === 'open-arch') {
      playSimSound('tap');
      showRoomBanner('⛩️ 目前為「穿透式拱門門洞」（無門扇阻擋，恆常暢通）！');
      return;
    }
    pCfg.doorOpen = !pCfg.doorOpen;
    pCfg.manualClosedUntil = pCfg.doorOpen ? 0 : performance.now() + 15000;
    if (obj.cfg) {
      obj.cfg.doorOpen = pCfg.doorOpen;
      obj.cfg.manualClosedUntil = pCfg.manualClosedUntil;
    }
    if (simState.hardscape?.partitionConfig && simState.hardscape.partitionConfig.id === pCfg.id) {
      simState.hardscape.partitionConfig.doorOpen = pCfg.doorOpen;
      simState.hardscape.partitionConfig.manualClosedUntil = pCfg.manualClosedUntil;
    }
    triggerSnapEffect(obj.id);
    saveSimState();
    playSimSound('snap');
    renderSim();
    renderV4Panels();
    updateObjInspectorUI();
    showRoomBanner(`🚪 已${pCfg.doorOpen ? '敞開隔間房門（便於走動）' : '闔上隔間房門（保留獨立隱私）'}！`);
    return;
  }
  const act = simActions.find(a => a.id === obj.action) || simActions[0];
  walkAndPerformAction(act, obj);
});
document.getElementById('btnInspectRotate')?.addEventListener('click', rotateSelectedObject);
document.getElementById('btnInspectRemove')?.addEventListener('click', removeSelectedObject);
document.getElementById('btnInspectClose')?.addEventListener('click', () => {
  selectedObjectId = null;
  updateObjInspectorUI();
});
document.getElementById('btnInspectJumpTab')?.addEventListener('click', () => {
  const jumpBtn = document.getElementById('btnInspectJumpTab');
  if (jumpBtn && jumpBtn.dataset.targetTab) {
    switchDeckTab(jumpBtn.dataset.targetTab, jumpBtn.dataset.targetCat || null);
    showRoomBanner(`📂 已跳轉至「${jumpBtn.textContent.trim()}」控制面板！`);
  }
});

// Empty Room Quick-Start Studio Overlay Buttons
document.getElementById('btnQuickStarterKit')?.addEventListener('click', () => {
  ensureV4State();
  simState.dlcs.work = true;
  simState.dlcs.storage = true;
  ['bed-set', 'shower-pod', 'sofa-set', 'plant-deco'].forEach(id => {
    if (!simState.furniture.includes(id)) simState.furniture.push(id);
  });
  ['work', 'storage', 'bed', 'shower', 'sofa', 'plant'].forEach(k => triggerSnapEffect(k));
  trackPulseUntil = performance.now() + 2200;
  saveSimState();
  playSimSound('buff');
  renderSim();
  showRoomBanner('⚡ 已一鍵配置「TAYA 基礎生活組」（含雙人床、衛浴、沙發、WORK 工作桌與收納牆）！', true);
});

document.getElementById('btnQuickOpenShop')?.addEventListener('click', () => {
  switchDeckTab('shop');
  showRoomBanner('🛋️ 請在右側「商城＆盲盒」自由選購基礎家具或主題單品！');
});

let pointerDownInfo = null;
let didDragOnCanvas = false;

roomCanvas.addEventListener('pointerdown', event => {
  roomCanvas.focus();
  const res = getCanvasMouse3D(event);
  didDragOnCanvas = false;
  const wasAlreadySelected = Boolean(res?.hit && selectedObjectId === res.hit.id);
  pointerDownInfo = { x: event.clientX, y: event.clientY, res, wasAlreadySelected };

  if (res && res.hit) {
    selectedObjectId = res.hit.id;
    updateObjInspectorUI();

    if (res.hit.isDlc && res.hit.slideAxis) {
      let grabOffset = res.hit.slideAxis === 'x' ? 0.8 : 0.6;
      if (window._currentRoomIso) {
        const rect = roomCanvas.getBoundingClientRect();
        const sx0 = (event.clientX - rect.left) * (roomCanvas.width / rect.width);
        const sy0 = (event.clientY - rect.top) * (roomCanvas.height / rect.height);
        const fl0 = window._currentRoomIso.unprojectFloor(sx0, sy0);
        grabOffset = res.hit.slideAxis === 'x' ? (fl0.x - res.hit.x) : (fl0.y - res.hit.y);
      }
      draggingModule = {
        id: res.hit.id,
        axis: res.hit.slideAxis,
        min: res.hit.slideMin,
        max: res.hit.slideMax,
        grabOffset
      };
      lastSlideTickVal = simState.trackPos[res.hit.id] || 0;
      roomCanvas.setPointerCapture(event.pointerId);
      return;
    }

    if (res.hit.isRoomWall) {
      // Room perimeter walls & pillar are structural boundaries, not draggable furniture
      return;
    }

    if (res.hit.storeKey) {
      draggingFloorObj = res.hit;
      draggingFloorObj.lastValidX = res.hit.x;
      draggingFloorObj.lastValidY = res.hit.y;
      draggingFloorObj.isColliding = false;
      lastSlideTickVal = res.hit.x + res.hit.y;
      roomCanvas.setPointerCapture(event.pointerId);
      return;
    }
  } else if (res && !res.hit) {
    cameraDragging = true;
    cameraDragStartX = event.clientX;
    roomCanvas.setPointerCapture(event.pointerId);
  }
});

roomCanvas.addEventListener('pointermove', event => {
  if (draggingFloorObj && window._currentRoomIso) {
    if (Math.hypot(event.clientX - (pointerDownInfo?.x || 0), event.clientY - (pointerDownInfo?.y || 0)) > 10) {
      didDragOnCanvas = true;
      const rect = roomCanvas.getBoundingClientRect();
      const sx = (event.clientX - rect.left) * (roomCanvas.width / rect.width);
      const sy = (event.clientY - rect.top) * (roomCanvas.height / rect.height);
      const fl = window._currentRoomIso.unprojectFloor(sx, sy);
      const { w: roomW, d: roomD } = getRoomDimensions(simState.profile?.area || 18);
      ensureV4State();
      const snapStep = draggingFloorObj.isSubgrid ? 0.05 : 0.25;
      const rawX = Math.round((fl.x - draggingFloorObj.dx / 2) / snapStep) * snapStep;
      const rawY = draggingFloorObj.isWall
        ? 0.05
        : Math.round((fl.y - draggingFloorObj.dy / 2) / snapStep) * snapStep;
      const clampedX = Math.max(0.15, Math.min(roomW - draggingFloorObj.dx - 0.15, rawX));
      const clampedY = draggingFloorObj.isWall
        ? 0.05
        : Math.max(0.15, Math.min(roomD - draggingFloorObj.dy - 0.15, rawY));
      const finalX = Number(clampedX.toFixed(2));
      const finalY = Number(clampedY.toFixed(2));

      // Test collision against solid walls, pillars, partitions AND other furniture
      const colHit = checkFurnitureCollision({
        x: finalX,
        y: finalY,
        dx: draggingFloorObj.dx,
        dy: draggingFloorObj.dy
      }, draggingFloorObj.id);

      draggingFloorObj.isColliding = Boolean(colHit);
      draggingFloorObj.collideTarget = colHit;

      let appliedX = finalX;
      let appliedY = finalY;

      if (!draggingFloorObj.isColliding) {
        draggingFloorObj.lastValidX = finalX;
        draggingFloorObj.lastValidY = finalY;
      } else {
        // Attempt physical surface sliding: test sliding along X with lastValidY
        const slideXHit = checkFurnitureCollision({
          x: finalX,
          y: draggingFloorObj.lastValidY ?? finalY,
          dx: draggingFloorObj.dx,
          dy: draggingFloorObj.dy
        }, draggingFloorObj.id);

        if (!slideXHit && Math.abs(finalX - (draggingFloorObj.lastValidX ?? finalX)) > 0.01) {
          appliedX = finalX;
          appliedY = draggingFloorObj.lastValidY ?? finalY;
          draggingFloorObj.lastValidX = finalX;
        } else {
          // Attempt physical surface sliding: test sliding along Y with lastValidX
          const slideYHit = checkFurnitureCollision({
            x: draggingFloorObj.lastValidX ?? finalX,
            y: finalY,
            dx: draggingFloorObj.dx,
            dy: draggingFloorObj.dy
          }, draggingFloorObj.id);

          if (!slideYHit && Math.abs(finalY - (draggingFloorObj.lastValidY ?? finalY)) > 0.01) {
            appliedX = draggingFloorObj.lastValidX ?? finalX;
            appliedY = finalY;
            draggingFloorObj.lastValidY = finalY;
          } else {
            // Neither axis free: clamp flush at last non-colliding boundary position (NO PENETRATION!)
            appliedX = draggingFloorObj.lastValidX ?? finalX;
            appliedY = draggingFloorObj.lastValidY ?? finalY;
          }
        }
      }

      if (!simState.v4Positions) simState.v4Positions = {};
      simState.v4Positions[draggingFloorObj.storeKey] = {
        x: appliedX,
        y: appliedY
      };
      if (isPartitionWall(draggingFloorObj.id)) {
        const pCfg = simState.hardscape?.partitions?.find(p => p.id === draggingFloorObj.id) || simState.hardscape?.partitionConfig;
        if (pCfg) {
          pCfg.x = appliedX;
          pCfg.y = appliedY;
        }
      }
      if (Math.abs(clampedX + clampedY - lastSlideTickVal) >= 0.25) {
        lastSlideTickVal = clampedX + clampedY;
        playSimSound('tap');
      }
    }
    return;
  }

  if (draggingModule && window._currentRoomIso) {
    if (Math.hypot(event.clientX - (pointerDownInfo?.x || 0), event.clientY - (pointerDownInfo?.y || 0)) > 5) {
      didDragOnCanvas = true;
      const rect = roomCanvas.getBoundingClientRect();
      const sx = (event.clientX - rect.left) * (roomCanvas.width / rect.width);
      const sy = (event.clientY - rect.top) * (roomCanvas.height / rect.height);
      const fl = window._currentRoomIso.unprojectFloor(sx, sy);
      const offset = Number.isFinite(draggingModule.grabOffset)
        ? draggingModule.grabOffset
        : (draggingModule.axis === 'x' ? 0.8 : 0.6);
      const raw = (draggingModule.axis === 'x' ? fl.x : fl.y) - offset;
      const clamped = Math.round(Math.max(draggingModule.min, Math.min(draggingModule.max, raw)) * 20) / 20;
      if (!simState.trackPos) simState.trackPos = { work: 5.1, family: 2.1, storage: 7.35, safe: 2.05 };
      const curObjs = getSceneObjects();
      const modObj = curObjs.find(o => o.id === draggingModule.id);
      let appliedPos = clamped;
      if (modObj) {
        const makeBox = pos => ({
          x: draggingModule.axis === 'x' ? pos : modObj.x,
          y: draggingModule.axis === 'y' ? pos : modObj.y,
          dx: modObj.dx,
          dy: modObj.dy
        });
        const directHit = checkFurnitureCollision(makeBox(clamped), draggingModule.id);
        draggingModule.isColliding = Boolean(directHit);
        if (directHit) {
          const curPos = Number.isFinite(simState.trackPos[draggingModule.id]) ? simState.trackPos[draggingModule.id] : (draggingModule.axis === 'x' ? modObj.x : modObj.y);
          let bestPos = curPos;
          const step = clamped > curPos ? 0.02 : -0.02;
          const count = Math.min(300, Math.ceil(Math.abs(clamped - curPos) / 0.02));
          for (let s = 1; s <= count; s++) {
            const p = Number((curPos + step * s).toFixed(2));
            if (p < draggingModule.min || p > draggingModule.max) break;
            if (!checkFurnitureCollision(makeBox(p), draggingModule.id)) {
              bestPos = p;
            }
          }
          appliedPos = bestPos;
        }
        // Push characters out if module slid onto their position
        const finalBox = makeBox(appliedPos);
        const pushEntityOut = ent => {
          if (!ent) return;
          if (ent.x > finalBox.x - 0.24 && ent.x < finalBox.x + finalBox.dx + 0.24 &&
              ent.y > finalBox.y - 0.24 && ent.y < finalBox.y + finalBox.dy + 0.24) {
            if (draggingModule.axis === 'x') {
              ent.y = finalBox.y + finalBox.dy + 0.32;
            } else {
              ent.x = finalBox.x + finalBox.dx + 0.32;
            }
          }
        };
        pushEntityOut(simState.player);
        if (typeof companionAgents !== 'undefined') companionAgents.forEach(pushEntityOut);
      }
      simState.trackPos[draggingModule.id] = appliedPos;
      if (Math.abs(appliedPos - lastSlideTickVal) >= 0.2) {
        lastSlideTickVal = appliedPos;
        playSimSound('tap');
      }
    }
    return;
  }

  if (cameraDragging) {
    const dx = event.clientX - cameraDragStartX;
    if (Math.abs(dx) > 4) {
      didDragOnCanvas = true;
      cameraDragStartX = event.clientX;
      targetYaw = Math.max(0.15, Math.min(1.4, targetYaw + dx * 0.005));
    }
    return;
  }

  const res = getCanvasMouse3D(event);
  hoveredObject = res ? res.hit : null;
  hoveredSubpart = res ? res.hitSubpart : null;
});

function finishCanvasPointer(event) {
  if (draggingFloorObj) {
    if (didDragOnCanvas) {
      if (draggingFloorObj.isColliding && Number.isFinite(draggingFloorObj.lastValidX) && Number.isFinite(draggingFloorObj.lastValidY)) {
        const vx = draggingFloorObj.lastValidX;
        const vy = draggingFloorObj.lastValidY;
        if (!simState.v4Positions) simState.v4Positions = {};
        simState.v4Positions[draggingFloorObj.storeKey] = { x: vx, y: vy };
        if (isPartitionWall(draggingFloorObj.id)) {
          ensureV4State();
          const pCfg = simState.hardscape?.partitions?.find(p => p.id === draggingFloorObj.id) || simState.hardscape?.partitionConfig;
          if (pCfg) {
            pCfg.x = vx;
            pCfg.y = vy;
          }
        }
        spawnFloatingText('⚠️ 碰撞保護：已退回合法位置', vx, vy, 1.2, '#f43f5e');
        playSimSound('tap');
        showRoomBanner('⚠️ 物件與承重結構或隔間產生碰撞，已自動退回合法無碰撞位置！');
      } else {
        triggerSnapEffect(draggingFloorObj.id);
        playSimSound('snap');
        const updated = getSceneObjects().find(o => o.id === draggingFloorObj.id) || draggingFloorObj;
        showRoomBanner(`📐 「${updated.label}」已擺放至 (${updated.x.toFixed(1)}m, ${updated.y.toFixed(1)}m)${updated.z > 0.2 ? ' 並自動疊上桌面！' : '（按 R 可旋轉 90°）'}`);
      }
      const finalObj = getSceneObjects().find(o => o.id === draggingFloorObj.id) || draggingFloorObj;
      if (isPartitionWall(draggingFloorObj.id)) {
        ensureV4State();
        const pCfg = simState.hardscape?.partitions?.find(p => p.id === draggingFloorObj.id) || simState.hardscape?.partitionConfig;
        if (pCfg) {
          pCfg.x = finalObj.x;
          pCfg.y = finalObj.y;
        }
      }
      saveSimState();
      renderSim();
      renderV4Panels();
      updateObjInspectorUI();
    }
    draggingFloorObj = null;
  }
  if (draggingModule) {
    if (didDragOnCanvas) {
      triggerSnapEffect(draggingModule.id);
      playSimSound('snap');
      saveSimState();
      updateObjInspectorUI();
      showRoomBanner(`🔒 軌道模組已滑移至 ${simState.trackPos[draggingModule.id].toFixed(1)}m 並自動咬合鎖定！`);
    }
    draggingModule = null;
  }
  cameraDragging = false;
}
roomCanvas.addEventListener('pointerup', finishCanvasPointer);
roomCanvas.addEventListener('pointercancel', finishCanvasPointer);

roomCanvas.addEventListener('click', event => {
  if (didDragOnCanvas) {
    didDragOnCanvas = false;
    return;
  }
  const res = getCanvasMouse3D(event);
  if (!res) return;
  if (res.hit) {
    selectedObjectId = res.hit.id;
    updateObjInspectorUI();
    if (res.hit.isRoomWall) {
      playSimSound('tap');
      if (res.hit.isPillar) {
        showRoomBanner('🧱 已選取「結構承重柱」：建築管道與承重結構，提供安全支撐');
      } else {
        showRoomBanner(`🧱 已選取「${res.hit.label}」：點擊下方檢查列可切換飾面材質或切換切牆模式！`);
      }
      return;
    }
    if (isPartitionWall(res.hit.id)) {
      ensureV4State();
      const pCfg = (simState.hardscape?.partitions || []).find(p => p.id === res.hit.id)
        || (simState.hardscape?.partitionConfig && simState.hardscape.partitionConfig.id === res.hit.id ? simState.hardscape.partitionConfig : null)
        || res.hit.cfg;
      const wasAlreadySelected = Boolean(pointerDownInfo?.wasAlreadySelected);
      const isDoorClick = (res.hitSubpart === 'partition-door') || (wasAlreadySelected && pCfg?.type !== 'solid');
      if (isDoorClick && pCfg && pCfg.type !== 'solid') {
        if (pCfg.doorStyle === 'open-arch') {
          playSimSound('tap');
          showRoomBanner('✨ 目前隔間為「開放式穿透拱門」，無門扇阻擋可直接通行！');
          return;
        }
        pCfg.doorOpen = !pCfg.doorOpen;
        pCfg.manualClosedUntil = pCfg.doorOpen ? 0 : performance.now() + 15000;
        if (res.hit.cfg) {
          res.hit.cfg.doorOpen = pCfg.doorOpen;
          res.hit.cfg.manualClosedUntil = pCfg.manualClosedUntil;
        }
        if (simState.hardscape?.partitionConfig && simState.hardscape.partitionConfig.id === pCfg.id) {
          simState.hardscape.partitionConfig.doorOpen = pCfg.doorOpen;
          simState.hardscape.partitionConfig.manualClosedUntil = pCfg.manualClosedUntil;
        }
        triggerSnapEffect(res.hit.id);
        saveSimState();
        playSimSound('snap');
        renderSim();
        renderV4Panels();
        updateObjInspectorUI();
        showRoomBanner(`🚪 已${pCfg.doorOpen ? '敞開隔間房門（動線暢通）' : '闔上隔間房門（保留獨立隱私）'}！`);
        return;
      }
      playSimSound('tap');
      const isSolid = pCfg?.type === 'solid';
      showRoomBanner(`🧱 已選取「${res.hit.label}」：可在 3D 畫面拖曳移位、按 R 旋轉 90°${isSolid ? '' : '，或再次點擊開關房門'}！`);
      renderV4Panels();
      return;
    }
    const act = simActions.find(a => a.id === res.hit.action) || simActions[0];
    walkAndPerformAction(act, res.hit);
  } else if (res.floor) {
    selectedObjectId = null;
    updateObjInspectorUI();
    const clickRDim = getRoomDimensions(simState.profile?.area || 18);
    const destX = Math.max(0.75, Math.min(clickRDim.w - 0.75, res.floor.x));
    const destY = Math.max(1.15, Math.min(clickRDim.d - 0.65, res.floor.y));
    const path = findRoomPath(simState.player.x, simState.player.y, destX, destY);
    simState.player.waypoints = path.slice(1);
    simState.player.targetX = path[0].x;
    simState.player.targetY = path[0].y;
    simState.player.pendingAction = null;
    playSimSound('tap');
  }
});

function walkAndPerformAction(action, targetObj = null) {
  const objs = getSceneObjects();
  const obj = targetObj || objs.find(o => o.id === action.targetObj) || objs[0];
  if (!obj) {
    executeSimAction(action, null);
    return;
  }
  lastPlayerInputAt = performance.now();
  const lookX = obj.x + obj.dx * 0.5;
  const lookY = obj.y + obj.dy * 0.5;
  const dist = Math.hypot(simState.player.x - obj.ix, simState.player.y - obj.iy);
  if (dist < 0.35) {
    simState.player.targetAngle = Math.atan2(lookY - simState.player.y, lookX - simState.player.x);
    executeSimAction(action, obj.id);
  } else {
    const path = findRoomPath(simState.player.x, simState.player.y, obj.ix, obj.iy);
    simState.player.waypoints = path.slice(1);
    simState.player.targetX = path[0].x;
    simState.player.targetY = path[0].y;
    simState.player.lookAtX = lookX;
    simState.player.lookAtY = lookY;
    simState.player.pendingAction = { action, objId: obj.id };
    showSimMessage(`🚶 ${simState.name} 正前往「${obj.label}」準備執行「${action.label}」…`);
  }
}


// ─── V4 3D HARDSCAPE & PROP CANVAS RENDERING ───
function drawV4HardscapeAndProps(iso, now, isNight, isDusk, renderables = [], roomW = 9.0, roomD = 6.6) {
  ensureV4State();
  const hs = simState.hardscape;

  // A. Zoned Floor Materials (clamped to roomW & roomD, drawn on floor BEFORE 3D objects!)
  if (hs.floorMat === 'zoned') {
    const entryY = Math.max(1.8, roomD - 1.55);
    iso.drawBox(0.05, entryY, 0.008, Math.min(2.1, roomW * 0.4), Math.min(1.5, roomD - entryY - 0.05), 0.015, isNight ? '#64748b' : '#cbd5e1');
    const gameX = Math.min(4.2, Math.max(1.8, roomW - 2.9));
    const gameW = Math.min(2.7, roomW - gameX - 0.15);
    if (gameW > 0.6) {
      iso.drawBox(gameX, 0.22, 0.008, gameW, Math.min(1.75, roomD * 0.38), 0.018, isNight ? '#1e1b4b' : '#312e81', { stroke: '#6366f1' });
    }
  } else if (hs.floorMat === 'tile') {
    iso.drawBox(0.04, 0.04, 0.006, roomW - 0.08, roomD - 0.08, 0.014, isNight ? '#64748b' : '#e2e8f0');
  }

  // B. Balcony Extension (behind back wall, drawn before 3D objects)
  if (hs.shape === 'balcony') {
    const balW = Math.min(3.4, roomW - 0.8);
    iso.drawBox(0.4, -0.95, -0.15, balW, 0.95, 0.16, isNight ? '#57534e' : '#a8a29e');
    iso.drawBox(0.4, -0.95, 0.02, balW, 0.08, 0.95, '#38bdf8', { topColor: 'rgba(186,230,253,0.5)' });
  }

  // C. Wall Finishes (clamped to roomW so bricks/foam never float outside the wall!)
  if (!simState.xrayMode) {
    if (hs.wallMat === 'stone') {
      for (let sx = 2.2; sx < roomW - 0.9; sx += 0.95) {
        for (let sz = 0.35; sz < 2.2; sz += 0.42) {
          iso.drawBox(sx + ((sz * 10) % 2) * 0.15, 0.01, sz, 0.72, 0.05, 0.32, isNight ? '#94a3b8' : '#e5e0d5');
        }
      }
    } else if (hs.wallMat === 'acoustic') {
      const cols = ['#1e293b', '#334155', '#0f766e', '#b45309'];
      let idx = 0;
      const startX = Math.min(3.8, roomW * 0.45);
      for (let sx = startX; sx < roomW - 0.65; sx += 0.65) {
        for (let sz = 1.05; sz < 2.35; sz += 0.48) {
          iso.drawBox(sx, 0.02, sz, 0.52, 0.06, 0.38, cols[idx % cols.length]);
          idx++;
        }
      }
    }
  }

  // D. Fixed Entry Main Door (clamped to roomD so it always stays on the Left Wall!) & Window Blinds
  const doorY = Math.max(2.1, Math.min(5.25, roomD - 1.15));
  iso.drawBox(-0.04, doorY, 0, 0.12, 0.95, 2.05, '#5c4028');
  iso.drawBox(0.02, doorY + 0.7, 0.95, 0.08, 0.12, 0.08, '#f59e0b');

  const blindPct = (hs.blindsOpen ?? 80) / 100;
  const winW = Math.min(1.32, roomW * 0.31);
  for (let i = 0; i < 5; i++) {
    const sz = 1.12 + i * 0.21;
    const slatH = 0.04 + (1 - blindPct) * 0.15;
    iso.drawBox(0.66, 0.02, sz, winW, 0.06, slatH, '#f8fafc');
  }
  if (!isNight && blindPct > 0.1) {
    roomCtx.save();
    const sunAlpha = (isDusk ? 0.14 : 0.22) * blindPct;
    const sunCol = isDusk ? `rgba(251, 146, 60, ${sunAlpha})` : `rgba(254, 249, 195, ${sunAlpha})`;
    for (let s = 0; s < 3; s++) {
      const sy = 0.4 + s * 0.55;
      if (sy + 0.35 > roomD) continue;
      const pts = [
        iso.project(0.7, sy, 0.012),
        iso.project(0.7 + winW, sy, 0.012),
        iso.project(0.95 + winW, sy + 0.32 * blindPct, 0.012),
        iso.project(0.95, sy + 0.32 * blindPct, 0.012)
      ];
      iso.drawPoly(pts, sunCol, null);
    }
    roomCtx.restore();
  }

  // E. Wall Power Outlets & Cable Raceway (clamped to roomW & roomD)
  WALL_OUTLETS.forEach(o => {
    if (o.x < roomW - 0.25 && o.y < roomD - 0.25) {
      iso.drawBox(o.x, o.y, o.z, 0.16, 0.06, 0.12, '#f8fafc', { stroke: '#64748b' });
    }
  });
  if (hs.cableRaceway) {
    iso.drawBox(0.15, 0.06, 0.04, roomW - 0.3, 0.08, 0.05, '#d97706');
  }

  // F. Push 3D Volumetric Hardscape & V4 Props into renderables for accurate depth sorting!
  if (hs.shape === 'lshape') {
    const lw = Math.min(2.15, roomW * 0.28);
    const ld = Math.min(1.75, roomD * 0.28);
    const lx = roomW - lw;
    const ly = roomD - ld;
    renderables.push({
      depth: iso.project(lx + lw * 0.5, ly + ld * 0.5, 1.3).depth,
      draw: () => iso.drawBox(lx, ly, 0, lw, ld, 2.65, isNight ? '#334155' : '#cfc6b8')
    });
  }

  if (hs.pillar) {
    renderables.push({
      depth: iso.project(0.51, 2.21, 1.3).depth,
      draw: () => {
        iso.drawShadow(0.22, 1.92, 0.62, 0.62, 0.22);
        iso.drawBox(0.22, 1.92, 0, 0.58, 0.58, 2.62, isNight ? '#64748b' : '#cbd5e1');
      }
    });
  }

  if (hasV4Item('robot-vac')) {
    const rv = robotVacState;
    rv.x = Math.max(0.9, Math.min(roomW - 0.9, rv.x));
    rv.y = Math.max(1.2, Math.min(roomD - 0.8, rv.y));
    renderables.push({
      depth: iso.project(rv.x, rv.y, 0.06).depth,
      draw: () => {
        iso.drawShadow(rv.x - 0.2, rv.y - 0.2, 0.4, 0.4, 0.2);
        iso.drawBox(rv.x - 0.18, rv.y - 0.18, 0.01, 0.36, 0.36, 0.1, '#f8fafc', { stroke: '#38bdf8' });
        iso.drawBox(rv.x - 0.06, rv.y - 0.06, 0.11, 0.12, 0.12, 0.04, '#0284c7');
      }
    });
  }

  simState.v4Items.forEach(id => {
    if (id === 'robot-vac') return;
    const item = V4_SHOP_CATALOG.find(m => m.id === id);
    if (!item) return;
    const pos = getV4ItemPos(item);
    const lift = getSnapLift(id, now);
    const isInteracting = activeInteraction && activeInteraction.objId === id;
    const bounce = isInteracting ? Math.sin((now - activeInteraction.startAt) / 80) * 0.035 : 0;
    const x = pos.x, y = pos.y, z0 = pos.z + lift + Math.max(0, bounce);
    const dx = pos.dx, dy = pos.dy, dz = item.dz;
    const zDepth = pos.z > 0.1 ? (pos.z * 3.0) : 0;
    const itemDepth = iso.project(x + dx * 0.5, y + dy * 0.5, zDepth).depth;

    renderables.push({
      depth: itemDepth,
      draw: () => {
        if (z0 < 0.1) iso.drawShadow(x, y, dx, dy, 0.16);
        const isSelected = selectedObjectId === id;
        if (hoveredObject?.id === id || isSelected || isInteracting) {
          const pad = 0.09;
          const pts = [
            iso.project(x - pad, y - pad, pos.z + 0.02),
            iso.project(x + dx + pad, y - pad, pos.z + 0.02),
            iso.project(x + dx + pad, y + dy + pad, pos.z + 0.02),
            iso.project(x - pad, y + dy + pad, pos.z + 0.02)
          ];
          iso.drawPoly(
            pts,
            isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(245, 196, 83, 0.22)',
            isSelected ? '#38bdf8' : '#d49b3b',
            isSelected ? 2.4 : 1.8
          );
        }
        if (id === 'standing-desk') {
          const rot = getObjRotation(id);
          if (rot % 2 === 0) {
            iso.drawBox(x + 0.12, y + 0.15, z0, 0.1, Math.max(0.2, dy - 0.3), 0.74, '#1e293b');
            iso.drawBox(x + dx - 0.22, y + 0.15, z0, 0.1, Math.max(0.2, dy - 0.3), 0.74, '#1e293b');
          } else {
            iso.drawBox(x + 0.15, y + 0.12, z0, Math.max(0.2, dx - 0.3), 0.1, 0.74, '#1e293b');
            iso.drawBox(x + 0.15, y + dy - 0.22, z0, Math.max(0.2, dx - 0.3), 0.1, 0.74, '#1e293b');
          }
          iso.drawBox(x, y, z0 + 0.74, dx, dy, 0.08, '#334155');
        } else if (id === 'rgb-pc-rig') {
          const rot = getObjRotation(id);
          const hueCol = Math.floor(now / 350) % 2 === 0 ? '#ec4899' : '#8b5cf6';
          if (rot % 2 === 0) {
            iso.drawBox(x, y, z0, Math.min(dx * 0.68, 0.78), Math.min(dy, 0.16), 0.42, '#0f172a');
            iso.drawBox(x + 0.03, y + (rot === 0 ? 0.12 : 0), z0 + 0.04, Math.min(dx * 0.62, 0.72), 0.04, 0.34, '#38bdf8');
            iso.drawBox(x + dx - 0.3, y, z0, 0.28, Math.min(dy, 0.38), 0.52, '#1e293b');
            iso.drawBox(x + dx - 0.28, y + 0.04, z0 + 0.06, 0.24, Math.min(dy - 0.06, 0.3), 0.4, hueCol);
          } else {
            iso.drawBox(x, y, z0, Math.min(dx, 0.16), Math.min(dy * 0.68, 0.78), 0.42, '#0f172a');
            iso.drawBox(x + (rot === 1 ? 0.12 : 0), y + 0.03, z0 + 0.04, 0.04, Math.min(dy * 0.62, 0.72), 0.34, '#38bdf8');
            iso.drawBox(x, y + dy - 0.3, z0, Math.min(dx, 0.38), 0.28, 0.52, '#1e293b');
            iso.drawBox(x + 0.04, y + dy - 0.28, z0 + 0.06, Math.min(dx - 0.06, 0.3), 0.24, 0.4, hueCol);
          }
        } else if (id === 'ergo-chair') {
          const rot = getObjRotation(id);
          iso.drawBox(x + dx * 0.5 - 0.07, y + dy * 0.5 - 0.07, z0, 0.14, 0.14, 0.42, '#1e293b');
          iso.drawBox(x, y, z0 + 0.42, dx, dy, 0.1, '#dc2626');
          if (rot === 0) {
            iso.drawBox(x + 0.06, y + dy - 0.12, z0 + 0.52, dx - 0.12, 0.12, 0.62, '#1e293b');
          } else if (rot === 1) {
            iso.drawBox(x, y + 0.06, z0 + 0.52, 0.12, dy - 0.12, 0.62, '#1e293b');
          } else if (rot === 2) {
            iso.drawBox(x + 0.06, y, z0 + 0.52, dx - 0.12, 0.12, 0.62, '#1e293b');
          } else {
            iso.drawBox(x + dx - 0.12, y + 0.06, z0 + 0.52, 0.12, dy - 0.12, 0.62, '#1e293b');
          }
        } else if (id === 'pegboard') {
          iso.drawBox(x, y, z0, dx, dy, dz, '#334155');
          iso.drawBox(x + 0.18, y + 0.08, z0 + 0.22, 0.38, 0.08, 0.16, '#38bdf8');
          iso.drawBox(x + 0.75, y + 0.08, z0 + 0.42, 0.24, 0.1, 0.24, '#f43f5e');
          iso.drawBox(x + 1.08, y + 0.08, z0 + 0.18, 0.2, 0.08, 0.16, '#facc15');
        } else if (id === 'figure-cab') {
          iso.drawBox(x, y, z0, dx, dy, 0.12, '#1e293b');
          iso.drawBox(x, y, z0 + 0.12, dx, dy, dz - 0.22, '#bae6fd', {
            topColor: 'rgba(254,249,195,0.75)',
            rightColor: 'rgba(186,230,253,0.38)',
            leftColor: 'rgba(254,240,138,0.42)'
          });
          iso.drawBox(x + dx * 0.2, y + dy * 0.28, z0 + 0.55, 0.2, 0.2, 0.32, '#f43f5e');
          iso.drawBox(x + dx * 0.55, y + dy * 0.28, z0 + 0.55, 0.2, 0.2, 0.35, '#3b82f6');
          iso.drawBox(x + dx * 0.35, y + dy * 0.28, z0 + 1.15, 0.24, 0.22, 0.38, '#f59e0b');
          iso.drawBox(x, y, z0 + dz - 0.1, dx, dy, 0.1, '#1e293b');
        } else if (id === 'vinyl-player') {
          iso.drawBox(x, y, z0, dx, dy, 0.16, '#92400e');
          iso.drawBox(x + 0.08, y + 0.08, z0 + 0.16, 0.28, 0.28, 0.04, '#1e293b');
        } else if (id === 'mahjong-table') {
          iso.drawBox(x + 0.38, y + 0.38, z0, 0.36, 0.36, 0.66, '#334155');
          iso.drawBox(x, y, z0 + 0.66, dx, dy, 0.12, '#065f46', { topColor: '#10b981' });
        } else if (id === 'beanbag') {
          iso.drawBox(x, y, z0, dx, dy, 0.38, '#d97706');
          iso.drawBox(x + 0.1, y + 0.1, z0 + 0.38, dx - 0.2, dy - 0.2, 0.24, '#f59e0b');
        } else if (id === 'projector') {
          iso.drawBox(x, y, z0 + 0.45, dx, dy, 1.05, '#f8fafc', { leftColor: '#38bdf8', topColor: '#38bdf8' });
        } else if (id === 'kitchen-island-suite') {
          // The Sims 4 Style Modular U-Shaped Kitchen & Breakfast Island Suite
          const topCol = '#3d2b1f'; // Dark walnut countertop
          const cabCol = '#ffffff'; // White modern shaker cabinets
          // 1. Backsplash subway tiles on back wall behind the counters
          for (let tx = x + 0.1; tx < x + dx - 0.15; tx += 0.35) {
            for (let tz = z0 + 0.9; tz < z0 + 1.85; tz += 0.28) {
              iso.drawBox(tx, y + 0.01, tz, 0.32, 0.04, 0.25, '#f8fafc', {
                topColor: '#ffffff', stroke: 'rgba(148,163,184,0.45)'
              });
            }
          }
          // 2. Double-Door Tall Refrigerator
          iso.drawBox(x + 0.08, y + 0.05, z0, 0.72, 0.75, 1.88, '#f1f5f9');
          iso.drawBox(x + 0.43, y + 0.78, z0 + 0.55, 0.03, 0.05, 1.25, '#1e293b');
          iso.drawBox(x + 0.4, y + 0.81, z0 + 0.75, 0.04, 0.03, 0.65, '#cbd5e1');
          iso.drawBox(x + 0.46, y + 0.81, z0 + 0.75, 0.04, 0.03, 0.65, '#cbd5e1');
          iso.drawBox(x + 0.12, y + 0.81, z0 + 0.25, 0.64, 0.03, 0.05, '#cbd5e1');

          // 3. Central Cooktop & Built-in Oven Counter
          iso.drawBox(x + 0.82, y + 0.05, z0, 0.85, 0.68, 0.84, cabCol);
          iso.drawBox(x + 0.8, y + 0.03, z0 + 0.84, 0.88, 0.72, 0.06, topCol);
          iso.drawBox(x + 0.92, y + 0.15, z0 + 0.9, 0.62, 0.48, 0.02, '#0f172a');
          iso.drawBox(x + 0.86, y + 0.71, z0 + 0.15, 0.76, 0.04, 0.62, '#1e293b');
          iso.drawBox(x + 0.94, y + 0.73, z0 + 0.22, 0.6, 0.03, 0.45, '#38bdf8', { topColor: 'rgba(56,189,248,0.45)' });
          iso.drawBox(x + 0.95, y + 0.76, z0 + 0.72, 0.58, 0.03, 0.04, '#cbd5e1');

          // 4. Right Return Counter & Undermount Sink
          iso.drawBox(x + dx - 0.7, y + 0.05, z0, 0.65, dy - 0.1, 0.84, cabCol);
          iso.drawBox(x + dx - 0.72, y + 0.03, z0 + 0.84, 0.68, dy - 0.06, 0.06, topCol);
          iso.drawBox(x + dx - 0.62, y + 0.45, z0 + 0.82, 0.48, 0.55, 0.1, '#94a3b8');
          iso.drawBox(x + dx - 0.58, y + 0.72, z0 + 0.9, 0.06, 0.06, 0.25, '#e2e8f0');
          iso.drawBox(x + dx - 0.58, y + 0.62, z0 + 1.12, 0.06, 0.14, 0.05, '#f8fafc');

          // 5. Front Breakfast Island Bar Peninsula
          iso.drawBox(x + 0.75, y + dy - 0.65, z0, dx - 1.45, 0.62, 0.84, cabCol);
          iso.drawBox(x + 0.7, y + dy - 0.68, z0 + 0.84, dx - 1.35, 0.68, 0.06, topCol);
          iso.drawBox(x + 0.75, y + dy - 0.04, z0 + 0.18, dx - 1.45, 0.04, 0.04, '#cbd5e1');
        } else if (id === 'fridge-2d') {
          const rot = getObjRotation(id);
          iso.drawBox(x, y, z0, dx, dy, dz, '#475569');
          if (rot === 0) {
            iso.drawBox(x + dx * 0.48, y + dy - 0.03, z0 + 0.2, 0.04, 0.05, dz - 0.35, '#cbd5e1');
          } else if (rot === 1) {
            iso.drawBox(x + 0.02, y + dy * 0.48, z0 + 0.2, 0.05, 0.04, dz - 0.35, '#cbd5e1');
          } else if (rot === 2) {
            iso.drawBox(x + dx * 0.48, y + 0.02, z0 + 0.2, 0.04, 0.05, dz - 0.35, '#cbd5e1');
          } else {
            iso.drawBox(x + dx - 0.04, y + dy * 0.48, z0 + 0.2, 0.05, 0.04, dz - 0.35, '#cbd5e1');
          }
        } else if (id === 'coffee-maker' || id === 'air-fryer') {
          iso.drawBox(x, y, z0, dx, dy, dz, id === 'coffee-maker' ? '#b91c1c' : '#1e293b');
        } else if (id === 'cat-tree') {
          iso.drawBox(x, y, z0, dx, dy, 0.1, '#d6c7b2');
          iso.drawBox(x + 0.28, y + 0.28, z0 + 0.1, 0.18, 0.18, dz - 0.1, '#b08968');
          iso.drawBox(x + 0.08, y + 0.1, z0 + 0.95, 0.58, 0.55, 0.08, '#e6ccb2');
          iso.drawBox(x + 0.12, y + 0.12, z0 + 1.55, 0.52, 0.52, 0.28, '#bae6fd');
          iso.drawBox(x + 0.24, y + 0.24, z0 + 1.68, 0.24, 0.24, 0.22, '#1e293b');
        } else if (id === 'neon-sign') {
          iso.drawBox(x, y, z0, dx, dy, dz, '#ec4899', { topColor: '#22d3ee', leftColor: '#f472b6' });
        } else if (id === 'aqua-tank') {
          iso.drawBox(x, y, z0, dx, dy, dz, '#06b6d4', { topColor: '#67e8f9', leftColor: '#10b981' });
        } else {
          iso.drawBox(x, y, z0, dx, dy, dz, '#648272');
        }
      }
    });
  });
}

function drawV4PostOverlays(iso, now, isNight, isDusk, roomW = 9.0, roomD = 6.6) {
  if (isNight || isDusk) {
    simState.v4Items.forEach(id => {
      const item = V4_SHOP_CATALOG.find(m => m.id === id);
      if (!item || !item.emitsLight) return;
      const pos = getV4ItemPos(item);
      const pt = iso.project(pos.x + pos.dx / 2, pos.y + pos.dy / 2, pos.z + item.dz * 0.6);
      roomCtx.save();
      const radius = item.emitsLight === 'rgb' || item.emitsLight === 'neon' ? 78 : 65;
      const grad = roomCtx.createRadialGradient(pt.x, pt.y, 4, pt.x, pt.y, radius);
      if (item.emitsLight === 'rgb') {
        grad.addColorStop(0, 'rgba(236, 72, 153, 0.55)');
        grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.28)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      } else if (item.emitsLight === 'neon') {
        grad.addColorStop(0, 'rgba(34, 211, 238, 0.62)');
        grad.addColorStop(0.5, 'rgba(236, 72, 153, 0.3)');
        grad.addColorStop(1, 'rgba(236, 72, 153, 0)');
      } else if (item.emitsLight === 'aqua') {
        grad.addColorStop(0, 'rgba(52, 211, 153, 0.55)');
        grad.addColorStop(1, 'rgba(6, 182, 212, 0)');
      } else {
        grad.addColorStop(0, 'rgba(254, 240, 138, 0.55)');
        grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      }
      roomCtx.fillStyle = grad;
      roomCtx.beginPath();
      roomCtx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      roomCtx.fill();
      roomCtx.restore();
    });
  }

  if (pathCheckAnim && now - pathCheckAnim.startAt < 4500) {
    const pts = pathCheckAnim.waypoints.map(w => iso.project(
      Math.min(roomW - 0.5, w.x),
      Math.min(roomD - 0.5, w.y),
      0.08
    ));
    roomCtx.save();
    roomCtx.lineWidth = 4;
    roomCtx.setLineDash([8, 5]);
    roomCtx.strokeStyle = pathCheckAnim.blocked ? '#ef4444' : '#22c55e';
    roomCtx.beginPath();
    pts.forEach((p, idx) => {
      if (idx === 0) roomCtx.moveTo(p.x, p.y);
      else roomCtx.lineTo(p.x, p.y);
    });
    roomCtx.stroke();
    pts.forEach((p, idx) => {
      roomCtx.fillStyle = pathCheckAnim.blocked && idx >= 2 ? '#ef4444' : '#22c55e';
      roomCtx.beginPath();
      roomCtx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      roomCtx.fill();
    });
    roomCtx.restore();
  }
}

// 3. Render Shop UI, Combo Tags, Scenario Checklist, Hardscape & Quote Exporter

// ─── 6. 3D STRUCTURAL CUTAWAY & EXPLODED MODEL VIEWER (#snap3DCanvas — GSAP 3 Driven) ───
const snapCanvas = document.getElementById('snap3DCanvas');
const snapCtx = snapCanvas ? snapCanvas.getContext('2d') : null;
let snapCurrentMod = 'work';
let snapExploded = false;
const snapAnimState = { progress: 1, yaw: 0.68 }; // Driven by GSAP tweens!
let snapDragging = false;
let snapDragStartX = 0;

const snapModulesData = {
  work: {
    title: 'WORK DLC · 隱藏壁掛折疊工作桌',
    desc: '展開即變身人體工學獨立工作檯，附設雙螢幕支架與閱讀燈，收起僅佔牆面厚度 8cm。',
    time: '約 30~45 分鐘快裝',
    damage: '0% (免打牆零粉塵)',
    power: '軌道 110V 隱藏供電',
    value: '支援舊件回收折抵',
    note: '💡 核心優勢：料理台不再被筆電佔滿，隨需展開專業遠端辦公空間。'
  },
  family: {
    title: 'FAMILY DLC · 變形分享料理中島',
    desc: '滑軌展開延伸 1.2 米備料檯面，整合石英石檯面、水槽與 IH 感應爐，支援多人共煮。',
    time: '約 45~60 分鐘定位',
    damage: '0% (免敲除既有牆面)',
    power: '水電雙匯流快接介面',
    value: '支援舊件回收折抵',
    note: '💡 核心優勢：家庭人數增加時無痛擴充中島，免除傳統廚房打掉重練。'
  },
  storage: {
    title: 'STORAGE DLC · 頂天立地高密度收納櫃',
    desc: '上下雙軌道咬合固定，垂直利用牆面直到天花板，內嵌感應展示燈帶與分類收納格。',
    time: '約 40 分鐘模組組裝',
    damage: '0% (免木作釘牆)',
    power: '24V 層板感應照明',
    value: '支援舊件回收折抵',
    note: '💡 核心優勢：釋放 40% 以上地面走道空間，解決家庭成長期的收納爆炸痛點。'
  },
  safe: {
    title: 'SAFE DLC · 樂齡安全感應扶手組',
    desc: '溫潤木質防滑握把結合航太鋁合金卡扣，內嵌夜間紅外線感應低照度地燈與防撞護角。',
    time: '約 20 分鐘即扣即用',
    damage: '0% (零泥作施工)',
    power: '24V 安全弱電感應迴路',
    value: '支援舊件回收折抵',
    note: '💡 核心優勢：老屋無須大動干戈，快速升級全齡無障礙安全環境，守護在地老化。'
  }
};

function renderSnap3DModel() { const sh = `${snapCurrentMod}:${snapAnimState.yaw.toFixed(4)}:${snapAnimState.progress.toFixed(4)}`; if (sh === window._lastSnapHash) { requestAnimationFrame(renderSnap3DModel); return; } window._lastSnapHash = sh;
  if (!snapCtx || !snapCanvas) return;
  const W = snapCanvas.width;
  const H = snapCanvas.height;
  snapCtx.clearRect(0, 0, W, H);

  const iso = createIsoProjector(snapCtx, {
    yaw: snapAnimState.yaw,
    pitch: 0.52,
    scale: 68,
    cx: 2.2,
    cy: 2.0,
    ox: W * 0.48,
    oy: H * 0.62
  });

  const gap = (1 - snapAnimState.progress) * 0.95;

  // LAYER 01: 3D Structural Wall & Studs
  const yL1 = 0.2;
  iso.drawShadow(0.6, yL1, 3.2, 0.35 + gap * 2.6, 0.14);
  iso.drawBox(0.6, yL1, 0, 3.2, 0.28, 2.5, '#dfd8cc');
  [0.85, 1.75, 2.65, 3.45].forEach(sx => {
    iso.drawBox(sx, yL1 + 0.04, 0, 0.14, 0.2, 2.55, '#94a3b8');
  });

  // LAYER 02: 3D 6063-T6 Aluminum Dual-Channel Rail + Power/Water Bus
  const yL2 = yL1 + 0.28 + gap * 0.85;
  iso.drawBox(0.65, yL2, 0.95, 3.1, 0.22, 0.32, '#64748b');
  iso.drawBox(0.65, yL2 + 0.06, 1.04, 3.1, 0.18, 0.08, '#38bdf8');
  iso.drawBox(0.65, yL2 + 0.06, 0.97, 3.1, 0.16, 0.05, '#f59e0b');

  // LAYER 03: 3D Gravity Auto-Lock Cleat & Safety Pin
  const yL3 = yL2 + 0.22 + gap * 0.95;
  iso.drawBox(1.1, yL3, 0.98, 0.38, 0.22, 0.28, '#d97706');
  iso.drawBox(2.85, yL3, 0.98, 0.38, 0.22, 0.28, '#d97706');

  // LAYER 04: 3D DLC Furniture Module
  const yL4 = yL3 + 0.22 + gap * 1.1;
  if (snapCurrentMod === 'work') {
    iso.drawBox(0.9, yL4, 0.96, 2.5, 1.15, 0.1, '#9c6639');
    iso.drawBox(1.6, yL4 + 0.2, 1.06, 1.1, 0.12, 0.62, '#1e293b');
    iso.drawBox(1.65, yL4 + 0.28, 1.12, 1.0, 0.04, 0.5, '#38bdf8');
    iso.drawBox(2.95, yL4 + 0.2, 1.06, 0.2, 0.2, 0.55, '#f59e0b');
  } else if (snapCurrentMod === 'family') {
    iso.drawBox(0.9, yL4, 0.05, 2.5, 1.35, 0.95, '#527464');
    iso.drawBox(0.84, yL4 - 0.04, 1.0, 2.62, 1.45, 0.1, '#f8f5ee');
    iso.drawBox(1.15, yL4 + 0.3, 1.03, 0.85, 0.65, 0.09, '#94a3b8');
    iso.drawBox(2.25, yL4 + 0.3, 1.03, 0.85, 0.65, 0.09, '#1e293b');
    iso.drawBox(2.45, yL4 + 0.45, 1.12, 0.42, 0.38, 0.26, '#e11d48');
  } else if (snapCurrentMod === 'storage') {
    iso.drawBox(1.0, yL4, 0.05, 2.3, 0.85, 2.25, '#8c5e3c');
    iso.drawBox(1.1, yL4 + 0.8, 0.15, 1.0, 0.08, 1.0, '#f4efe4');
    iso.drawBox(2.2, yL4 + 0.8, 0.15, 1.0, 0.08, 1.0, '#f4efe4');
    iso.drawBox(1.1, yL4 + 0.15, 1.25, 2.1, 0.72, 0.52, '#fde68a');
  } else if (snapCurrentMod === 'safe') {
    iso.drawBox(0.85, yL4, 0.98, 2.6, 0.24, 0.14, '#d97706');
    iso.drawBox(0.95, yL4 + 0.04, 0.9, 2.4, 0.16, 0.07, '#84cc16');
    iso.drawBox(1.0, yL4, 0.35, 0.2, 0.2, 0.65, '#94a3b8');
    iso.drawBox(3.1, yL4, 0.35, 0.2, 0.2, 0.65, '#94a3b8');
  }

  if (gap > 0.08) {
    snapCtx.save();
    snapCtx.setLineDash([5, 4]);
    snapCtx.strokeStyle = '#98633f';
    snapCtx.lineWidth = 1.5;
    [1.25, 3.0].forEach(gx => {
      const p1 = iso.project(gx, yL1 + 0.28, 1.1);
      const p2 = iso.project(gx, yL4, 1.1);
      snapCtx.beginPath();
      snapCtx.moveTo(p1.x, p1.y);
      snapCtx.lineTo(p2.x, p2.y);
      snapCtx.stroke();
    });
    snapCtx.restore();
  }

  const callouts = [
    { label: 'L01 牆體骨幹', x: 0.6, y: yL1 + 0.1, z: 2.35, col: '#64748b' },
    { label: 'L02 鋁軌與匯流槽', x: 0.65, y: yL2 + 0.1, z: 1.45, col: '#0284c7' },
    { label: 'L03 自鎖卡扣', x: 2.95, y: yL3 + 0.1, z: 1.42, col: '#d97706' },
    { label: 'L04 3D DLC 模組', x: 2.1, y: yL4 + 0.5, z: 1.85, col: '#527464' }
  ];
  callouts.forEach(c => {
    const pt = iso.project(c.x, c.y, c.z);
    snapCtx.save();
    snapCtx.font = '700 11px "Inter", "Noto Sans TC", sans-serif';
    const w = snapCtx.measureText(c.label).width + 12;
    snapCtx.fillStyle = c.col;
    snapCtx.beginPath();
    snapCtx.roundRect(pt.x - w / 2, pt.y - 10, w, 19, 5);
    snapCtx.fill();
    snapCtx.fillStyle = '#ffffff';
    snapCtx.textAlign = 'center';
    snapCtx.fillText(c.label, pt.x, pt.y + 3);
    snapCtx.restore();
  });

  requestAnimationFrame(renderSnap3DModel);
}

function updateSnapSimUI(modKey, replay = false) {
  snapCurrentMod = modKey;
  const data = snapModulesData[modKey];
  if (!data) return;

  document.getElementById('snapModTitle').textContent = data.title;
  document.getElementById('snapModDesc').textContent = data.desc;
  document.getElementById('snapDataTime').textContent = data.time;
  document.getElementById('snapDataDamage').textContent = data.damage;
  document.getElementById('snapDataPower').textContent = data.power;
  document.getElementById('snapDataValue').textContent = data.value;
  document.getElementById('snapModNote').textContent = data.note;

  // GSAP content transition on the status panel & data cells
  gsap.fromTo(
    '.snap-status-panel > *, .snap-data-cell',
    { y: 12, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.38, stagger: 0.04, ease: "power2.out", overwrite: "auto" }
  );

  const badge = document.getElementById('snapStatusBadge');
  if (replay || !snapExploded) {
    snapExploded = false;
    document.getElementById('snapBtnLocked').classList.add('active');
    document.getElementById('snapBtnExploded').classList.remove('active');
    if (badge) {
      badge.className = 'snap-status-badge locked';
      badge.innerHTML = '<span>✓</span> 3D 模型狀態：卡扣已咬合鎖定';
    }
    gsap.fromTo(
      snapAnimState,
      { progress: 0.1 },
      { progress: 1, duration: 0.72, ease: "back.out(1.5)", overwrite: "auto" }
    );
    playSimSound('snap');
  }
}

document.querySelectorAll('.snap-sim-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.snap-sim-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateSnapSimUI(btn.dataset.mod, true);
  });
});

document.getElementById('snapBtnLocked')?.addEventListener('click', () => {
  snapExploded = false;
  gsap.to(snapAnimState, { progress: 1, duration: 0.65, ease: "back.out(1.4)", overwrite: "auto" });
  document.getElementById('snapBtnLocked').classList.add('active');
  document.getElementById('snapBtnExploded').classList.remove('active');
  const badge = document.getElementById('snapStatusBadge');
  if (badge) {
    badge.className = 'snap-status-badge locked';
    badge.innerHTML = '<span>✓</span> 3D 模型狀態：卡扣已咬合鎖定';
  }
  playSimSound('snap');
});

document.getElementById('snapBtnExploded')?.addEventListener('click', () => {
  snapExploded = true;
  gsap.to(snapAnimState, { progress: 0, duration: 0.65, ease: "power3.out", overwrite: "auto" });
  document.getElementById('snapBtnExploded').classList.add('active');
  document.getElementById('snapBtnLocked').classList.remove('active');
  const badge = document.getElementById('snapStatusBadge');
  if (badge) {
    badge.className = 'snap-status-badge';
    badge.innerHTML = '<span>💥</span> 3D 結構爆炸圖：展示四層分解結構';
  }
  playSimSound('tap');
});

document.getElementById('snapBtnReplay')?.addEventListener('click', () => {
  updateSnapSimUI(snapCurrentMod, true);
});

if (snapCanvas) {
  const quickSnapYaw = gsap.quickTo(snapAnimState, 'yaw', { duration: 0.25, ease: "power2.out" });
  snapCanvas.addEventListener('pointerdown', e => {
    snapDragging = true;
    snapDragStartX = e.clientX;
    snapCanvas.setPointerCapture(e.pointerId);
  });
  snapCanvas.addEventListener('pointermove', e => {
    if (!snapDragging) return;
    const dx = e.clientX - snapDragStartX;
    snapDragStartX = e.clientX;
    const nextYaw = gsap.utils.clamp(0.25, 1.25, snapAnimState.yaw + dx * 0.007);
    quickSnapYaw(nextYaw);
  });
  const endDrag = () => { snapDragging = false; };
  snapCanvas.addEventListener('pointerup', endDrag);
  snapCanvas.addEventListener('pointercancel', endDrag);
  requestAnimationFrame(renderSnap3DModel);
}

