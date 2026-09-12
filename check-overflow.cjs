// 用法: node check-overflow.mjs [起始页] [结束页]
// 只测量"可见"的那一页 slide, 返回逻辑像素溢出 (slidev 逻辑高 552)
const { chromium } = require('playwright-core');

const from = parseInt(process.argv[2] || '0', 10);
const to = parseInt(process.argv[3] || '50', 10);

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  for (let n = from; n <= to; n++) {
    const resp = await page.goto(`http://localhost:3030/${n}`, { waitUntil: 'load' }).catch(() => null);
    if (!resp || resp.status() >= 400) break;
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const pages = [...document.querySelectorAll('.slidev-page')];
      const slide = pages.find(p => p.getBoundingClientRect().width > 0);
      if (!slide) return null;
      const sr = slide.getBoundingClientRect();
      const scale = sr.height / 552;
      let worstBottom = 0, worstEl = '', worstRight = 0;
      const walk = el => {
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden') return;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          if (r.bottom > worstBottom) { worstBottom = r.bottom; worstEl = (el.textContent || '').trim().slice(0, 30); }
          worstRight = Math.max(worstRight, r.right);
        }
        [...el.children].forEach(walk);
      };
      walk(slide);
      const h = slide.querySelector('h1,h2');
      return {
        title: h ? h.textContent.trim().slice(0, 38) : '?',
        overflowY: Math.round((worstBottom - sr.bottom) / scale),
        overflowX: Math.round((worstRight - sr.right) / scale),
        worstEl
      };
    });
    if (!r) { console.log(n, 'no visible page'); break; }
    const flag = r.overflowY > 0 ? `⚠ OVERFLOW_Y +${r.overflowY}` : 'ok';
    const flagX = r.overflowX > 0 ? ` ⚠ OVERFLOW_X +${r.overflowX}` : '';
    console.log(String(n).padStart(2), flag + flagX, '|', r.title, r.overflowY > 0 ? '| worst: ' + r.worstEl : '');
  }
  await browser.close();
})();
