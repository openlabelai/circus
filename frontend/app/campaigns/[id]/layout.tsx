"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { getCampaign } from "@/lib/api";
import { useCampaign } from "@/lib/campaign-context";
import type { Campaign } from "@/lib/types";

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const { setActiveCampaign } = useCampaign();
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    if (!id) return;
    getCampaign(id)
      .then((p) => {
        setCampaign(p);
        setActiveCampaign(p);
      })
      .catch(console.error);
  }, [id]);

  const prefix = `/campaigns/${id}`;

  const navItems = [
    { href: prefix, label: "Overview" },
    { href: `${prefix}/research`, label: "Artist Research" },
    { href: `${prefix}/fans`, label: "Fans" },
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
        {/* Back to campaigns */}
        <Link
          href="/campaigns"
          className="px-3 py-2 rounded-md text-sm text-gray-500 hover:text-white hover:bg-gray-800 transition-colors mb-1"
        >
          &larr; Campaigns
        </Link>

        {/* Campaign name */}
        { campaign && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: campaign.color }}
            />
            <span className="text-sm font-semibold text-white truncate">{campaign.name}</span>
          </div>
        )}

        {/* Campaign nav */}
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
