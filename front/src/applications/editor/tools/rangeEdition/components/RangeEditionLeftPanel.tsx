import React, { useContext, useEffect, useState } from 'react';

import { cloneDeep, isEmpty, last, pick, uniqWith } from 'lodash';
import { useTranslation } from 'react-i18next';

import EntityError from 'applications/editor/components/EntityError';
import EditorContext from 'applications/editor/context';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import ElectrificationMetadataForm from 'applications/editor/tools/rangeEdition/electrification/ElectrificationMetadataForm';
import EditPSLSection from 'applications/editor/tools/rangeEdition/speedSection/EditPSLSection';
import SpeedSectionMetadataForm from 'applications/editor/tools/rangeEdition/speedSection/SpeedSectionMetadataForm';
import type {
  RangeEditionState,
  SpeedSectionEntity,
  SpeedSectionPslEntity,
  AvailableSwitchPositions,
  SwitchPosition,
  ApplicableTrackRange,
} from 'applications/editor/tools/rangeEdition/types';
import {
  compareTrackRange,
  makeSpeedRestrictionTrackRanges,
  makeRouteElements,
  speedSectionIsPsl,
  speedSectionIsSpeedRestriction,
} from 'applications/editor/tools/rangeEdition/utils';
import type { ExtendedEditorContextType, PartialOrReducer } from 'applications/editor/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import { useInfraID } from 'common/osrdContext';
import { isEmptyArray, toggleElement } from 'utils/array';

import TrackRangesList from './RangeEditionTrackRangeList';
import RouteList from './RouteList';
import SwitchList from '../speedSection/SwitchList';

