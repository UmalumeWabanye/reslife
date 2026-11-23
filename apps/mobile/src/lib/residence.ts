import { useSession } from './session';
import type { Residency } from './types';

type InResidence = Extract<Residency, { mode: 'residence' }>;

/** Residence + lease for screens inside the (residence) group, where they're guaranteed to exist. */
export function useResidence(): InResidence {
  const { residency } = useSession();
  if (residency?.mode !== 'residence') throw new Error('useResidence used outside the residence space');
  return residency;
}
