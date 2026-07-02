import { useEffect, useState } from "react";

// Returns true once `active` has stayed continuously true for `ms` milliseconds,
// and resets to false the moment `active` flips false. Use it to detect a stuck
// state — e.g. identity that never resolves out of "loading" on a deep-link/LINE
// entry — so the UI can offer an escape hatch instead of an infinite spinner
// (#mumate-my-destiny-mountgate-hang, Fix B″).
export function useLoadingTimeout(active: boolean, ms: number): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) {
      setElapsed(false);
      return;
    }
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => clearTimeout(timer);
  }, [active, ms]);

  return elapsed;
}
