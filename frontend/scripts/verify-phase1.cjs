const { chromium } = require("playwright");

const SSE_HEADERS = { "Content-Type": "text/event-stream" };

function sseBody() {
  const parts = [
    'event: agent_start\ndata: {"agent": "Router", "event": "agent_start", "detail": "分析用户意图"}\n\n',
    'event: agent_start\ndata: {"agent": "Researcher", "event": "agent_start", "detail": "检索知识库"}\n\n',
    'event: sources\ndata: {"sources": [{"title": "Attention Is All You Need", "citation": "Vaswani et al., NeurIPS 2017"}, {"title": "Scaling Laws for Neural Language Models", "citation": "Kaplan et al., 2020"}]}\n\n',
    'event: token\ndata: {"token": "## Transformer 应用趋势"}\n\n',
    'event: token\ndata: {"token": "\\n\\n根据知识库检索 [KB] 与联网搜索 [WEB]，结合模型推理 [AI]，结论如下 [1]：\\n\\n"}\n\n',
    'event: token\ndata: {"token": "| 领域 | 代表工作 | 效果 |\\n|---|---|---|\\n| NLP | GPT 系列 | SOTA [2] |\\n| CV | ViT | 超越 CNN |\\n\\n"}\n\n',
    'event: token\ndata: {"token": "**核心机制**为自注意力：\\n\\n```python\\ndef self_attention(Q, K, V):\\n    scores = Q @ K.T / np.sqrt(d_k)\\n    return softmax(scores) @ V\\n```\\n\\n"}\n\n',
    'event: token\ndata: {"token": "能量公式 $E = mc^2$，注意力复杂度 $O(n^2)$。\\n"}\n\n',
    'event: done\ndata: {"message": "完成"}\n\n',
  ];
  return parts.join("");
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:3000" });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.route("**/api/v1/projects/", (route) =>
    route.fulfill({ json: [{ id: "proj-verify", name: "验证项目", topic: "" }] })
  );
  await page.route("**/api/v1/chat", (route) =>
    route.fulfill({ status: 200, headers: SSE_HEADERS, body: sseBody() })
  );

  await page.goto("http://localhost:3000/chat");
  await page.waitForLoadState("networkidle");

  await page.fill('input[type="text"]', "总结 Transformer 应用趋势");
  await page.click('button:has-text("学术调度")');
  await page.waitForSelector(".md-render", { timeout: 20000 });
  await page.waitForSelector("text=注意力复杂度", { timeout: 10000 });
  await page.waitForTimeout(500);

  const checks = {};
  checks.h2 = await page.locator(".md-render h2").count();
  checks.table = await page.locator(".md-render table").count();
  checks.tableRows = await page.locator(".md-render tbody tr").count();
  checks.codeblock = await page.locator(".md-codeblock").count();
  checks.codeLang = await page.locator(".md-codeblock header, .md-code-block >> text=PYTHON").count() > 0 || (await page.locator(".md-codeblock").first().textContent()).includes("PYTHON");
  checks.katex = await page.locator(".katex").count();
  checks.kbAnnotation = await page.locator(".txt-kb").count();
  checks.webAnnotation = await page.locator(".txt-web").count();
  checks.aiAnnotation = await page.locator(".txt-ai").count();
  checks.citeSup = await page.locator(".cite-sup").count();
  checks.actionBar = await page.locator('button[title="复制全文"]').count();
  checks.regenerateBtn = await page.locator('button[title="重新生成"]').count();
  checks.agentTimeline = await page.locator(".collab-step").count();

  await page.screenshot({ path: "verify-1-markdown.png", fullPage: false });

  // Click [KB] annotation
  await page.click(".txt-kb");
  await page.waitForSelector(".annotation-popover", { timeout: 5000 });
  checks.kbPopoverText = await page.locator(".annotation-popover").textContent();
  await page.screenshot({ path: "verify-2-kb-popover.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Click citation [1]
  await page.locator(".cite-sup").first().click();
  await page.waitForSelector(".annotation-popover", { timeout: 5000 });
  checks.citePopoverText = (await page.locator(".annotation-popover").textContent()) || "";
  checks.citeHasTitle = checks.citePopoverText.includes("Attention Is All You Need");
  await page.screenshot({ path: "verify-3-cite-popover.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Hover message -> action bar visible + copy
  await page.hover('button[title="复制全文"]');
  await page.waitForTimeout(400);
  await page.click('button[title="复制全文"]');
  await page.waitForTimeout(500);
  checks.copyToast = await page.locator("text=已复制到剪贴板").count();

  // Feedback button
  await page.click('button[title="有帮助"]');
  await page.waitForTimeout(400);
  checks.feedbackActive = await page.locator('button[title="有帮助"].text-green-500').count();

  await page.screenshot({ path: "verify-4-actions.png" });

  checks.consoleErrors = consoleErrors;

  console.log(JSON.stringify(checks, null, 2));
  await browser.close();
})().catch((err) => {
  console.error("VERIFY FAILED:", err.message);
  process.exit(1);
});
