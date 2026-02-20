"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getCampaigns, createCampaign as apiCreateCampaign } from "@/lib/api";
import type { Campaign } from "@/lib/types";

interface CampaignContextType {
  campaigns: Campaign[];
  activeCampaign: Campaign | null;
  setActiveCampaign: (campaign: Campaign) => void;
  refreshCampaigns: () => Promise<void>;
  loading: boolean;
}

const CampaignContext = createContext<CampaignContextType>({
  campaigns: [],
  activeCampaign: null,
  setActiveCampaign: () => {},
  refreshCampaigns: async () => {},
  loading: true,
});

export function useCampaign() {
  return useContext(CampaignContext);
}

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaignState] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshCampaigns = useCallback(async () => {
    try {
      const data = await getCampaigns();
      const list = data.results || [];
      setCampaigns(list);

      // If no campaigns exist, create a default one
      if (list.length === 0) {
        const created = await apiCreateCampaign({ name: "Default", description: "Default campaign", color: "#6366f1" });
        setCampaigns([created]);
        setActiveCampaignState(created);
        localStorage.setItem("activeCampaignId", created.id);
        return;
      }

      // Restore from localStorage or pick first
      const savedId = localStorage.getItem("activeCampaignId");
      const saved = list.find((p) => p.id === savedId);
      if (saved) {
        setActiveCampaignState(saved);
      } else {
        setActiveCampaignState(list[0]);
        localStorage.setItem("activeCampaignId", list[0].id);
      }
    } catch (e) {
      console.error("Failed to load campaigns:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCampaigns();
  }, [refreshCampaigns]);

  const setActiveCampaign = useCallback((campaign: Campaign) => {
    setActiveCampaignState(campaign);
    localStorage.setItem("activeCampaignId", campaign.id);
  }, []);

  return (
    <CampaignContext.Provider value={{ campaigns, activeCampaign, setActiveCampaign, refreshCampaigns, loading }}>
      {children}
    </CampaignContext.Provider>
  );
}
