import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import {
  osrdEditoastApi,
  type MacroNodeForm,
  type MacroNodeResponse,
} from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import type { LocatedPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import type { OperationalPointSuggestion } from '../Itinerary/ComboBoxCustomList/ListElementComponent';
import type { DomesticOperationalPointReference } from '../types';

export function useSaveCustomOps() {
  const dispatch = useAppDispatch();
  const { scenario } = useScenarioContext();

  const [matchMacroNodes] =
    osrdEditoastApi.endpoints.postScenariosByScenarioIdMatchMacroNodes.useLazyQuery();
  const [postMacroNodes] = osrdEditoastApi.endpoints.postMacroNodes.useMutation();
  const [putMacroNode] = osrdEditoastApi.endpoints.putMacroNodesByNodeId.useMutation();

  return async (pathSteps: LocatedPathStep[], customOps: OperationalPointSuggestion[]) => {
    const usedCustomOps = customOps.filter(({ countryCode, mainCode }) =>
      pathSteps.some(
        ({ location }) =>
          location.type === 'operational_point_part_reference' &&
          location.operational_point.type === 'domestic' &&
          location.operational_point.country_code === countryCode &&
          location.operational_point.main_code === mainCode
      )
    );
    if (usedCustomOps.length === 0) return;

    const opRefs: DomesticOperationalPointReference[] = usedCustomOps.map(
      ({ countryCode, mainCode, secondaryCodeList }) => ({
        type: 'domestic',
        country_code: countryCode,
        main_code: mainCode,
        secondary_code: secondaryCodeList[0].code ?? undefined,
      })
    );

    try {
      const { related_operational_points } = await matchMacroNodes({
        scenarioId: scenario.id,
        body: { operational_point_references: opRefs },
      }).unwrap();

      const missingMacroNodes: MacroNodeForm[] = [];
      const renamedMacroNodes: MacroNodeResponse[] = [];
      usedCustomOps.forEach(({ name, mainCode }, i) => {
        const macroNode = related_operational_points[i];
        if (!macroNode) {
          missingMacroNodes.push({
            full_name: name,
            short_name: mainCode,
            labels: [],
            position_x: 0,
            position_y: 0,
            node_location: { type: 'operational_point_reference', operational_point: opRefs[i] },
          });
        } else if (macroNode.full_name !== name) {
          renamedMacroNodes.push({ ...macroNode, full_name: name });
        }
      });

      if (missingMacroNodes.length > 0) {
        await postMacroNodes({
          macroNodeBatchForm: { macro_nodes: missingMacroNodes, scenario_id: scenario.id },
        }).unwrap();
      }
      await Promise.all(
        renamedMacroNodes.map(({ id, ...macroNodeForm }) =>
          putMacroNode({ nodeId: id, macroNodeForm }).unwrap()
        )
      );
    } catch (error) {
      dispatch(setFailure(castErrorToFailure(error)));
    }
  };
}
