import type { PostSimilarTrainsApiResponse } from 'common/api/osrdEditoastApi';
import type { StdcmPathStep } from 'reducers/osrdconf/types';

import type { SimilarTrainWithSecondaryCode } from '../types';

export const addSecondaryCodesToSimilarTrains = (
  similarTrains: PostSimilarTrainsApiResponse['similar_trains'],
  pathSteps: StdcmPathStep[]
): SimilarTrainWithSecondaryCode[] => {
  const nameToSecondaryCode = new Map<string, string>();

  pathSteps.forEach((step) => {
    const loc = step.location;
    if (loc?.name && loc?.secondary_code) {
      nameToSecondaryCode.set(loc.name, loc.secondary_code);
    }
  });

  return similarTrains.map((similarTrain) => ({
    train_name: similarTrain.train?.train_name ?? null,
    start_time: similarTrain.train ? new Date(similarTrain.train.start_time) : undefined,
    begin: {
      name: similarTrain.begin,
      secondary_code: nameToSecondaryCode.get(similarTrain.begin) ?? '—',
    },
    end: {
      name: similarTrain.end,
      secondary_code: nameToSecondaryCode.get(similarTrain.end) ?? '—',
    },
  }));
};
