import type { PostSimilarTrainsApiResponse } from 'common/api/osrdEditoastApi';
import type { PathOperationalPoint } from 'modules/simulationResult/types';

import type { SimilarTrainWithSecondaryCode } from '../types';

type OperationalPointMatch = {
  op: PathOperationalPoint;
  index: number;
};

export const addSecondaryCodesToSimilarTrains = (
  similarTrains: PostSimilarTrainsApiResponse['similar_trains'],
  pathOP?: PathOperationalPoint[]
): SimilarTrainWithSecondaryCode[] => {
  const orderedPathOP = pathOP ?? [];
  const opById = new Map<string, PathOperationalPoint>();
  orderedPathOP.forEach((op) => {
    if (op.opId) {
      opById.set(op.opId, op);
    }
  });

  const findOpFromIndex = (id: string, startIndex: number): OperationalPointMatch | undefined => {
    for (let index = startIndex; index < orderedPathOP.length; index += 1) {
      const op = orderedPathOP[index];
      if (op.opId === id) {
        return { op, index };
      }
    }

    return undefined;
  };

  const getOpInfo = (id: string, match?: OperationalPointMatch) => {
    const op = match?.op ?? opById.get(id);
    return {
      name: op?.name ?? id,
      secondary_code: op?.secondary_code ?? '—',
    };
  };

  let cursor = 0;

  return similarTrains.map((similarTrain) => {
    const beginMatch = findOpFromIndex(similarTrain.begin, cursor);
    const endMatch = findOpFromIndex(similarTrain.end, beginMatch ? beginMatch.index + 1 : cursor);

    cursor = endMatch?.index ?? beginMatch?.index ?? cursor;

    return {
      train_name: similarTrain.train?.train_name ?? null,
      start_time: similarTrain.train ? new Date(similarTrain.train.start_time) : undefined,
      begin: getOpInfo(similarTrain.begin, beginMatch),
      end: getOpInfo(similarTrain.end, endMatch),
    };
  });
};
