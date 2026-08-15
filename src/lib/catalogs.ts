import type { BusinessType } from './businessTypes';
import { normalizeBusinessType } from './businessTypes';

export type SeedProduct = {
  name: string;
  category: string;
  unit: string;
  stock: number;
  min_stock: number;
  cost: number;
  price: number;
};

/** Uniquement maquis / boissons : logique casiers */
export function usesCasiers(type: string | null | undefined): boolean {
  return normalizeBusinessType(type) === 'maquis';
}

export function casierSize(type: string | null | undefined): number {
  return usesCasiers(type) ? 24 : 0;
}

const MAQUIS: SeedProduct[] = [
  { name: 'BOCK 66', category: 'Bière', unit: 'Bouteille 65cl', stock: 0, min_stock: 12, cost: 450, price: 600 },
  { name: 'Castel', category: 'Bière', unit: 'Bouteille 50cl', stock: 0, min_stock: 12, cost: 400, price: 550 },
  { name: 'Flag', category: 'Bière', unit: 'Bouteille 50cl', stock: 0, min_stock: 12, cost: 400, price: 550 },
  { name: 'Beaufort 50cl', category: 'Bière', unit: 'Bouteille 50cl', stock: 0, min_stock: 12, cost: 450, price: 650 },
  { name: 'Beaufort 33cl', category: 'Bière', unit: 'Bouteille 33cl', stock: 0, min_stock: 12, cost: 500, price: 700 },
  { name: 'Desperados', category: 'Bière', unit: 'Bouteille 33cl', stock: 0, min_stock: 6, cost: 700, price: 1000 },
  { name: 'Guinness', category: 'Bière', unit: 'Bouteille 33cl', stock: 0, min_stock: 6, cost: 600, price: 900 },
  { name: 'Coca-Cola', category: 'Boisson', unit: 'Bouteille 33cl', stock: 0, min_stock: 24, cost: 200, price: 350 },
  { name: 'Fanta', category: 'Boisson', unit: 'Bouteille 33cl', stock: 0, min_stock: 24, cost: 200, price: 350 },
  { name: 'Sprite', category: 'Boisson', unit: 'Bouteille 33cl', stock: 0, min_stock: 12, cost: 200, price: 350 },
  { name: 'Eau minérale 1.5L', category: 'Eau', unit: 'Bouteille 1.5L', stock: 0, min_stock: 12, cost: 250, price: 400 },
  { name: 'Eau 50cl', category: 'Eau', unit: 'Bouteille 50cl', stock: 0, min_stock: 24, cost: 100, price: 200 },
  { name: 'Vody mix', category: 'Spiritueux', unit: 'Canette 33cl', stock: 0, min_stock: 12, cost: 400, price: 600 },
  { name: 'Vin rouge 75cl', category: 'Vin', unit: 'Bouteille 75cl', stock: 0, min_stock: 2, cost: 2500, price: 4000 },
  { name: 'Brochettes bœuf', category: 'Grillade', unit: 'Portion', stock: 0, min_stock: 10, cost: 500, price: 1000 },
  { name: 'Alloco', category: 'Accompagnement', unit: 'Portion', stock: 0, min_stock: 10, cost: 200, price: 500 },
];

const MAGASIN: SeedProduct[] = [
  { name: 'Riz 25kg', category: 'Alimentaire', unit: 'Sac 25kg', stock: 0, min_stock: 5, cost: 15000, price: 18000 },
  { name: 'Riz 5kg', category: 'Alimentaire', unit: 'Sac 5kg', stock: 0, min_stock: 10, cost: 3500, price: 4200 },
  { name: 'Huile 5L', category: 'Alimentaire', unit: 'Bidon 5L', stock: 0, min_stock: 6, cost: 4500, price: 5500 },
  { name: 'Sucre 1kg', category: 'Alimentaire', unit: 'Paquet 1kg', stock: 0, min_stock: 20, cost: 700, price: 900 },
  { name: 'Lait en poudre', category: 'Alimentaire', unit: 'Boîte', stock: 0, min_stock: 10, cost: 2500, price: 3200 },
  { name: 'Savon de ménage', category: 'Hygiène', unit: 'Pièce', stock: 0, min_stock: 24, cost: 150, price: 250 },
  { name: 'Lessive 1kg', category: 'Hygiène', unit: 'Paquet', stock: 0, min_stock: 12, cost: 1200, price: 1600 },
  { name: 'Papier toilette (pack)', category: 'Hygiène', unit: 'Pack', stock: 0, min_stock: 10, cost: 1500, price: 2000 },
  { name: 'Piles AA (blister)', category: 'Électronique', unit: 'Blister', stock: 0, min_stock: 10, cost: 800, price: 1200 },
  { name: 'Ampoule LED', category: 'Électronique', unit: 'Pièce', stock: 0, min_stock: 10, cost: 500, price: 900 },
  { name: 'Sac plastique (lot)', category: 'Divers', unit: 'Lot', stock: 0, min_stock: 20, cost: 200, price: 350 },
];

