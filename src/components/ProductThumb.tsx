import { useState } from 'react';
import { categoryEmoji, resolveProductImage } from '@/lib/productImages';

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
  const src = resolveProductImage({ name, category, image_url: imageUrl });
  const [err, setErr] = useState(false);
  const emoji = categoryEmoji(category, name || '');

  if (!src || err) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-xl bg-stone-800 border border-stone-700 shrink-0 text-lg"
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
      referrerPolicy="no-referrer"
      onError={() => setErr(true)}
      className="rounded-xl object-cover shrink-0 border border-stone-700 bg-stone-800"
      style={{ width: size, height: size }}
    />
  );
}
