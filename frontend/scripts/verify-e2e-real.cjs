const { chromium } = require("playwright");
const fs = require("fs");

const TMP = "C:/Users/77230/AppData/Local/Temp";

(async () => {
  const browser = await chromium.launch({ args: ["--no-proxy-server"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Seed real Supabase session (shell-obtained) — backend calls stay 100% real
  const seed = JSON.parse(fs.readFileSync(`${TMP}/sb-session.json`, "utf-8"));
  const key = Object.keys(seed)[0];
  await context.addInitScript(({ k, v }) => localStorage.setItem(k, v), { k: key, v: JSON.stringify(seed[key]) });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 120)));

  const checks = { phase: {} };

  // ─── 1. App loads with session, project auto-loads ───
  await page.goto("http://localhost:3000/chat");
  await page.waitForTimeout(3500);
  checks.phase.projectLoaded = await page.evaluate(() => !!localStorage.getItem("citewise_active_project"));
  checks.phase.inputEnabled = await page.locator('input[type="text"]').isEnabled();

  // ─── 2. Real upload (FormData fix, live backend + Supabase DB) ───
  fs.writeFileSync("C:/Users/77230/CiteWise4.0/frontend/tmp-upload.md",
    "# Attention Is All You Need\n\nTransformer 使用自注意力机制 (Self-Attention)，公式为 softmax(QK^T / sqrt(d_k)) V。它取代了 RNN 的循环结构，实现完全并行化。\n\n## 应用领域\n\n自然语言处理、计算机视觉、多模态学习。");
  await page.goto("http://localhost:3000/papers");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.setInputFiles('input[type="file"]', "C:/Users/77230/CiteWise4.0/frontend/tmp-upload.md");
  await page.waitForSelector("text=文献上传成功", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);
  checks.phase.uploadToast = await page.locator("text=文献上传成功").count();
  checks.phase.paperInList = await page.locator("text=tmp-upload").count();

  // ─── 3. Real chat (live LLM + persistence) ───
  await page.goto("http://localhost:3000/chat");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await page.fill('input[type="text"]', "Transformer的核心机制是什么");
  await page.click('button:has-text("学术调度")');
  await page.waitForSelector(".md-render", { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(20000); // allow full stream + persistence
  const chatText = (await page.locator(".chat-container").textContent()) || "";
  checks.phase.chatResponded = chatText.length > 200 && !chatText.includes("请求失败");
  checks.phase.chatError = chatText.includes("请求失败") || chatText.includes("处理请求时发生错误");
  checks.phase.markdownRendered = await page.locator(".md-render").count();

  // Session item appears in the history panel (scoped to w-64 aside)
  const sessionPanel = page.locator("aside.w-64");
  await page.waitForTimeout(2000);
  checks.phase.sessionCreated = await sessionPanel.locator(".group").count();

  // ─── 4. Reload: session persists, history loads ───
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);
  checks.phase.sessionPersisted = await sessionPanel.locator(".group").count();
  if (checks.phase.sessionPersisted) {
    await sessionPanel.locator(".group").first().click();
    await page.waitForTimeout(3000);
    const historyText = (await page.locator(".chat-container").textContent()) || "";
    checks.phase.historyLoaded = historyText.includes("Transformer的核心机制");
  }

  checks.consoleErrors = consoleErrors.filter((e) => !e.includes("401"));
  console.log(JSON.stringify(checks, null, 2));
  await browser.close();
})().catch((err) => {
  console.error("E2E FAILED:", err.message);
  process.exit(1);
});
