"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTask, updateTask } from "@/lib/api";
import type { Task } from "@/lib/types";
import TaskEditor from "@/components/workflow/TaskEditor";

export default function EditTaskPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [task, setTask] = useState<Task | null>(null);

  useEffect(() => {
    getTask(id).then(setTask).catch(console.error);
  }, [id]);

  if (!task) return <p className="text-gray-400 p-8">Loading...</p>;

  return (
    <TaskEditor
      initialTask={task}
      isNew={false}
      onSave={async (data) => {
        await updateTask(id, data);
        router.push(`/tasks/${id}`);
      }}
    />
  );
}
