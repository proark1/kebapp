"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

export function DemoRoleButton() {
  const { pending } = useFormStatus();

  return (
    <button className="demo-role-card__button" disabled={pending} type="submit">
      {pending ? (
        <LoaderCircle aria-hidden="true" className="demo-role-card__spinner" />
      ) : null}
      <span>{pending ? "Demo wird geöffnet …" : "Demo als diese Rolle öffnen"}</span>
      {!pending ? <ArrowRight aria-hidden="true" size={18} /> : null}
    </button>
  );
}
