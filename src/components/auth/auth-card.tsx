import type { ReactNode } from "react";
import { isPublicDemo } from "@/server/demo/demo-mode";

type AuthCardProps = {
  children: ReactNode;
  description: string;
  eyebrow: string;
  footer?: ReactNode;
  title: string;
};

export function AuthCard({
  children,
  description,
  eyebrow,
  footer,
  title,
}: AuthCardProps) {
  const demoMode = isPublicDemo();

  return (
    <main className="auth-main" id="auth-main">
      <section className="auth-card" aria-labelledby="auth-title">
        <header className="auth-card__header">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1 id="auth-title">{title}</h1>
          <p>{description}</p>
        </header>

        {children}

        {footer ? <footer className="auth-card__footer">{footer}</footer> : null}
      </section>
      <p className="auth-local-note">
        {demoMode
          ? "Öffentliche Demo · E-Mail-Versand deaktiviert"
          : "Lokale Entwicklungsumgebung · E-Mails nur über den konfigurierten Testversand"}
      </p>
    </main>
  );
}
