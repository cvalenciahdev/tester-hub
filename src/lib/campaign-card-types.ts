export type CampaignStatus =
  | "Draft"
  | "Recruiting"
  | "Testing"
  | "Completed"
  | "Cancelled";

export type ParticipationStatus =
  | "Waiting access"
  | "Access enabled"
  | "Active"
  | "Completed"
  | "Incompatible"
  | "Abandoned"
  | "Cancelled";

export type Campaign = {
  id: string;
  name: string;
  app: string;
  category: string;
  description: string;
  platform: string;
  countries: string[];
  minVersion: string;
  duration: string;
  target: number;
  covered: number;
  status: CampaignStatus;
  color: string;
  icon: string;
  instructions: string[];
};
