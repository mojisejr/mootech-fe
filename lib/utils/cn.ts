// cn — className merge util for the V3 UI primitive library.
//
// clsx / tailwind-merge are NOT dependencies of this repo, so this is a self-contained
// minimal implementation: it flattens conditional inputs (strings, arrays, and
// { 'class': boolean } objects), drops falsy values, and joins with a single space.
//
// Note: unlike tailwind-merge, this does NOT dedupe conflicting Tailwind utilities
// (e.g. `cn('p-2', 'p-4')` yields "p-2 p-4", last one wins at the CSS cascade level).
// That's fine for variant composition where inputs don't fight; order your class
// strings so the intended override comes last. If real conflict-resolution is ever
// needed, add `clsx` + `tailwind-merge` to package.json and swap this body for
// `twMerge(clsx(inputs))` — the signature below stays the same.

export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === "string" || typeof input === "number") {
      out.push(String(input));
    } else if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) out.push(nested);
    } else if (typeof input === "object") {
      for (const key in input) {
        if (input[key]) out.push(key);
      }
    }
  }

  return out.join(" ");
}

export default cn;
