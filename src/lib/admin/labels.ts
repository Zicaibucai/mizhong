import type { AdminMessages } from './i18n';
import type { AdminLocale } from './validation';

/** String-indexed lookup into a message map, falling back to the raw key. */
function pick(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}

/** Label for a *content* locale (zh / en / vi) — the language being edited, not the admin UI. */
export function getContentLocaleLabel(t: AdminMessages, locale: AdminLocale): string {
  return t.labels.contentLocales[locale];
}

export function getContactTypeLabel(t: AdminMessages, type: string): string {
  return pick(t.labels.contactTypes, type);
}

export function getAuditActionLabel(t: AdminMessages, action: string): string {
  return pick(t.labels.auditActions, action);
}

export function getPageStatusLabel(t: AdminMessages, status: string): string {
  return pick(t.labels.pageStatuses, status);
}

export function getBlockLabel(t: AdminMessages, key: string): string {
  return pick(t.labels.blocks, key);
}

/** Options for the contact type `<select>`, in message order. */
export function getContactTypeOptions(t: AdminMessages): { value: string; label: string }[] {
  return Object.keys(t.labels.contactTypes).map((value) => ({
    value,
    label: pick(t.labels.contactTypes, value),
  }));
}
