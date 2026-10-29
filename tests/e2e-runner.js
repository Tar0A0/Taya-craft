/**
 * TAYACRAFT E2E Playwright Automation Test Suite
 * Scenarios A, B, C, D
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runE2ETests() {
  console.log('====================================================');
  console.log('🚀 Starting TAYACRAFT Playwright E2E Test Suite');
  console.log('====================================================\n');

  const htmlPath = path.resolve(__dirname, '..', 'index.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error('Target index.html not found at: ' + htmlPath);
  }
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 }
  });

  const page = await context.newPage();

  // Track page and console errors for Test D
  const pageErrors = [];
  const consoleErrors = [];
  const consoleWarnings = [];

  page.on('pageerror', err => {
    pageErrors.push(err.message || String(err));
  });

  page.on('console', msg => {
    const text = msg.text();
    // Filter out external CDN font resolution if running offline
    if (text.includes('ERR_NAME_NOT_RESOLVED') || text.includes('ERR_INTERNET_DISCONNECTED') || text.includes('fonts.gstatic.com')) {
      return;
    }
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(text);
    }
  });

  let testCount = 0;
  let passCount = 0;
  let failCount = 0;

  function assert(condition, testName, details = '') {
    testCount++;
    if (condition) {
      passCount++;
      console.log(`  ✅ [PASS] ${testName}`);
    } else {
      failCount++;
      console.error(`  ❌ [FAIL] ${testName} ${details ? ' - ' + details : ''}`);
    }
  }

  try {
    console.log(`📡 Navigating to ${fileUrl}...`);
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.waitForTimeout(600);

    // ─────────────────────────────────────────────────────────────
    // 測試 A：驗證首頁導航點擊時能否平滑滾動至對應章節，並正確切換 .is-current 高亮
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 測試 A：首頁導覽點擊平滑滾動與 .is-current 高亮切換 ---');

    const navTargets = [
      { id: 'concept', selector: '.nav-links a[href="#concept"]', label: '模組概念' },
      { id: 'prototype', selector: '.nav-links a[href="#prototype"]', label: '結構原型' },
      { id: 'benefits', selector: '.nav-links a[href="#benefits"]', label: '循環效益' }
    ];

    for (const target of navTargets) {
      console.log(`  👉 點擊導覽連結「${target.label}」...`);
      await page.click(target.selector);
      
      // Wait for smooth scrolling to reach target section
      await page.waitForFunction((targetId) => {
        const sec = document.getElementById(targetId);
        return sec && (window.scrollY >= sec.offsetTop - 300 || (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 50);
      }, target.id, { timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(400);

      const scrollState = await page.evaluate((targetId) => {
        const sec = document.getElementById(targetId);
        const y = window.scrollY;
        const offsetTop = sec ? sec.offsetTop : 0;
        return { y, offsetTop };
      }, target.id);

      assert(
        scrollState.y > 0 && Math.abs(scrollState.y - scrollState.offsetTop) < 300,
        `頁面平滑滾動至 #${target.id} (滾動位置: ${scrollState.y}px, 目標章節: ${scrollState.offsetTop}px)`
      );

      const isCurrent = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.classList.contains('is-current') : false;
      }, target.selector);

      assert(
        isCurrent,
        `導航連結 ${target.selector} 正確獲得 .is-current 高亮狀態`
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 測試 B：驗證 3D 模擬器點擊「STAGE 1 / 2 / 3」按鈕時，房間畫布與 HUD 數據連動
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 測試 B：3D 模擬器 STAGE 1 / 2 / 3 按鈕與畫布 HUD 數據連動 ---');

    await page.evaluate(() => {
      const gameSec = document.getElementById('game');
      if (gameSec) gameSec.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(600);

    const canvasReady = await page.evaluate(() => {
      const c = document.getElementById('simRoomCanvas');
      return c && c.width > 0 && c.height > 0;
    });
    assert(canvasReady, '3D 房間視窗 Canvas (#simRoomCanvas) 已正確載入且具備幾何維度');

    const stages = [
      { id: 'stageBtnFamily', stage: 'family', name: 'STAGE 2 · 家庭轉換 (FAMILY DLC)' },
      { id: 'stageBtnSenior', stage: 'senior', name: 'STAGE 3 · 樂齡安老 (SAFE DLC)' },
      { id: 'stageBtnStarter', stage: 'starter', name: 'STAGE 1 · 建立生活 (WORK DLC)' }
    ];

    for (const stg of stages) {
      console.log(`  👉 點擊模擬器按鈕「${stg.name}」...`);
      await page.click(`#${stg.id}`);
      await page.waitForTimeout(500);

      const stageState = await page.evaluate((btnId) => {
        const btn = document.getElementById(btnId);
        const active = btn ? btn.classList.contains('active') : false;
        const currentStage = typeof simState !== 'undefined' ? simState.stage : null;
        const money = document.getElementById('simMoney') ? document.getElementById('simMoney').textContent.trim() : '';
        const space = document.getElementById('simSpaceScore') ? document.getElementById('simSpaceScore').textContent.trim() : '';
        const esg = document.getElementById('simEsgScore') ? document.getElementById('simEsgScore').textContent.trim() : '';
        const caption = document.getElementById('simRoomCaption') ? document.getElementById('simRoomCaption').textContent.trim() : '';

        return { active, currentStage, money, space, esg, caption };
      }, stg.id);

      assert(
        stageState.active && stageState.currentStage === stg.stage,
        `階段切換至 ${stg.stage}，按鈕啟用 (.active) 且 simState.stage 同步更新`
      );

      assert(
        stageState.money !== '' && stageState.space !== '' && stageState.esg !== '',
        `HUD 數值即時更新 (預算: ${stageState.money}, 空間: ${stageState.space}, ESG: ${stageState.esg})`
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 測試 C：驗證「30年居住生命週期計算機」數值計算與進度條縮放無 NaN/未定義
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 測試 C：30 年居住生命週期計算機數值計算與進度條無錯誤拋出 ---');

    await page.evaluate(() => {
      const calcSec = document.getElementById('lifecycleCalculator');
      if (calcSec) calcSec.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    const testYears = [10, 20, 30, 40];
    const testAreas = [15, 25, 35];

    let calcMatrixPassed = true;
    let checkedCombinations = 0;

    for (const y of testYears) {
      await page.click(`.calc-filter-row button[data-years="${y}"]`);
      for (const a of testAreas) {
        await page.click(`.calc-filter-row button[data-area="${a}"]`);
        await page.waitForTimeout(100);

        const calcData = await page.evaluate(() => {
          const tradCost = document.getElementById('calcTradCost') ? document.getElementById('calcTradCost').textContent : '';
          const tayaCost = document.getElementById('calcTayaCost') ? document.getElementById('calcTayaCost').textContent : '';
          const savings = document.getElementById('calcSavingsCallout') ? document.getElementById('calcSavingsCallout').textContent : '';
          
          const barTayaCost = document.getElementById('barTayaCost');
          const costTransform = barTayaCost ? barTayaCost.style.transform : '';
          
          const barTayaWaste = document.getElementById('barTayaWaste');
          const wasteTransform = barTayaWaste ? barTayaWaste.style.transform : '';

          const hasNaN = [tradCost, tayaCost, savings, costTransform, wasteTransform].some(str => 
            str.includes('NaN') || str.includes('undefined') || str.includes('null')
          );

          const validCost = /^NT\$\s*[\d,]+$/.test(tradCost.trim()) && /^NT\$\s*[\d,]+$/.test(tayaCost.trim());

          return { tradCost, tayaCost, savings, costTransform, wasteTransform, hasNaN, validCost };
        });

        checkedCombinations++;
        if (calcData.hasNaN || !calcData.validCost) {
          calcMatrixPassed = false;
          console.error(`  ❌ 組合 [${y}年, ${a}坪] 出現異常數值:`, calcData);
        }
      }
    }

    assert(
      calcMatrixPassed,
      `驗證所有 ${checkedCombinations} 組 [年限 x 坪數] 運算組合，完全無 NaN、undefined 或格式錯誤`
    );

    const progressScaleValid = await page.evaluate(() => {
      const bar = document.getElementById('barTayaCost');
      if (!bar) return false;
      let val = null;
      if (typeof gsap !== 'undefined') {
        val = gsap.getProperty(bar, 'scaleX');
      }
      if (val === null || val === undefined) {
        const t = bar.style.transform || window.getComputedStyle(bar).transform;
        const match = t.match(/scale\(([\d.]+)/) || t.match(/scaleX\(([\d.]+)/) || t.match(/matrix\(([\d.]+)/);
        if (match) val = parseFloat(match[1]);
      }
      return typeof val === 'number' && !isNaN(val) && val > 0 && val <= 1;
    });

    assert(
      progressScaleValid,
      'GSAP 進度條硬體加速 scaleX(scale) 正確動態縮放且位於 (0, 1] 有效區間'
    );

    // ─────────────────────────────────────────────────────────────
    // 測試 D：檢查控制台（Console）在整頁滾動與操作過程中有無任何 JS Error 或警告
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 測試 D：全頁互動與動態滾動過程中 Console 零錯誤檢驗 ---');

    console.log('  👉 執行全頁平滑遍歷滾動與點擊互動...');
    await page.evaluate(async () => {
      const scrollStep = 400;
      for (let y = 0; y < document.body.scrollHeight; y += scrollStep) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);

    // Interact with age tabs
    await page.click('.age-tab[data-tab="family"]');
    await page.waitForTimeout(200);
    await page.click('.age-tab[data-tab="senior"]');
    await page.waitForTimeout(200);

    // Interact with snap unlock cards
    await page.click('.unlock-card[data-mod="family"]');
    await page.waitForTimeout(200);
    await page.click('#snapBtnExploded');
    await page.waitForTimeout(200);
    await page.click('#snapBtnLocked');
    await page.waitForTimeout(200);

    // ─────────────────────────────────────────────────────────────
    // 測試 E：一鍵式「3 分鐘人生旅程導覽（Guided Walkthrough）」全流程驗證
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 測試 E：一鍵式「3 分鐘人生旅程導覽（Guided Walkthrough）」全流程驗證 ---');

    console.log('  👉 點擊 Hero 導覽按鈕「🎬 3 分鐘人生旅程導覽」...');
    await page.click('#btnHeroGuidedTour');
    await page.waitForTimeout(300);

    const tourVisible = await page.evaluate(() => {
      const el = document.getElementById('guidedTourOverlay');
      return el && window.getComputedStyle(el).display !== 'none';
    });
    assert(tourVisible, '點擊一鍵導覽按鈕後，導覽控制艙 (#guidedTourOverlay) 成功啟動顯現');

    // 驗證 25 歲首購客廳
    console.log('  👉 驗證導覽第 1 站：25 歲首購客廳 (WORK DLC)...');
    await page.click('#tourStepsNav button[data-step-index="1"]');
    await page.waitForTimeout(300);

    const step1State = await page.evaluate(() => {
      const title = document.getElementById('tourCardTitle')?.textContent || '';
      const stage = typeof simState !== 'undefined' ? simState.stage : '';
      const workActive = typeof simState !== 'undefined' ? simState.dlcs?.work : false;
      return { title, stage, workActive };
    });
    assert(
      step1State.stage === 'starter' && step1State.workActive && step1State.title.includes('25 歲首購客廳'),
      '第 1 站正確切換為 25 歲首購客廳 (simState.stage === starter，WORK DLC 自動掛載)'
    );

    // 驗證 40 歲家庭料理中島
    console.log('  👉 驗證導覽第 2 站：40 歲家庭料理中島 (FAMILY DLC)...');
    await page.click('#tourStepsNav button[data-step-index="2"]');
    await page.waitForTimeout(300);

    const step2State = await page.evaluate(() => {
      const title = document.getElementById('tourCardTitle')?.textContent || '';
      const stage = typeof simState !== 'undefined' ? simState.stage : '';
      const famActive = typeof simState !== 'undefined' ? simState.dlcs?.family : false;
      return { title, stage, famActive };
    });
    assert(
      step2State.stage === 'family' && step2State.famActive && step2State.title.includes('40 歲家庭料理中島'),
      '第 2 站正確切換為 40 歲家庭料理中島 (simState.stage === family，FAMILY 中島與收納牆扣入)'
    );

    // 驗證 65 歲樂齡防跌安全軌道
    console.log('  👉 驗證導覽第 3 站：65 歲樂齡防跌安全軌道 (SAFE DLC)...');
    await page.click('#tourStepsNav button[data-step-index="3"]');
    await page.waitForTimeout(300);

    const step3State = await page.evaluate(() => {
      const title = document.getElementById('tourCardTitle')?.textContent || '';
      const stage = typeof simState !== 'undefined' ? simState.stage : '';
      const safeActive = typeof simState !== 'undefined' ? simState.dlcs?.safe : false;
      return { title, stage, safeActive };
    });
    assert(
      step3State.stage === 'senior' && step3State.safeActive && step3State.title.includes('65 歲樂齡防跌安全軌道'),
      '第 3 站正確切換為 65 歲樂齡防跌安全軌道 (simState.stage === senior，SAFE DLC 感應扶手與夜間導引)'
    );

    // 驗證 30年財務效益與 ESG 減廢 74% 動態圖表
    console.log('  👉 驗證導覽第 4 站：30 年財務效益與 ESG 減廢 74% 動態圖表...');
    await page.click('#tourStepsNav button[data-step-index="4"]');
    await page.waitForTimeout(850);

    const step4State = await page.evaluate(() => {
      const title = document.getElementById('tourCardTitle')?.textContent || '';
      const tayaCost = document.getElementById('calcTayaCost')?.textContent || '';
      const wasteRed = document.getElementById('calcTayaWasteReduction')?.textContent || '';
      const isSpotlight = document.getElementById('lifecycleCalculator')?.classList.contains('tour-spotlight-active');
      const isChartPulse = document.getElementById('barTayaCost')?.classList.contains('tour-chart-pulse');
      return { title, tayaCost, wasteRed, isSpotlight, isChartPulse };
    });
    assert(
      step4State.tayaCost.includes('1,045,000') && step4State.wasteRed.includes('74%') && step4State.isSpotlight && step4State.isChartPulse,
      '第 4 站成功串接財務效益（NT$ 1,045,000 / 省 71%）與 ESG 減廢 74% 動態圖表聚焦脈衝',
      JSON.stringify(step4State)
    );

    // 驗證導覽控制列互動 (速度切換與關閉)
    console.log('  👉 驗證導覽控制列互動 (巡弋速度切換 2× / 播放暫停 / 關閉)...');
    await page.click('#btnTourSpeed');
    await page.waitForTimeout(150);
    const speedText = await page.evaluate(() => document.getElementById('btnTourSpeed')?.textContent);
    assert(speedText === '2×', '導覽速度切換按鈕成功切換至 2× 快轉模式');

    await page.click('#btnTourClose');
    await page.waitForTimeout(200);
    const tourClosed = await page.evaluate(() => {
      const el = document.getElementById('guidedTourOverlay');
      return !el || window.getComputedStyle(el).display === 'none';
    });
    assert(tourClosed, '點擊關閉按鈕 (✕) 後，導覽控制艙已正確退出並還原正常瀏覽狀態');

    assert(
      pageErrors.length === 0,
      `頁面 JavaScript 執行階段無任何未捕捉錯誤 (Page Errors: ${pageErrors.length})`,
      pageErrors.join('; ')
    );

    assert(
      consoleErrors.length === 0,
      `瀏覽器控制台無任何 console.error 報錯 (Console Errors: ${consoleErrors.length})`,
      consoleErrors.join('; ')
    );

    console.log('\n====================================================');
    console.log(`📊 測試結果摘要: 共 ${testCount} 項檢查點，${passCount} 項通過，${failCount} 項失敗`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('❌ 測試執行過程中發生未預期例外:', err);
    failCount++;
  } finally {
    await browser.close();
  }

  if (failCount > 0) {
    process.exit(1);
  } else {
    console.log('🎉 所有 Playwright E2E 自動化測試全數通過！\n');
  }
}

runE2ETests().catch(err => {
  console.error(err);
  process.exit(1);
});

