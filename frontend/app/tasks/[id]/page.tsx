"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getTask, deleteTask } from "@/lib/api";
import type { Task } from "@/lib/types";

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [task, setTask] = useState<Task | null>(null);

  useEffect(() => {
    getTask(id).then(setTask).catch(console.error);
  }, [id]);

  if (!task) return <p className="text-gray-400">Loading...</p>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push("/tasks")} className="text-gray-400 hover:text-white text-sm">
          &larr; Back
        </button>
        <h2 className="text-2xl font-bold">{task.name}</h2>
        <div className="ml-auto flex gap-2">
          <Link
            href={`/tasks/${id}/edit`}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
          >
            Edit Workflow
          </Link>
          <button
            onClick={async () => {
              if (!confirm(`Delete task "${task.name}"? This will also remove the YAML file.`)) return;
              await deleteTask(id);
              router.push("/tasks");
            }}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-4">
        <div className="grid grid-cols-3 gap-4 text-sm mb-4">
          <div>
            <span className="text-gray-400">Target Package:</span>{" "}
            <span className="font-mono">{task.target_package || "-"}</span>
          </div>
          <div>
            <span className="text-gray-400">Timeout:</span> {task.timeout}s
          </div>
          <div>
            <span className="text-gray-400">Source:</span>{" "}
            <span className="font-mono">{task.source_file || "-"}</span>
          </div>
        </div>
        {task.description && <p className="text-gray-300 text-sm">{task.description}</p>}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
          Actions ({task.actions.length})
        </h3>
        <div className="space-y-2">
          {task.actions.map((action, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className="text-gray-500 font-mono w-6 text-right">{i + 1}.</span>
              <pre className="bg-gray-800 rounded px-3 py-1.5 flex-1 overflow-x-auto text-xs">
                {JSON.stringify(action, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
