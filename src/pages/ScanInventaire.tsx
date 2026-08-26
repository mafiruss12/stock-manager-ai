import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Upload, Loader2, Check, AlertTriangle, Merge, Plus, SkipForward, ArrowLeft, Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product } from '@/lib/types';
import {
  runOcrFrench,
  parseInventoryText,
  type ScannedLine,
} from '@/lib/inventoryScan';
import { EmptyState } from '@/components/ui';

export default function ScanInventaire() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id;
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [lines, setLines] = useState<ScannedLine[]>([]);
  const [step, setStep] = useState<'pick' | 'ocr' | 'review' | 'done'>('pick');
  const [busy, setBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ updated: 0, created: 0, skipped: 0 });

  useEffect(() => {
    if (!estId) return;
    supabase
      .from('products')
      .select('*')
      .eq('establishment_id', estId)
      .then(({ data }) => setProducts((data ?? []) as Product[]));
  }, [estId]);

  async function onFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choisissez une image (photo JPG/PNG).');
      return;
    }
    setError(null);
    setPreview(URL.createObjectURL(file));
    setStep('ocr');
    setBusy(true);
    setOcrProgress(0);
    setOcrStatus('Préparation de l’image…');
    try {
      const text = await runOcrFrench(file, (pct, status) => {
        setOcrProgress(pct);
        setOcrStatus(status);
      });
      setOcrText(text);
      if (!text || text.trim().length < 2) {
        setError(
          'Aucun texte reconnu. Photo trop floue, sombre, ou hors connexion (le moteur OCR charge depuis internet la 1re fois). Réessayez avec une photo nette et éclairée.'
        );
        setStep('pick');
        return;
      }
      const parsed = parseInventoryText(text, products);
      if (parsed.length === 0) {
        setError(
          `Texte lu mais aucun produit détecté. Texte brut : « ${text.slice(0, 120)}… ». Reprenez une photo plus nette du carnet / tableau.`
        );
        setStep('pick');
      } else {
        setLines(parsed);
        setStep('review');
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(
        msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')
          ? 'OCR : connexion internet requise pour charger le moteur (1re utilisation). Vérifiez le réseau et réessayez.'
          : `OCR impossible : ${msg}`
      );
      setStep('pick');
    } finally {
      setBusy(false);
      setOcrProgress(0);
      setOcrStatus('');
    }
  }

  function setAction(id: string, action: ScannedLine['action']) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, action } : l)));
  }

  function updateLine(id: string, patch: Partial<ScannedLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        return next;
      })
    );
  }

  async function integrate() {
    if (!estId) return;
    setBusy(true);
    setError(null);
    let updated = 0;
    let created = 0;
    let skipped = 0;
    try {
      for (const line of lines) {
        if (line.action === 'skip' || !line.name.trim()) {
          skipped++;
          continue;
        }
        if (line.action === 'update' && line.matchId) {
          const patch: Record<string, unknown> = {
            stock: line.stock,
            unit: line.unit,
            category: line.category,
          };
          if (line.cost > 0) patch.cost = line.cost;
          if (line.price > 0) patch.price = line.price;
          const { error: err } = await supabase
            .from('products')
            .update(patch)
            .eq('id', line.matchId);
          if (err) throw err;
          updated++;
        } else {
          const { error: err } = await supabase.from('products').insert({
            establishment_id: estId,
            name: line.name.trim(),
            category: line.category || 'Autre',
            unit: line.unit || 'unité',
            stock: line.stock || 0,
            min_stock: line.min_stock || 12,
            cost: line.cost || 0,
            price: line.price || 0,
          });
          if (err) throw err;
          created++;
        }
      }
      setStats({ updated, created, skipped });
      setStep('done');
      // notif propriétaire
      if (member.user_id) {
        await supabase.from('notifications').insert({
          user_id: member.user_id,
          title: 'Inventaire mis à jour par photo',
          message: `${updated} mis à jour, ${created} créés (OCR).`,
          read: false,
          link: '/inventory',
          type: 'inventory',
          action_label: 'Voir inventaire',
        });
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur intégration');
    } finally {
      setBusy(false);
    }
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<Camera size={48} />}
        title="Établissement requis"
        message="Rattachez un établissement pour scanner l'inventaire."
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" className="btn-ghost p-2" onClick={() => navigate('/inventory')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
            <Sparkles className="text-amber-400" size={22} /> Scanner inventaire (IA)
          </h1>
          <p className="text-sm text-stone-400">
            Photo du carnet / tableau → OCR français → doublons gérés → intégration auto
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {step === 'pick' && (
        <div className="card space-y-4">
          <p className="text-sm text-stone-300">
            Prenez une photo <strong>nette</strong> de votre carnet d&apos;inventaire ou tableau (écriture
            lisible, bon éclairage). L&apos;IA extrait les produits et quantités.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary flex items-center gap-2"
              onClick={() => inputRef.current?.click()}
            >
              <Camera size={18} /> Prendre / choisir une photo
            </button>
            <button
              type="button"
              className="btn-secondary flex items-center gap-2"
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={18} /> Galerie
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <ul className="text-xs text-stone-500 space-y-1 list-disc pl-4">
            <li>Doublons détectés automatiquement (ex. Flag = FLAG 65cl)</li>
            <li>Vous validez avant toute écriture en base</li>
            <li>Manuscrit : écrire le plus clairement possible</li>
          </ul>
        </div>
      )}

      {step === 'ocr' && (
        <div className="card flex flex-col items-center py-12 gap-3">
          <Loader2 className="animate-spin text-amber-400" size={36} />
          <p className="text-stone-300">OCR français en cours…</p>
          {preview && (
            <img src={preview} alt="scan" className="max-h-40 rounded-xl border border-stone-700 mt-2" />
          )}
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-sm text-stone-300 mb-2">
              {lines.length} ligne(s) détectée(s). Corrigez si besoin, puis intégrez.
            </p>
            <details className="text-xs text-stone-500">
              <summary className="cursor-pointer text-stone-400">Texte OCR brut</summary>
              <pre className="mt-2 whitespace-pre-wrap max-h-32 overflow-y-auto bg-stone-950 p-2 rounded-lg">
                {ocrText || '—'}
              </pre>
            </details>
          </div>

          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.id} className="card p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <input
                    className="input-field flex-1 min-w-[140px] text-sm"
                    value={l.name}
                    onChange={(e) => updateLine(l.id, { name: e.target.value })}
                  />
                  <span className="text-[10px] text-stone-500">
                    conf. {Math.round(l.confidence * 100)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-stone-500">Stock</label>
                    <input
                      type="number"
                      className="input-field text-sm py-1"
                      value={l.stock}
                      onChange={(e) => updateLine(l.id, { stock: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-500">Coût</label>
                    <input
                      type="number"
                      className="input-field text-sm py-1"
                      value={l.cost}
                      onChange={(e) => updateLine(l.id, { cost: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-500">Prix</label>
                    <input
                      type="number"
                      className="input-field text-sm py-1"
                      value={l.price}
                      onChange={(e) => updateLine(l.id, { price: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-500">Unité</label>
                    <input
                      className="input-field text-sm py-1"
                      value={l.unit}
                      onChange={(e) => updateLine(l.id, { unit: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center text-xs">
                  {l.matchId ? (
                    <span className="text-amber-300 flex items-center gap-1">
                      <Merge size={12} /> Doublon → {l.matchName}
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Plus size={12} /> Nouveau produit
                    </span>
                  )}
                  <div className="flex gap-1 ml-auto">
                    {l.matchId && (
                      <button
                        type="button"
                        className={`px-2 py-1 rounded-lg border text-[11px] ${
                          l.action === 'update' ? 'border-amber-500/50 bg-amber-500/15 text-amber-200' : 'border-stone-700 text-stone-400'
                        }`}
                        onClick={() => setAction(l.id, 'update')}
                      >
                        Mettre à jour
                      </button>
                    )}
                    <button
                      type="button"
                      className={`px-2 py-1 rounded-lg border text-[11px] ${
                        l.action === 'create' ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200' : 'border-stone-700 text-stone-400'
                      }`}
                      onClick={() => setAction(l.id, 'create')}
                    >
                      Créer
                    </button>
                    <button
                      type="button"
                      className={`px-2 py-1 rounded-lg border text-[11px] flex items-center gap-1 ${
                        l.action === 'skip' ? 'border-stone-500 bg-stone-800 text-stone-300' : 'border-stone-700 text-stone-400'
                      }`}
                      onClick={() => setAction(l.id, 'skip')}
                    >
                      <SkipForward size={12} /> Ignorer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 sticky bottom-4">
            <button type="button" className="btn-ghost" onClick={() => setStep('pick')} disabled={busy}>
              Reprendre photo
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-2"
              onClick={integrate}
              disabled={busy || lines.every((l) => l.action === 'skip')}
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              Intégrer à mon établissement
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="card text-center space-y-3 py-10">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
            <Check className="text-emerald-400" size={28} />
          </div>
          <h2 className="text-xl font-bold text-stone-100">Inventaire mis à jour</h2>
          <p className="text-sm text-stone-400">
            {stats.updated} mis à jour · {stats.created} créés · {stats.skipped} ignorés
          </p>
          <p className="text-xs text-stone-500">Dashboard et alertes stock recalculés à l&apos;ouverture de l&apos;inventaire.</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/inventory')}>
            Voir l&apos;inventaire
          </button>
        </div>
      )}

      {busy && step === 'review' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-stone-900 rounded-2xl px-6 py-4 flex items-center gap-3 border border-stone-700">
            <Loader2 className="animate-spin text-amber-400" />
            <span className="text-stone-200 text-sm">Intégration en cours…</span>
          </div>
        </div>
      )}
    </div>
  );
}
