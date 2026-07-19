// Checkbox — MuMate V3 design-system primitive (DESIGN.md §6 Checkbox).
//
// Box 24×24 radius 4, check icon 16×16 inset 4.
//   Unselected .............. white + 1px #C2C2C2 (border-v3-border-checkbox)
//   Unselected hover/focus .. white + 1px #1455A4 (border-v3-sapphire)
//   Checked ................. #1455A4 fill + white check
//   Focus ................... box grows 32×32 radius 8 + 2px #1455A4 ring
//
// Controlled component: `checked`/`onChange` drive selection; hover & focus are
// pure CSS state (group-hover / peer-focus-visible) so they need no JS.
//
// The visual box is absolutely centered inside a fixed 24×24 slot, so the
// focus growth (24 → 32) and the 2px ring overflow symmetrically WITHOUT
// reflowing the label beside it — the checkbox↔text gap stays a true 8px.
//
// No 'use client' — Pages Router. Named export, inline prop type, Tailwind-only.

import { useId } from "react";
import { cn } from "@/lib/utils/cn";

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  /** Accessible name for the unlabeled variant (required there for a11y).
   *  In the labeled variant the visible <label htmlFor> supplies the name,
   *  so this is ignored there to avoid overriding the real association. */
  ariaLabel?: string;
}) {
  const reactId = useId();
  const inputId = `checkbox-${reactId}`;
  const descId = description ? `${inputId}-desc` : undefined;

  // Fixed 24×24 slot; the styled box sits absolutely-centered inside it so the
  // focus-grow to 32×32 + ring never pushes the label.
  const control = (
    <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label ? undefined : ariaLabel}
        aria-describedby={descId}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          "peer absolute inset-0 z-10 m-0 h-full w-full appearance-none rounded",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          // base box — 24×24, radius 4, check centered
          "pointer-events-none absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border transition-all",
          // focus (from the peer input): grow to 32×32, radius 8, 2px sapphire ring + border
          "peer-focus-visible:h-8 peer-focus-visible:w-8 peer-focus-visible:rounded-lg peer-focus-visible:border-v3-sapphire peer-focus-visible:ring-2 peer-focus-visible:ring-v3-sapphire",
          checked
            ? "border-v3-sapphire bg-v3-sapphire"
            : "border-v3-border-checkbox bg-white",
          // hover border only makes sense on an interactive, unchecked box
          !checked && !disabled && "group-hover:border-v3-sapphire",
          disabled && "opacity-50",
        )}
      >
        {checked && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              className="stroke-white"
              d="M13 4.5L6.5 11.5L3.5 8.5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </span>
  );

  // Unlabeled variant — the input already fills the box, so the box alone is the
  // full click/hit target.
  if (!label) {
    return (
      <span className={cn("group inline-flex", disabled && "opacity-60")}>
        {control}
      </span>
    );
  }

  // Labeled variant — box + label (16/24) + optional description, gap 8 (§5).
  // items-start so the box aligns to the first line of a multi-line description.
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "group inline-flex items-start gap-2 font-ibm",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
    >
      {control}
      <span className="flex flex-col">
        <span className="text-base leading-6 text-v3-text-body">{label}</span>
        {description && (
          <span id={descId} className="text-sm leading-5 text-v3-text-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

export default Checkbox;
