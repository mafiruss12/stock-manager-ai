/**
 * Preuves photo boissons (ventes / stock) — upload Storage ou data-URL compressée
 */
import { supabase } from '@/lib/supabase';

export type ProofKind = 'sale' | 'arrivage' | 'stock' | 'other';

export type StockProofPhoto = {
  id: string;
  establishment_id: string;
  product_id: string | null;
  kind: ProofKind;
  image_url: string;
  note: string | null;
  taken_at: string;
  taken_by: string | null;
  created_at: string;
  updated_at?: string;
  product?: { name?: string } | null;
};

/** Compresse une image navigateur → JPEG blob */
export async function compressImageFile(file: Blob, maxSide = 1280, quality = 0.72): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Compression échouée'))),
      'image/jpeg',
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Lecture fichier'));
    r.readAsDataURL(blob);
  });
}

/** Upload vers bucket stock-proofs, sinon data-URL */
export async function uploadProofImage(
  establishmentId: string,
  file: Blob,
  filenameHint = 'proof.jpg'
): Promise<{ url: string; via: 'storage' | 'inline' }> {
  const compressed = await compressImageFile(file);
  const path = `${establishmentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

  const { error } = await supabase.storage.from('stock-proofs').upload(path, compressed, {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (!error) {
    const { data } = supabase.storage.from('stock-proofs').getPublicUrl(path);
    if (data?.publicUrl) return { url: data.publicUrl, via: 'storage' };
  }

  // Fallback si bucket absent
  const dataUrl = await blobToDataUrl(compressed);
  if (dataUrl.length > 900_000) {
    const smaller = await compressImageFile(file, 800, 0.55);
    return { url: await blobToDataUrl(smaller), via: 'inline' };
  }
  return { url: dataUrl, via: 'inline' };
}

export async function listProofPhotos(establishmentId: string): Promise<StockProofPhoto[]> {
  const { data, error } = await supabase
    .from('stock_proof_photos')
    .select('*, product:products(name)')
    .eq('establishment_id', establishmentId)
    .order('taken_at', { ascending: false })
    .limit(120);
  if (error) {
    console.warn('[proofPhotos]', error.message);
    return [];
  }
  return (data || []) as StockProofPhoto[];
}

export async function createProofPhoto(opts: {
  establishmentId: string;
  productId?: string | null;
  kind?: ProofKind;
  imageUrl: string;
  note?: string;
  userId?: string | null;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data, error } = await supabase
    .from('stock_proof_photos')
    .insert({
      establishment_id: opts.establishmentId,
      product_id: opts.productId || null,
      kind: opts.kind || 'sale',
      image_url: opts.imageUrl,
      note: opts.note || null,
      taken_by: opts.userId || null,
      taken_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

export async function updateProofPhoto(
  id: string,
  patch: { note?: string; product_id?: string | null; kind?: ProofKind; image_url?: string }
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('stock_proof_photos')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteProofPhoto(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('stock_proof_photos').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Ouvre la caméra / galerie (input file) */
export function pickPhotoFromDevice(capture = true): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capture) input.setAttribute('capture', 'environment');
    input.onchange = () => {
      const f = input.files?.[0] || null;
      resolve(f);
    };
    input.click();
  });
}
