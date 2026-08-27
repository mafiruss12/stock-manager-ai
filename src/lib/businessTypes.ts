import type { Role } from './types';

export type BusinessType =
  | 'maquis'
  | 'magasin'
  | 'boutique'
  | 'superette'
  | 'quincaillerie'
  | 'location_event'
  | 'btp';


export const BUSINESS_TYPES: BusinessType[] = [
  'maquis',
  'magasin',
  'boutique',
  'superette',
  'quincaillerie',
  'location_event',
  'btp',
];


export const BUSINESS_LABELS: Record<BusinessType, string> = {
  maquis: 'Maquis',
  magasin: 'Magasin',
  boutique: 'Boutique',
  superette: 'Supérette',
  quincaillerie: 'Quincaillerie',
  location_event: 'Location événementielle',
  btp: 'BTP / BatiDevis',
};

export const BUSINESS_DESCRIPTIONS: Record<BusinessType, string> = {
  maquis: 'Boissons, grills et gestion de caisse au quotidien',
  magasin: 'Stock produits, achats, marge et vente au détail',
  boutique: 'Articles, collections et vente au détail',
  superette: 'Épicerie, stock rapide et rayons',
  quincaillerie: 'Matériaux, outillage et stock technique',
  location_event: 'Chaises, tables, bâches, sono — mariages et cérémonies',
  btp: 'Devis, factures et matériaux pour artisans et entreprises du bâtiment',
};

export const BUSINESS_THEMES: Record<
  BusinessType,
  { primary: string; primarySoft: string; accent: string; label: string; gradient: string }
> = {
  maquis: {
    primary: '#f59e0b',
    primarySoft: 'rgba(245, 158, 11, 0.15)',
    accent: '#d97706',
    label: 'Ambre',
    gradient: 'from-amber-500/20 to-orange-600/5',
  },
  magasin: {
    primary: '#06b6d4',
    primarySoft: 'rgba(6, 182, 212, 0.15)',
    accent: '#0891b2',
    label: 'Cyan',
    gradient: 'from-cyan-500/20 to-blue-600/5',
  },
  boutique: {
    primary: '#ec4899',
    primarySoft: 'rgba(236, 72, 153, 0.15)',
    accent: '#db2777',
    label: 'Rose',
    gradient: 'from-pink-500/20 to-rose-600/5',
  },
  superette: {
    primary: '#84cc16',
    primarySoft: 'rgba(132, 204, 22, 0.15)',
    accent: '#65a30d',
    label: 'Lime',
    gradient: 'from-lime-500/20 to-green-600/5',
  },
  quincaillerie: {
    primary: '#f97316',
    primarySoft: 'rgba(249, 115, 22, 0.15)',
    accent: '#ea580c',
    label: 'Orange',
    gradient: 'from-orange-500/20 to-amber-600/5',
  },
  location_event: {
    primary: '#6366f1',
    primarySoft: 'rgba(99, 102, 241, 0.15)',
    accent: '#4f46e5',
    label: 'Indigo',
    gradient: 'from-indigo-500/20 to-violet-600/5',
  },
  btp: {
    primary: '#0ea5e9',
    primarySoft: 'rgba(14, 165, 233, 0.15)',
    accent: '#0284c7',
    label: 'Sky',
    gradient: 'from-sky-500/20 to-blue-600/5',
  },
};

export const MENU_BY_TYPE: Record<BusinessType, string[]> = {
  maquis: [
    '/dashboard', '/pos', '/documents', '/inventory', '/inventory/scan', '/point-manuel', '/guide',
    '/kits', '/menu-qr', '/stock-transfer', '/orders', '/tables', '/kitchen', '/purchases', '/suppliers', '/customers',
    '/expenses', '/mes-employes', '/calendar', '/daily-report', '/cloture', '/patron',
    '/statistics', '/reports', '/accounting', '/ai', '/ai-train', '/chat',
    '/notifications', '/settings',
  ],
  magasin: [
    '/dashboard', '/pos', '/documents', '/inventory', '/inventory/scan', '/point-manuel', '/guide',
    '/kits', '/menu-qr', '/stock-transfer', '/purchases', '/suppliers', '/customers',
    '/expenses', '/mes-employes', '/daily-report', '/cloture', '/statistics', '/accounting', '/reports',
    '/ai', '/ai-train', '/chat', '/notifications', '/settings',
  ],
  boutique: [
    '/dashboard', '/pos', '/documents', '/inventory', '/inventory/scan', '/point-manuel', '/guide',
    '/kits', '/menu-qr', '/stock-transfer', '/purchases', '/suppliers', '/customers',
    '/expenses', '/mes-employes', '/daily-report', '/cloture', '/statistics', '/accounting', '/reports',
    '/ai', '/ai-train', '/chat', '/notifications', '/settings',
  ],
  superette: [
    '/dashboard', '/pos', '/documents', '/inventory', '/inventory/scan', '/point-manuel', '/guide',
    '/kits', '/menu-qr', '/stock-transfer', '/purchases', '/suppliers', '/customers',
    '/expenses', '/mes-employes', '/daily-report', '/cloture', '/statistics', '/accounting', '/reports',
    '/ai', '/ai-train', '/chat', '/notifications', '/settings',
  ],
  quincaillerie: [
    '/dashboard', '/pos', '/documents', '/inventory', '/inventory/scan', '/point-manuel', '/guide',
    '/kits', '/menu-qr', '/stock-transfer', '/purchases', '/suppliers', '/customers',
    '/expenses', '/mes-employes', '/daily-report', '/cloture', '/statistics', '/accounting', '/reports',
    '/ai', '/ai-train', '/chat', '/notifications', '/settings',
  ],
  location_event: [
    '/dashboard', '/rent/equipment', '/rent/clients', '/rent/orders',
    '/rent/movements', '/rent/payments', '/rent/calendar', '/rent/packs',
    '/rent/invoices', '/guide', '/mes-employes', '/daily-report', '/cloture',
    '/ai', '/ai-train', '/chat', '/notifications', '/settings',
  ],
  btp: [
    '/dashboard', '/btp/documents', '/btp/clients', '/btp/materials',
    '/guide', '/mes-employes', '/expenses', '/statistics',
    '/ai', '/ai-train', '/chat', '/notifications', '/settings',
  ],
};

