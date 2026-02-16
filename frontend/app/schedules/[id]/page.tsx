"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSchedule, updateSchedule } from "@/lib/api";
import ScheduleForm from "@/components/schedules/ScheduleForm";
import type { ScheduledTask } from "@/lib/types";

export default function EditSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [schedule, setSchedule] = useState<ScheduledTask | null>(null);

  useEffect(() => {
    getSchedule(id).then(setSchedule).catch(console.error);
  }, [id]);

  if (!schedule) return <p className="text-gray-400">Loading...</p>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/schedules")}
          className="text-gray-400 hover:text-white text-sm"
        >
          &larr; Back
        </button>
        <h2 className="text-2xl font-bold">Edit Schedule</h2>
        <span className="text-sm text-gray-500 font-mono">{id}</span>
      </div>
      <ScheduleForm
        initial={schedule}
        onSave={async (data) => {
          await updateSchedule(id, data);
          router.push("/schedules");
        }}
      />
    </div>
  );
}
