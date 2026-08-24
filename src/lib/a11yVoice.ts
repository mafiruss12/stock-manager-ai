/** Aide terrain — synthèse vocale & sons simples (sans dépendance) */

export function speakFrench(text: string, opts?: { rate?: number; interrupt?: boolean }) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return false;
  }
  try {
    if (opts?.interrupt !== false) {
      window.speechSynthesis.cancel();
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = opts?.rate ?? 0.92;
    u.pitch = 1;
    // Préférer une voix française si dispo
    const voices = window.speechSynthesis.getVoices();
    const fr = voices.find((v) => v.lang.toLowerCase().startsWith('fr'));
    if (fr) u.voice = fr;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* */
  }
}

/** Bip court via Web Audio (vert = OK, rouge = écart) */
export function playTone(kind: 'ok' | 'warn' | 'tap') {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    if (kind === 'ok') {
      o.frequency.value = 660;
      g.gain.value = 0.08;
      o.start();
      o.stop(ctx.currentTime + 0.18);
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.connect(g2);
      g2.connect(ctx.destination);
      o2.frequency.value = 880;
      g2.gain.value = 0.06;
      o2.start(ctx.currentTime + 0.16);
      o2.stop(ctx.currentTime + 0.32);
    } else if (kind === 'warn') {
      o.frequency.value = 220;
      g.gain.value = 0.1;
      o.type = 'square';
      o.start();
      o.stop(ctx.currentTime + 0.35);
    } else {
      o.frequency.value = 440;
      g.gain.value = 0.05;
      o.start();
      o.stop(ctx.currentTime + 0.06);
    }
    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        /* */
      }
    }, 500);
  } catch {
    /* */
  }
}

/** Phrase orale simple pour le rapport du jour */
export function buildReportSpeech(opts: {
  establishmentName?: string;
  date: string;
  items: { name: string; qty: number; total: number }[];
  theoretical: number;
  cash: number;
  mobile: number;
  match: boolean;
  diff: number;
}): string {
  const est = opts.establishmentName || 'le maquis';
  const parts: string[] = [];
  parts.push(`Rapport du jour pour ${est}, date ${opts.date}.`);
  if (!opts.items.length) {
    parts.push('Aucune boisson saisie.');
  } else {
    parts.push('Boissons vendues :');
    opts.items.forEach((it) => {
      parts.push(`${it.name}, ${it.qty}.`);
    });
  }
  parts.push(`Total théorique : ${Math.round(opts.theoretical)} francs.`);
  parts.push(`Espèces : ${Math.round(opts.cash)} francs.`);
  parts.push(`Mobile money : ${Math.round(opts.mobile)} francs.`);
  if (opts.match) {
    parts.push('Caisse correcte. Les montants coincident.');
  } else {
    parts.push(`Attention. Écart de ${Math.round(Math.abs(opts.diff))} francs.`);
  }
  return parts.join(' ');
}
