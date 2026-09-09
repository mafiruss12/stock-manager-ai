/**
 * Ventes « au fil de l’eau » — pas de décrément stock avant clôture du soir.
 */
export type LivePayMethod = 'cash' | 'mobile' | 'mixed';

export type LiveSaleLine = {
  product_id: string;
  name: string;
  price: number;
  cost: number;
  qty: number;
};

export type LiveSaleTicket = {
  id: string;
  at: string; // ISO
  lines: LiveSaleLine[];
  total: number;
  pay: LivePayMethod;
  note?: string;
};

export type LiveDayState = {
  establishment_id: string;
  date: string; // YYYY-MM-DD
  tickets: LiveSaleTicket[];
  closed_at?: string | null;
  stock_deducted?: boolean;
};

function key(estId: string, date: string) {
  return `mm_live_sales:${estId}:${date}`;
}

export function loadLiveDay(estId: string, date: string): LiveDayState {
  try {
    const raw = localStorage.getItem(key(estId, date));
    if (raw) {
      const p = JSON.parse(raw) as LiveDayState;
      if (p && Array.isArray(p.tickets)) return p;
    }
  } catch {
    /* */
  }
  return { establishment_id: estId, date, tickets: [], closed_at: null, stock_deducted: false };
}

export function saveLiveDay(state: LiveDayState) {
  try {
    localStorage.setItem(key(state.establishment_id, state.date), JSON.stringify(state));
  } catch {
    /* */
  }
}

export function addTicket(
  estId: string,
  date: string,
  lines: LiveSaleLine[],
  pay: LivePayMethod,
  note?: string,
): LiveDayState {
  const state = loadLiveDay(estId, date);
  if (state.closed_at) return state;
  const clean = lines.filter((l) => l.qty > 0);
  if (!clean.length) return state;
  const total = clean.reduce((s, l) => s + l.qty * l.price, 0);
  const ticket: LiveSaleTicket = {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    lines: clean,
    total,
    pay,
    note,
  };
  state.tickets = [ticket, ...state.tickets];
  saveLiveDay(state);
  return state;
}

export function voidTicket(estId: string, date: string, ticketId: string): LiveDayState {
  const state = loadLiveDay(estId, date);
  if (state.closed_at) return state;
  state.tickets = state.tickets.filter((t) => t.id !== ticketId);
  saveLiveDay(state);
  return state;
}

export function aggregateDay(state: LiveDayState): {
  byProduct: Record<string, LiveSaleLine>;
  total: number;
  cash: number;
  mobile: number;
  ticketCount: number;
} {
  const byProduct: Record<string, LiveSaleLine> = {};
  let total = 0;
  let cash = 0;
  let mobile = 0;
  for (const t of state.tickets) {
    total += t.total;
    if (t.pay === 'cash') cash += t.total;
    else if (t.pay === 'mobile') mobile += t.total;
    else {
      cash += t.total / 2;
      mobile += t.total / 2;
    }
    for (const l of t.lines) {
      const cur = byProduct[l.product_id];
      if (!cur) {
        byProduct[l.product_id] = { ...l };
      } else {
        cur.qty += l.qty;
      }
    }
  }
  return {
    byProduct,
    total,
    cash: Math.round(cash),
    mobile: Math.round(mobile),
    ticketCount: state.tickets.length,
  };
}

export function markClosed(estId: string, date: string, stockDeducted: boolean): LiveDayState {
  const state = loadLiveDay(estId, date);
  state.closed_at = new Date().toISOString();
  state.stock_deducted = stockDeducted;
  saveLiveDay(state);
  return state;
}

/** Contrôles simples type « IA métier » sans API */
export function verifyDayHeuristics(
  state: LiveDayState,
  products: { id: string; name: string; stock?: number }[],
): string[] {
  const tips: string[] = [];
  const agg = aggregateDay(state);
  if (agg.ticketCount === 0) {
    tips.push('Aucune vente enregistrée aujourd’hui.');
    return tips;
  }
  if (agg.total <= 0) tips.push('Total journée à 0 — vérifiez les prix.');
  for (const line of Object.values(agg.byProduct)) {
    const p = products.find((x) => x.id === line.product_id);
    const stock = Math.floor(Number(p?.stock) || 0);
    if (stock > 0 && line.qty > stock) {
      tips.push(
        `Attention : ${line.name} vendu ×${line.qty} mais stock affiché ${stock}. Vérifiez avant clôture.`,
      );
    }
    if (line.qty >= 50) {
      tips.push(`${line.name} : volume élevé (×${line.qty}) — confirmez le comptage.`);
    }
  }
  const avg = agg.total / Math.max(1, agg.ticketCount);
  if (avg < 200) tips.push('Panier moyen très bas — des ventes ont-elles été oubliées ?');
  if (tips.length === 0) tips.push('Contrôle OK : volumes cohérents avec le stock affiché.');
  return tips;
}
