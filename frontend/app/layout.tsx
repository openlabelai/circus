import type { Metadata } from "next";
import "./globals.css";
import { ProjectProvider } from "@/lib/project-context";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Circus",
  description: "Phone farm management dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <ProjectProvider>
          <AppShell>{children}</AppShell>
        </ProjectProvider>
      </body>
    </html>
  );
}