const RangeEditionLeftPanel = () => {
  const { t } = useTranslation();
  const {
    setState,
    state: {
      entity,
      initialEntity,
      trackSectionsCache,
      selectedSwitches,
      highlightedRoutes,
      routeElements,
      routeExtra,
    },
  } = useContext(EditorContext) as ExtendedEditorContextType<RangeEditionState<SpeedSectionEntity>>;

  const [getRoutesFromSwitch] =
    osrdEditoastApi.endpoints.postInfraByInfraIdRoutesNodes.useMutation();

  const [getTrackRangesByRoutes] =
    osrdEditoastApi.endpoints.getInfraByInfraIdRoutesTrackRanges.useLazyQuery();

  const [switchesRouteCandidates, setSwitchesRouteCandidates] = useState<string[]>([]);
  const [availableSwitchesPositions, setAvailableSwitchesPositions] =
    useState<AvailableSwitchPositions>({});

  // The 2 main checkboxes
  const isPermanentSpeedLimit = speedSectionIsPsl(entity as SpeedSectionEntity);
  const isSpeedRestriction = speedSectionIsSpeedRestriction(entity as SpeedSectionEntity);

  const isNew = entity.properties.id === NEW_ENTITY_ID;
  const infraID = useInfraID();
  const entityIsSpeedSection = entity.objType === 'SpeedSection';

  /** Reset both highlighted and selected track_ranges, route ids and switches lists */
  const resetSpeedRestrictionSelections = () => {
    const newEntity = cloneDeep(entity) as SpeedSectionEntity;
    newEntity.properties.on_routes = [];
    newEntity.properties.track_ranges = [];
    setState({
      entity: newEntity,
      selectedSwitches: {},
      routeElements: {},
      highlightedRoutes: [],
    });
  };

  const toggleSpeedRestriction = () => {
    if (isSpeedRestriction) resetSpeedRestrictionSelections();
    const selectiontype = isSpeedRestriction ? 'idle' : 'selectSwitch';
    const newEntity = cloneDeep(entity) as SpeedSectionEntity;
    if (newEntity.properties.extensions) {
      newEntity.properties.extensions = undefined;
    }
    newEntity.properties.track_ranges = [];
    setState({
      isSpeedRestriction: !isSpeedRestriction,
      entity: newEntity,
      interactionState: { type: selectiontype },
    });
  };

  const { data: voltages } = osrdEditoastApi.endpoints.getInfraByInfraIdVoltages.useQuery(
    {
      infraId: infraID as number,
    },
    { skip: !infraID }
  );

  const { data: speedLimitTags } =
    osrdEditoastApi.endpoints.getInfraByInfraIdSpeedLimitTags.useQuery(
      {
        infraId: infraID as number,
      },
      { skip: !infraID }
    );

  const updateSpeedSectionExtensions = (
    extensions: SpeedSectionEntity['properties']['extensions']
  ) => {
    const newEntity = cloneDeep(entity) as SpeedSectionEntity;
    newEntity.properties.extensions = extensions;
    setState({
      entity: newEntity,
    });
  };

  const unselectSwitch = (swId: string) => () => {
    const filteredSelectedSwitches = Object.fromEntries(
      Object.entries(selectedSwitches).filter(([key]) => key !== swId)
    );
    if (isEmptyArray(Object.keys(filteredSelectedSwitches))) resetSpeedRestrictionSelections();
    setState({
      selectedSwitches: filteredSelectedSwitches,
    });
  };

  const handleRouteClicked = (select: boolean) => async (routeId: string) => {
    if (isEmpty(routeElements)) {
      return;
    }
    const newEntity = cloneDeep(entity) as SpeedSectionEntity;
    const { properties } = newEntity;
    if (select) {
      properties.on_routes = toggleElement(properties.on_routes || [], routeId);
      const newRouteExtra = { ...routeExtra };
      const selectedRoutes = pick(routeElements, properties.on_routes);
      const trackRangesBetweenSwitches = Object.values(selectedRoutes).flatMap((els) => {
        const [result, hasExtraTrack] = makeSpeedRestrictionTrackRanges(
          els.trackRanges,
          els.switches,
          selectedSwitches,
          true
        );
        if (hasExtraTrack) {
          newRouteExtra[routeId] = last(result) as ApplicableTrackRange;
        }
        return result;
      });
      properties.track_ranges = uniqWith(trackRangesBetweenSwitches, (a, b) =>
        compareTrackRange(a)(b)
      );
      setState({
        optionsState: { type: 'idle' },
        routeExtra: newRouteExtra,
        entity: newEntity,
        ...(highlightedRoutes.includes(routeId) !== properties.on_routes.includes(routeId) && {
          highlightedRoutes: toggleElement(highlightedRoutes, routeId),
        }),
      });
    } else {
      const newHighlightedRoutes = toggleElement(highlightedRoutes, routeId);
      setState({
        optionsState: { type: 'idle' },
        highlightedRoutes: newHighlightedRoutes,
      });
    }
  };

  const searchRoutesFromSwitch = async () => {
    const body = Object.keys(selectedSwitches).reduce<SwitchPosition>(
      (acc, switchId) => ({ ...acc, [switchId]: selectedSwitches[switchId].position }),
      {}
    );

    setState({
      optionsState: { type: 'loading' },
    });
    const routesAndNodesPositions = await getRoutesFromSwitch({
      infraId: infraID as number,
      body,
    }).unwrap();
    const { routes, available_node_positions } = routesAndNodesPositions;

    const newEntity = cloneDeep(entity) as SpeedSectionEntity;
    newEntity.properties.on_routes = [];
    setState({
      entity: newEntity,
    });

    setSwitchesRouteCandidates(routes);
    setAvailableSwitchesPositions(available_node_positions);
    const trackRangesResults = await getTrackRangesByRoutes({
      infraId: infraID as number,
      routes: routes.join(','),
    }).unwrap();
    const newRouteElements = makeRouteElements(trackRangesResults, routes);
    setState({
      routeElements: newRouteElements,
      optionsState: { type: 'idle' },
      highlightedRoutes: [],
    });
  };

  useEffect(() => {
    if (switchesRouteCandidates.length) {
      handleRouteClicked(true)(switchesRouteCandidates[0]);
    }
  }, [routeElements]);

  useEffect(() => {
    if (isSpeedRestriction && !isEmpty(selectedSwitches)) {
      searchRoutesFromSwitch();
    }
  }, [selectedSwitches]);

  // The 2 main checkboxes
  const permanentSpeedLimitCheckbox = !isSpeedRestriction && (
    <div className="d-flex">
      <CheckboxRadioSNCF
        type="checkbox"
        id="is-psl-checkbox"
        name="is-psl-checkbox"
        checked={isPermanentSpeedLimit}
        disabled={entity.properties.track_ranges?.length === 0}
        label={t('Editor.tools.speed-edition.toggle-psl')}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          let newExtension: SpeedSectionEntity['properties']['extensions'] = {
            psl_sncf: null,
          };
          if (e.target.checked) {
            const firstRange = (entity.properties?.track_ranges || [])[0];
            if (!firstRange) return;
            newExtension = {
              psl_sncf: initialEntity.properties?.extensions?.psl_sncf || {
                announcement: [],
                r: [],
                z: {
                  direction: 'START_TO_STOP',
                  position: firstRange.begin,
                  side: 'LEFT',
                  track: firstRange.track,
                  type: 'Z',
                  value: '',
                  kp: '',
                },
              },
            };
          }
          updateSpeedSectionExtensions(newExtension);
        }}
      />
    </div>
  );
  const speedRestrictionCheckbox = !isPermanentSpeedLimit && (
    <div className="d-flex">
      <CheckboxRadioSNCF
        type="checkbox"
        id="get-route-from-switch"
        name="get-route-from-switch"
        checked={isSpeedRestriction}
        label={t('Editor.tools.speed-edition.ralen-30-60')}
        onChange={toggleSpeedRestriction}
      />
    </div>
  );

  // Entity is Speed Section
  if (entityIsSpeedSection) {
    return (
      <div className="speed-section">
        <legend className="mb-4">{t(`Editor.obj-types.SpeedSection`)}</legend>
        {speedLimitTags && <SpeedSectionMetadataForm speedLimitTags={speedLimitTags} />}
        <hr />
        <div>
          {permanentSpeedLimitCheckbox}
          {!isSpeedRestriction && entity.properties.track_ranges?.length === 0 && (
            <p className="mt-3 font-size-1">{t('Editor.tools.speed-edition.toggle-psl-help')}</p>
          )}
          {speedRestrictionCheckbox}
          {!isSpeedRestriction && isPermanentSpeedLimit && (
            <EditPSLSection
              entity={entity as SpeedSectionPslEntity}
              setState={
                setState as (
                  stateOrReducer: PartialOrReducer<RangeEditionState<SpeedSectionEntity>>
                ) => void
              }
              trackSectionsCache={trackSectionsCache}
            />
          )}
        </div>
        <hr />
        {isSpeedRestriction && (
          <>
            {t('Editor.tools.speed-edition.select-switches-to-get-route')}
            {Object.keys(selectedSwitches).length > 0 && (
              <>
                <SwitchList
                  selectedSwitches={selectedSwitches}
                  unselectSwitch={unselectSwitch}
                  setSwitchSelection={setState}
                  availableSwitchesPositions={availableSwitchesPositions}
                />
                {switchesRouteCandidates.length === 0 && (
                  <p className="text-muted">{t('Editor.tools.routes-edition.routes_zero')}</p>
                )}
              </>
            )}
            <hr />
          </>
        )}
        {switchesRouteCandidates.length > 0 && (
          <RouteList
            switchesRouteCandidates={switchesRouteCandidates}
            onRouteSelect={handleRouteClicked(true)}
            selectedRoutes={entity.properties.on_routes || []}
            onRouteHighlight={handleRouteClicked(false)}
            highlightedRoutes={highlightedRoutes}
          />
        )}
        <TrackRangesList
          withRouteName={switchesRouteCandidates.length > 0}
          speedRestrictionTool={isSpeedRestriction}
        />
        {!isNew && <EntityError className="mt-1" entity={entity} />}
      </div>
    );
  }

  // Entity is electrification
  return (
    <div>
      <legend className="mb-4">{t(`Editor.obj-types.Electrification`)}</legend>
      {voltages && <ElectrificationMetadataForm voltages={voltages} />}
      <hr />
      <TrackRangesList speedRestrictionTool={isSpeedRestriction} />
      {!isNew && <EntityError className="mt-1" entity={entity} />}
    </div>
  );
};

export default RangeEditionLeftPanel;
