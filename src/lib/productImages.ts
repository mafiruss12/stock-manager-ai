/**
 * Images produits / boissons pour inventaire (reconnaissance visuelle).
 * Priorité : image_url produit → correspondance nom → image catégorie → placeholder.
 */

type Rule = { keys: string[]; url: string };

/** Photos libres (Unsplash) — bières, sodas, spiritueux, eau */
const RULES: Rule[] = [
  { keys: ['heineken'], url: 'https://images.unsplash.com/photo-1618885472179-5e39196df9fe?w=128&h=128&fit=crop' },
  { keys: ['guinness'], url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=128&h=128&fit=crop' },
  { keys: ['corona'], url: 'https://images.unsplash.com/photo-1615880484746-a134be9a0eaa?w=128&h=128&fit=crop' },
  { keys: ['budweiser', 'bud '], url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=128&h=128&fit=crop' },
  { keys: ['flag', 'castel', 'beaufort', 'bock', 'desperados', 'bière', 'biere', 'beer'], url: 'https://images.unsplash.com/photo-1535958636474-b021ee852bba?w=128&h=128&fit=crop' },
  { keys: ['coca', 'coke'], url: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=128&h=128&fit=crop' },
  { keys: ['pepsi'], url: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=128&h=128&fit=crop' },
  { keys: ['fanta', 'sprite', 'mirinda', 'soda', 'gazeuse'], url: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=128&h=128&fit=crop' },
  { keys: ['orangina', 'juice', 'jus ', 'bissap', 'yako'], url: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=128&h=128&fit=crop' },
  { keys: ['eau', 'water', 'mineral', 'mullion', 'celeste'], url: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=128&h=128&fit=crop' },
  { keys: ['vin', 'wine', 'rouge', 'blanc'], url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=128&h=128&fit=crop' },
  { keys: ['whisky', 'whiskey', 'ricard', 'pastis', 'vodka', 'rhum', 'gin', 'spirit'], url: 'https://images.unsplash.com/photo-1514362545857-3bc16549766b?w=128&h=128&fit=crop' },
  { keys: ['café', 'cafe', 'coffee', 'expresso'], url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=128&h=128&fit=crop' },
  { keys: ['thé', 'the ', 'tea'], url: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=128&h=128&fit=crop' },
  { keys: ['poulet', 'grillade', 'brochette', 'alloco', 'garba', 'plat'], url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=128&h=128&fit=crop' },
];

const CATEGORY_URL: Record<string, string> = {
  bière: 'https://images.unsplash.com/photo-1535958636474-b021ee852bba?w=128&h=128&fit=crop',
  biere: 'https://images.unsplash.com/photo-1535958636474-b021ee852bba?w=128&h=128&fit=crop',
  alcool: 'https://images.unsplash.com/photo-1514362545857-3bc16549766b?w=128&h=128&fit=crop',
  soda: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=128&h=128&fit=crop',
  boisson: 'https://images.unsplash.com/photo-1546171753-97d7676e4602?w=128&h=128&fit=crop',
  eau: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=128&h=128&fit=crop',
  grillade: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=128&h=128&fit=crop',
};

export function categoryEmoji(category?: string | null, name?: string): string {
  const t = `${category || ''} ${name || ''}`.toLowerCase();
  if (/bière|biere|beer|flag|castel|heineken|guinness/.test(t)) return '🍺';
  if (/soda|coca|fanta|sprite|gazeuse/.test(t)) return '🥤';
  if (/eau|water/.test(t)) return '💧';
  if (/vin|wine/.test(t)) return '🍷';
  if (/whisky|rhum|vodka|alcool|spirit/.test(t)) return '🥃';
  if (/jus|juice|bissap/.test(t)) return '🧃';
  if (/café|cafe|coffee/.test(t)) return '☕';
  if (/grillade|poulet|plat|alloco/.test(t)) return '🍖';
  return '📦';
}

export function resolveProductImage(opts: {
  name?: string | null;
  category?: string | null;
  image_url?: string | null;
}): string | null {
  if (opts.image_url && /^https?:\/\//i.test(opts.image_url)) return opts.image_url;
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
