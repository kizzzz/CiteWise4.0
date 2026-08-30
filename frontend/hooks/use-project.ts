"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import type { Project } from "@/types";

export function useProject() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      const data = await api.get<Project[]>("/projects/");
      setProjects(data);
      const savedId = localStorage.getItem("citewise_active_project");
      const match = data.find((p) => p.id === savedId);
      setActiveProject(match ?? data[0] ?? null);
    } catch {
      // Not authenticated yet or no projects
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Project[]>("/projects/")
      .then((data) => {
        if (cancelled) return;
        setProjects(data);
        const savedId = localStorage.getItem("citewise_active_project");
        const match = data.find((p) => p.id === savedId);
        setActiveProject(match ?? data[0] ?? null);
      })
      .catch(() => {
        // Not authenticated yet or no projects
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectProject = useCallback((project: Project) => {
    setActiveProject(project);
    localStorage.setItem("citewise_active_project", project.id);
  }, []);

  const createProject = useCallback(
    async (name: string, topic = "") => {
      const project = await api.post<Project>("/projects/", { name, topic });
      setProjects((prev) => [project, ...prev]);
      selectProject(project);
      return project;
    },
    [selectProject]
  );

  return { projects, activeProject, selectProject, createProject, loading, reload: loadProjects };
}
