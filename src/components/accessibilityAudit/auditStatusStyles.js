import { AlertTriangle, CheckCircle2, CircleSlash, HelpCircle, Slash, XCircle } from 'lucide-react';
import { MEASUREMENT_STATUS } from '../../data/accessibilityAuditStandards.js';

/** Icon + class per measurement status (shared by the table and the form). */
export const STATUS_STYLES = {
  [MEASUREMENT_STATUS.PASS]: { icon: CheckCircle2, className: 'audit-chip--pass' },
  [MEASUREMENT_STATUS.AT_LIMIT]: { icon: AlertTriangle, className: 'audit-chip--limit' },
  [MEASUREMENT_STATUS.FAIL]: { icon: XCircle, className: 'audit-chip--fail' },
  [MEASUREMENT_STATUS.UNKNOWN]: { icon: HelpCircle, className: 'audit-chip--unknown' },
  [MEASUREMENT_STATUS.NOT_APPLICABLE]: { icon: Slash, className: 'audit-chip--na' },
  [MEASUREMENT_STATUS.INVALID]: { icon: CircleSlash, className: 'audit-chip--invalid' },
};

/** Wording and colour for the "since last assessment" column. */
export const CHANGE_STYLES = {
  improved: { label: 'Improved since last assessment', className: 'audit-change--better' },
  worse: { label: 'Worse since last assessment', className: 'audit-change--worse' },
  unchanged: { label: 'Same as last assessment', className: 'audit-change--same' },
  first_measurement: { label: 'First measurement', className: 'audit-change--first' },
  not_measured: { label: 'Not measured this time — cannot compare', className: 'audit-change--same' },
};
