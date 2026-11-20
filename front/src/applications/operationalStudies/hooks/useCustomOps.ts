import { useState } from 'react';

import { osrdEditoastApi, type SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import type { PathStep, PathStepMetadata } from 'reducers/osrdconf/types';

import { exactTrigramPayload } from '../helpers/searchPayload';
import {
  buildCustomOpSuggestion,
  buildOpSuggestion,
  hasSameCodes,
} from '../views/Scenario/components/ManageTrainSchedule/helpers/buildOpSuggestion';
import type { OperationalPointSuggestion } from '../views/Scenario/components/ManageTrainSchedule/Itinerary/ComboBoxCustomList/ListElementComponent';
import { useSearchMacroNodes } from './useOperationalPointSearch';

type Params = {
  scenarioId: number;
  pathSteps: PathStep[];
  pathStepsMetadataByKey: Map<string, PathStepMetadata>;
  pageSize?: number;
};

export const useCustomOps = ({
  scenarioId,
  pathSteps,
  pathStepsMetadataByKey,
  pageSize = 1000,
}: Params) => {
  const infraId = useInfraID();
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useLazyQuery();
  const searchMacroNodes = useSearchMacroNodes(scenarioId, pageSize);

  const [customOps, setCustomOps] = useState<OperationalPointSuggestion[]>([]);

  const addCustomOp = (customOp: OperationalPointSuggestion) => {
    setCustomOps((prev) => [...prev.filter((op) => op.id !== customOp.id), customOp]);
  };

  const [unknownOpNameByStepKey, setUnknownOpNameByStepKey] = useState<Record<string, string>>({});
  const setUnknownOpName = (stepKey: string, name: string) => {
    setUnknownOpNameByStepKey((prev) => ({ ...prev, [stepKey]: name }));

    const location = pathSteps.find(({ key }) => key === stepKey)?.location;
    if (location?.type !== 'operational_point_part_reference') return;
    const pathStepsLocation = location.operational_point;
    if (pathStepsLocation.type !== 'domestic') return;
    const pathStepCodes = {
      countryCode: pathStepsLocation.country_code,
      mainCode: pathStepsLocation.main_code,
    };
    setCustomOps((ops) =>
      ops.map((customOp) =>
        hasSameCodes(customOp, pathStepCodes) ? { ...customOp, name } : customOp
      )
    );
  };

  const unknownOps = pathSteps
    .map(({ key, location }) => {
      const name = unknownOpNameByStepKey[key];
      const isInvalid = pathStepsMetadataByKey.get(key)?.validity === 'invalid';
      const isNamedTrackOffset = location?.type === 'track_offset' && !!name;
      if (location && (isInvalid || isNamedTrackOffset)) {
        return buildCustomOpSuggestion(name ?? '', location);
      }
      return null;
    })
    .filter((op) => op !== null)
    .filter((op) => !customOps.some((customOp) => hasSameCodes(customOp, op)));

  const customOpSuggestions = [...customOps, ...unknownOps];

  const findExistingOp = async (countryCode: string, mainCode: string) => {
    const isSameOp = (op: OperationalPointSuggestion) =>
      hasSameCodes(op, { countryCode, mainCode });

    const customOp = customOpSuggestions.find(isSameOp);
    if (customOp) return customOp;

    const [infraOps, macroNodeSuggestions] = await Promise.all([
      postSearch(
        { searchPayload: exactTrigramPayload(infraId, mainCode), pageSize },
        true
      ).unwrap() as Promise<SearchResultItemOperationalPoint[]>,
      searchMacroNodes(mainCode),
    ]);
    return (
      buildOpSuggestion(infraOps).find(isSameOp) ?? macroNodeSuggestions.find(isSameOp) ?? null
    );
  };

  return { customOpSuggestions, addCustomOp, setUnknownOpName, findExistingOp };
};
