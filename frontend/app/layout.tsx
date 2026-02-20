import type { Metadata } from "next";
import "./globals.css";
import { CampaignProvider } from "@/lib/campaign-context";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Circus",
  description: "Phone farm management dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <CampaignProvider>
          <AppShell>{children}</AppShell>
        </CampaignProvider>


      </body>
    </html>
  );
}
