import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { toAuthEmail } from './login';
import { isOnline, cacheAuthProfile, getCachedAuthProfile, prefetchForOffline } from './offline';
import { getLoginLockRemaining, registerLoginFailure, registerLoginSuccess, isSafeLogin, safeErrorMessage } from './security';
import type { Member, AccessRequest, Establishment } from './types';

export interface MyEstablishment extends Establishment {
  member_role?: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  member: Member | null;
  accessRequest: AccessRequest | null;
  loading: boolean;
  needsAccess: boolean;
  /** Établissements auxquels l'utilisateur est rattaché (phase 2) */
  myEstablishments: MyEstablishment[];
  activeEstablishment: MyEstablishment | null;
  switchEstablishment: (establishmentId: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [accessRequest, setAccessRequest] = useState<AccessRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAccess, setNeedsAccess] = useState(false);
  const [myEstablishments, setMyEstablishments] = useState<MyEstablishment[]>([]);
  const [activeEstablishment, setActiveEstablishment] = useState<MyEstablishment | null>(null);

  // Restaurer établissement depuis localStorage pour éviter TypePicker au refresh
  useEffect(() => {
    try {
      const raw = localStorage.getItem('mm_active_est');
      if (raw && !activeEstablishment) {
        const parsed = JSON.parse(raw);
        if (parsed?.id) {
          setActiveEstablishment((prev) => prev ?? ({ ...parsed, member_role: member?.role } as any));
        }
      }
    } catch { /* */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  async function loadMyEstablishments(currentUser: User, currentMember: Member | null) {
    try {
      const { data: links } = await supabase
        .from('member_establishments')
        .select('establishment_id, role, status')
        .eq('user_id', currentUser.id)
        .eq('status', 'active');

      let estIds = (links ?? []).map((l) => l.establishment_id);
      if (currentMember?.establishment_id && !estIds.includes(currentMember.establishment_id)) {
        estIds = [...estIds, currentMember.establishment_id];
      }

      if (currentMember && ['super_admin', 'admin', 'owner'].includes(currentMember.role)) {
        const { data: owned } = await supabase
          .from('establishments')
          .select('id')
          .eq('created_by', currentUser.id);
        for (const o of owned ?? []) {
          if (!estIds.includes(o.id)) estIds.push(o.id);
        }
      }

      let list: MyEstablishment[] = [];
      const roleMap = new Map((links ?? []).map((l) => [l.establishment_id, l.role]));

      if (estIds.length > 0) {
        const { data: ests } = await supabase.from('establishments').select('*').in('id', estIds);
        list = (ests ?? []).map((e) => ({
          ...(e as Establishment),
          member_role: roleMap.get(e.id) ?? currentMember?.role,
        }));
      }

      // Filet de sécurité : si le membre a un establishment_id mais la liste est vide (RLS)
      if (list.length === 0 && currentMember?.establishment_id) {
        const { data: one } = await supabase
          .from('establishments')
          .select('*')
          .eq('id', currentMember.establishment_id)
          .maybeSingle();
        if (one) {
          list = [{ ...(one as Establishment), member_role: currentMember.role }];
        }
      }

      setMyEstablishments(list);
      const active =
        list.find((e) => e.id === currentMember?.establishment_id) ?? list[0] ?? null;
      setActiveEstablishment(active);
      try {
        if (list.length > 0) {
          localStorage.setItem('mm_est_ids', JSON.stringify(list.map((e) => e.id)));
          const act = list.find((e) => e.id === currentMember?.establishment_id) ?? list[0];
          if (act) localStorage.setItem('mm_active_est', JSON.stringify({ id: act.id, type: act.type, name: act.name }));
        }
      } catch { /* */ }
    } catch (e) {
      console.error('loadMyEstablishments', e);
      // Ne PAS vider l'établissement actif : évite TypePicker récursif pour tout le monde
      try {
        const raw = localStorage.getItem('mm_active_est');
        if (raw) {
          const cached = JSON.parse(raw);
          setActiveEstablishment((prev) => prev || ({ ...cached, member_role: member?.role } as MyEstablishment));
        }
      } catch { /* */ }
    }
  }

  async function switchEstablishment(establishmentId: string) {
    if (!user || !member) return;
    const target = myEstablishments.find((e) => e.id === establishmentId);
    const role = (target?.member_role as Member['role']) || member.role;

    await supabase
      .from('members')
      .update({ establishment_id: establishmentId, role })
      .eq('user_id', user.id);

    await supabase.from('member_establishments').upsert(
      {
        user_id: user.id,
        establishment_id: establishmentId,
        role,
        status: 'active',
      },
      { onConflict: 'user_id,establishment_id' }
    );

    await loadMemberData(user);
  }

  function buildFallbackMember(currentUser: User): Member {
    const email = currentUser.email ?? '';
    return {
      id: currentUser.id,
      user_id: currentUser.id,
      email,
      full_name:
        (currentUser.user_metadata?.full_name as string) ||
        (currentUser.user_metadata?.name as string) ||
        email.split('@')[0] ||
        'Utilisateur',
      role: 'owner',
      status: 'active',
      establishment_id: null,
      created_at: new Date().toISOString(),
    } as Member;
  }

  async function loadMemberData(currentUser: User): Promise<Member> {
    const fallback = buildFallbackMember(currentUser);
    try {
      try {
        if (!isOnline()) {
          const cached = await getCachedAuthProfile(currentUser.id);
          if (cached?.member) {
            setMember(cached.member as Member);
            setAccessRequest(null);
            setNeedsAccess(false);
            return cached.member as Member;
          }
        }
      } catch {
        /* ignore */
      }

      let existingMember: Member | null = null;
      try {
        const { data, error } = await supabase
          .from('members')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (error) console.error('members select error', error);
        existingMember = (data as Member) || null;
      } catch (e) {
        console.error('members select throw', e);
      }

      if (existingMember && !existingMember.establishment_id) {
        try {
          let estId: string | null = null;
          const { data: owned } = await supabase
            .from('establishments')
            .select('id')
            .eq('created_by', currentUser.id)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (owned?.id) estId = owned.id;
          if (!estId) {
            const { data: link } = await supabase
              .from('member_establishments')
              .select('establishment_id')
              .eq('user_id', currentUser.id)
              .eq('status', 'active')
              .limit(1)
              .maybeSingle();
            if (link?.establishment_id) estId = link.establishment_id;
          }
          if (estId) {
            await supabase
              .from('members')
              .update({ establishment_id: estId })
              .eq('user_id', currentUser.id);
            const { data: refreshed } = await supabase
              .from('members')
              .select('*')
              .eq('user_id', currentUser.id)
              .maybeSingle();
            if (refreshed) existingMember = refreshed as Member;
            else existingMember = { ...existingMember, establishment_id: estId };
          }
        } catch {
          /* ignore */
        }
      }

      if (existingMember) {
        setMember(existingMember);
        setAccessRequest(null);
        setNeedsAccess(false);
        try {
          await loadMyEstablishments(currentUser, existingMember);
        } catch {
          /* ignore */
        }
        try {
          await cacheAuthProfile({ userId: currentUser.id, member: existingMember });
        } catch {
          /* ignore */
        }
        return existingMember;
      }

      // Récupérer un établissement existant (créé par l'user ou via member_establishments)
      let recoveredEstId: string | null = null;
      try {
        const { data: owned } = await supabase
          .from('establishments')
          .select('id')
          .eq('created_by', currentUser.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (owned?.id) recoveredEstId = owned.id;
      } catch { /* */ }
      if (!recoveredEstId) {
        try {
          const { data: link } = await supabase
            .from('member_establishments')
            .select('establishment_id')
            .eq('user_id', currentUser.id)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();
          if (link?.establishment_id) recoveredEstId = link.establishment_id;
        } catch { /* */ }
      }

      const payload: Record<string, unknown> = {
        user_id: currentUser.id,
        email: fallback.email,
        full_name: fallback.full_name,
        role: 'owner',
        status: 'active',
      };
      if (recoveredEstId) payload.establishment_id = recoveredEstId;

      try {
        // insert only if absent — ne pas écraser un establishment_id existant avec null
        const { data: inserted, error: insErr } = await supabase
          .from('members')
          .insert(payload)
          .select()
          .maybeSingle();
        if (!insErr && inserted) {
          const m = inserted as Member;
          setMember(m);
          setAccessRequest(null);
          setNeedsAccess(false);
          try { await loadMyEstablishments(currentUser, m); } catch { /* */ }
          return m;
        }
        // Si conflit (déjà existant) : recharger sans upsert destructif
        const { data: again } = await supabase
          .from('members')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (again) {
          let m = again as Member;
          if (!m.establishment_id && recoveredEstId) {
            await supabase.from('members').update({ establishment_id: recoveredEstId }).eq('user_id', currentUser.id);
            m = { ...m, establishment_id: recoveredEstId };
          }
          setMember(m);
          setAccessRequest(null);
          setNeedsAccess(false);
          try { await loadMyEstablishments(currentUser, m); } catch { /* */ }
          return m;
        }
        if (insErr) console.error('member insert error', insErr);
      } catch (e) {
        console.error('member insert throw', e);
      }

      // Dernier recours : fallback AVEC établissement récupéré si possible
      const fb = recoveredEstId
        ? { ...fallback, establishment_id: recoveredEstId }
        : fallback;
      setMember(fb);
      setAccessRequest(null);
      setNeedsAccess(false);
      if (recoveredEstId) {
        try { await loadMyEstablishments(currentUser, fb); } catch { /* */ }
      } else {
        // Ne pas vider si localStorage a un établissement (évite TypePicker)
        try {
          const raw = localStorage.getItem('mm_active_est');
          if (!raw) {
            setMyEstablishments([]);
            setActiveEstablishment(null);
          }
        } catch {
          setMyEstablishments([]);
          setActiveEstablishment(null);
        }
      }
      return fb;
    } catch (e) {
      console.error('loadMemberData', e);
      setMember(fallback);
      setNeedsAccess(false);
      return fallback;
    }
  }



  useEffect(() => {
    let mounted = true;
    let memberLoadSeq = 0;

    async function ensureMember(u: User) {
      const seq = ++memberLoadSeq;
      try {
        const result = await Promise.race([
          loadMemberData(u).then((m) => m),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
        ]);
        if (!mounted || seq !== memberLoadSeq) return;
        if (result === null) {
          setMember((prev) => prev ?? buildFallbackMember(u));
          setNeedsAccess(false);
        }
      } catch {
        if (mounted && seq === memberLoadSeq) {
          setMember((prev) => prev ?? buildFallbackMember(u));
          setNeedsAccess(false);
        }
      }
    }

    async function boot() {
      try {
        // Double lecture session (corrige race localStorage juste après login)
        let session = (await supabase.auth.getSession()).data.session;
        if (!session) {
          await new Promise((r) => setTimeout(r, 150));
          session = (await supabase.auth.getSession()).data.session;
        }
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Ne pas bloquer l'UI : profil en arrière-plan
          void ensureMember(session.user);
        }
      } catch (e) {
        console.error('getSession', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    boot();

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (event === 'INITIAL_SESSION') return;

      // Ne jamais effacer un user valide sur TOKEN_REFRESHED raté
      if (event === 'TOKEN_REFRESHED' && newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setMember(null);
        setAccessRequest(null);
        setNeedsAccess(false);
        setMyEstablishments([]);
        setActiveEstablishment(null);
        setLoading(false);
        return;
      }

      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        setLoading(false);
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          void ensureMember(newSession.user);
        }
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(login: string, password: string) {
    try {
      try {
        localStorage.removeItem('mm_login_attempts');
      } catch { /* */ }
      if (!login.trim()) return { error: 'Saisissez votre identifiant ou e-mail.' };
      if (!password) return { error: 'Saisissez votre mot de passe.' };
      if (!isSafeLogin(login)) {
        return { error: 'Identifiant invalide (e-mail ou login simple sans espaces).' };
      }
      const email = toAuthEmail(login);
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        registerLoginFailure();
        setLoading(false);
        return { error: safeErrorMessage(error, 'Identifiant ou mot de passe incorrect') };
      }
      registerLoginSuccess();
      const user = data.user ?? data.session?.user ?? null;
      if (data.session) {
        setSession(data.session);
      }
      if (user) {
        setUser(user);
        try {
          await loadMemberData(user);
        } catch {
          setMember(buildFallbackMember(user));
          setNeedsAccess(false);
        }
      }
      setLoading(false);
      return { error: null };
    } catch (e: any) {
      registerLoginFailure();
      setLoading(false);
      return { error: e?.message || 'Connexion impossible' };
    }
  }

  async function signUp(login: string, password: string, fullName: string) {
    if (!login.trim()) return { error: 'E-mail ou identifiant requis.' };
    if (!isSafeLogin(login)) {
      return { error: 'Identifiant invalide (e-mail ou login simple).' };
    }
    if (!password || password.length < 6) {
      return { error: 'Mot de passe trop court (minimum 6 caractères).' };
    }
    const email = toAuthEmail(login);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || login, name: fullName || login },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        setLoading(false);
        return { error: safeErrorMessage(error, error.message) };
      }

      let session = data.session;
      let user = data.user;
      if (!session || !user) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) {
          setLoading(false);
          return {
            error: signInErr.message.toLowerCase().includes('confirm')
              ? 'Compte créé. Confirmez votre e-mail puis connectez-vous.'
              : safeErrorMessage(signInErr, 'Compte créé. Connectez-vous avec le même identifiant.'),
          };
        }
        session = signInData.session;
        user = signInData.user;
      }

      if (session) setSession(session);
      if (user) {
        setUser(user);
        setNeedsAccess(false);
        try {
          const { error: memErr } = await supabase.from('members').upsert(
            {
              user_id: user.id,
              email: user.email || email,
              full_name: fullName || user.user_metadata?.full_name || login,
              role: 'owner',
              status: 'active',
              establishment_id: null,
            },
            { onConflict: 'user_id' }
          );
          if (memErr) console.warn('member upsert', memErr.message);
        } catch { /* trigger SQL peut déjà l\'avoir créé */ }
        try {
          await loadMemberData(user);
        } catch {
          setMember(buildFallbackMember(user));
          setNeedsAccess(false);
        }
      }
      setLoading(false);
      return { error: null };
    } catch (e: any) {
      setLoading(false);
      return { error: e?.message || 'Inscription impossible' };
    }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { access_type: 'online', prompt: 'select_account' },
      },
    });
    if (error) {
      throw error;
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore network errors — on nettoie quand même l'état local */
      }
    }
    setSession(null);
    setUser(null);
    setMember(null);
    setAccessRequest(null);
    setNeedsAccess(false);
    setMyEstablishments([]);
    setActiveEstablishment(null);
      try {
        localStorage.removeItem('mm_active_est');
        localStorage.removeItem('mm_est_ids');
      } catch { /* */ }
    setLoading(false);
  }

  /** Déconnexion auto après inactivité (15 min) */
  useEffect(() => {
    if (!user) return;
    const IDLE_MS = 15 * 60 * 1000; // 15 minutes
    let timer: ReturnType<typeof setTimeout> | null = null;

    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        console.info('[auth] Déconnexion pour inactivité');
        void signOut();
        try {
          alert('Session expirée pour inactivité (15 min). Reconnectez-vous.');
        } catch {
          /* */
        }
      }, IDLE_MS);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
    // signOut is stable enough for this purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function refresh() {
    if (user) {
      setLoading(true);
      await loadMemberData(user);
      setLoading(false);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        member,
        accessRequest,
        loading,
        needsAccess,
        myEstablishments,
        activeEstablishment,
        switchEstablishment,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
