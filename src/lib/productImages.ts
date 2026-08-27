/**
 * Images produits — priorité : image produit → catalogue global (AU GBAISSAI) → Unsplash.
 */
import { supabase } from '@/lib/supabase';

type Rule = { keys: string[]; url: string };

const RULES: Rule[] = [
  { keys: ['heineken'], url: 'https://images.unsplash.com/photo-1618885472179-5e39196df9fe?w=128&h=128&fit=crop' },
  { keys: ['guinness'], url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=128&h=128&fit=crop' },
  { keys: ['corona'], url: 'https://images.unsplash.com/photo-1615880484746-a134be9a0eaa?w=128&h=128&fit=crop' },
  { keys: ['flag', 'castel', 'beaufort', 'beauford', 'bock', 'desperados', 'despe', 'bière', 'biere', 'beer'], url: 'https://images.unsplash.com/photo-1535958636474-b021ee852bba?w=128&h=128&fit=crop' },
  { keys: ['coca', 'coke'], url: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=128&h=128&fit=crop' },
  { keys: ['fanta', 'sprite', 'mirinda', 'soda', 'gazeuse'], url: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=128&h=128&fit=crop' },
  { keys: ['eau', 'water', 'mineral'], url: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=128&h=128&fit=crop' },
  { keys: ['énergie', 'energie', 'energy', 'boom'], url: 'https://images.unsplash.com/photo-1622543925917-763c34d1a951?w=128&h=128&fit=crop' },
];

const CATEGORY_URL: Record<string, string> = {
  bière: 'https://images.unsplash.com/photo-1535958636474-b021ee852bba?w=128&h=128&fit=crop',
  biere: 'https://images.unsplash.com/photo-1535958636474-b021ee852bba?w=128&h=128&fit=crop',
  alcool: 'https://images.unsplash.com/photo-1514362545857-3bc16549766b?w=128&h=128&fit=crop',
  soda: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=128&h=128&fit=crop',
  eau: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=128&h=128&fit=crop',
};

let globalCatalog: Map<string, string> = new Map();
let catalogLoaded = false;
let catalogPromise: Promise<void> | null = null;

export function normalizeProductKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function isValidImageSrc(url: string | null | undefined): boolean {
  if (!url || url.length < 8) return false;
  return /^https?:\/\//i.test(url) || url.startsWith('data:image');
}

export async function ensureProductImageCatalog(): Promise<void> {
  if (catalogLoaded) return;
  if (catalogPromise) return catalogPromise;
  catalogPromise = (async () => {
    try {
      // 1) Catalogue global (images AU GBAISSAI CHEZ RCO) — visible par tous les maquis
      const { data: defaults } = await supabase
        .from('product_image_defaults')
        .select('name_key, name, image_url');
      for (const r of defaults || []) {
        if (!isValidImageSrc(r.image_url)) continue;
        const key = (r.name_key || normalizeProductKey(r.name)).toLowerCase();
        if (key.length >= 3) globalCatalog.set(key, r.image_url);
      }
      // 2) Compléter avec images visibles de mon établissement (RLS)
      const { data } = await supabase
        .from('products')
        .select('name, image_url')
        .not('image_url', 'is', null);
      for (const r of data || []) {
        if (!isValidImageSrc(r.image_url)) continue;
        const key = normalizeProductKey(r.name);
        // ne pas écraser le catalogue RCO sauf si le produit a déjà sa propre image locale
        // (lors de l'affichage resolveProductImage priorise image_url produit)
        if (key.length >= 3 && !globalCatalog.has(key)) globalCatalog.set(key, r.image_url);
      }
    } catch {
      /* */
    }
    catalogLoaded = true;
  })();
  return catalogPromise;
}

/** Applique les images catalogue aux produits sans image_url (optionnel, côté client) */
export function applyDefaultImagesToProducts<T extends { name: string; image_url?: string | null }>(
  products: T[],
): T[] {
  return products.map((p) => {
    if (isValidImageSrc(p.image_url)) return p;
    const url = lookupCatalogImage(p.name);
    return url ? { ...p, image_url: url } : p;
  });
}

export function lookupCatalogImage(name?: string | null): string | null {
  if (!name) return null;
  const key = normalizeProductKey(name);
  if (key.length < 3) return null;
  if (globalCatalog.has(key)) return globalCatalog.get(key)!;
  for (const [k, url] of globalCatalog) {
    if ((k.includes(key) || key.includes(k)) && Math.min(k.length, key.length) >= 4) return url;
  }
  return null;
}

export function registerCatalogImage(name: string, imageUrl: string) {
  if (!isValidImageSrc(imageUrl)) return;
  const key = normalizeProductKey(name);
  if (key.length >= 3) globalCatalog.set(key, imageUrl);
}

export function categoryEmoji(category?: string | null, name?: string): string {
  const t = `${category || ''} ${name || ''}`.toLowerCase();
  if (/bière|biere|beer|flag|castel|bock|beaufort|beauford/.test(t)) return '🍺';
  if (/soda|coca|fanta|sprite|chill/.test(t)) return '🥤';
  if (/eau|water/.test(t)) return '💧';
  if (/énergie|energie|energy|boom/.test(t)) return '⚡';
  if (/alcool|whisky|rhum/.test(t)) return '🥃';
  return '📦';
}

export function resolveProductImage(opts: {
  name?: string | null;
  category?: string | null;
  image_url?: string | null;
}): string | null {
  if (isValidImageSrc(opts.image_url)) return opts.image_url!;
  const fromCatalog = lookupCatalogImage(opts.name);
  if (fromCatalog) return fromCatalog;
  const name = (opts.name || '').toLowerCase();
  for (const rule of RULES) {
    if (rule.keys.some((k) => name.includes(k))) return rule.url;
  }
  const cat = (opts.category || '').toLowerCase();
  for (const [k, url] of Object.entries(CATEGORY_URL)) {
    if (cat.includes(k)) return url;
  }
  return null;
}
