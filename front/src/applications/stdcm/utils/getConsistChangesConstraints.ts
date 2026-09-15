import type {
  LightRollingStock,
  LoadingGaugeType,
  osrdEditoastApi,
  PathfindingItem,
  PathfindingResult,
} from 'common/api/osrdEditoastApi';
import { getPathfindingQuery } from 'modules/pathfinding/utils';
import type { StdcmPathStep } from 'reducers/osrdconf/types';

type PathfindingConsistChange = {
  index: number;
  rollingStockID: number;
  totalLength: number;
  loadingGauge?: LoadingGaugeType;
  speedLimitByTag?: string | null;
};

type SegmentConstraints = {
  segmentRollingStock: LightRollingStock;
  segmentTotalLength: number;
  segmentLoadingGauge?: LoadingGaugeType;
  segmentSpeedLimitByTag?: string | null;
};

type getSegmentConstraintsOptions = {
  segmentIndex: number;
  consistChanges: PathfindingConsistChange[];
  getLightRollingStockById: GetLightRollingStockById;
  rollingStock: LightRollingStock;
  totalLength: number;
  loadingGauge?: LoadingGaugeType;
  speedLimitByTag?: string | null;
};

type LaunchSegmentedPathfindingOptions = {
  pathSegmentsIndexes: number[];
  stdcmPathSteps: PathfindingItem[];
  consistChanges: PathfindingConsistChange[];
  getLightRollingStockById: GetLightRollingStockById;
  postPathfindingBlocks: PostPathfindingBlocks;
  infraId: number;
  rollingStock: LightRollingStock;
  totalLength: number;
  loadingGauge?: LoadingGaugeType;
  speedLimitByTag?: string | null;
  allowedTrackSections?: string[];
};

type GetLightRollingStockById = ReturnType<
  typeof osrdEditoastApi.endpoints.getLightRollingStockByRollingStockId.useLazyQuery
>[0];

type PostPathfindingBlocks = ReturnType<
  typeof osrdEditoastApi.endpoints.postInfraByInfraIdPathfindingBlocks.useLazyQuery
>[0];

export const getConsistChanges = (pathSteps: StdcmPathStep[]): PathfindingConsistChange[] =>
  pathSteps.flatMap((step, index) => {
    if (!step.isVia || !step.consistChange?.rollingStockID || !step.consistChange?.totalLength)
      return [];
    return [
      {
        index,
        rollingStockID: step.consistChange.rollingStockID,
        totalLength: step.consistChange.totalLength,
        loadingGauge: step.consistChange.loadingGauge,
        speedLimitByTag: step.consistChange.speedLimitByTag,
      },
    ];
  });

export const getPathSegmentsIndexes = (
  consistChanges: PathfindingConsistChange[],
  totalSteps: number
): number[] => [0, ...consistChanges.map((change) => change.index), totalSteps - 1];

export const getSegmentConstraints = async ({
  segmentIndex,
  consistChanges,
  getLightRollingStockById,
  rollingStock,
  totalLength,
  loadingGauge,
  speedLimitByTag,
}: getSegmentConstraintsOptions): Promise<SegmentConstraints> => {
  if (segmentIndex === 0) {
    return {
      segmentRollingStock: rollingStock,
      segmentTotalLength: totalLength,
      segmentLoadingGauge: loadingGauge,
      segmentSpeedLimitByTag: speedLimitByTag,
    };
  }

  const previousStep = consistChanges[segmentIndex - 1];
  const segmentRollingStock = await getLightRollingStockById({
    rollingStockId: previousStep.rollingStockID,
  }).unwrap();

  return {
    segmentRollingStock,
    segmentTotalLength: previousStep.totalLength,
    segmentLoadingGauge: previousStep.loadingGauge ?? loadingGauge,
    segmentSpeedLimitByTag: previousStep.speedLimitByTag ?? speedLimitByTag,
  };
};

/**
 * We launch one pathfinding request for each segment we find.
 * For example A -> B -> C with a consist change at B:
 *   - we launch A -> B with the initial rolling stock
 *   - then B -> C with the convoy change rolling stock
 * When there are no consist changes, we're doing one pathfinding request for the entire path
 */
export const launchSegmentedPathfinding = async ({
  pathSegmentsIndexes,
  stdcmPathSteps,
  consistChanges,
  getLightRollingStockById,
  postPathfindingBlocks,
  infraId,
  rollingStock,
  totalLength,
  loadingGauge,
  speedLimitByTag,
  allowedTrackSections,
}: LaunchSegmentedPathfindingOptions): Promise<PathfindingResult | undefined> => {
  let pathfindingResult: PathfindingResult | undefined;

  for (let i = 0; i < pathSegmentsIndexes.length - 1; i++) {
    // Need to do a +1 to include the destination of the segment, because slice excludes the end index
    const endSliceIndex = pathSegmentsIndexes[i + 1] + 1;
    const segmentSteps = stdcmPathSteps.slice(pathSegmentsIndexes[i], endSliceIndex);

    const { segmentRollingStock, segmentTotalLength, segmentLoadingGauge, segmentSpeedLimitByTag } =
      await getSegmentConstraints({
        segmentIndex: i,
        consistChanges,
        getLightRollingStockById,
        rollingStock,
        totalLength,
        loadingGauge,
        speedLimitByTag,
      });

    const payload = getPathfindingQuery({
      infraId,
      rollingStock: segmentRollingStock,
      totalLength: segmentTotalLength,
      pathSteps: segmentSteps,
      loadingGauge: segmentLoadingGauge,
      speedLimitByTag: segmentSpeedLimitByTag,
      allowedTrackSections,
    });

    if (payload === null) {
      return;
    }

    pathfindingResult = await postPathfindingBlocks(payload).unwrap();

    if (pathfindingResult.status === 'failure') {
      return pathfindingResult;
    }
  }

  return pathfindingResult;
};
