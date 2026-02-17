"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const globalNavItems = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/artist-profiles", label: "Artist Profiles" },
  { href: "/devices", label: "Devices" },
  { href: "/settings", label: "Settings" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Any route under /projects/[id] (including the detail page itself)
  // The project nested layout handles its own sidebar for these routes
  const isProjectRoute = /^\/projects\/[^/]+/.test(pathname) && pathname !== "/projects";

  if (isProjectRoute) {
    // Project nested layout provides its own sidebar
    return <>{children}</>;
  }

  return (
    <>
      <aside className="w-56 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-1">
        <h1 className="text-xl font-bold mb-4 px-3">Circus</h1>
        {globalNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-md text-sm transition-colors ${
              (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))
                ? "bg-gray-800 text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </>
  );
}
