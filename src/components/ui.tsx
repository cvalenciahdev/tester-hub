import type { ReactNode } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock3, MapPin, Users } from "lucide-react";
import type { Campaign, CampaignStatus, ParticipationStatus } from "@/lib/campaign-card-types";
import { T, type TranslationKey } from "@/lib/i18n";

type BadgeStatus =
  | CampaignStatus
  | ParticipationStatus
  | "Active"
  | "Activa"
  | "Archivada";

const statusStyles: Record<string, string> = {
  Draft: "badge-neutral",
  Recruiting: "badge-blue",
  Testing: "badge-violet",
  Completed: "badge-green",
  Cancelled: "badge-red",
  "Waiting access": "badge-amber",
  "Access enabled": "badge-blue",
  Active: "badge-green",
  Incompatible: "badge-red",
  Abandoned: "badge-neutral",
  Activa: "badge-green",
  Archivada: "badge-neutral",
};

const statusTranslationKeys: Record<BadgeStatus, TranslationKey> = {
  Draft: "status.Draft",
  Recruiting: "status.Recruiting",
  Testing: "status.Testing",
  Completed: "status.Completed",
  Cancelled: "status.Cancelled",
  "Waiting access": "status.Waiting access",
  "Access enabled": "status.Access enabled",
  Active: "status.Active",
  Incompatible: "status.Incompatible",
  Abandoned: "status.Abandoned",
  Activa: "status.Activa",
  Archivada: "status.Archivada",
};

export function Badge({ status }: { status: BadgeStatus }) {
  return <span className={`badge ${statusStyles[status]}`}><T id={statusTranslationKeys[status]} /></span>;
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "blue",
}: {
  label: ReactNode;
  value: string | number;
  note: ReactNode;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  tone?: "blue" | "mint" | "amber" | "violet";
}) {
  return (
    <article className="stat-card">
      <div className={`stat-icon tone-${tone}`}>
        <Icon size={19} strokeWidth={1.8} />
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </article>
  );
}

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const percentage = Math.round((campaign.covered / campaign.target) * 100);
  return (
    <article className="campaign-card">
      <div className="campaign-card-top">
        <div className={`app-mark mark-${campaign.color}`}>{campaign.icon}</div>
        <Badge status={campaign.status} />
      </div>
      <div className="campaign-category">{campaign.category}</div>
      <h3>{campaign.name}</h3>
      <p className="campaign-card-description">{campaign.description}</p>
      <div className="campaign-facts">
        <span>{campaign.platform}</span>
        <span><MapPin size={14} />{campaign.countries.join(", ")}</span>
        <span><Clock3 size={14} />{campaign.duration}</span>
      </div>
      <div className="campaign-progress-label">
        <span><Users size={14} /><T id="explore.coveredSpots" /></span>
        <span><T id="explore.spotsCount" values={{ covered: campaign.covered, target: campaign.target }} /></span>
      </div>
      <div className="progress-track">
        <span style={{ width: `${percentage}%` }} />
      </div>
      <Link className="text-link campaign-link" href={`/explore/${campaign.id}`}>
        <T id="explore.viewDetails" /> <ArrowUpRight size={15} />
      </Link>
    </article>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <div className="empty-hint">{children}</div>;
}
