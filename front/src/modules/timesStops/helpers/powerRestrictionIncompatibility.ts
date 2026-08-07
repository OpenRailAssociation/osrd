import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import { getPowerRestrictionsWarnings } from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/PowerRestrictionsSelector/helpers/powerRestrictionWarnings';
import type { PowerRestrictionItem, RollingStock } from 'common/api/osrdEditoastApi';
import { NO_POWER_RESTRICTION } from 'modules/powerRestriction/consts';
import type { Train } from 'reducers/osrdconf/types';

import type { TimesStopsRowNew } from '../types';
import { buildPowerRestrictionsFromRows } from './cellUpdate';

export type PowerRestrictionBlockInfo = {
  /** The restriction code active at this row position (null if no restriction is active). */
  propagatedValue: string | null;
  /** True if this row falls within a warning range (incompatible restriction + electrification). */
  hasWarning: boolean;
  /** True if this row is the first row of a contiguous block of warned rows. */
  isBlockStart: boolean;
};

/**
 * For each row, compute its power restriction status:
 *
 * 1. **Propagation**: track which restriction code is active at each position
 *    (follows the path step chain, reset by NO_POWER_RESTRICTION).
 *
 * 2. **Warning detection**: check if the row's position falls within a warning
 *    range (restriction code incompatible with the electrification).
 *
 * 3. **Block detection**: group contiguous warned rows into blocks. The first
 *    row of each block is flagged so the caller can display the propagated value
 *    there (in a lighter style) for the user to see what causes the warning and
 *    edit it directly at the boundary.
 *
 * 4. **Single-row block dismissal** — blocks containing only one row in an
 *    electrification transition zone are cleared. These short gaps between two
 *    voltage systems are not actionable in the table (the GEV provides more detail).
 *    Real single-row incompatibilities (outside transition zones) are kept.
 */
export const computeRowPowerRestrictionStatus = (
  rows: TimesStopsRowNew[],
  operationalPointPositions: Map<number, number>,
  warningRanges: { begin: number; end: number }[],
  voltages: { begin: number; end: number; value: string }[]
): Map<string, PowerRestrictionBlockInfo> => {
  const result = new Map<string, PowerRestrictionBlockInfo>();

  let activeRestriction: string | null = null;
  let prevActiveRestriction: string | null = null;
  let prevHadWarning = false;
  // Row that opened a block not yet confirmed (waiting for the next row to
  // know if the block has 2+ rows or is just a single isolated row).
  let candidateBlockStart: { id: string; position: number | undefined } | null = null;

  // Ignore a candidate single-row block if it falls within an electrification
  // transition zone (voltage = ""). Real incompatibilities are kept.
  const ignoreCandidateIfInTransitionZone = () => {
    if (!candidateBlockStart) return;
    const { id, position } = candidateBlockStart;
    const isInTransitionZone =
      position !== undefined &&
      voltages.some((v) => v.value === '' && position >= v.begin && position < v.end);
    if (isInTransitionZone) {
      const candidate = result.get(id)!;
      result.set(id, { ...candidate, hasWarning: false, isBlockStart: false });
    }
    candidateBlockStart = null;
  };

  for (const row of rows) {
    // 1. Update the active restriction when a path step defines one.
    if (row.pathStepId && row.powerRestriction !== null) {
      activeRestriction =
        row.powerRestriction === NO_POWER_RESTRICTION ? null : row.powerRestriction;
    }

    // 2. Check if this row's position falls within any warning range.
    const rowPosition = operationalPointPositions.get(row.opOnPathIndex);
    const hasWarning =
      rowPosition !== undefined &&
      warningRanges.some((w) => rowPosition >= w.begin && rowPosition < w.end);

    // 3. Detect block boundaries. A block represents a contiguous run of rows
    //    where the *same* active restriction is incompatible. So a new block
    //    starts either when entering a warning from a compatible row, or when
    //    the active restriction changes while still in a warning state (two
    //    adjacent blocks of different restrictions).
    const restrictionChanged = activeRestriction !== prevActiveRestriction;
    const isBlockStart = hasWarning && (!prevHadWarning || restrictionChanged);

    result.set(row.id, {
      propagatedValue: activeRestriction,
      hasWarning,
      isBlockStart,
    });

    // 4. Dismiss single-row blocks only if they fall within an electrification
    //    transition zone (voltage = ""). A single row in a real incompatibility
    //    zone is a legitimate warning and should be kept.
    if (isBlockStart) {
      // A previous candidate may still be pending (1-row block ended by a
      // restriction change), so handle its dismissal before opening the new one.
      ignoreCandidateIfInTransitionZone();
      candidateBlockStart = { id: row.id, position: rowPosition };
    } else if (hasWarning) {
      // Block has 2+ rows → confirmed, stop tracking.
      candidateBlockStart = null;
    } else {
      ignoreCandidateIfInTransitionZone();
    }

    prevHadWarning = hasWarning;
    prevActiveRestriction = activeRestriction;
  }

  // Handle a single-row block at the very end of the table.
  ignoreCandidateIfInTransitionZone();

  return result;
};