const BOUTIQUE: SeedProduct[] = [
  { name: 'T-shirt homme M', category: 'Homme', unit: 'Pièce', stock: 0, min_stock: 5, cost: 2500, price: 5000 },
  { name: 'T-shirt homme L', category: 'Homme', unit: 'Pièce', stock: 0, min_stock: 5, cost: 2500, price: 5000 },
  { name: 'Pantalon jean', category: 'Homme', unit: 'Pièce', stock: 0, min_stock: 3, cost: 8000, price: 15000 },
  { name: 'Robe femme', category: 'Femme', unit: 'Pièce', stock: 0, min_stock: 3, cost: 7000, price: 14000 },
  { name: 'Top femme', category: 'Femme', unit: 'Pièce', stock: 0, min_stock: 5, cost: 3000, price: 6000 },
  { name: 'Ensemble enfant', category: 'Enfant', unit: 'Pièce', stock: 0, min_stock: 4, cost: 4000, price: 8000 },
  { name: 'Casquette', category: 'Accessoire', unit: 'Pièce', stock: 0, min_stock: 6, cost: 1500, price: 3000 },
  { name: 'Ceinture', category: 'Accessoire', unit: 'Pièce', stock: 0, min_stock: 6, cost: 2000, price: 4000 },
  { name: 'Sac à main', category: 'Accessoire', unit: 'Pièce', stock: 0, min_stock: 3, cost: 5000, price: 10000 },
];

const SUPERETTE: SeedProduct[] = [
  { name: 'Pain de mie', category: 'Épicerie', unit: 'Paquet', stock: 0, min_stock: 10, cost: 600, price: 900 },
  { name: 'Spaghetti 500g', category: 'Épicerie', unit: 'Paquet', stock: 0, min_stock: 20, cost: 400, price: 600 },
  { name: 'Concentré tomate', category: 'Épicerie', unit: 'Boîte', stock: 0, min_stock: 24, cost: 300, price: 500 },
  { name: 'Yaourt nature', category: 'Frais', unit: 'Pot', stock: 0, min_stock: 20, cost: 200, price: 350 },
  { name: 'Œufs (plateau)', category: 'Frais', unit: 'Plateau', stock: 0, min_stock: 5, cost: 2500, price: 3200 },
  { name: 'Jus local 1L', category: 'Boissons', unit: 'Bouteille 1L', stock: 0, min_stock: 12, cost: 700, price: 1000 },
  { name: 'Eau 1.5L', category: 'Boissons', unit: 'Bouteille', stock: 0, min_stock: 24, cost: 250, price: 400 },
  { name: 'Dentifrice', category: 'Hygiène', unit: 'Tube', stock: 0, min_stock: 10, cost: 800, price: 1200 },
  { name: 'Savon liquide', category: 'Hygiène', unit: 'Flacon', stock: 0, min_stock: 8, cost: 1000, price: 1500 },
];

