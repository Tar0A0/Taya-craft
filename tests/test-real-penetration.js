const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('====================================================');
  console.log('🎮 Rigorous Physical Collision & Tunneling Verification');
  console.log('====================================================\n');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  const fileUrl = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Scroll to game simulator
  await page.locator('#game').scrollIntoViewIfNeeded();

  // Test A: WASD keyboard movement into Sofa
  console.log('--- 測試 A：主角使用鍵盤 WASD 移動撞向沙發，驗證不可穿透 ---');
  const wasdSofaResult = await page.evaluate(async () => {
    window.simState.furniture = ['sofa-set', 'bed-set'];
    window.renderSim();
    const sofa = window.getSceneObjects().find(o => o.id === 'sofa');
    // Place player 0.4m above the sofa
    window.simState.player.x = sofa.x + sofa.dx * 0.5;
    window.simState.player.y = sofa.y - 0.4;
    window.simState.player.targetX = null;
    window.simState.player.targetY = null;

    // Simulate pressing Down key (moving down into sofa) for 60 frames (1 second)
    const initialY = window.simState.player.y;
    const roomDim = window.getRoomDimensions(window.simState.profile?.area || 18);

    for (let f = 0; f < 60; f++) {
      const targetY = window.simState.player.y + 3.2 * (1 / 60);
      const moved = window.resolveWallCollisions(
        window.simState.player.x,
        window.simState.player.y,
        window.simState.player.x,
        targetY,
        0.22,
        roomDim.w,
        roomDim.d
      );
      window.simState.player.y = moved.y;
    }

    const finalY = window.simState.player.y;
    const penetrated = finalY >= sofa.y && finalY <= sofa.y + sofa.dy;

    return {
      initialY,
      sofaTopY: sofa.y,
      finalY,
      penetrated,
      stoppedAbove: finalY <= sofa.y
    };
  });
  console.log('  結果:', wasdSofaResult);
  if (wasdSofaResult.stoppedAbove && !wasdSofaResult.penetrated) {
    console.log('  ✅ [PASS] 主角連續 60 幀衝撞沙發，被物理碰撞箱嚴格擋在沙發外側，完全無穿透！');
  } else {
    throw new Error('Player penetrated sofa!');
  }

  // Test B: WASD keyboard movement into solid partition wall
  console.log('\n--- 測試 B：主角使用鍵盤 WASD 移動撞向純隔間牆，驗證不可穿透 ---');
  const wasdPartitionResult = await page.evaluate(async () => {
    window.simState.hardscape = {
      partitions: [
        { id: 'solid-part-test', orient: 'x', type: 'solid', x: 2.0, y: 3.0, length: 4.0 }
      ]
    };
    window.renderSim();
    const roomDim = window.getRoomDimensions(window.simState.profile?.area || 18);

    // Place player at (3.5, 2.6) - above the partition at y=3.0
    window.simState.player.x = 3.5;
    window.simState.player.y = 2.6;
    window.simState.player.targetX = null;
    window.simState.player.targetY = null;

    for (let f = 0; f < 60; f++) {
      const targetY = window.simState.player.y + 3.2 * (1 / 60);
      const moved = window.resolveWallCollisions(
        window.simState.player.x,
        window.simState.player.y,
        window.simState.player.x,
        targetY,
        0.22,
        roomDim.w,
        roomDim.d
      );
      window.simState.player.y = moved.y;
    }

    const finalY = window.simState.player.y;
    const penetrated = finalY >= 3.0;

    return {
      initialY: 2.6,
      wallY: 3.0,
      finalY,
      penetrated,
      stoppedAbove: finalY < 3.0
    };
  });
  console.log('  結果:', wasdPartitionResult);
  if (wasdPartitionResult.stoppedAbove && !wasdPartitionResult.penetrated) {
    console.log('  ✅ [PASS] 主角連續 60 幀衝撞純隔間牆，被物理碰撞箱嚴格擋在牆壁外側，完全無穿透！');
  } else {
    throw new Error('Player penetrated partition wall!');
  }

  // Test C: Dragging Bed onto Sofa - sliding and boundary clamp
  console.log('\n--- 測試 C：拖曳床鋪重疊沙發時的即時防穿透阻擋驗證 ---');
  const dragOverlapResult = await page.evaluate(() => {
    const objs = window.getSceneObjects();
    const sofa = objs.find(o => o.id === 'sofa');
    const bed = objs.find(o => o.id === 'bed');

    // Test dragging bed to exact position of sofa
    const col = window.checkFurnitureCollision({
      x: sofa.x,
      y: sofa.y,
      dx: bed.dx,
      dy: bed.dy
    }, bed.id);

    return {
      collidedWith: col ? col.id : null,
      isBlocked: Boolean(col)
    };
  });
  console.log('  結果:', dragOverlapResult);
  if (dragOverlapResult.isBlocked && dragOverlapResult.collidedWith === 'sofa') {
    console.log('  ✅ [PASS] 家具重疊檢測成功攔截！床鋪不可穿過或重疊沙發');
  } else {
    throw new Error('Furniture-on-furniture collision not detected!');
  }

  // Test D: Dragging Bed onto Structural Pillar
  console.log('\n--- 測試 D：拖曳床鋪重疊建築承重柱時的即時防穿透阻擋驗證 ---');
  const dragPillarResult = await page.evaluate(() => {
    window.simState.hardscape.pillar = true;
    const bed = window.getSceneObjects().find(o => o.id === 'bed');
    // Structural pillar at x: 0.22, y: 1.92, dx: 0.58, dy: 0.58
    const col = window.checkFurnitureCollision({
      x: 0.35,
      y: 2.05,
      dx: bed.dx,
      dy: bed.dy
    }, bed.id);

    return {
      collidedWith: col ? col.id : null,
      isBlocked: Boolean(col)
    };
  });
  console.log('  結果:', dragPillarResult);
  if (dragPillarResult.isBlocked && dragPillarResult.collidedWith === 'room-pillar') {
    console.log('  ✅ [PASS] 建築柱碰撞檢測成功攔截！床鋪不可穿過或重疊承重柱');
  } else {
    throw new Error('Furniture-on-pillar collision not detected!');
  }

  await browser.close();
  console.log('\n====================================================');
  console.log('🎉 所有碰撞防穿透（防 Tunneling & 實體不可穿越）測試 100% 通過！');
  console.log('====================================================');
})();

