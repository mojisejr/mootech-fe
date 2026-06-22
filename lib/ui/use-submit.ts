// useSubmit — wrap an async action with an isSubmitting flag and a
// double-fire guard. Concurrent/rapid calls while a submit is pending are
// IGNORED (mirrors the defensive promptpayFiredRef ref-guard pattern), so a
// money/compute path like UserMatchingCalculateApi never fires twice on
// rapid taps. No state library, no React context.

import { useCallback, useRef, useState } from 'react';

// Pure, React-free guard so the double-fire logic is testable without a
// renderer. tryAcquire() returns true exactly once until release() is called.
export function createSubmitGuard() {
  let held = false;
  return {
    tryAcquire(): boolean {
      if (held) return false;
      held = true;
      return true;
    },
    release(): void {
      held = false;
    },
    get isHeld(): boolean {
      return held;
    },
  };
}

export function useSubmit<T>(fn: () => Promise<T>) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const guardRef = useRef(createSubmitGuard());

  const submit = useCallback(async (): Promise<T | undefined> => {
    // Ignore re-entrant calls while a submit is still pending.
    if (!guardRef.current.tryAcquire()) return undefined;

    setIsSubmitting(true);
    try {
      return await fn();
    } finally {
      // Reset on both success and throw.
      setIsSubmitting(false);
      guardRef.current.release();
    }
  }, [fn]);

  return { isSubmitting, submit };
}
