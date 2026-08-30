import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "CiteWise 4.0 — 智能研究助手",
  description: "AI-powered research assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <head>
      </head>
      <body className="min-h-full flex flex-col">
        {/* SVG Gradient Defs for sparkle icon */}
        <svg width="0" height="0" style={{ position: "absolute" }}>
          <defs>
            <linearGradient id="geminiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: "#6366f1", stopOpacity: 1 }} />
              <stop offset="50%" style={{ stopColor: "#a855f7", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "#3b82f6", stopOpacity: 1 }} />
            </linearGradient>
          </defs>
        </svg>
        {children}
      </body>
    </html>
  );
}
