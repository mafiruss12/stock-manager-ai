import { useEffect, useMemo, useState } from 'react';
import { categoryEmoji, resolveProductImage, ensureProductImageCatalog } from '@/lib/productImages';

type ProductLike = {
  name?: string | null;
  category?: string | null;
  image_url?: string | null;
};

export default function ProductThumb({
  name,
  category,
  imageUrl,
  product,
  size = 40,
  className = '',
}: {
  name?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  product?: ProductLike | null;
  size?: number;
  className?: string;
}) {
  const n = name ?? product?.name ?? '';
  const c = category ?? product?.category ?? '';
  const img = imageUrl ?? product?.image_url ?? null;

  const [catalogReady, setCatalogReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    void ensureProductImageCatalog().then(() => setCatalogReady(true));
  }, []);

  useEffect(() => {
    setFailed(null);
  }, [n, c, img]);

  const src = useMemo(() => {
    const primary = resolveProductImage({ name: n, category: c, image_url: img });
    if (primary && primary !== failed) return primary;
    const fallback = resolveProductImage({ name: n, category: c, image_url: null });
    if (fallback && fallback !== failed) return fallback;
    return null;
  }, [n, c, img, catalogReady, failed]);

  const emoji = categoryEmoji(c, n);

  if (!src) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/25 shrink-0 text-lg ${className}`}
        style={{ width: size, height: size }}
        title={n || ''}
      >
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={n || 'produit'}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
      className={`rounded-xl object-cover shrink-0 border border-amber-500/20 bg-stone-800 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
