"use client";

import { useState, useEffect } from "react";
import { getTasks, getPersonas, getDevices } from "@/lib/api";
import type { ScheduledTask, Task, PersonaSummary, Device } from "@/lib/types";

interface Props {
  initial?: Partial<ScheduledTask>;
  onSave: (data: Partial<ScheduledTask>) => Promise<void>;
  isNew?: boolean;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

export default function ScheduleForm({ initial = {}, onSave, isNew }: Props) {
  const [form, setForm] = useState({
    task: initial.task || "",
    persona: initial.persona || "",
    device_serial: initial.device_serial || "",
    trigger_type: initial.trigger_type || "interval",
    cron_expression: initial.cron_expression || "",
    interval_seconds: initial.interval_seconds || 3600,
    run_at: initial.run_at || "",
    respect_active_hours: initial.respect_active_hours ?? true,
  });

  const [tasks, setTasks] = useState<Task[]>([]);
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getTasks()
      .then((d) => setTasks(d.results || []))
      .catch(console.error);
    getPersonas()
      .then((d) => setPersonas(d.results || []))
      .catch(console.error);
    getDevices().then(setDevices).catch(console.error);
  }, []);

  const set = (key: string, value: string | number | boolean | null) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const data: Record<string, unknown> = {
        task: form.task,
        trigger_type: form.trigger_type,
        respect_active_hours: form.respect_active_hours,
      };
      if (form.persona) data.persona = form.persona;
      else data.persona = null;
      if (form.device_serial) data.device_serial = form.device_serial;

      if (form.trigger_type === "interval")
        data.interval_seconds = form.interval_seconds;
      if (form.trigger_type === "cron")
        data.cron_expression = form.cron_expression;
      if (form.trigger_type === "once" && form.run_at)
        data.run_at = new Date(form.run_at).toISOString();

      await onSave(data as Partial<ScheduledTask>);
    } catch (err: unknown) {
      setMessage(`Error: ${err instanceof Error ? err.message : err}`);
      setSaving(false);
    }
  };

  const intervalHint = () => {
    const s = form.interval_seconds;
    if (s >= 86400) return `= ${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
    if (s >= 3600) return `= ${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
    if (s >= 60) return `= ${Math.floor(s / 60)}m ${s % 60}s`;
    return "";
  };

  return (
    <form onSubmit={handleSubmit}>
      <Section title="Target">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Task *">
            <select
              className={inputClass}
              value={form.task}
              onChange={(e) => set("task", e.target.value)}
              required
            >
              <option value="">Select task...</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Persona (optional)">
            <select
              className={inputClass}
              value={form.persona}
              onChange={(e) => set("persona", e.target.value)}
            >
              <option value="">None</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Device (optional)">
            <select
              className={inputClass}
              value={form.device_serial}
              onChange={(e) => set("device_serial", e.target.value)}
            >
              <option value="">Any available</option>
              {devices.map((d) => (
                <option key={d.serial} value={d.serial}>
                  {d.model} ({d.serial})
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Trigger">
        <div className="mb-4">
          <Field label="Trigger Type">
            <select
              className={inputClass}
              value={form.trigger_type}
              onChange={(e) => set("trigger_type", e.target.value)}
            >
              <option value="interval">Interval</option>
              <option value="cron">Cron</option>
              <option value="once">One-time</option>
            </select>
          </Field>
        </div>

        {form.trigger_type === "interval" && (
          <Field label="Interval (seconds)">
            <input
              type="number"
              className={inputClass}
              value={form.interval_seconds}
              onChange={(e) => set("interval_seconds", Number(e.target.value))}
              min={1}
            />
            {intervalHint() && (
              <p className="text-xs text-gray-500 mt-1">{intervalHint()}</p>
            )}
          </Field>
        )}

        {form.trigger_type === "cron" && (
          <Field label="Cron Expression">
            <input
              className={inputClass}
              value={form.cron_expression}
              onChange={(e) => set("cron_expression", e.target.value)}
              placeholder="0 */6 * * *"
            />
            <p className="text-xs text-gray-500 mt-1">
              Format: minute hour day month weekday (e.g. &quot;0 9 * * 1-5&quot; = 9am weekdays)
            </p>
          </Field>
        )}

        {form.trigger_type === "once" && (
          <Field label="Run At">
            <input
              type="datetime-local"
              className={inputClass}
              value={
                form.run_at
                  ? new Date(form.run_at).toISOString().slice(0, 16)
                  : ""
              }
              onChange={(e) => set("run_at", e.target.value)}
            />
          </Field>
        )}

        <div className="mt-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.respect_active_hours}
              onChange={(e) => set("respect_active_hours", e.target.checked)}
              className="rounded bg-gray-800 border-gray-700"
            />
            <span className="text-gray-300">
              Respect persona active hours
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-5">
            Skip runs when outside the persona&apos;s configured active hours window
          </p>
        </div>
      </Section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : isNew
              ? "Create Schedule"
              : "Save Changes"}
        </button>
        {message && (
          <span
            className={
              message.startsWith("Error")
                ? "text-red-400 text-sm"
                : "text-green-400 text-sm"
            }
          >
            {message}
          </span>
        )}
      </div>
    </form>
  );
}
