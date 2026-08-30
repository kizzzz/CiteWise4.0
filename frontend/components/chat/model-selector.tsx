"use client";

import { useState, useRef, useEffect } from "react";
import { Cpu } from "lucide-react";

interface ApiKeyConfig {
  active?: boolean;
  models?: string[];
}

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
}

function loadInitialModels(): string[] {
  if (typeof window === "undefined") return [];
  const saved = localStorage.getItem("citewise_api_keys");
  if (!saved) return [];
  try {
    const keys = JSON.parse(saved) as ApiKeyConfig[];
    const active = keys.find((k) => k.active);
    return active?.models?.length ? active.models : [];
  } catch {
    return [];
  }
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [models] = useState<string[]>(loadInitialModels);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeModel = value && models.includes(value) ? value : "默认模型";

  return (
    <div className="model-dropdown-wrap shrink-0" ref={ref}>
      <button
        type="button"
        className={`model-dropdown-btn ${open ? "open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Cpu className="w-3.5 h-3.5" />
        <span>{activeModel}</span>
        <svg className="chevron w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`model-dropdown-list ${open ? "show" : ""}`}>
        {/* Default model option */}
        <div
          className={`model-option ${!value ? "active" : ""}`}
          onClick={() => { onChange(""); setOpen(false); }}
        >
          默认模型
        </div>
        {models.map((model) => (
          <div
            key={model}
            className={`model-option ${value === model ? "active" : ""}`}
            onClick={() => {
              onChange(model);
              setOpen(false);
            }}
          >
            {model}
          </div>
        ))}
      </div>
    </div>
  );
}
