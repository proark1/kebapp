import "server-only";

import { sql } from "drizzle-orm";
import { getRuntimeEnv } from "@/lib/env";
import { database } from "@/server/db/client";
import { createMailer } from "@/server/email/mailer";
import { roundReminderEmail } from "@/server/email/templates";

const MAINTENANCE_INTERVAL_MS = 60_000;
const REMINDER_HORIZON_HOURS = 48;

type DueRound = {
  round_id: string;
  round_name: string;
  closes_at: Date;
  organization_id: string;
  store_name: string;
};

type Recipient = {
  recipient_user_id: string;
  recipient_email: string;
  recipient_name: string;
};

export type RoundMaintenanceResult = {
  closedRounds: number;
  remindersSent: number;
};

async function closeDueRounds(now: Date): Promise<number> {
  const result = await database.execute<{ closed: string }>(sql`
    select kebapp_private.close_due_buying_rounds(${now.toISOString()}::timestamptz)::text as closed
  `);
  return Number(result.rows[0]?.closed ?? 0);
}

export async function runRoundMaintenance(
  now: Date = new Date(),
): Promise<RoundMaintenanceResult> {
  const env = getRuntimeEnv();
  let remindersSent = 0;

  const closedRounds = await closeDueRounds(now);

  if (!env.DEMO_MODE) {
    const dueRounds = await database.execute<DueRound>(sql`
      select
        round_id,
        round_name,
        closes_at,
        organization_id
      from kebapp_private.due_round_reminders(
        ${now.toISOString()}::timestamptz,
        ${`${REMINDER_HORIZON_HOURS} hours`}::interval
      )
    `);

    if (dueRounds.rows.length > 0) {
      const mailer = createMailer({
        from: env.SMTP_FROM!,
        host: env.SMTP_HOST!,
        port: env.SMTP_PORT!,
        requireTls: env.SMTP_REQUIRE_TLS,
      });

      try {
        for (const round of dueRounds.rows) {
          const recipients = await database.execute<Recipient>(sql`
            select
              recipient_user_id,
              recipient_email,
              recipient_name
            from kebapp_private.round_recipients(${round.organization_id}::uuid)
          `);

          for (const recipient of recipients.rows) {
            try {
              const url = new URL("/app/einkauf", env.BETTER_AUTH_URL).toString();
              await mailer.send(
                roundReminderEmail({
                  closesAt: new Date(round.closes_at),
                  roundName: round.round_name,
                  storeName: round.store_name,
                  to: recipient.recipient_email,
                  url,
                }),
              );
              remindersSent += 1;
            } catch {
              console.error(
                "Kebapp konnte eine Runden-Erinnerung nicht zustellen.",
              );
            }
          }

          await database.execute(sql`
            select kebapp_private.mark_round_reminder_sent(
              ${round.round_id}::uuid,
              ${now.toISOString()}::timestamptz
            )
          `);
        }
      } finally {
        mailer.close();
      }
    }
  } else {
    // Demo: keine Mails, aber Erinnerung als "erledigt" markieren, damit der
    // Zeitplan deterministisch bleibt.
    await database.execute(sql`
      select kebapp_private.mark_due_round_reminders(
        ${now.toISOString()}::timestamptz,
        ${`${REMINDER_HORIZON_HOURS} hours`}::interval
      )
    `);
  }

  return { closedRounds, remindersSent };
}

type MaintenanceGlobal = typeof globalThis & {
  __kebappRoundMaintenanceTimer?: NodeJS.Timeout;
};

export function startRoundMaintenanceLoop(): void {
  const maintenanceGlobal = globalThis as MaintenanceGlobal;
  if (maintenanceGlobal.__kebappRoundMaintenanceTimer) {
    return;
  }

  const tick = async () => {
    try {
      const result = await runRoundMaintenance();
      if (result.closedRounds > 0 || result.remindersSent > 0) {
        console.log(
          `Kebapp Runden-Wartung: ${result.closedRounds} geschlossen, ${result.remindersSent} Erinnerungen versendet.`,
        );
      }
    } catch (error) {
      console.error("Kebapp Runden-Wartung fehlgeschlagen.", error);
    }
  };

  maintenanceGlobal.__kebappRoundMaintenanceTimer = setInterval(
    () => void tick(),
    MAINTENANCE_INTERVAL_MS,
  );
}
