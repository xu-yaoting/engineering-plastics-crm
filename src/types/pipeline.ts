export interface CardData {
  id: string;
  entityType: string;
  entityId: string;
  companyName: string;
  companyId: string;
  material: string;
  value: number;
  currency: string;
  owner: string;
  status: string;
  stage: string;
  nextAction: string;
  daysInStage: number;
  urgency?: string;
}
