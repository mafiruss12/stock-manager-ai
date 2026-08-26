export type BtpDocType = 'quote' | 'invoice' | 'situation';
export type BtpDocStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'paid' | 'partial' | 'overdue';

export const BTP_CATEGORIES = [
  { id: 'gros_oeuvre', label: 'Gros œuvre' },
  { id: 'maconnerie', label: 'Maçonnerie' },
  { id: 'charpente_couverture', label: 'Charpente / Couverture' },
  { id: 'plomberie_sanitaire', label: 'Plomberie / Sanitaire' },
  { id: 'electricite', label: 'Électricité' },
  { id: 'peinture_revetement', label: 'Peinture / Revêtement' },
  { id: 'carrelage', label: 'Carrelage' },
  { id: 'menuiserie', label: 'Menuiserie' },
  { id: 'quincaillerie_fer', label: 'Quincaillerie / Fer' },
  { id: 'main_oeuvre', label: 'Main d\'œuvre' },
  { id: 'engins_location', label: 'Engins / Location' },
  { id: 'divers', label: 'Divers' },
] as const;

export const DOC_TYPE_LABELS: Record<BtpDocType, string> = {
  quote: 'Devis',
  invoice: 'Facture',
  situation: 'Situation',
};

export const DOC_STATUS_LABELS: Record<BtpDocStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  rejected: 'Refusé',
  paid: 'Payé',
  partial: 'Acompte',
  overdue: 'En retard',
};

export function formatMoney(n: number, currency = 'FCFA') {
  return `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} ${currency}`;
}

export function lineHT(qty: number, price: number, discount = 0) {
  const base = Number(qty) * Number(price);
  return base * (1 - Number(discount) / 100);
}

export function nextDocNumber(type: BtpDocType, existing: { type: string; doc_number: string }[]) {
  const prefix = type === 'quote' ? 'DEV' : type === 'invoice' ? 'FAC' : 'SIT';
  const year = new Date().getFullYear();
  const same = existing.filter((d) => d.type === type && d.doc_number.includes(String(year)));
  const n = same.length + 1;
  return `${prefix}-${year}-${String(n).padStart(4, '0')}`;
}

export type BtpBranding = {
  slogan?: string;
  activity?: string;
  email?: string;
  website?: string;
  city?: string;
  country?: string;
  rccm?: string;
  nif?: string;
  tva_number?: string;
  bank_name?: string;
  iban?: string;
  mobile_money?: string;
  header_note?: string;
  footer_text?: string;
  legal_notice?: string;
  payment_terms_default?: string;
  stamp_url?: string;
};

export const DEFAULT_BRANDING: BtpBranding = {
  slogan: '',
  activity: 'Travaux de bâtiment & fournitures',
  email: '',
  website: '',
  city: '',
  country: 'Côte d\'Ivoire',
  rccm: '',
  nif: '',
  tva_number: '',
  bank_name: '',
  iban: '',
  mobile_money: '',
  header_note: '',
  footer_text: 'Merci de votre confiance.',
  legal_notice: 'Devis valable 30 jours. Acompte à la commande.',
  payment_terms_default: 'Acompte 30 % à la commande, solde à la réception des travaux.',
  stamp_url: '',
};