export const EQUIPMENT_CATEGORIES = [
  'chaises', 'chaises_presidentielles', 'tables', 'treteaux', 'baches',
  'chapiteaux', 'sonorisation', 'vaisselle', 'decoration', 'autres',
] as const;

export const EQUIPMENT_CATEGORY_LABELS: Record<string, string> = {
  chaises: 'Chaises',
  chaises_presidentielles: 'Chaises présidentielles',
  tables: 'Tables',
  treteaux: 'Tréteaux',
  baches: 'Bâches',
  chapiteaux: 'Chapiteaux',
  sonorisation: 'Sonorisation',
  vaisselle: 'Vaisselle',
  decoration: 'Décoration',
  autres: 'Autres',
};

export const RENTAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  confirmed: 'Confirmée',
  out: 'En sortie',
  returned: 'Retournée',
  cancelled: 'Annulée',
};


/** Libellés métier cohérents par type d'établissement */
export interface BusinessUI {
  productSingular: string;
  productPlural: string;
  inventoryTitle: string;
  inventorySubtitle: string;
  posTitle: string;
  posSubtitle: string;
  stockAlert: string;
  categories: string[];
  unitDefault: string;
  salesLabel: string;
  shortcutInventory: string;
  emptyProducts: string;
}

export const BUSINESS_UI: Record<BusinessType, BusinessUI> = {
  maquis: {
    productSingular: 'Boisson / article',
    productPlural: 'Boissons & grillades',
    inventoryTitle: 'Inventaire maquis',
    inventorySubtitle: 'Boissons, casiers et grillades',
    posTitle: 'Caisse maquis',
    posSubtitle: 'Vente rapide au comptoir',
    stockAlert: 'Boissons en rupture',
    categories: ['Bière', 'Soda', 'Eau', 'Vin', 'Spiritueux', 'Énergie', 'Grillade', 'Accompagnement', 'Autre'],
    unitDefault: 'bouteille',
    salesLabel: 'Ventes',
    shortcutInventory: 'Boissons',
    emptyProducts: 'Aucune boisson en stock. Importez le catalogue Makaya ou ajoutez des produits.',
  },
  magasin: {
    productSingular: 'Produit',
    productPlural: 'Produits',
    inventoryTitle: 'Inventaire magasin',
    inventorySubtitle: 'Références, quantités et seuils',
    posTitle: 'Caisse magasin',
    posSubtitle: 'Vente au détail',
    stockAlert: 'Produits sous seuil',
    categories: ['Alimentaire', 'Hygiène', 'Électronique', 'Divers', 'Autre'],
    unitDefault: 'pièce',
    salesLabel: 'Ventes',
    shortcutInventory: 'Stock',
    emptyProducts: 'Aucun produit. Ajoutez vos références magasin.',
  },
  boutique: {
    productSingular: 'Article',
    productPlural: 'Articles',
    inventoryTitle: 'Stock boutique',
    inventorySubtitle: 'Collections et tailles',
    posTitle: 'Caisse boutique',
    posSubtitle: 'Vente d’articles',
    stockAlert: 'Articles en rupture',
    categories: ['Homme', 'Femme', 'Enfant', 'Accessoire', 'Autre'],
    unitDefault: 'pièce',
    salesLabel: 'Ventes',
    shortcutInventory: 'Articles',
    emptyProducts: 'Aucun article boutique.',
  },
  superette: {
    productSingular: 'Produit',
    productPlural: 'Rayons',
    inventoryTitle: 'Inventaire supérette',
    inventorySubtitle: 'Rayons et réassort',
    posTitle: 'Caisse supérette',
    posSubtitle: 'Encaissement rapide',
    stockAlert: 'Rayons à réapprovisionner',
    categories: ['Épicerie', 'Frais', 'Boissons', 'Hygiène', 'Autre'],
    unitDefault: 'pièce',
    salesLabel: 'Ventes',
    shortcutInventory: 'Rayons',
    emptyProducts: 'Aucun produit en rayon.',
  },
  quincaillerie: {
    productSingular: 'Article',
    productPlural: 'Matériaux & outillage',
    inventoryTitle: 'Stock quincaillerie',
    inventorySubtitle: 'Matériaux, outils et consommables',
    posTitle: 'Caisse quincaillerie',
    posSubtitle: 'Vente matériaux et outils',
    stockAlert: 'Articles techniques bas',
    categories: ['Outillage', 'Quincaillerie', 'Électricité', 'Plomberie', 'Peinture', 'Autre'],
    unitDefault: 'pièce',
    salesLabel: 'Ventes',
    shortcutInventory: 'Matériaux',
    emptyProducts: 'Aucun article quincaillerie.',
  },
  location_event: {
    productSingular: 'Matériel',
    productPlural: 'Matériel de location',
    inventoryTitle: 'Parc matériel',
    inventorySubtitle: 'Chaises, tables, sono…',
    posTitle: 'Caisse location',
    posSubtitle: 'Encaissement location',
    stockAlert: 'Matériel indisponible',
    categories: ['Chaises', 'Tables', 'Chapiteaux', 'Sono', 'Décoration', 'Autre'],
    unitDefault: 'unité',
    salesLabel: 'Locations',
    shortcutInventory: 'Matériel',
    emptyProducts: 'Aucun matériel. Ajoutez le parc location.',
  },
  btp: {
    productSingular: 'Matériau',
    productPlural: 'Matériaux BTP',
    inventoryTitle: 'Catalogue matériaux',
    inventorySubtitle: 'Prix unitaires et catégories chantier',
    posTitle: 'Devis & factures',
    posSubtitle: 'Documents BTP',
    reportTitle: 'Suivi chantier',
    emptyProducts: 'Aucun matériau. Ajoutez ciment, fer, main-d\'œuvre…',
  },
};

