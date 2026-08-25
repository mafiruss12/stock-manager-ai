import { useState, useEffect } from 'react';
import { Beer, Mail, Lock, User, Loader2, Chrome, KeyRound, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { toAuthEmail } from '@/lib/login';
import { supabase } from '@/lib/supabase';

const MARQUEE_MESSAGES = [
  'Stock Manager AI — gestion intelligente',
  'Caisse, stock, IA et Mobile Money',
  'Fonctionne hors ligne · Powered by Kevin Tech Pro',
  'Suivez vos ventes et bénéfices',
  'Clôture quotidienne sécurisée',
  'Contrôle total des accès',
];

type Mode = 'signin' | 'signup' | 'forgot' | 'recovery' | 'mfa';

function mapAuthError(err: string, context: 'signin' | 'signup' | 'forgot' | 'other' = 'other'): string {
  const e = (err || '').toLowerCase();
  if (
    e.includes('invalid login credentials') ||
    e.includes('invalid_credentials') ||
    e.includes('invalid email or password') ||
    e.includes('email/password')
  ) {
    return context === 'signin'
      ? 'Identifiant ou mot de passe incorrect. Vérifiez majuscules/minuscules ou utilisez « Mot de passe oublié ».'
      : 'Identifiant ou mot de passe incorrect.';
  }
  if (
    e.includes('user already registered') ||
    e.includes('already been registered') ||
    e.includes('already registered') ||
    e.includes('email address is already') ||
    e.includes('already exists')
  ) {
    return 'Cet identifiant (e-mail) est déjà utilisé. Connectez-vous ou utilisez « Mot de passe oublié ».';
  }
  if (e.includes('email not confirmed')) {
    return 'E-mail non confirmé. Vérifiez votre boîte mail.';
  }
  if (e.includes('password') && (e.includes('least') || e.includes('short') || e.includes('6') || e.includes('8'))) {
    return 'Mot de passe trop court (minimum 6 caractères).';
  }
  if (e.includes('interdit') || e.includes('insert member')) {
    return 'Impossible de créer le profil. Réessayez dans un instant.';
  }
  return err;
}

export default function AuthPage() {
  const { signIn, signUp, signInWithGoogle, user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [newPassword, setNewPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [pendingMfaUserId, setPendingMfaUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Erreurs renvoyées par Google / OAuth dans l'URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const err =
      params.get('error_description') ||
      params.get('error') ||
      hash.get('error_description') ||
      hash.get('error');
    if (err) {
      const decoded = decodeURIComponent(err.replace(/\+/g, ' '));
      let msg = `Connexion Google impossible : ${decoded}`;
      if (err.includes('access_denied')) {
        msg = 'Connexion Google annulée.';
      } else if (/unable to exchange external code/i.test(decoded)) {
        msg =
          'Google refuse l’échange du code (secret OAuth incorrect ou URI de redirection). ' +
          'Dans Google Cloud → Identifiants OAuth (type Application Web), vérifiez le secret ' +
          'et l’URI : https://ycoaxbgxstxondxxnhhf.supabase.co/auth/v1/callback — ' +
          'puis collez le même Client ID + secret dans Supabase → Authentication → Providers → Google.';
      } else if (/redirect/i.test(decoded)) {
        msg = 'URL de retour non autorisée. Vérifiez les Redirect URLs dans Supabase et Google Cloud.';
      }
      setError(msg);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Déjà connecté → dashboard
  useEffect(() => {
    if (user && !authLoading) {
      window.location.replace('/dashboard');
    }
  }, [user, authLoading]);

  // Retour Google OAuth : session puis dashboard
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const href = window.location.href;
        const hasToken =
          href.includes('access_token') ||
          href.includes('refresh_token') ||
          window.location.search.includes('code=') ||
          window.location.hash.includes('access_token');
        if (!hasToken) return;
        await new Promise((r) => setTimeout(r, 250));
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session?.user) {
          setSuccess('Connexion Google réussie…');
          window.history.replaceState({}, '', '/');
          window.location.replace('/dashboard');
        }
      } catch (e) {
        console.error('oauth return', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);


  
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('recovery');
        setError(null);
        setSuccess('Choisissez un nouveau mot de passe sécurisé.');
      }
    });
    // Lien de récupération dans l'URL
    const hash = window.location.hash || '';
    if (hash.includes('type=recovery')) {
      setMode('recovery');
    }
    return () => sub.subscription.unsubscribe();
  }, []);

