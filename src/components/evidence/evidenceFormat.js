/** Shared formatting helpers for the evidence manifest screens (#947). */

/** Locale-aware date + time, or an em dash for missing/invalid values. */
export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};
