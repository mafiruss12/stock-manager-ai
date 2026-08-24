import { useEffect, useRef, useState } from 'react';
import {
  Sparkles, TrendingUp, AlertTriangle, Lightbulb, Brain, Target, Zap,
  Send, Loader2, Bot, User,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product, Sale } from '@/lib/types';
import { formatFCFA, daysAgoISO } from '@/lib/format';
import { EmptyState } from '@/components/ui';
import { loadKnowledge, matchTrainedAnswer, getPersona, type AiKnowledge } from '@/lib/aiTrainer';


interface AIInsight {
  type: 'prediction' | 'alert' | 'recommendation' | 'opportunity';
  title: string;
  message: string;
  icon: typeof TrendingUp;
  color: string;
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

function buildReply(
  question: string,
  ctx: {
    sales: Sale[];
    products: Product[];
    expensesTotal: number;
    salesTotal: number;
    lowStock: Product[];
    topProduct?: { name: string; revenue: number };
  },
  knowledge: AiKnowledge[] = [],
): string {
  // 1) Réponses entraînées par l'admin / propriétaire
  const trained = matchTrainedAnswer(question, knowledge);
  if (trained) {
    return trained.answer;
  }

  const q = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Aide navigation / tâches
  if (/caisse|vente|pos|encaiss/.test(q)) {
    return "Pour encaisser : menu **Caisse (POS)** → choisissez les produits → validez le paiement (espèces / mobile money). Le stock est déduit automatiquement.";
  }
  if (/inventaire|stock|produit|boisson|ajouter/.test(q)) {
    return "Pour gérer le stock : **Inventaire** → « Ajouter » pour une nouvelle boisson/plat, ou modifiez le stock d'un produit existant. Surveillez le seuil minimum pour éviter les ruptures.";
  }
  if (/depense|dépense|frais/.test(q)) {
    return "Enregistrez une dépense dans **Dépenses** (catégorie, montant, mode de paiement). Elles apparaissent dans la Comptabilité et la Clôture du jour.";
  }
  if (/cloture|clôture|rapport.?jour|fermer.?caisse/.test(q)) {
    return "Allez dans **Clôture du jour** pour valider les ventes, dépenses, caisse et mobile money de la journée. Vous pouvez verrouiller le rapport une fois terminé.";
  }
  if (/employe|employé|personnel|planning|pointage/.test(q)) {
    return "Section **Employés** pour la liste du personnel, et **Planning** pour le calendrier / suivi. Le propriétaire peut créer des accès dans **Administration**.";
  }
  if (/chat|message|discut/.test(q)) {
    return "Ouvrez **Chat interne** pour écrire à votre équipe. Chaque message notifie les autres membres (voir **Notifications** → « Ouvrir le chat »).";
  }
  if (/commande|cuisine|table/.test(q)) {
    return "Créez une commande dans **Commandes** (table ou à emporter). La **Cuisine / Bar** suit le statut des articles. Les **Tables** indiquent libre / occupée.";
  }
  if (/fournisseur|achat|approvisionnement/.test(q)) {
    return "Ajoutez un **Fournisseur**, puis enregistrez un **Achat** (quantité + coût). Pensez à mettre à jour l'inventaire après réception.";
  }
  if (/stat|chiffre|ca\b|benefice|bénéfice|compta/.test(q)) {
    const profit = ctx.salesTotal - ctx.expensesTotal;
    return `Sur 30 jours : ventes **${formatFCFA(ctx.salesTotal)}**, dépenses **${formatFCFA(ctx.expensesTotal)}**, solde estimé **${formatFCFA(profit)}**. Détails dans **Statistiques** et **Comptabilité**.`;
  }
  if (/stock.?bas|rupture|manque/.test(q) || /alerte/.test(q)) {
    if (ctx.lowStock.length === 0) return "Aucune alerte stock pour le moment. Tous les produits sont au-dessus du seuil minimum.";
    return `Attention : ${ctx.lowStock.length} produit(s) sous le seuil : ${ctx.lowStock.slice(0, 5).map((p) => p.name).join(', ')}. Réapprovisionnez via **Achats** ou ajustez l'**Inventaire**.`;
  }
  if (/meilleur|top|star|populaire/.test(q)) {
    if (!ctx.topProduct) return "Pas encore assez de ventes pour identifier un produit star.";
    return `Produit le plus rentable (30 j) : **${ctx.topProduct.name}** avec **${formatFCFA(ctx.topProduct.revenue)}**. Gardez un stock confortable.`;
  }
  if (/aide|help|comment|que.?faire|guide/.test(q)) {
    return "Je peux vous guider sur : caisse, inventaire, dépenses, clôture, employés, chat, commandes, tables, fournisseurs, stats et alertes stock. Posez une question précise, ex. « Comment faire la clôture ? »";
  }

  // Réponse générale avec résumé
  return `Voici un résumé de votre établissement (30 j) :\n• Ventes : ${formatFCFA(ctx.salesTotal)}\n• Dépenses : ${formatFCFA(ctx.expensesTotal)}\n• Produits en alerte stock : ${ctx.lowStock.length}\n• ${ctx.topProduct ? `Top produit : ${ctx.topProduct.name}` : 'Pas encore de top produit'}\n\nPosez une question (ex. « Comment encaisser ? », « Quels stocks sont bas ? »).`;
}

export default function AIAssistant() {
  const { member } = useAuth();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [predictedSales, setPredictedSales] = useState(0);
  const [topDay, setTopDay] = useState('');
  const [ctx, setCtx] = useState<{
    sales: Sale[];
    products: Product[];
    expensesTotal: number;
    salesTotal: number;
    lowStock: Product[];
    topProduct?: { name: string; revenue: number };
  } | null>(null);

  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Bonjour ! Je suis Stock AI Assistant (Kevin Tech Pro). Posez vos questions sur la caisse, le stock, les prévisions, les dépenses, la clôture, le personnel…',
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [knowledge, setKnowledge] = useState<AiKnowledge[]>([]);

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      if (!member?.establishment_id) {
        setLoading(false);
        return;
      }
      const estId = member.establishment_id;
      try {
        const kn = await loadKnowledge(estId);
        setKnowledge(kn);
        const persona = getPersona(kn);
        setTurns((prev) => {
          if (prev.length === 1 && prev[0].id === 'welcome') {
            return [{
              id: 'welcome',
              role: 'assistant',
              text: persona.slice(0, 280) + (persona.length > 280 ? '…' : '') + '\n\nPosez votre question sur la caisse, le stock, le rapport du jour…',
            }];
          }
          return prev;
        });
      } catch { /* */ }
      const start = daysAgoISO(30);

      const [salesRes, productsRes, expensesRes] = await Promise.all([
        supabase
          .from('sales')
          .select('total, qty, product_id, created_at')
          .eq('establishment_id', estId)
          .gte('created_at', start),
        supabase.from('products').select('*').eq('establishment_id', estId),
        supabase
          .from('expenses')
          .select('amount')
          .eq('establishment_id', estId)
          .gte('created_at', start),
      ]);

      const sales = (salesRes.data ?? []) as Sale[];
      const products = (productsRes.data ?? []) as Product[];
      const expensesTotal = (expensesRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
      const salesTotal = sales.reduce((s, x) => s + Number(x.total), 0);
      const lowStock = products.filter((p) => Number(p.stock) <= Number(p.min_stock));

      const prodRevenue: Record<string, number> = {};
      for (const s of sales) {
        const pid = s.product_id ?? '';
        prodRevenue[pid] = (prodRevenue[pid] ?? 0) + Number(s.total);
      }
      const sortedProds = Object.entries(prodRevenue).sort((a, b) => b[1] - a[1]);
      const best = sortedProds[0]
        ? products.find((p) => p.id === sortedProds[0][0])
        : undefined;
      const topProduct = best
        ? { name: best.name, revenue: sortedProds[0][1] }
        : undefined;

      setCtx({ sales, products, expensesTotal, salesTotal, lowStock, topProduct });

      const newInsights: AIInsight[] = [];
      const dailyMap: Record<string, number> = {};
      for (const s of sales) {
        const d = s.created_at.split('T')[0];
        dailyMap[d] = (dailyMap[d] ?? 0) + Number(s.total);
      }
      const dailyValues = Object.values(dailyMap);
      const avg7 =
        dailyValues.slice(-7).reduce((a, b) => a + b, 0) /
        Math.max(1, dailyValues.slice(-7).length);
      const avg30 = dailyValues.reduce((a, b) => a + b, 0) / Math.max(1, dailyValues.length);
      const trend = avg7 > avg30 * 1.1 ? 'hausse' : avg7 < avg30 * 0.9 ? 'baisse' : 'stable';
      const prediction = Math.round(avg7 * 1.05);
      setPredictedSales(prediction);

      newInsights.push({
        type: 'prediction',
        title: 'Prédiction des ventes de demain',
        message: `Basé sur 7 jours, estimation ~ ${formatFCFA(prediction)}. Tendance : ${trend}.`,
        icon: TrendingUp,
        color: 'success',
      });

      const dayMap: Record<string, number> = {};
      for (const s of sales) {
        const day = new Date(s.created_at).toLocaleDateString('fr-FR', { weekday: 'long' });
        dayMap[day] = (dayMap[day] ?? 0) + Number(s.total);
      }
      const sortedDays = Object.entries(dayMap).sort((a, b) => b[1] - a[1]);
      if (sortedDays.length > 0) {
        setTopDay(sortedDays[0][0]);
        newInsights.push({
          type: 'opportunity',
          title: 'Jour le plus rentable',
          message: `${sortedDays[0][0]} : ${formatFCFA(sortedDays[0][1])}. Préparez stock et personnel ce jour-là.`,
          icon: Target,
          color: 'primary',
        });
      }

      if (lowStock.length > 0) {
        newInsights.push({
          type: 'alert',
          title: `${lowStock.length} produit(s) en alerte stock`,
          message: `${lowStock
            .slice(0, 3)
            .map((p) => p.name)
            .join(', ')}${lowStock.length > 3 ? '…' : ''} — réapprovisionnez vite.`,
          icon: AlertTriangle,
          color: 'warning',
        });
      }

      if (topProduct) {
        newInsights.push({
          type: 'opportunity',
          title: 'Produit star',
          message: `"${topProduct.name}" : ${formatFCFA(topProduct.revenue)}. Priorisez son stock.`,
          icon: Brain,
          color: 'primary',
        });
      }

      if (sales.length === 0) {
        newInsights.push({
          type: 'recommendation',
          title: 'Premiers pas',
          message:
            'Ajoutez des produits dans Inventaire, puis encaisser via la Caisse. Posez-moi une question ci-dessous pour un guide étape par étape.',
          icon: Lightbulb,
          color: 'warning',
        });
      }

      setInsights(newInsights);
      setLoading(false);
    })();
  }, [member]);

  async function ask() {
    if (!input.trim() || !ctx) return;
    const q = input.trim();
    setInput('');
    setTurns((t) => [...t, { id: `u-${Date.now()}`, role: 'user', text: q }]);
    setThinking(true);
    await new Promise((r) => setTimeout(r, 350));
    const reply = buildReply(q, ctx, knowledge);
    setTurns((t) => [...t, { id: `a-${Date.now()}`, role: 'assistant', text: reply }]);
    setThinking(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-stone-400">
        <Sparkles className="animate-pulse text-primary-500" size={24} />
      </div>
    );
  }
  if (!member?.establishment_id) {
    return (
      <EmptyState
        icon={<Sparkles size={48} />}
        title="Aucun établissement"
        message="Vous n'êtes rattaché à aucun établissement."
      />
    );
  }

  const colorMap: Record<string, string> = {
    success: 'bg-success-500/10 text-success-400 border-success-500/20',
    warning: 'bg-warning-500/10 text-warning-400 border-warning-500/20',
    error: 'bg-error-500/10 text-error-400 border-error-500/20',
    primary: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
  };

  const quick = [
    'Comment encaisser ?',
    'Stocks bas ?',
    'Comment faire la clôture ?',
    'Résumé des ventes',
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary-400" />
          <h1 className="text-2xl font-bold font-display text-stone-100">Stock AI Assistant</h1>
        </div>
        {(member?.role === 'super_admin') && (
          <a href="/ai-train" className="text-sm text-primary-400 hover:underline">Former l&apos;IA</a>
        )}
      </div>
      <p className="text-stone-400 text-sm mb-6">
        Analyses automatiques + réponses que vous entraînez (Former l&apos;IA)
      </p>

      <div className="card mb-6 bg-gradient-to-br from-primary-500/10 to-secondary-500/5 border-primary-500/20">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-primary-500/15">
            <Brain size={32} className="text-primary-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-stone-400">Ventes prédites demain</p>
            <p className="text-3xl font-bold font-display text-stone-100">
              {formatFCFA(predictedSales)}
            </p>
          </div>
          {topDay && (
            <div className="text-right">
              <p className="text-sm text-stone-400">Meilleur jour</p>
              <p className="text-xl font-bold text-primary-400 capitalize">{topDay}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {insights.map((ins, i) => {
          const Icon = ins.icon;
          return (
            <div key={i} className={`card border ${colorMap[ins.color]}`}>
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${colorMap[ins.color]}`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-stone-100 mb-1">{ins.title}</p>
                  <p className="text-sm text-stone-400">{ins.message}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat d'aide */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-800 flex items-center gap-2">
          <Bot size={18} className="text-primary-400" />
          <p className="font-semibold text-stone-100">Demander de l’aide</p>
        </div>
        <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
          {turns.map((t) => (
            <div
              key={t.id}
              className={`flex gap-2 ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {t.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-primary-400" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  t.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-stone-800 text-stone-200'
                }`}
              >
                {t.text}
              </div>
              {t.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center shrink-0">
                  <User size={16} className="text-stone-300" />
                </div>
              )}
            </div>
          ))}
          {thinking && (
            <div className="flex items-center gap-2 text-stone-500 text-sm">
              <Loader2 className="animate-spin" size={14} /> Réflexion…
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="px-3 pb-2 flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setInput(q)}
              className="text-xs px-2.5 py-1 rounded-full bg-stone-800 text-stone-300 hover:bg-stone-700"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-stone-800 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            placeholder="Ex. Comment ajouter une boisson ?"
            className="input-field flex-1"
          />
          <button
            onClick={ask}
            disabled={thinking || !input.trim()}
            className="btn-primary px-4 flex items-center gap-2"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
