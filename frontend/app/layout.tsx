import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Circus",
  description: "Phone farm management dashboard",
};

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/personas", label: "Personas" },
  { href: "/devices", label: "Devices" },
  { href: "/tasks", label: "Tasks" },
  { href: "/results", label: "Results" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <aside className="w-56 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-1">
          <h1 className="text-xl font-bold mb-6 px-3">Circus</h1>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </aside>
        <main className="flex-1 p-8 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
