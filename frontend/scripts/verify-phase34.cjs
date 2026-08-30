const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

  const checks = {};

  // ─── Phase 3: page transition animation ───
  await page.route("**/api/v1/projects/", (r) => r.fulfill({ json: [{ id: "p1", name: "P", topic: "" }] }));
  await page.goto("http://localhost:3000/papers");
  await page.waitForLoadState("networkidle");
  checks.pageTemplateAnimated = await page.locator("main > .animate-pageIn").count();

  // Phase 3: global button press feedback
  checks.pressFeedback = await page.evaluate(() => {
    const btn = document.querySelector("button");
    if (!btn) return "no-button";
    const before = getComputedStyle(btn).transform;
    btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    btn.classList.add("active-test");
    // simulate :active via matchMedia not possible; check stylesheet rules instead
    const sheets = [...document.styleSheets];
    for (const sheet of sheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText && rule.selectorText.includes("button:not(:disabled):active")) {
            return { rule: rule.selectorText, transform: rule.style.transform, beforeTransform: before };
          }
        }
      } catch { /* cross-origin sheet */ }
    }
    return "rule-not-found";
  });

  // ─── Phase 4: extensions persistence ───
  await page.goto("http://localhost:3000/extensions");
  await page.waitForLoadState("networkidle");
  await page.click('button:has-text("安装新 Skill")');
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await page.fill("#skill-name", "跨语言检索");
  await page.fill("#skill-desc", "支持中英双语文献检索");
  await page.click('[role="dialog"] button:has-text("安装")');
  await page.waitForTimeout(400);
  checks.customSkillVisible = await page.locator("text=跨语言检索").count();
  checks.installToast = await page.locator("text=已安装「跨语言检索」").count();
  // unload/install existing skill s3
  await page.click('div:has-text("语义去重") button:has-text("安装")');
  await page.waitForTimeout(1200);
  checks.skillInstalledBadge = await page.locator('div:has-text("语义去重") >> span:has-text("已安装")').count();
  // persistence across reload
  await page.reload();
  await page.waitForLoadState("networkidle");
  checks.customSkillPersisted = await page.locator("text=跨语言检索").count();
  checks.s3StillInstalled = await page.locator('div:has-text("语义去重") >> span:has-text("已安装")').count();
  // tools dialog
  await page.click('button:has-text("工具脚本")');
  await page.click('button:has-text("导入 Python 工具")');
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await page.fill("#tool-name", "数据清洗");
  await page.fill("#tool-trigger", "/clean_data");
  await page.click('[role="dialog"] button:has-text("导入")');
  await page.waitForTimeout(400);
  checks.customToolVisible = await page.locator("text=/clean_data").count();

  // ─── Phase 4: agents eval with real API shape ───
  const now = Date.now();
  const trend = [];
  for (let i = 0; i < 8; i++) {
    trend.push({
      metric: i % 2 === 0 ? "successRate" : "accuracy",
      score: 80 + (i % 4) * 5,
      created_at: new Date(now - (i % 3) * 86400000 - i * 3600000).toISOString(),
    });
  }
  await page.route("**/api/v1/settings/eval/summary**", (r) =>
    r.fulfill({
      json: {
        total: 8,
        metrics: {
          successRate: { avg: 91.2, count: 4, latest: 95 },
          accuracy: { avg: 87.5, count: 4, latest: 90 },
        },
        trend,
      },
    })
  );
  await page.goto("http://localhost:3000/agents");
  await page.waitForLoadState("networkidle");
  await page.click('button:has-text("评估")');
  await page.waitForTimeout(800);
  checks.evalMetricValue = await page.locator("text=91.2%").count();
  checks.evalMetricCount = await page.locator("text=4 次评估").first().isVisible();
  checks.evalTrendBars = await page.locator(".bg-indigo-500.rounded-t-md, div[class*='bg-indigo-500']").count();
  checks.evalInsight = await page.locator("text=已累计 8 次评估").count();
  checks.evalConfigBadge = await page.locator("text=LangGraph 内置架构").count();

  // eval no-project banner (block projects API so activeProject is null)
  await page.unroute("**/api/v1/projects/");
  await page.route("**/api/v1/projects/", (r) => r.fulfill({ status: 401, json: { detail: "Not authenticated" } }));
  await page.goto("http://localhost:3000/agents");
  await page.waitForLoadState("networkidle");
  await page.click('button:has-text("评估")');
  await page.waitForTimeout(600);
  checks.noProjectBanner = await page.locator("text=请先选择或创建项目").count();

  checks.consoleErrors = consoleErrors;
  console.log(JSON.stringify(checks, null, 2));
  await browser.close();
})().catch((err) => {
  console.error("VERIFY FAILED:", err.message);
  process.exit(1);
});
