"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { getProject } from "@/lib/api";
import { useProject } from "@/lib/project-context";
import type { Project } from "@/lib/types";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const { setActiveProject } = useProject();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!id) return;
    getProject(id)
      .then((p) => {
        setProject(p);
        setActiveProject(p);
      })
      .catch(console.error);
  }, [id]);

  const prefix = `/projects/${id}`;

  const navItems = [
    { href: prefix, label: "Overview" },
    { href: `${prefix}/research`, label: "Artist Research" },
    { href: `${prefix}/personas`, label: "Personas" },
    { href: `${prefix}/tasks`, label: "Tasks" },
    { href: `${prefix}/schedules`, label: "Schedules" },
    { href: `${prefix}/queue`, label: "Queue" },
    { href: `${prefix}/results`, label: "Results" },
    { href: `${prefix}/devices`, label: "Devices" },
  ];

  const globalItems = [
    { href: "/devices", label: "Devices" },
    { href: "/settings", label: "Settings" },
  ];

  const isActive = (href: string) => {
    if (href === prefix) return pathname === prefix;
    return pathname.startsWith(href);
  };

  return (
    <div className="flex flex-1 min-h-0">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-1">
        {/* Back to projects */}
        <Link
          href="/projects"
          className="px-3 py-2 rounded-md text-sm text-gray-500 hover:text-white hover:bg-gray-800 transition-colors mb-1"
        >
          &larr; Projects
        </Link>

        {/* Project name */}
        {project && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <span className="text-sm font-semibold text-white truncate">{project.name}</span>
          </div>
        )}

        {/* Project nav */}
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-md text-sm transition-colors ${
              isActive(item.href)
                ? "bg-gray-800 text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}

        {/* Separator */}
        <div className="border-t border-gray-800 my-2" />

        {/* Global items */}
        {globalItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-md text-sm transition-colors ${
              pathname.startsWith(item.href)
                ? "bg-gray-800 text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
