"use client";

import { useRouter } from "next/navigation";
import { createTask } from "@/lib/api";
import TaskEditor from "@/components/workflow/TaskEditor";

export default function NewTaskPage() {
  const router = useRouter();

  return (
    <TaskEditor
      isNew={true}
      onSave={async (data) => {
        const task = await createTask(data);
        router.push(`/tasks/${task.id}`);
      }}
    />
  );
}
