const { chromium } = require("playwright");

const SESSIONS = [
  { id: "sess-1", title: "Transformer 综述讨论", parent_session_id: null, created_at: "2026-08-29T10:00:00Z" },
  { id: "sess-2", title: "RAG 检索策略对比", parent_session_id: null, created_at: "2026-08-28T09:00:00Z" },
];

const HISTORY = {
  "sess-1": [
    { id: "m1", role: "user", content: "总结 Transformer 的应用", sources: [] },
    {
      id: "m2",
      role: "assistant",
      content: "根据文献 [KB]，Transformer 已广泛应用于 NLP 与 CV 领域 [1]。",
      sources: [{ title: "Attention Is All You Need", citation: "Vaswani et al., NeurIPS 2017" }],
    },
  ],
};

function sseChatBody() {
  return [
    'event: session\ndata: {"session_id": "sess-new"}\n\n',
    'event: token\ndata: {"token": "## 新回复\\n\\n这是流式生成的 **Markdown** 内容。"}\n\n',
    'event: done\ndata: {"message": "完成"}\n\n',
  ].join("");
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

  const dialogs = [];
  page.on("dialog", async (d) => {
    dialogs.push({ type: d.type(), message: d.message().slice(0, 30) });
    if (d.type() === "prompt") await d.accept("重命名的对话");
    else await d.accept();
  });

  await page.route("**/api/v1/projects/", (r) =>
    r.fulfill({ json: [{ id: "proj-verify", name: "验证项目", topic: "" }] })
  );
  await page.route("**/api/v1/sessions**", (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (method === "GET" && url.includes("project_id")) return route.fulfill({ json: SESSIONS });
    if (method === "GET" && url.includes("/messages")) {
      const id = url.match(/sessions\/([^/]+)\/messages/)?.[1] || "";
      return route.fulfill({ json: HISTORY[id] || [] });
    }
    return route.fulfill({ json: { status: "ok" } });
  });
  await page.route("**/api/v1/chat", (r) =>
    r.fulfill({ status: 200, headers: { "Content-Type": "text/event-stream" }, body: sseChatBody() })
  );
  await page.route("**/api/v1/papers/**", async (route) => {
    await new Promise((res) => setTimeout(res, 1500));
    return route.fulfill({ json: [] });
  });

  const checks = {};
  await page.goto("http://localhost:3000/chat");
  await page.waitForLoadState("networkidle");

  // 1. Session panel renders
  checks.panelVisible = await page.locator("text=历史对话").count();
  checks.sessionCount = await page.locator("aside .group").count();
  checks.sessionTitle = await page.locator("text=Transformer 综述讨论").count();

  // 2. Switch session -> history loads with markdown + annotations
  await page.click("text=Transformer 综述讨论");
  await page.waitForSelector(".md-render", { timeout: 5000 });
  checks.historyUserMsg = await page.locator("text=总结 Transformer 的应用").count();
  checks.historyAnnotation = await page.locator(".txt-kb").count();
  checks.historyCite = await page.locator(".cite-sup").count();
  checks.historyActionbar = await page.locator('button[title="复制全文"]').count();

  // 3. Rename via prompt dialog
  await page.locator('button[title="重命名"]').first().hover();
  await page.click('button[title="重命名"]');
  await page.waitForTimeout(400);
  checks.renamedTitle = await page.locator("text=重命名的对话").count();
  checks.renameToast = await page.locator("text=已重命名").count();

  // 4. Delete active session -> list shrinks, chat resets
  await page.locator('button[title="删除"]').first().hover();
  await page.click('button[title="删除"]');
  await page.waitForTimeout(500);
  checks.afterDeleteCount = await page.locator("aside .group").count();
  checks.chatReset = await page.locator("text=暂无历史对话, 发送第一条消息后会自动保存".split(",")[0]).count() >= 0 ? await page.locator("text=CiteWise 协同系统已就绪").count() : 0;
  checks.deleteToast = await page.locator("text=对话已删除").count();

  // 5. New chat -> welcome
  await page.click("text=RAG 检索策略对比");
  await page.waitForTimeout(500);
  await page.click('button:has-text("新对话")');
  await page.waitForTimeout(300);
  checks.welcomeAfterNew = await page.locator("text=CiteWise 协同系统已就绪").count();

  // 6. Send message -> stream with session event -> markdown still works
  await page.fill('input[type="text"]', "测试消息");
  await page.click('button:has-text("学术调度")');
  await page.waitForSelector(".md-render", { timeout: 10000 });
  await page.waitForSelector("text=流式生成", { timeout: 5000 });
  checks.streamH2 = await page.locator(".md-render h2").count();
  checks.streamStrong = await page.locator(".md-render strong").count();

  await page.screenshot({ path: "verify-p2-chat.png" });

  // 7. Papers skeleton during slow load
  await page.goto("http://localhost:3000/papers");
  await page.waitForSelector(".animate-pulse", { timeout: 5000 });
  checks.papersSkeleton = await page.locator(".animate-pulse").count();
  await page.waitForTimeout(2000);

  checks.dialogs = dialogs;
  checks.consoleErrors = consoleErrors;
  console.log(JSON.stringify(checks, null, 2));
  await browser.close();
})().catch((err) => {
  console.error("VERIFY FAILED:", err.message);
  process.exit(1);
});
