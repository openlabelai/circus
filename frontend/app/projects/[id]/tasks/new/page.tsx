"use client";

import { useParams, useRouter } from "next/navigation";
import { createTask } from "@/lib/api";
import TaskEditor from "@/components/workflow/TaskEditor";

export default function NewTaskPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <TaskEditor
      isNew={true}
      onSave={async (data) => {
        const task = await createTask(data);
        router.push(`/projects/${id}/tasks/${task.id}`);
      }}
    />
  );
}
