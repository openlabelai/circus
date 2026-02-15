"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPersona, updatePersona } from "@/lib/api";
import PersonaForm from "@/components/personas/PersonaForm";
import type { Persona } from "@/lib/types";

export default function EditPersonaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [persona, setPersona] = useState<Persona | null>(null);

  useEffect(() => {
    getPersona(id).then(setPersona).catch(console.error);
  }, [id]);

  if (!persona) return <p className="text-gray-400">Loading...</p>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push("/personas")} className="text-gray-400 hover:text-white text-sm">
          &larr; Back
        </button>
        <h2 className="text-2xl font-bold">Edit Persona: {persona.name}</h2>
        <span className="text-sm font-mono text-cyan-400">{persona.id}</span>
      </div>
      <PersonaForm
        initial={persona}
        onSave={async (data) => {
          await updatePersona(id, data);
        }}
      />
    </div>
  );
}
