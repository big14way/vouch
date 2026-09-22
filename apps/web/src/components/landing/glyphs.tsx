import type { SVGProps } from "react";

/** Hand-drawn line glyphs for the landing page. Stroke inherits `currentColor`; every glyph is decorative. */
type P = SVGProps<SVGSVGElement>;
const base = (p: P): P => ({ width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, ...p });

export function LockGlyph(p: P) {
  return (
    <svg {...base(p)}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5v2.5" />
    </svg>
  );
}

export function DeliverGlyph(p: P) {
  return (
    <svg {...base(p)}>
      <path d="M7 3.5h7l5 5v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      <path d="M14 3.5v5h5" />
      <path d="M8.5 13.5h7M8.5 16.5h4.5" />
    </svg>
  );
}

export function VerifyGlyph(p: P) {
  return (
    <svg {...base(p)}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 20 20" />
      <path d="m7.75 10.75 1.9 1.9 3.6-4.1" />
    </svg>
  );
}

export function SettleGlyph(p: P) {
  return (
    <svg {...base(p)}>
      <rect x="3.5" y="6.5" width="17" height="11" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M3.5 10h2M18.5 14h2" />
    </svg>
  );
}

export function DisputeGlyph(p: P) {
  return (
    <svg {...base(p)}>
      <path d="M12 3.5v17M8 20.5h8" />
      <path d="M5 7.5h14" />
      <path d="M5 7.5 2.5 13.5a2.5 2.5 0 0 0 5 0L5 7.5ZM19 7.5l-2.5 6a2.5 2.5 0 0 0 5 0L19 7.5Z" />
    </svg>
  );
}

export function FingerprintGlyph(p: P) {
  return (
    <svg {...base(p)}>
      <path d="M6 11.5a6 6 0 0 1 12 0c0 3.2-.6 5.7-1.5 8" />
      <path d="M9 12a3 3 0 0 1 6 0c0 2.6-.4 5-1.2 7.2" />
      <path d="M12 12v1.5c0 2.2-.4 4.2-1.1 6" />
      <path d="M4.5 8.2A8.5 8.5 0 0 1 12 3.5c1.8 0 3.4.5 4.8 1.4" />
    </svg>
  );
}

export function SlidersGlyph(p: P) {
  return (
    <svg {...base(p)}>
      <path d="M4 7.5h16M4 12h16M4 16.5h16" />
      <circle cx="9" cy="7.5" r="1.8" fill="var(--bg)" />
      <circle cx="15" cy="12" r="1.8" fill="var(--bg)" />
      <circle cx="7" cy="16.5" r="1.8" fill="var(--bg)" />
    </svg>
  );
}

export function ShieldGlyph(p: P) {
  return (
    <svg {...base(p)}>
      <path d="M12 3.5 5 6.2v5.3c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6.2L12 3.5Z" />
      <path d="m9.2 12 1.9 1.9 3.7-4" />
    </svg>
  );
}

export function FileGlyph(p: P) {
  return (
    <svg {...base(p)}>
      <path d="M7 3.5h7l5 5v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      <path d="M14 3.5v5h5" />
    </svg>
  );
}

export function TerminalGlyph(p: P) {
  return (
    <svg {...base(p)}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="m7.5 9.5 2.5 2.5-2.5 2.5M12.5 14.5h4" />
    </svg>
  );
}
