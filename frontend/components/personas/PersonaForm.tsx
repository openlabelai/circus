"use client";

import { useState } from "react";
import type { Persona, ServiceCredential } from "@/lib/types";

const ENGAGEMENT_STYLES = ["passive", "active", "moderate"];
const POSTING_FREQUENCIES = ["hourly", "daily", "weekly", "rarely"];
const SCROLL_SPEEDS = ["slow", "medium", "fast"];
const NICHE_POOL = [
  "fitness", "cooking", "travel", "tech", "beauty", "fashion",
  "parenting", "finance", "gaming", "music", "art", "wellness",
  "photography", "food", "pets", "sports", "education", "comedy",
];
const TONE_POOL = [
  "casual", "professional", "enthusiastic", "sarcastic", "warm",
  "Gen-Z", "motivational", "educational", "humorous", "chill",
];
const GENDERS = ["male", "female", "non-binary"];
const GENRE_POOL = [
  "hip-hop", "indie-rock", "edm", "r&b", "latin", "k-pop", "pop", "country",
];
const ARCHETYPE_POOL = [
  { value: "day_one_stan", label: "Day-One Stan" },
  { value: "casual_viber", label: "Casual Viber" },
  { value: "content_creator_fan", label: "Content Creator Fan" },
  { value: "genre_head", label: "Genre Head" },
];
const DISCOVERY_STYLES = [
  "algorithmic", "soundcloud_digger", "blog_reader", "dj_friend",
  "playlist_curator", "radio_listener",
];
const PROFILE_AESTHETICS = ["dark_minimal", "colorful", "aesthetic", "no_theme"];
const KNOWLEDGE_DEPTHS = ["deep", "surface"];
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
    interests: [], niche: "", tone: "",
    background_story: "", content_style: "",
    engagement_style: "passive",
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

      {/* Character */}
      <Section title="Character">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Niche">
            <select className={selectClass} value={form.niche || ""} onChange={(e) => set("niche", e.target.value)}>
              <option value="">Select...</option>
              {NICHE_POOL.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Tone">
            <select className={selectClass} value={form.tone || ""} onChange={(e) => set("tone", e.target.value)}>
              <option value="">Select...</option>
              {TONE_POOL.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Field label="Background Story">
            <textarea className={inputClass + " h-20"} value={form.background_story || ""} onChange={(e) => set("background_story", e.target.value)} placeholder="Who is this person and why are they into their niche?" />
          </Field>
          <Field label="Content Style">
            <textarea className={inputClass + " h-20"} value={form.content_style || ""} onChange={(e) => set("content_style", e.target.value)} placeholder="How do they post? Format preferences, caption style, emoji usage..." />
          </Field>
        </div>
      </Section>

      {/* Music Profile */}
      <Section title="Music Profile">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Genre">
            <select className={selectClass} value={form.genre || ""} onChange={(e) => set("genre", e.target.value)}>
              <option value="">Select...</option>
              {GENRE_POOL.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Archetype">
            <select className={selectClass} value={form.archetype || ""} onChange={(e) => set("archetype", e.target.value)}>
              <option value="">Select...</option>
              {ARCHETYPE_POOL.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Field>
          <Field label="Music Discovery">
            <select className={selectClass} value={form.music_discovery_style || ""} onChange={(e) => set("music_discovery_style", e.target.value)}>
              <option value="">Select...</option>
              {DISCOVERY_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Profile Aesthetic">
            <select className={selectClass} value={form.profile_aesthetic || ""} onChange={(e) => set("profile_aesthetic", e.target.value)}>
              <option value="">Select...</option>
              {PROFILE_AESTHETICS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Knowledge Depth">
            <select className={selectClass} value={form.artist_knowledge_depth || ""} onChange={(e) => set("artist_knowledge_depth", e.target.value)}>
              <option value="">Select...</option>
              {KNOWLEDGE_DEPTHS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Bio Template">
            <input className={inputClass} value={form.bio_template || ""} onChange={(e) => set("bio_template", e.target.value)} placeholder="artist1 + artist2 | genre | city" />
          </Field>
        </div>
        {(form.favorite_artists as string[] || []).length > 0 && (
          <div className="mt-4">
            <Field label="Favorite Artists (LLM-generated)">
              <div className="flex flex-wrap gap-2">
                {(form.favorite_artists as string[] || []).map((artist, i) => (
                  <span key={i} className="px-2 py-1 bg-purple-900/50 border border-purple-700 rounded text-xs">{artist}</span>
                ))}
              </div>
            </Field>
          </div>
        )}
        {form.comment_style && Object.keys(form.comment_style).length > 0 && (
          <div className="mt-4">
            <Field label="Comment Style (LLM-generated)">
              <pre className="bg-gray-800 border border-gray-700 rounded p-2 text-xs overflow-auto">{JSON.stringify(form.comment_style, null, 2)}</pre>
            </Field>
          </div>
        )}
        {form.engagement_pattern && Object.keys(form.engagement_pattern).length > 0 && (
          <div className="mt-4">
            <Field label="Engagement Pattern (LLM-generated)">
              <pre className="bg-gray-800 border border-gray-700 rounded p-2 text-xs overflow-auto">{JSON.stringify(form.engagement_pattern, null, 2)}</pre>
            </Field>
          </div>
        )}
        {form.content_behavior && Object.keys(form.content_behavior).length > 0 && (
          <div className="mt-4">
            <Field label="Content Behavior (LLM-generated)">
              <pre className="bg-gray-800 border border-gray-700 rounded p-2 text-xs overflow-auto">{JSON.stringify(form.content_behavior, null, 2)}</pre>
            </Field>
          </div>
        )}
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
