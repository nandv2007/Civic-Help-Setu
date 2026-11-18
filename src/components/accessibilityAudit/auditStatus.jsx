import {
  MEASUREMENT_STATUS,
  MEASUREMENT_STATUS_LABELS,
} from '../../data/accessibilityAuditStandards.js';
import { CHANGE_STYLES, STATUS_STYLES } from './auditStatusStyles.js';

/**
 * Status chip for a measurement. Icon + word, never colour alone — the same
 * rule the rest of the app follows, and the one people who cannot separate red
 * from green depend on.
 */
export default function MeasurementStatusChip({ status, withLabel = true }) {
  const config = STATUS_STYLES[status] || STATUS_STYLES[MEASUREMENT_STATUS.UNKNOWN];
  const Icon = config.icon;

  return (
    <span className={`audit-chip ${config.className}`}>
      <Icon size={13} aria-hidden="true" />
      {withLabel ? MEASUREMENT_STATUS_LABELS[status] || status : null}
      {!withLabel && <span className="audit-visually-hidden">{MEASUREMENT_STATUS_LABELS[status]}</span>}
    </span>
  );
}

export function ChangeFlag({ change, previousStatus, previousDisplay }) {
  const config = CHANGE_STYLES[change];
  if (!config) return null;

  return (
    <span
      className={`audit-change ${config.className}`}
      title={previousDisplay ? `Previously: ${previousDisplay}` : undefined}
    >
      {config.label}
      {previousStatus && previousDisplay ? ` (was ${previousDisplay})` : ''}
    </span>
  );
}
