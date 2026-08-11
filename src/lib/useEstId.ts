import { useAuth } from './auth';

/** ID établissement actif (sélecteur) ou profil membre */
export function useEstId(): string | null {
  const { member, activeEstablishment } = useAuth();
  return activeEstablishment?.id || member?.establishment_id || null;
}