type ComputePowerRestrictionWarningsResult = {
  blocks: Map<string, PowerRestrictionBlockInfo>;
  warningCount: number;
};

const EMPTY_RESULT: ComputePowerRestrictionWarningsResult = {
  blocks: new Map(),
  warningCount: 0,
};

/**
 * Compute the power restriction incompatibility warnings for each row of the
 * TimesStopsTable, based on the current restrictions, the electrification
 * profile along the path, and the rolling stock effort curves.
 *
 * Built from the rows (expected to be the optimistic rows) rather than from
 * `selectedTrain.power_restrictions` so warnings update immediately when the
 * user edits a cell, before the API round-trip completes.
 *
 * The warning count reflects the number of contiguous blocks of incompatible
 * rows. Each block represents one distinct issue the user needs to resolve,
 * matching what is visually highlighted in the table.
 */
export const computePowerRestrictionWarnings = ({
  rows,
  path,
  operationalPointsOnPath,
  voltages,
  rollingStock,
}: {
  rows: TimesStopsRowNew[];
  path: Train['path'];
  operationalPointsOnPath: PathPropertiesFormatted['operationalPoints'] | undefined;
  voltages: PathPropertiesFormatted['voltages'] | undefined;
  rollingStock: RollingStock | undefined;
}): ComputePowerRestrictionWarningsResult => {
  const powerRestrictions: PowerRestrictionItem[] = buildPowerRestrictionsFromRows(rows);
  if (!voltages?.length || !rollingStock || !powerRestrictions.length) return EMPTY_RESULT;

  const pathStepPositions = new Map<string, number>();
  path.forEach((pathStep) => {
    const matchingOp = operationalPointsOnPath?.find((op) => op.pathItemId === pathStep.key);
    if (matchingOp) pathStepPositions.set(pathStep.key, matchingOp.position);
  });

  const ranges: { begin: number; end: number; value: string }[] = powerRestrictions.flatMap(
    (pr) => {
      if (pr.value === NO_POWER_RESTRICTION) return [];
      const begin = pathStepPositions.get(pr.from);
      const end = pathStepPositions.get(pr.to);
      if (begin === undefined || end === undefined) return [];
      return [{ begin, end, value: pr.value }];
    }
  );

  if (!ranges.length) return EMPTY_RESULT;

  const warnings = getPowerRestrictionsWarnings(ranges, voltages, rollingStock.effort_curves.modes);

  const warningRanges = [
    ...warnings.invalidCombinationWarnings,
    ...warnings.modeNotSupportedWarnings,
  ];

  const operationalPointPositions = new Map<number, number>(
    (operationalPointsOnPath ?? []).map((op, idx) => [idx, op.position])
  );

  const blocks = computeRowPowerRestrictionStatus(
    rows,
    operationalPointPositions,
    warningRanges,
    voltages
  );
  const warningCount = [...blocks.values()].filter((b) => b.isBlockStart).length;

  return { blocks, warningCount };
};
