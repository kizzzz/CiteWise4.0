"use client";

import { useState, useEffect, useCallback } from "react";
import { Key, Plus, X, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";

const PROVIDER_DEFAULTS: Record<string, { name: string; baseUrl: string; icon: string }> = {
  zhipu:    { name: "智谱 (GLM)",       baseUrl: "https://open.bigmodel.cn/api/paas/v4/",  icon: "🤖" },
  deepseek: { name: "DeepSeek",          baseUrl: "https://api.deepseek.com/v1/",           icon: "🔮" },
  openai:   { name: "OpenAI",            baseUrl: "https://api.openai.com/v1/",             icon: "🌍" },
  moonshot: { name: "Moonshot (Kimi)",   baseUrl: "https://api.moonshot.cn/v1/",            icon: "🌙" },
  qwen:     { name: "通义千问",          baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/", icon: "☁️" },
  custom:   { name: "自定义 (OpenAI 兼容)", baseUrl: "", icon: "⚙️" },
};

interface SavedKey {
  provider: string;
  apiKey: string;
  baseUrl: string;
  models: string[];
  active: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5329/api/v1";

export default function SettingsPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<SavedKey[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [provider, setProvider] = useState("zhipu");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ msg: string; ok: boolean } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const username = user?.user_metadata?.username || user?.email?.split("@")[0] || "用户";
  const avatarLetter = username.charAt(0).toUpperCase();

  const loadKeys = useCallback(() => {
    const saved = localStorage.getItem("citewise_api_keys");
    if (saved) {
      try { setKeys(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  function saveKeys(newKeys: SavedKey[]) {
    setKeys(newKeys);
    localStorage.setItem("citewise_api_keys", JSON.stringify(newKeys));
  }

  function openNewKeyModal() {
    setEditIndex(null);
    setProvider("zhipu");
    setApiKey("");
    setBaseUrl(PROVIDER_DEFAULTS.zhipu.baseUrl);
    setVerifyResult(null);
    setShowModal(true);
  }

  function openEditKeyModal(index: number) {
    const k = keys[index];
    setEditIndex(index);
    setProvider(k.provider);
    setApiKey(k.apiKey);
    setBaseUrl(k.baseUrl);
    setVerifyResult(null);
    setShowModal(true);
  }

  function handleProviderChange(p: string) {
    setProvider(p);
    const def = PROVIDER_DEFAULTS[p];
    if (def && def.baseUrl) setBaseUrl(def.baseUrl);
  }

  function activateKey(index: number) {
    const newKeys = keys.map((k, i) => ({ ...k, active: i === index }));
    saveKeys(newKeys);
  }

  function deleteKey(index: number) {
    const wasActive = keys[index]?.active;
    const newKeys = keys.filter((_, i) => i !== index);
    if (wasActive && newKeys.length > 0) newKeys[0].active = true;
    saveKeys(newKeys);
    setShowModal(false);
  }

  async function verifyAndSave() {
    if (!apiKey.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch(`${API_BASE}/apikeys/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, api_key: apiKey.trim(), base_url: baseUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "验证失败");

      const newKey: SavedKey = {
        provider,
        apiKey: apiKey.trim(),
        baseUrl: data.base_url || baseUrl.trim() || PROVIDER_DEFAULTS[provider]?.baseUrl || "",
        models: data.models || [],
        active: true,
      };

      let newKeys: SavedKey[];
      if (editIndex !== null) {
        newKeys = keys.map((k, i) => ({ ...k, active: i === editIndex }));
        newKeys[editIndex] = newKey;
      } else {
        const existingIdx = keys.findIndex((k) => k.provider === provider);
        if (existingIdx >= 0) {
          newKeys = keys.map((k, i) => ({ ...k, active: i === existingIdx }));
          newKeys[existingIdx] = newKey;
        } else {
          newKeys = [...keys.map((k) => ({ ...k, active: false })), newKey];
        }
      }
      saveKeys(newKeys);
      setVerifyResult({ msg: data.message || "验证成功", ok: true });

      // Also save to backend if logged in
      if (user) {
        try {
          await api.post("/settings/api-keys", { provider, key: apiKey.trim(), base_url: baseUrl.trim() });
        } catch { /* non-critical */ }
      }
    } catch (err: any) {
      setVerifyResult({ msg: err.message || "验证失败", ok: false });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <section className="flex flex-col h-full w-full">
      <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center flex-shrink-0">
        <h2 className="font-bold text-slate-800">设置与 API 管理</h2>
      </header>

      <div className="flex-1 p-12 bg-slate-50/50 overflow-y-auto scroll-thin text-sm">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* User Profile Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex items-center gap-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-400 flex items-center justify-center text-white text-3xl font-bold shadow-xl">
              {avatarLetter}
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-xl font-bold text-slate-800">{username}</h3>
              <p className="text-slate-500 text-xs">{user?.email || "点击登录以启用数据隔离"}</p>
            </div>
          </div>

          {/* API Keys */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-800">API 密钥管理</h4>
              <button onClick={openNewKeyModal} className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> 新增配置
              </button>
            </div>

            {keys.length === 0 ? (
              <div className="col-span-2 text-center text-slate-400 py-12">
                暂无 API Key 配置，点击右上角「+ 新增配置」添加
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {keys.map((k, i) => {
                  const prov = PROVIDER_DEFAULTS[k.provider] || { name: k.provider, icon: "🔧" };
                  return (
                    <div
                      key={i}
                      onClick={() => openEditKeyModal(i)}
                      className={`p-5 bg-white border border-slate-200 rounded-2xl shadow-sm cursor-pointer hover:border-blue-300 transition-all ${
                        k.active ? "key-card-active" : ""
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{prov.icon}</span>
                          <span className="font-bold text-sm text-slate-800">{prov.name}</span>
                        </div>
                        <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded ${
                          k.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                        }`}>
                          {k.active ? "使用中" : "未激活"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">••••{(k.apiKey || "").slice(-4)}</div>
                      <div className="text-[9px] text-slate-300 mt-1 truncate">{k.baseUrl || ""}</div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); activateKey(i); }}
                          className={`text-[9px] px-2 py-1 rounded-lg ${
                            k.active ? "bg-emerald-50 text-emerald-600 font-bold" : "bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                          }`}
                        >
                          {k.active ? "当前" : "启用"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm("确定删除该 API Key 配置？")) deleteKey(i); }}
                          className="text-[9px] px-2 py-1 rounded-lg bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Key Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4" onClick={() => setShowModal(false)}>
          <div
            className="bg-white w-full max-w-lg rounded-3xl p-8 space-y-5 shadow-2xl animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">配置 LLM API Key</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-500">选择大模型供应商，填入 API Key 和 Base URL，验证通过后保存。所有 Agent 将使用该 Key。</p>

            {/* Provider Selection */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">供应商</label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full border p-3 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="zhipu">智谱 (GLM)</option>
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="moonshot">Moonshot (Kimi)</option>
                <option value="qwen">通义千问</option>
                <option value="custom">自定义 (OpenAI 兼容)</option>
              </select>
            </div>

            {/* API Key */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full border p-3 rounded-xl bg-slate-50"
                placeholder="输入 API Key..."
              />
            </div>

            {/* Base URL */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Base URL</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full border p-3 rounded-xl bg-slate-50"
                placeholder="API Base URL (通常自动填充)"
              />
            </div>

            {/* Verify Result */}
            {verifyResult && (
              <div className={`text-xs font-bold p-2 rounded-lg ${
                verifyResult.ok
                  ? "text-emerald-600 bg-emerald-50 border border-emerald-100"
                  : "text-red-600 bg-red-50 border border-red-100"
              }`}>
                {verifyResult.ok ? <CheckCircle className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1" />}
                {verifyResult.msg}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={verifyAndSave}
                disabled={verifying || !apiKey.trim()}
                className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {verifying ? "验证中..." : "验证并保存"}
              </button>
              {editIndex !== null && (
                <button
                  onClick={() => { deleteKey(editIndex); }}
                  className="py-3 px-5 bg-white border border-red-200 text-red-500 rounded-2xl font-bold hover:bg-red-50 transition-all"
                >
                  删除
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
