import { useMemo, useState } from 'react';

import { osrdEditoastApi, type SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import type { PathStep, PathStepMetadata } from 'reducers/osrdconf/types';

import { countryAndMainCodesPayload } from '../helpers/searchPayload';
import {
  buildCustomOpSuggestion,
  buildOpSuggestion,
  hasSameCountryAndMainCodes,
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

  const upsertCustomOp = (customOp: OperationalPointSuggestion) => {
    setCustomOps((prev) => [...prev.filter((op) => op.id !== customOp.id), customOp]);
  };

  const setUnknownOpName = (stepKey: string, name: string) => {
    const location = pathSteps.find(({ key }) => key === stepKey)?.location;
    if (location?.type !== 'operational_point_part_reference') return;
    const opRef = location.operational_point;
    if (opRef.type !== 'domestic') return;

    const existingOp = customOps.find(
      (op) => op.countryCode === opRef.country_code && op.mainCode === opRef.main_code
    );
    upsertCustomOp(existingOp ? { ...existingOp, name } : buildCustomOpSuggestion(name, opRef));
  };

  const customOpSuggestions = useMemo(() => {
    const unknownOps = pathSteps
      .map(({ key, location }) => {
        const isInvalid = pathStepsMetadataByKey.get(key)?.validity === 'invalid';
        if (!isInvalid || location?.type !== 'operational_point_part_reference') return null;
        const opRef = location.operational_point;
        if (opRef.type !== 'domestic') return null;
        return buildCustomOpSuggestion('', opRef);
      })
      .filter((op) => op !== null)
      .filter((op) => !customOps.some((customOp) => hasSameCountryAndMainCodes(customOp, op)));

    return [...customOps, ...unknownOps];
  }, [pathSteps, pathStepsMetadataByKey, customOps]);

  const findExistingOp = async (countryCode: string, mainCode: string) => {
    const isSameOp = (op: OperationalPointSuggestion) =>
      hasSameCountryAndMainCodes(op, { countryCode, mainCode });

    const customOp = customOpSuggestions.find(isSameOp);
    if (customOp) return customOp;

    const [infraOps, macroNodeSuggestions] = await Promise.all([
      postSearch(
        { searchPayload: countryAndMainCodesPayload(infraId, countryCode, mainCode), pageSize },
        true
      ).unwrap() as Promise<SearchResultItemOperationalPoint[]>,
      // TODO: search macro nodes by location once editoast supports it
      searchMacroNodes(mainCode),
    ]);
    return buildOpSuggestion(infraOps).at(0) ?? macroNodeSuggestions.find(isSameOp) ?? null;
  };

  return { customOpSuggestions, upsertCustomOp, setUnknownOpName, findExistingOp };
};
