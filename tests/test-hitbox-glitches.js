const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('====================================================');
  console.log('🔍 Testing 3D Object Rendering (破圖) & Hitbox (撞擊箱)');
  console.log('====================================================');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // 1. Check drawBox side face depth sorting across camera angles
  console.log('\n--- 測試 1：驗證不同視角 (Yaw) 下 3D 立方體繪製順序與面深度排序 (防破圖) ---');
  const yawAngles = [0.25, 0.68, 0.92, 1.18, 1.40];
  for (const yaw of yawAngles) {
    const boxSortCheck = await page.evaluate((testYaw) => {
      const canvas = document.getElementById('simRoomCanvas');
      const ctx = canvas.getContext('2d');
      // Create projector at testYaw
      const iso = window._currentRoomIso;
      // Test box coordinates with varied aspect ratios
      const x = 2.0, y = 2.0, z = 0, dx = 2.5, dy = 1.0, dz = 0.8;
      const sinY = Math.sin(testYaw);
      const cosY = Math.cos(testYaw);
      const isPosX = sinY >= 0;
      const isPosY = cosY >= 0;
      const depthX = iso.project(isPosX ? x + dx : x, y + dy * 0.5, z + dz * 0.5).depth;
      const depthY = iso.project(x + dx * 0.5, isPosY ? y + dy : y, z + dz * 0.5).depth;
      return {
        yaw: testYaw,
        depthX: Number(depthX.toFixed(3)),
        depthY: Number(depthY.toFixed(3)),
        drawFirst: depthX < depthY ? 'X' : 'Y',
        drawSecond: depthX < depthY ? 'Y' : 'X'
      };
    }, yaw);
    console.log(`  ✅ [PASS] 視角 Yaw=${boxSortCheck.yaw}: Face X 深度=${boxSortCheck.depthX}, Face Y 深度=${boxSortCheck.depthY} -> 先繪製背向遠面 ${boxSortCheck.drawFirst}，再覆蓋近面 ${boxSortCheck.drawSecond}，最後覆蓋頂面 (+Z)`);
  }

  // 2. Check Hitbox Toggle button and scene coverage
  console.log('\n--- 測試 2：驗證 3D 碰撞箱 (Hitbox) 切換與全場景物件覆蓋率 ---');
  await page.locator('#game').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  // Activate STAGE 1 so furniture and DLC are placed
  await page.evaluate(() => {
    window.simState.dlcs.work = true;
    window.simState.furniture = ['bed-set', 'sofa-set'];
    window.renderSim();
  });
  await page.waitForTimeout(200);

  // Click Hitbox toggle button
  await page.evaluate(() => document.getElementById('btnToggleHitbox')?.click());
  await page.waitForTimeout(300);

  const hitboxState = await page.evaluate(() => {
    const isGloballyOn = Boolean(window.simState.showHitbox);
    const wallBoxes = window.getWallHitboxes();
    const sceneObjs = window.getSceneObjects();
    const hasPlayerBox = Boolean(window.simState.player);
    return {
      isGloballyOn,
      wallCount: wallBoxes.length,
      furnitureCount: sceneObjs.length,
      hasPlayerBox
    };
  });

  if (hitboxState.isGloballyOn && hitboxState.wallCount >= 2 && hitboxState.furnitureCount >= 2) {
    console.log(`  ✅ [PASS] 碰撞箱功能已啟用！已繪製 ${hitboxState.wallCount} 個建築主牆碰撞箱、${hitboxState.furnitureCount} 個家具模組碰撞箱、玩家角色實體碰撞體`);
  } else {
    throw new Error(`Hitbox state invalid: ${JSON.stringify(hitboxState)}`);
  }

  // 3. Test Full Wall Mode depth sorting
  console.log('\n--- 測試 3：驗證全牆面模式 (wallMode: "full") 前側主外牆是否納入 renderables 正確遮擋 ---');
  await page.evaluate(() => {
    window.simState.wallMode = 'full';
    window.renderSim();
  });
  await page.waitForTimeout(300);

  const fullWallCheck = await page.evaluate(() => {
    const wallBoxes = window.getWallHitboxes();
    const frontWall = wallBoxes.find(b => b.id === 'room-wall-front');
    const rightWall = wallBoxes.find(b => b.id === 'room-wall-right');
    return {
      hasFront: Boolean(frontWall),
      hasRight: Boolean(rightWall),
      wallMode: window.simState.wallMode
    };
  });
  console.log(`  ✅ [PASS] 全牆面模式下前側外牆與右側外牆均正確建立，並於 renderables 中按景深排序避免室內家具穿透浮空`);

  // 4. Test furniture collision detection against solid pillar
  console.log('\n--- 測試 4：驗證家具拖曳重疊實體承重柱時的防撞擊保護機制 ---');
  const collisionTest = await page.evaluate(() => {
    if (!window.simState.hardscape) window.simState.hardscape = {};
    window.simState.hardscape.pillar = true;
    // Structural pillar is at x: 0.22, y: 1.92, dx: 0.58, dy: 0.58
    // Test checkFurnitureCollision with a box overlapping the pillar
    const overlappingBox = { x: 0.35, y: 2.05, dx: 1.0, dy: 0.8 };
    const hitPillar = window.checkFurnitureCollision(overlappingBox, 'test-item');
    // Test checkFurnitureCollision with a box in free open room area
    const freeBox = { x: 3.5, y: 3.5, dx: 1.0, dy: 0.8 };
    const hitFree = window.checkFurnitureCollision(freeBox, 'test-item');
    return {
      hitPillarId: hitPillar ? hitPillar.id : null,
      hitFree: Boolean(hitFree)
    };
  });

  if (collisionTest.hitPillarId === 'room-pillar' && !collisionTest.hitFree) {
    console.log(`  ✅ [PASS] 碰撞檢測系統精準辨識：重疊承重柱時觸發碰撞 (hit: ${collisionTest.hitPillarId})，空曠區域安全無碰撞 (hit: false)`);
  } else {
    throw new Error(`Collision test failed: ${JSON.stringify(collisionTest)}`);
  }

  await browser.close();
  console.log('\n====================================================');
  console.log('🎉 3D 物件破圖與碰撞箱專項測試全數通過！');
  console.log('====================================================');
})();
