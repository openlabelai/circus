"use client";

import { useRouter } from "next/navigation";
import { createPersona } from "@/lib/api";
import PersonaForm from "@/components/personas/PersonaForm";

export default function NewPersonaPage() {
  const router = useRouter();

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push("/personas")} className="text-gray-400 hover:text-white text-sm">
          &larr; Back
        </button>
        <h2 className="text-2xl font-bold">New Persona</h2>
      </div>
      <PersonaForm
        isNew
        onSave={async (data) => {
          const created = await createPersona(data);
          router.push(`/personas/${created.id}`);
        }}
      />
    </div>
  );
}
