import { useEffect, useMemo, useState } from 'react';
import { categoryEmoji, resolveProductImage, ensureProductImageCatalog } from '@/lib/productImages';

export default function ProductThumb({
  name,
  category,
  imageUrl,
  size = 40,
}: {
  name?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  size?: number;
}) {
  const [catalogReady, setCatalogReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    void ensureProductImageCatalog().then(() => setCatalogReady(true));
  }, []);

  useEffect(() => {
    setFailed(null);
  }, [name, category, imageUrl]);

  const src = useMemo(() => {
    const primary = resolveProductImage({ name, category, image_url: imageUrl });
    if (primary && primary !== failed) return primary;
    // 2e tentative sans image_url produit (catalogue / règles)
    const fallback = resolveProductImage({ name, category, image_url: null });
    if (fallback && fallback !== failed) return fallback;
    return null;
  }, [name, category, imageUrl, catalogReady, failed]);

  const emoji = categoryEmoji(category, name || '');

  if (!src) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/25 shrink-0 text-lg"
        style={{ width: size, height: size }}
        title={name || ''}
      >
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={name || 'produit'}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
      className="rounded-xl object-cover shrink-0 border border-amber-500/20 bg-stone-800"
      style={{ width: size, height: size }}
    />
  );
}
