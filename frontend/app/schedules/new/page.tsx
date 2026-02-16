"use client";

import { useRouter } from "next/navigation";
import { createSchedule } from "@/lib/api";
import ScheduleForm from "@/components/schedules/ScheduleForm";

export default function NewSchedulePage() {
  const router = useRouter();

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/schedules")}
          className="text-gray-400 hover:text-white text-sm"
        >
          &larr; Back
        </button>
        <h2 className="text-2xl font-bold">New Schedule</h2>
      </div>
      <ScheduleForm
        isNew
        onSave={async (data) => {
          await createSchedule(data);
          router.push("/schedules");
        }}
      />
    </div>
  );
}
