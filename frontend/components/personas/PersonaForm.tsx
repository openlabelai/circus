"use client";

import { useState } from "react";
import type { Persona, ServiceCredential } from "@/lib/types";

const ENGAGEMENT_STYLES = ["passive", "active", "moderate"];
const POSTING_FREQUENCIES = ["hourly", "daily", "weekly", "rarely"];
const SCROLL_SPEEDS = ["slow", "medium", "fast"];
const GENDERS = ["male", "female", "non-binary"];
const INTEREST_POOL = [
  "photography", "cooking", "travel", "fitness", "gaming", "music",
  "fashion", "tech", "art", "reading", "hiking", "yoga", "dance",
  "skateboarding", "surfing", "cycling", "meditation", "film",
];

interface Props {
  initial?: Partial<Persona>;
  onSave: (data: Partial<Persona>) => Promise<void>;
  isNew?: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none";
const selectClass = inputClass;

export default function PersonaForm({ initial = {}, onSave, isNew }: Props) {
  const [form, setForm] = useState<Partial<Persona>>({
    name: "", age: 25, gender: "", email: "", phone: "",
    city: "", state: "", country: "", username: "", bio: "",
    interests: [], engagement_style: "passive",
    session_duration_min: 5, session_duration_max: 30,
    posting_frequency: "daily", active_hours_start: 9,
    active_hours_end: 22, scroll_speed: "medium",
    credentials: [], assigned_device: "",
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const credentials = form.credentials || [];
  const setCredentials = (creds: ServiceCredential[]) => set("credentials", creds);

  const addCredential = () => {
    setCredentials([...credentials, { service_name: "", username: "", password: "", email: "" }]);
  };

  const updateCredential = (i: number, field: string, value: string) => {
    const updated = [...credentials];
    (updated[i] as any)[field] = value;
    setCredentials(updated);
  };

  const removeCredential = (i: number) => {
    setCredentials(credentials.filter((_, idx) => idx !== i));
  };

  const interests = form.interests || [];
  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      set("interests", interests.filter((i) => i !== interest));
    } else {
      set("interests", [...interests, interest]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await onSave(form);
      setMessage("Saved successfully!");
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Identity */}
      <Section title="Identity">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Name">
            <input className={inputClass} value={form.name || ""} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Age">
            <input className={inputClass} type="number" value={form.age || 25} onChange={(e) => set("age", Number(e.target.value))} />
          </Field>
          <Field label="Gender">
            <select className={selectClass} value={form.gender || ""} onChange={(e) => set("gender", e.target.value)}>
              <option value="">Select...</option>
              {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Email">
            <input className={inputClass} value={form.email || ""} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Username">
            <input className={inputClass} value={form.username || ""} onChange={(e) => set("username", e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Bio">
            <textarea className={inputClass + " h-20"} value={form.bio || ""} onChange={(e) => set("bio", e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* Location */}
      <Section title="Location">
        <div className="grid grid-cols-3 gap-4">
          <Field label="City">
            <input className={inputClass} value={form.city || ""} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="State">
            <input className={inputClass} value={form.state || ""} onChange={(e) => set("state", e.target.value)} />
          </Field>
          <Field label="Country">
            <input className={inputClass} value={form.country || ""} onChange={(e) => set("country", e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* Interests */}
      <Section title="Interests">
        <div className="flex flex-wrap gap-2">
          {INTEREST_POOL.map((interest) => (
            <button
              key={interest}
              type="button"
              onClick={() => toggleInterest(interest)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                interests.includes(interest)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {interest}
            </button>
          ))}
        </div>
      </Section>

      {/* Behavioral Profile */}
      <Section title="Behavioral Profile">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Engagement Style">
            <select className={selectClass} value={form.engagement_style || "passive"} onChange={(e) => set("engagement_style", e.target.value)}>
              {ENGAGEMENT_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Session Min (minutes)">
            <input className={inputClass} type="number" value={form.session_duration_min || 5} onChange={(e) => set("session_duration_min", Number(e.target.value))} />
          </Field>
          <Field label="Session Max (minutes)">
            <input className={inputClass} type="number" value={form.session_duration_max || 30} onChange={(e) => set("session_duration_max", Number(e.target.value))} />
          </Field>
          <Field label="Posting Frequency">
            <select className={selectClass} value={form.posting_frequency || "daily"} onChange={(e) => set("posting_frequency", e.target.value)}>
              {POSTING_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Active Hours Start">
            <input className={inputClass} type="number" min={0} max={23} value={form.active_hours_start ?? 9} onChange={(e) => set("active_hours_start", Number(e.target.value))} />
          </Field>
          <Field label="Active Hours End">
            <input className={inputClass} type="number" min={0} max={23} value={form.active_hours_end ?? 22} onChange={(e) => set("active_hours_end", Number(e.target.value))} />
          </Field>
          <Field label="Scroll Speed">
            <select className={selectClass} value={form.scroll_speed || "medium"} onChange={(e) => set("scroll_speed", e.target.value)}>
              {SCROLL_SPEEDS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      {/* Service Credentials */}
      <Section title="Service Credentials">
        {credentials.map((cred, i) => (
          <div key={i} className="grid grid-cols-5 gap-3 mb-3 items-end">
            <Field label="Service">
              <input className={inputClass} value={cred.service_name} onChange={(e) => updateCredential(i, "service_name", e.target.value)} placeholder="instagram" />
            </Field>
            <Field label="Username">
              <input className={inputClass} value={cred.username} onChange={(e) => updateCredential(i, "username", e.target.value)} />
            </Field>
            <Field label="Password">
              <input className={inputClass} type="password" value={cred.password} onChange={(e) => updateCredential(i, "password", e.target.value)} />
            </Field>
            <Field label="Email">
              <input className={inputClass} value={cred.email} onChange={(e) => updateCredential(i, "email", e.target.value)} />
            </Field>
            <button type="button" onClick={() => removeCredential(i)} className="text-red-400 hover:text-red-300 text-sm pb-1">
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addCredential} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm mt-2">
          + Add Service
        </button>
      </Section>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : isNew ? "Create Persona" : "Save Changes"}
        </button>
        {message && (
          <span className={message.startsWith("Error") ? "text-red-400 text-sm" : "text-green-400 text-sm"}>
            {message}
          </span>
        )}
      </div>
    </form>
  );
}
