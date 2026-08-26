/**
 * Reconnaissance d'objets / lecture inventaire via Gemini Vision.
 * Clé : VITE_GEMINI_API_KEY (Vercel / .env)
 */
import type { Product } from './types';
import {
  findDuplicate,
  parseInventoryText,
  type ScannedLine,
  guessCategoryFromName,
} from './inventoryScan';

const MODEL = 'gemini-2.0-flash';

function getApiKey(): string | null {
  const k = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
  if (k) return k;
  try {
    const local = localStorage.getItem('gemini_api_key')?.trim();
    return local || null;
  } catch {
    return null;
  }
}

export function hasVisionApi(): boolean {
  return !!getApiKey();
}

export function setLocalGeminiKey(key: string) {
  localStorage.setItem('gemini_api_key', key.trim());
}

export function clearLocalGeminiKey() {
  localStorage.removeItem('gemini_api_key');
}

async function blobToBase64(blob: Blob): Promise<{ mime: string; data: string }> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const data = btoa(binary);
  const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  return { mime, data };
}

/** Réduit l’image avant envoi API (max 1280px) */
async function shrinkImage(file: File | Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const max = 1280;
    let { width, height } = bmp;
    if (width > max || height > max) {
      const s = max / Math.max(width, height);
      width = Math.round(width * s);
      height = Math.round(height * s);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close?.();
    return await new Promise((res) => {
      canvas.toBlob((b) => res(b || file), 'image/jpeg', 0.85);
    });
  } catch {
    return file;
  }
}

type VisionItem = {
  name: string;
  quantity?: number;
  unit?: string;
  brand?: string;
  category?: string;
  confidence?: number;
};

function toScannedLines(items: VisionItem[], existing: Product[]): ScannedLine[] {
  const results: ScannedLine[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const name = (it.name || it.brand || '').trim();
    if (name.length < 2) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const dup = findDuplicate(name, existing);
    const stock = Math.max(0, Math.round(Number(it.quantity) || 0));
    results.push({
      id: `vis-${results.length}-${Date.now()}`,
      name,
      category: it.category || guessCategoryFromName(name),
      unit: it.unit || 'unité',
      stock,
      cost: dup ? Number(dup.cost) : 0,
      price: dup ? Number(dup.price) : 0,
      min_stock: dup ? Number(dup.min_stock) || 12 : 12,
      matchId: dup?.id ?? null,
      matchName: dup?.name ?? null,
      action: dup ? 'update' : 'create',
      confidence: typeof it.confidence === 'number' ? it.confidence : 0.75,
      raw: JSON.stringify(it),
    });
  }
  return results.slice(0, 80);
}

async function callGemini(
  image: Blob,
  prompt: string,
  onProgress?: (pct: number, status: string) => void,
): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error('Clé Gemini manquante (VITE_GEMINI_API_KEY)');

  onProgress?.(15, 'Préparation image…');
  const small = await shrinkImage(image);
  const { mime, data } = await blobToBase64(small);
  onProgress?.(35, 'Analyse IA (Gemini)…');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mime, data } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  onProgress?.(80, 'Réponse reçue…');
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 400 || res.status === 403) {
      throw new Error('Clé Gemini invalide ou refusée. Vérifiez VITE_GEMINI_API_KEY.');
    }
    throw new Error(`Gemini erreur ${res.status}: ${errText.slice(0, 180)}`);
  }
  const json = await res.json();
  const text =
    json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') ||
    '';
  return text.trim();
}

function extractJsonArray(text: string): VisionItem[] {
  // Strip markdown fences
  let s = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr)) return arr as VisionItem[];
  } catch {
    /* fallback line parse */
  }
  return [];
}

const LIST_PROMPT = `Tu es un assistant inventaire pour commerces (maquis, bar, magasin, BTP, location).
Analyse cette photo (carnet, tableau, étiquette, rayonnage ou produits).
Extrais TOUS les produits visibles avec quantités si présentes.
Réponds UNIQUEMENT avec un JSON array valide, sans texte autour, format:
[{"name":"Flag 65cl","quantity":48,"unit":"bouteille","category":"Alcool","confidence":0.9}]
Règles:
- name = nom commercial lisible (marque + format si possible)
- quantity = nombre entier si visible, sinon 0
- unit = bouteille, casier, kg, sac, unité…
- category = Alcool, Soft, Spiritueux, BTP, Location, Autre
- Si c'est un seul objet (bouteille, sac de ciment…), une seule entrée
- Langue: français
- Maximum 60 items`;

const OBJECT_PROMPT = `Tu identifies des produits sur cette photo (boisson, matériau BTP, matériel de location, emballage…).
Réponds UNIQUEMENT un JSON array:
[{"name":"nom du produit","quantity":1,"unit":"unité","category":"…","confidence":0.85,"brand":"marque"}]
Si plusieurs objets distincts, liste-les. Si un seul produit, un seul objet.
Français. Pas de markdown.`;

/**
 * Reconnaissance vision (objets + listes). Fallback possible côté appelant via OCR.
 */
export async function recognizeInventoryVision(
  file: File | Blob,
  existing: Product[],
  mode: 'auto' | 'list' | 'object' = 'auto',
  onProgress?: (pct: number, status: string) => void,
): Promise<{ lines: ScannedLine[]; rawText: string; engine: 'gemini' }> {
  const prompt = mode === 'object' ? OBJECT_PROMPT : LIST_PROMPT;
  const text = await callGemini(file, prompt, onProgress);
  let items = extractJsonArray(text);
  if (items.length === 0) {
    // parfois Gemini renvoie du texte libre → parser OCR-like
    const parsed = parseInventoryText(text, existing);
    if (parsed.length) {
      return { lines: parsed, rawText: text, engine: 'gemini' };
    }
  }
  const lines = toScannedLines(items, existing);
  onProgress?.(100, 'Terminé');
  return { lines, rawText: text, engine: 'gemini' };
}
