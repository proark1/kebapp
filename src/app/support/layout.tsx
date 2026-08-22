import type { Metadata } from "next";
import { Headset, ShieldCheck } from "lucide-react";
import { DemoEnvironmentBar } from "@/components/demo-environment-bar";
import { SupportNavigation } from "@/components/support-navigation";
import { requirePlatformSupportPage } from "@/server/auth/page-guards";
import { isPublicDemo } from "@/server/demo/demo-mode";

export const metadata: Metadata = {
  title: { default: "Supporteinsatz", template: "%s · Kebapp Support" },
  robots: { follow: false, index: false },
};

export default async function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requirePlatformSupportPage("/support");
  const demoMode = isPublicDemo();

  return (
    <div className={`support-shell ${demoMode ? "support-shell--demo" : ""}`}>
      <a className="skip-link" href="#support-main">Zum Inhalt springen</a>
      {demoMode ? <DemoEnvironmentBar /> : null}
      <header className="support-context-bar">
        <div>
          <Headset size={18} aria-hidden="true" />
          <strong>Supporteinsatz</strong>
          <span>Du handelst als {actor.name} – niemals als Ladeninhaber:in.</span>
        </div>
        <span>
          <ShieldCheck size={17} aria-hidden="true" />
          Änderungen werden begründet protokolliert
        </span>
      </header>
      <SupportNavigation actorName={actor.name} />
      <main className="support-workspace" id="support-main">{children}</main>
    </div>
  );
}
