import type { PostSimilarTrainsApiResponse } from 'common/api/osrdEditoastApi';
import type { PathOperationalPoint } from 'modules/simulationResult/types';

import type { SimilarTrainWithSecondaryCode } from '../types';

export const addSecondaryCodesToSimilarTrains = (
  similarTrains: PostSimilarTrainsApiResponse['similar_trains'],
  pathOP?: PathOperationalPoint[]
): SimilarTrainWithSecondaryCode[] => {
  const opById = new Map<string, PathOperationalPoint>();
  pathOP?.forEach((op) => {
    if (op.opId) {
      opById.set(op.opId, op);
    }
  });

  const getOpInfo = (id: string) => {
    const op = opById.get(id);
    return {
      name: op?.extensions?.identifier?.name ?? id,
      secondary_code: op?.extensions?.sncf?.ch ?? '—',
    };
  };

  return similarTrains.map((similarTrain) => ({
    train_name: similarTrain.train?.train_name ?? null,
    start_time: similarTrain.train ? new Date(similarTrain.train.start_time) : undefined,
    begin: getOpInfo(similarTrain.begin),
    end: getOpInfo(similarTrain.end),
  }));
};
