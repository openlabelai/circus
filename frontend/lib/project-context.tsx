"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getProjects, createProject as apiCreateProject } from "@/lib/api";
import type { Project } from "@/lib/types";

interface ProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  setActiveProject: (project: Project) => void;
  refreshProjects: () => Promise<void>;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  activeProject: null,
  setActiveProject: () => {},
  refreshProjects: async () => {},
  loading: true,
});

export function useProject() {
  return useContext(ProjectContext);
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProjects = useCallback(async () => {
    try {
      const data = await getProjects();
      const list = data.results || [];
      setProjects(list);

      // If no projects exist, create a default one
      if (list.length === 0) {
        const created = await apiCreateProject({ name: "Default", description: "Default project", color: "#6366f1" });
        setProjects([created]);
        setActiveProjectState(created);
        localStorage.setItem("activeProjectId", created.id);
        return;
      }

      // Restore from localStorage or pick first
      const savedId = localStorage.getItem("activeProjectId");
      const saved = list.find((p) => p.id === savedId);
      if (saved) {
        setActiveProjectState(saved);
      } else {
        setActiveProjectState(list[0]);
        localStorage.setItem("activeProjectId", list[0].id);
      }
    } catch (e) {
      console.error("Failed to load projects:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const setActiveProject = useCallback((project: Project) => {
    setActiveProjectState(project);
    localStorage.setItem("activeProjectId", project.id);
  }, []);

  return (
    <ProjectContext.Provider value={{ projects, activeProject, setActiveProject, refreshProjects, loading }}>
      {children}
    </ProjectContext.Provider>
  );
}
