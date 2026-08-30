export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex flex-col min-h-0 animate-pageIn">{children}</div>;
}