export function getBusinessUI(type: string | null | undefined): BusinessUI {
  return BUSINESS_UI[normalizeBusinessType(type)];
}

/** Libellés de menu adaptés au métier */
export function menuLabelFor(path: string, type: BusinessType): string | null {
  const ui = BUSINESS_UI[type];
  const map: Record<string, string> = {
    '/inventory': ui.inventoryTitle,
    '/pos': ui.posTitle,
    '/inventory/scan': type === 'location_event' ? 'Scan matériel' : 'Scan inventaire',
    '/orders': type === 'location_event' ? 'Commandes location' : 'Commandes',
    '/kitchen': 'Préparation',
    '/tables': 'Espaces',
    '/customers': type === 'location_event' ? 'Clients location' : 'Clients',
  };
  return map[path] ?? null;
}


export function normalizeBusinessType(raw: string | null | undefined): BusinessType {
  const v = (raw || '').toLowerCase().trim();
  // Anciens types retirés → maquis
  if (v in { bar: 1, restaurant: 1, pharmacie: 1, commerce: 1, cafe: 1 }) return 'maquis';
  const allowed: BusinessType[] = [
    'maquis', 'magasin', 'boutique', 'superette', 'quincaillerie', 'location_event', 'btp',
  ];
  if ((allowed as string[]).includes(v)) return v as BusinessType;
  if (v === 'store' || v === 'shop') return 'magasin';
  if (v === 'superette' || v === 'supermarche') return 'superette';
  if (v === 'location' || v === 'event' || v === 'rental') return 'location_event';
  if (v === 'batidevis' || v === 'construction' || v === 'chantier' || v === 'devis') return 'btp';
  return 'maquis';
}


export function isLocationEvent(type: string | null | undefined): boolean {
  return normalizeBusinessType(type) === 'location_event';
}

export function isBtp(type: string | null | undefined): boolean {
  return normalizeBusinessType(type) === 'btp';
}

export function applyBusinessTheme(type: BusinessType) {
  if (typeof document === 'undefined') return;
  const t = BUSINESS_THEMES[type];
  const root = document.documentElement;
  root.style.setProperty('--biz-primary', t.primary);
  root.style.setProperty('--biz-primary-soft', t.primarySoft);
  root.style.setProperty('--biz-accent', t.accent);
  root.dataset.businessType = type;
}

export function canManageEstablishments(role: Role | undefined): boolean {
  return !!role && ['super_admin', 'admin', 'owner'].includes(role);
}

export function buildWhatsAppLink(phone: string | null | undefined, message: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  let normalized = digits;
  if (digits.startsWith('0') && digits.length >= 10) {
    normalized = '225' + digits.slice(1);
  }
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}


export function buildSmsLink(phone: string | null | undefined, message: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return `sms:${digits}?body=${encodeURIComponent(message)}`;
}
