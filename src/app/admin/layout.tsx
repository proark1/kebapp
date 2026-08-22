import type { Metadata } from "next";
import { AdminNavigation } from "@/components/admin-navigation";
import { DemoEnvironmentBar } from "@/components/demo-environment-bar";
import { requirePlatformAdminPage } from "@/server/auth/page-guards";
import { isPublicDemo } from "@/server/demo/demo-mode";

export const metadata: Metadata = {
  title: { default: "Prüftisch", template: "%s · Kebapp Prüftisch" },
  robots: { follow: false, index: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePlatformAdminPage("/admin");
  const demoMode = isPublicDemo();

  return (
    <div className={`admin-shell ${demoMode ? "admin-shell--demo" : ""}`}>
      <a className="skip-link" href="#admin-main">
        Zum Inhalt springen
      </a>
      {demoMode ? <DemoEnvironmentBar /> : null}
      <AdminNavigation actorName={actor.name} />
      <div className="admin-workspace">
        <main id="admin-main">{children}</main>
      </div>
    </div>
  );
}
