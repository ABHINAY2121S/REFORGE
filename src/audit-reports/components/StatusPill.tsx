import React from "react";
import type { EntryStatus } from "../types/audit";

// Icon-plus-label so status is never conveyed by color alone (important
// for colorblind users and for print/greyscale contexts).
const ICONS: Record<EntryStatus, string> = {
  success: "✓",
  warning: "!",
  blocked: "✕",
  info: "i",
};

export function StatusPill({ status, label }: { status: EntryStatus; label?: string }) {
  return (
    <span className={`status-pill ${status}`}>
      <span aria-hidden="true">{ICONS[status]}</span>
      {label ?? status}
    </span>
  );
}
