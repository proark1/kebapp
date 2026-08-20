import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { formatCurrency, getBuyingRoundSnapshot } from "@/lib/calculations";
import type { BuyingRound, DemandItem } from "@/lib/types";

type BuyingRoundMeterProps = {
  round: BuyingRound;
  demands: DemandItem[];
  compact?: boolean;
};

export function BuyingRoundMeter({
  round,
  demands,
  compact = false,
}: BuyingRoundMeterProps) {
  const snapshot = getBuyingRoundSnapshot(round, demands);

  return (
    <div className={`spit-meter ${compact ? "spit-meter--compact" : ""}`}>
      <div className="spit-meter__visual" aria-hidden="true">
        <div className="spit-meter__skewer" />
        <div className="spit-meter__stack">
          <span className="spit-meter__slice spit-meter__slice--top" />
          <span className="spit-meter__slice" />
          <span className="spit-meter__slice spit-meter__slice--warm" />
          <span className="spit-meter__slice" />
          <span className="spit-meter__slice spit-meter__slice--wide" />
          <span className="spit-meter__slice spit-meter__slice--warm" />
        </div>
        <div
          className="spit-meter__fill"
          style={{ height: `${snapshot.progressPercent}%` }}
        />
      </div>

      <div className="spit-meter__content">
        <span className="eyebrow eyebrow--light">Sammelrunde · Fleisch</span>
        <div className="spit-meter__amount">
          <strong>{Math.round(snapshot.regionalKg)}</strong>
          <span>von {round.targetKg} kg</span>
        </div>
        <p>
          {snapshot.remainingKg > 0
            ? `Noch ${Math.round(snapshot.remainingKg)} kg bis zum Zielpreis von ${formatCurrency(round.tiers.at(-1)?.pricePerKg ?? snapshot.activeTier.pricePerKg)} je kg.`
            : `Zielpreis erreicht: ${formatCurrency(snapshot.activeTier.pricePerKg)} je kg.`}
        </p>
        <div className="spit-meter__progress" aria-label={`${Math.round(snapshot.progressPercent)} Prozent der Zielmenge erreicht`}>
          <span style={{ width: `${snapshot.progressPercent}%` }} />
        </div>
        {compact ? null : (
          <Link className="text-link text-link--light" href="/app/einkauf">
            Bedarf prüfen
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
