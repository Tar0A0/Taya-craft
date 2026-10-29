const { test, expect } = require('@playwright/test');
const path = require('path');

const fileUrl = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

test.describe('TAYACRAFT E2E 自動化測試套件', () => {

  test('測試 A：首頁導航點擊平滑滾動與 .is-current 高亮切換', async ({ page }) => {
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.waitForTimeout(500);

    const navTargets = [
      { id: 'concept', selector: '.nav-links a[href="#concept"]' },
      { id: 'prototype', selector: '.nav-links a[href="#prototype"]' },
      { id: 'benefits', selector: '.nav-links a[href="#benefits"]' }
    ];

    for (const target of navTargets) {
      await page.click(target.selector);
      await page.waitForFunction((targetId) => {
        const sec = document.getElementById(targetId);
        return sec && (window.scrollY >= sec.offsetTop - 300 || (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 50);
      }, target.id, { timeout: 4000 });
      await page.waitForTimeout(400);

      const isCurrent = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.classList.contains('is-current') : false;
      }, target.selector);

      expect(isCurrent).toBeTruthy();
    }
  });

  test('測試 B：3D 模擬器 STAGE 1 / 2 / 3 按鈕與畫布 HUD 數據連動', async ({ page }) => {
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.evaluate(() => {
      const gameSec = document.getElementById('game');
      if (gameSec) gameSec.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(600);

    // Canvas exists and has dimensions
    const canvasBox = await page.locator('#simRoomCanvas').boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox.width).toBeGreaterThan(0);

    const stages = [
      { id: 'stageBtnFamily', stage: 'family' },
      { id: 'stageBtnSenior', stage: 'senior' },
      { id: 'stageBtnStarter', stage: 'starter' }
    ];

    for (const stg of stages) {
      await page.click(`#${stg.id}`);
      await page.waitForTimeout(400);

      const active = await page.locator(`#${stg.id}`).evaluate(el => el.classList.contains('active'));
      expect(active).toBeTruthy();

      const currentStage = await page.evaluate(() => typeof simState !== 'undefined' ? simState.stage : null);
      expect(currentStage).toBe(stg.stage);

      const moneyText = await page.locator('#simMoney').innerText();
      expect(moneyText.length).toBeGreaterThan(0);
      expect(moneyText).not.toContain('NaN');

      const spaceText = await page.locator('#simSpaceScore').innerText();
      expect(spaceText.length).toBeGreaterThan(0);
      expect(spaceText).not.toContain('NaN');

      const esgText = await page.locator('#simEsgScore').innerText();
      expect(esgText.length).toBeGreaterThan(0);
      expect(esgText).not.toContain('NaN');
    }
  });

  test('測試 C：30 年居住生命週期計算機數值運算與進度條縮放無 NaN/未定義', async ({ page }) => {
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.evaluate(() => {
      const calcSec = document.getElementById('lifecycleCalculator');
      if (calcSec) calcSec.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    const testYears = [10, 20, 30, 40];
    const testAreas = [15, 25, 35];

    for (const y of testYears) {
      await page.click(`.calc-filter-row button[data-years="${y}"]`);
      for (const a of testAreas) {
        await page.click(`.calc-filter-row button[data-area="${a}"]`);
        await page.waitForTimeout(100);

        const tradCost = await page.locator('#calcTradCost').innerText();
        const tayaCost = await page.locator('#calcTayaCost').innerText();
        const savings = await page.locator('#calcSavingsCallout').innerText();

        expect(tradCost).toMatch(/^NT\$\s*[\d,]+$/);
        expect(tayaCost).toMatch(/^NT\$\s*[\d,]+$/);
        expect(savings).not.toContain('NaN');
        expect(savings).not.toContain('undefined');
      }
    }

    const scaleX = await page.evaluate(() => {
      const bar = document.getElementById('barTayaCost');
      if (!bar) return 0;
      if (typeof gsap !== 'undefined') {
        return gsap.getProperty(bar, 'scaleX');
      }
      const t = bar.style.transform || window.getComputedStyle(bar).transform;
      const match = t.match(/scale\(([\d.]+)/) || t.match(/scaleX\(([\d.]+)/) || t.match(/matrix\(([\d.]+)/);
      return match ? parseFloat(match[1]) : 0;
    });

    expect(scaleX).toBeGreaterThan(0);
    expect(scaleX).toBeLessThanOrEqual(1);
  });

  test('測試 D：整頁滾動與操作過程中 Console 零 JavaScript 錯誤檢驗', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', err => pageErrors.push(err.message || String(err)));
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('ERR_NAME_NOT_RESOLVED') || text.includes('ERR_INTERNET_DISCONNECTED') || text.includes('fonts.gstatic.com')) {
        return;
      }
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.waitForTimeout(500);

    // Scroll smoothly through entire page
    await page.evaluate(async () => {
      const step = 450;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 50));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(500);

    // Click interactive elements
    await page.click('.age-tab[data-tab="family"]');
    await page.waitForTimeout(150);
    await page.click('.age-tab[data-tab="senior"]');
    await page.waitForTimeout(150);
    await page.click('.unlock-card[data-mod="family"]');
    await page.waitForTimeout(150);
    await page.click('#snapBtnExploded');
    await page.waitForTimeout(150);
    await page.click('#snapBtnLocked');
    await page.waitForTimeout(150);

    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

});