const QUINCAILLERIE: SeedProduct[] = [
  { name: 'Marteau', category: 'Outillage', unit: 'Pièce', stock: 0, min_stock: 5, cost: 2500, price: 4500 },
  { name: 'Tournevis set', category: 'Outillage', unit: 'Set', stock: 0, min_stock: 5, cost: 3000, price: 5500 },
  { name: 'Mètre ruban 5m', category: 'Outillage', unit: 'Pièce', stock: 0, min_stock: 8, cost: 1500, price: 2500 },
  { name: 'Vis assortiment', category: 'Quincaillerie', unit: 'Boîte', stock: 0, min_stock: 10, cost: 1000, price: 1800 },
  { name: 'Serrure porte', category: 'Quincaillerie', unit: 'Pièce', stock: 0, min_stock: 4, cost: 5000, price: 8500 },
  { name: 'Câble électrique 1.5mm', category: 'Électricité', unit: 'Rouleau', stock: 0, min_stock: 5, cost: 8000, price: 12000 },
  { name: 'Prise murale', category: 'Électricité', unit: 'Pièce', stock: 0, min_stock: 12, cost: 800, price: 1500 },
  { name: 'Robinet', category: 'Plomberie', unit: 'Pièce', stock: 0, min_stock: 6, cost: 3500, price: 6000 },
  { name: 'Tuyau PVC 32mm', category: 'Plomberie', unit: 'Barre', stock: 0, min_stock: 10, cost: 1500, price: 2500 },
  { name: 'Peinture 4L blanche', category: 'Peinture', unit: 'Pot 4L', stock: 0, min_stock: 4, cost: 12000, price: 16000 },
  { name: 'Pinceau 50mm', category: 'Peinture', unit: 'Pièce', stock: 0, min_stock: 10, cost: 500, price: 1000 },
];

const LOCATION: SeedProduct[] = [
  { name: 'Chaise pliante', category: 'Chaises', unit: 'Unité', stock: 0, min_stock: 50, cost: 2000, price: 500 },
  { name: 'Chaise présidentielle', category: 'Chaises', unit: 'Unité', stock: 0, min_stock: 20, cost: 8000, price: 1500 },
  { name: 'Table rectangulaire', category: 'Tables', unit: 'Unité', stock: 0, min_stock: 15, cost: 15000, price: 3000 },
  { name: 'Tréteau', category: 'Tables', unit: 'Unité', stock: 0, min_stock: 20, cost: 5000, price: 1000 },
  { name: 'Bâche 4x6', category: 'Chapiteaux', unit: 'Unité', stock: 0, min_stock: 5, cost: 25000, price: 8000 },
  { name: 'Chapiteau 5x10', category: 'Chapiteaux', unit: 'Unité', stock: 0, min_stock: 2, cost: 150000, price: 50000 },
  { name: 'Sono complète', category: 'Sono', unit: 'Kit', stock: 0, min_stock: 2, cost: 200000, price: 75000 },
  { name: 'Micro sans fil', category: 'Sono', unit: 'Unité', stock: 0, min_stock: 4, cost: 25000, price: 10000 },
  { name: 'Nappe', category: 'Décoration', unit: 'Unité', stock: 0, min_stock: 20, cost: 2000, price: 1000 },
  { name: 'Assiettes (lot 50)', category: 'Décoration', unit: 'Lot', stock: 0, min_stock: 10, cost: 5000, price: 3000 },
];

const BY_TYPE: Record<BusinessType, SeedProduct[]> = {
  maquis: MAQUIS,
  magasin: MAGASIN,
  boutique: BOUTIQUE,
  superette: SUPERETTE,
  quincaillerie: QUINCAILLERIE,
  location_event: LOCATION,
};

export function getSeedCatalog(type: string | null | undefined): SeedProduct[] {
  const t = normalizeBusinessType(type);
  return BY_TYPE[t] || MAQUIS;
}

export function catalogLabel(type: string | null | undefined): string {
  const t = normalizeBusinessType(type);
  const map: Record<BusinessType, string> = {
    maquis: 'Catalogue maquis (boissons & grillades)',
    magasin: 'Catalogue magasin (épicerie & hygiène)',
    boutique: 'Catalogue boutique (prêt-à-porter)',
    superette: 'Catalogue supérette (rayons)',
    quincaillerie: 'Catalogue quincaillerie (outils & matériaux)',
    location_event: 'Parc type location (chaises, tables, sono)',
  };
  return map[t] || 'Catalogue de démarrage';
}
