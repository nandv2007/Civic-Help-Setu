import {
  FACILITY_GROUPS,
  MEASUREMENT_STATUS_LABELS,
} from '../../data/accessibilityAuditStandards.js';

const FACILITY_LABEL = Object.fromEntries(FACILITY_GROUPS.map((group) => [group.id, group.label]));

const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

/** CSV of the measurements, so a volunteer can work on them offline. */
export function resultsToCsv(results = [], officeName = '') {
  const header = [
    'Office',
    'Facility',
    'Benchmark',
    'Measured',
    'Result',
    'Requirement',
    'Source',
    'Note',
  ];

  const rows = results.map((result) => [
    officeName,
    FACILITY_LABEL[result.facility] || result.facility,
    result.label,
    result.displayValue,
    MEASUREMENT_STATUS_LABELS[result.status] || result.status,
    result.requirement,
    `${result.source?.id || ''} ${result.source?.clause || ''}`.trim(),
    result.note || '',
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n') + '\n';
}
