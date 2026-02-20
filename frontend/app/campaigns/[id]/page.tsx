"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCampaign, updateCampaign, deleteCampaign, getCampaignStats, startCampaign } from "@/lib/api";
import { useCampaign } from "@/lib/campaign-context";
import CampaignForm from "@/components/campaigns/CampaignForm";
import Link from "next/link";
import type { Campaign, CampaignStats } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-gray-500/20 text-gray-400",
  warming: "bg-yellow-500/20 text-yellow-400",
  active: "bg-green-500/20 text-green-400",
  paused: "bg-orange-500/20 text-orange-400",
  completed: "bg-blue-500/20 text-blue-400",
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { refreshCampaigns } = useCampaign();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCampaign(id).then(setCampaign).catch(console.error);
    getCampaignStats(id).then(setStats).catch(console.error);
  }, [id]);

  const handleSave = async (data: Partial<Campaign>) => {
    const updated = await updateCampaign(id, data);
    setCampaign(updated);
    refreshCampaigns();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this campaign and all its data? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteCampaign(id);
      refreshCampaigns();
      router.push("/");
    } finally {
      setDeleting(false);
    }
  };

  if (!campaign) {
    return <div className="text-gray-500">Loading...</div>;
  }

  // Timeline progress
  let timelineProgress: number | null = null;
  let timelineSub = "";
  if (campaign.start_date && campaign.end_date) {
    const start = new Date(campaign.start_date).getTime();
    const end = new Date(campaign.end_date).getTime();
    const now = Date.now();
    const total = end - start;
    if (total > 0) {
      const elapsed = Math.max(0, Math.min(now - start, total));
      timelineProgress = Math.round((elapsed / total) * 100);
      const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
      timelineSub = `${daysLeft} days remaining`;
    }
  }

  const quickLinks = [
    { label: "Fans", href: `/campaigns/${id}/fans`, count: stats?.persona_count },
    { label: "Tasks", href: `/campaigns/${id}/tasks`, count: stats?.task_count },
    { label: "Schedules", href: `/campaigns/${id}/schedules`, count: stats ? stats.schedules_active + stats.schedules_paused : undefined },
    { label: "Results", href: `/campaigns/${id}/results` },
    { label: "Queue", href: `/campaigns/${id}/queue`, count: stats ? stats.queue.queued + stats.queue.running : undefined },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: campaign.color }} />
          <h2 className="text-2xl font-bold">{campaign.name}</h2>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[campaign.status] || ""}`}>
            {campaign.status}
          </span>
        </div>
        {campaign.ready_agent_count > 0 && (
          <button
            onClick={async () => {
              const result = await startCampaign(id);
              alert(`Provisioned ${result.provisioned} fans. ${result.remaining_ready} still awaiting resources.`);
              getCampaign(id).then(setCampaign);
              getCampaignStats(id).then(setStats);
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-sm font-medium transition-colors"
          >
            Start Campaign ({campaign.ready_agent_count})
          </button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <StatCard
            label="Fans"
            value={stats.persona_count}
            sub={campaign.target_persona_count ? `of ${campaign.target_persona_count} target` : undefined}
          />
          <StatCard label="Tasks" value={stats.task_count} />
          <StatCard
            label="Schedules"
            value={stats.schedules_active}
            sub={stats.schedules_paused > 0 ? `${stats.schedules_paused} paused` : undefined}
          />
          <StatCard label="Devices" value={stats.devices_in_use} sub={campaign.max_devices ? `of ${campaign.max_devices} max` : undefined} />
          <StatCard
            label="Today's Runs"
            value={stats.results_today.total}
            sub={stats.results_today.total > 0 ? `${stats.results_today.successful} OK / ${stats.results_today.failed} fail` : undefined}
          />
          <StatCard
            label="Queue"
            value={stats.queue.queued + stats.queue.running}
            sub={stats.queue.running > 0 ? `${stats.queue.running} running` : undefined}
          />
        </div>
      )}

      {/* Timeline progress bar */}
      {timelineProgress !== null && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Timeline: {campaign.start_date} - {campaign.end_date}</span>
            <span>{timelineProgress}% &middot; {timelineSub}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${timelineProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="flex items-center gap-2 mb-6">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
          >
            {link.label}
            {link.count !== undefined && <span className="ml-1 text-gray-500">({link.count})</span>}
          </Link>
        ))}
      </div>

      {/* Edit form */}
      <CampaignForm initial={campaign} onSave={handleSave} />

      {/* Danger zone */}
      <div className="mt-8 bg-red-900/10 border border-red-900/30 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-red-400 mb-2 uppercase tracking-wider">Danger Zone</h3>
        <p className="text-sm text-gray-400 mb-3">
          Deleting this campaign will permanently remove all associated personas, tasks, schedules, and results.
        </p>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete Campaign"}
        </button>
      </div>
    </div>
  );
}
