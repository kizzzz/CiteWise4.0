"use client";

import { AuthProvider } from "@/hooks/use-auth";
import { useProject } from "@/hooks/use-project";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NoteFab } from "@/components/notes/note-fab";
import { Toaster } from "@/components/ui/sonner";
import { type ReactNode } from "react";

function DashboardGuard({ children }: { children: ReactNode }) {
  const { activeProject, createProject } = useProject();

  // Temporarily skip auth for UI comparison (restore after).
  // To restore: import useRouter/useEffect/useAuth, destructure { user, loading },
  // and re-add the redirect effect below.

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AppSidebar
        projectName={activeProject?.name ?? null}
        onNewProject={() => {
          const name = prompt("项目名称");
          if (name) createProject(name);
        }}
      />
      <main className="flex-1 flex flex-col relative overflow-hidden h-full min-w-0">
        {children}
      </main>
      <Toaster />
      <NoteFab />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DashboardGuard>{children}</DashboardGuard>
    </AuthProvider>
  );
}
