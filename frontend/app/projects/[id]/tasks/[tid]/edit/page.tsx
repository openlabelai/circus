"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTask, updateTask } from "@/lib/api";
import type { Task } from "@/lib/types";
import TaskEditor from "@/components/workflow/TaskEditor";

export default function EditTaskPage() {
  const { id, tid } = useParams<{ id: string; tid: string }>();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);

  useEffect(() => {
    getTask(tid).then(setTask).catch(console.error);
  }, [tid]);

  if (!task) return <p className="text-gray-400 p-8">Loading...</p>;

  return (
    <TaskEditor
      initialTask={task}
      isNew={false}
      onSave={async (data) => {
        await updateTask(tid, data);
        router.push(`/projects/${id}/tasks/${tid}`);
      }}
    />
  );
}