async function resendConfirmation() {
    const authEmail = toAuthEmail(login);
    if (!authEmail.includes('@') || authEmail.endsWith('@maquis.local')) {
      setError('Indiquez une vraie adresse e-mail pour renvoyer la confirmation.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resend({ type: 'signup', email: authEmail });
    setLoading(false);
    if (err) setError(mapAuthError(err.message, 'other'));
    else setSuccess(`E-mail de confirmation renvoyé à ${authEmail}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const login = email.trim();
      if (!login) {
        setError('E-mail, téléphone ou identifiant requis');
        setLoading(false);
        return;
      }

      if (mode === 'forgot') {
        const authEmail = toAuthEmail(login);
        if (!authEmail.includes('@') || authEmail.endsWith('@maquis.local')) {
          setError(
            'La réinitialisation par e-mail nécessite une vraie adresse e-mail (pas un login simple).'
          );
          setLoading(false);
          return;
        }
        const { error: err } = await supabase.auth.resetPasswordForEmail(authEmail, {
          redirectTo: `${window.location.origin}/?type=recovery`,
        });
        if (err) setError(mapAuthError(err.message, 'forgot'));
        else
          setSuccess(
            `Un e-mail de réinitialisation a été envoyé à ${authEmail} s'il existe un compte.`
          );
        setLoading(false);
        return;
      }

      if (mode === 'recovery') {
        if (!newPassword || newPassword.length < 8) {
          setError('Nouveau mot de passe : 8 caractères minimum');
          setLoading(false);
          return;
        }
        const { error: err } = await supabase.auth.updateUser({ password: newPassword });
        if (err) setError(mapAuthError(err.message, 'other'));
        else {
          setSuccess('Mot de passe mis à jour. Vous pouvez vous connecter.');
          setMode('signin');
          setNewPassword('');
          window.history.replaceState({}, '', '/');
        }
        setLoading(false);
        return;
      }

      if (mode === 'mfa') {
        if (!pendingMfaUserId) {
          setMode('signin');
          setLoading(false);
          return;
        }
        const { data: mem } = await supabase
          .from('members')
          .select('mfa_secret, mfa_enabled')
          .eq('user_id', pendingMfaUserId)
          .maybeSingle();
        if (!mem?.mfa_enabled || !mem?.mfa_secret) {
          setError('2FA non configuré');
          setLoading(false);
          return;
        }
        const { verifyTotp } = await import('@/lib/totp');
        const ok = await verifyTotp(String(mem.mfa_secret), mfaCode);
        if (!ok) {
          setError('Code 2FA incorrect');
          setLoading(false);
          return;
        }
        setSuccess('Vérification 2FA OK…');
        window.location.replace('/dashboard');
        return;
      }

      if (!password || password.length < 6) {
        setError('Le mot de passe doit contenir au moins 6 caractères');
        setLoading(false);
        return;
      }

      if (mode === 'signin') {
        const { error: err } = await signIn(login, password);
        if (err) {
          setError(mapAuthError(err, 'signin'));
          if (err.toLowerCase().includes('trop de tentatives')) {
            setError(err);
          }
          setLoading(false);
          return;
        }
        // 2FA admin
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (uid) {
          const { data: mem } = await supabase
            .from('members')
            .select('role, mfa_enabled, mfa_secret')
            .eq('user_id', uid)
            .maybeSingle();
          if (
            mem?.mfa_enabled &&
            mem?.mfa_secret &&
            ['super_admin', 'admin'].includes(String(mem.role))
          ) {
            setPendingMfaUserId(uid);
            setMode('mfa');
            setSuccess('Entrez le code de votre application d\'authentification');
            setLoading(false);
            return;
          }
        }
        setSuccess('Connexion réussie…');
        window.location.replace('/dashboard');
        return;
      }

      // signup
      if (!fullName.trim()) {
        setError('Nom complet requis');
        setLoading(false);
        return;
      }
      const { error: err } = await signUp(login, password, fullName.trim());
      if (err) {
        setError(mapAuthError(err, 'signup'));
        setLoading(false);
        return;
      }
      setSuccess("Compte créé ! Ouverture de l'application…");
      // Laisse le temps d'écrire la session
      await new Promise((r) => setTimeout(r, 250));
      window.location.replace('/dashboard');
    } catch (ex: any) {
      setError(ex?.message || 'Erreur inattendue. Réessayez.');
      setLoading(false);
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950/30 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-10 bg-primary-600/90 overflow-hidden flex items-center z-20">
        <div className="flex whitespace-nowrap animate-marquee">
          {MARQUEE_MESSAGES.concat(MARQUEE_MESSAGES).map((msg, i) => (
            <span key={i} className="mx-8 text-sm font-medium text-white flex items-center gap-2">
              <Beer size={14} /> {msg}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-primary-400/10 animate-rise"
            style={{
              left: `${(i * 8 + 3) % 100}%`,
              width: `${8 + (i % 4) * 6}px`,
              height: `${8 + (i % 4) * 6}px`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${8 + (i % 5) * 2}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md mt-10">
        <div className="bg-stone-900/90 backdrop-blur-xl border border-stone-700/50 rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-6">
            <img src="/logo-full.png" alt="Stock Manager AI" className="h-16 w-auto max-w-[280px] object-contain mb-3" />
            <h1 className="text-3xl font-bold font-display text-stone-100">Stock Manager AI</h1>
            <p className="text-sm text-stone-400 mt-1">
              {mode === 'forgot' ? 'Réinitialiser le mot de passe' : 'Gestion intelligente multi-métiers'}
            </p>
          </div>

          {/* Alertes */}
          {error && (error.toLowerCase().includes('confirm') || error.toLowerCase().includes('confirmé')) && (
              <button type="button" className="text-sm text-amber-400 underline mb-2" onClick={resendConfirmation}>
                Renvoyer l&apos;e-mail de confirmation
              </button>
            )}
            {error && (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex gap-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{error}</p>
                {mode === 'signin' && (
                  <button
                    type="button"
                    className="mt-2 text-amber-300 hover:text-amber-200 underline text-xs"
                    onClick={() => {
                      setError(null);
                      setMode('forgot');
                    }}
                  >
                    Mot de passe oublié ? Réinitialiser par e-mail
                  </button>
                )}
              </div>
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex gap-2">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <p>{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Nom complet</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jean Kouassi"
                    className="input-field pl-10"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label">{mode === 'forgot' ? 'E-mail du compte' : 'Identifiant ou email'}</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === 'forgot' ? 'vous@exemple.com' : '0708091011, gerant1 ou email@gmail.com'}
                  className="input-field pl-10"
                />
              </div>
            </div>

            {mode !== 'forgot' && mode !== 'recovery' && mode !== 'mfa' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Mot de passe</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      className="text-xs text-amber-400 hover:text-amber-300"
                      onClick={() => {
                        setError(null);
                        setSuccess(null);
                        setMode('forgot');
                      }}
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                  <input
                    type="password"
                    required
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field pl-10"
                    minLength={8}
                  />
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : mode === 'recovery' ? (
                'Enregistrer le nouveau mot de passe'
              ) : mode === 'mfa' ? (
                'Valider le code 2FA'
              ) : mode === 'forgot' ? (
                <><KeyRound size={18} /> Envoyer le lien</>
              ) : mode === 'signin' ? (
                'Se connecter'
              ) : (
                "S'inscrire"
              )}
            </button>
          </form>

          {mode === 'forgot' ? (
            <button
              type="button"
              className="mt-4 w-full text-sm text-stone-400 hover:text-stone-200 flex items-center justify-center gap-1"
              onClick={() => {
                setMode('signin');
                setError(null);
                setSuccess(null);
              }}
            >
              <ArrowLeft size={14} /> Retour à la connexion
            </button>
          ) : (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-stone-700" />
                <span className="text-xs text-stone-500">ou</span>
                <div className="h-px flex-1 bg-stone-700" />
              </div>
              <button
                type="button"
                disabled={googleLoading}
                onClick={async () => {
                  setError(null);
                  setGoogleLoading(true);
                  try {
                    await signInWithGoogle();
                    // Redirection Google en cours
                  } catch (e: any) {
                    setError(
                      e?.message?.includes('provider')
                        ? 'Google n\'est pas correctement configuré. Utilisez e-mail + mot de passe, ou contactez l\'admin.'
                        : mapAuthError(e?.message || 'Connexion Google impossible')
                    );
                    setGoogleLoading(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl border border-stone-600 text-stone-200 text-sm flex items-center justify-center gap-2 hover:bg-stone-800 disabled:opacity-60"
              >
                {googleLoading ? <Loader2 size={16} className="animate-spin" /> : <Chrome size={16} />}
                Continuer avec Google
              </button>
              <p className="text-center text-sm text-stone-400 mt-5">
                {mode === 'signin' ? (
                  <>
                    Pas de compte ?{' '}
                    <button type="button" className="text-amber-400 hover:text-amber-300" onClick={() => setMode('signup')}>
                      S&apos;inscrire
                    </button>
                  </>
                ) : (
                  <>
                    Déjà inscrit ?{' '}
                    <button type="button" className="text-amber-400 hover:text-amber-300" onClick={() => setMode('signin')}>
                      Se connecter
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
