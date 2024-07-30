import React, { useContext, useEffect, useState } from 'react';

import { cloneDeep, isEmpty, isEqual, last, pick, uniqWith } from 'lodash';
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
  AvailableTrackNodePositions,
  TrackNodePosition,
  ApplicableTrackRange,
} from 'applications/editor/tools/rangeEdition/types';
import {
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

import RouteList from './RouteList';
import TrackRangesList from './TrackRangeList';
import TrackNodeList from '../speedSection/TrackNodeList';

const RangeEditionLeftPanel = () => {
  const { t } = useTranslation();
  const {
    setState,
    state: {
      entity,
      initialEntity,
      trackSectionsCache,
      selectedTrackNodes,
      highlightedRoutes,
      routeElements,
      routeExtra,
    },
  } = useContext(EditorContext) as ExtendedEditorContextType<RangeEditionState<SpeedSectionEntity>>;

  const [getRoutesFromTrackNode] =
    osrdEditoastApi.endpoints.postInfraByInfraIdRoutesNodes.useMutation();

  const [getTrackRangesByRoutes] =
    osrdEditoastApi.endpoints.getInfraByInfraIdRoutesTrackRanges.useLazyQuery();

  const [track_nodesRouteCandidates, setTrackNodesRouteCandidates] = useState<string[]>([]);
  const [availableTrackNodesPositions, setAvailableTrackNodesPositions] =
    useState<AvailableTrackNodePositions>({});

  // The 2 main checkboxes
  const isPermanentSpeedLimit = speedSectionIsPsl(entity as SpeedSectionEntity);
  const isSpeedRestriction = speedSectionIsSpeedRestriction(entity as SpeedSectionEntity);

  const isNew = entity.properties.id === NEW_ENTITY_ID;
  const infraID = useInfraID();
  const entityIsSpeedSection = entity.objType === 'SpeedSection';

  /** Reset both highlighted and selected track_ranges, route ids and track_nodes lists */
  const resetSpeedRestrictionSelections = () => {
    const newEntity = cloneDeep(entity) as SpeedSectionEntity;
    newEntity.properties.on_routes = [];
    newEntity.properties.track_ranges = [];
    setState({
      entity: newEntity,
      selectedTrackNodes: {},
      routeElements: {},
      highlightedRoutes: [],
    });
  };

  const toggleSpeedRestriction = () => {
    const selectiontype = isSpeedRestriction ? 'idle' : 'selectTrackNode';
    const newEntity = cloneDeep(entity) as SpeedSectionEntity;
    newEntity.properties.extensions = undefined;
    newEntity.properties.track_ranges = [];
    if (isSpeedRestriction) {
      newEntity.properties.on_routes = undefined;
    } else {
      newEntity.properties.on_routes = [];
    }
    setState({
      entity: newEntity,
      interactionState: { type: selectiontype },
      ...(isSpeedRestriction && {
        selectedTrackNodes: {},
        routeElements: {},
        highlightedRoutes: [],
      }),
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

  const unselectTrackNode = (swId: string) => () => {
    const filteredSelectedTrackNodes = Object.fromEntries(
      Object.entries(selectedTrackNodes).filter(([key]) => key !== swId)
    );
    if (isEmptyArray(Object.keys(filteredSelectedTrackNodes))) resetSpeedRestrictionSelections();
    setState({
      selectedTrackNodes: filteredSelectedTrackNodes,
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
      const trackRangesBetweenTrackNodes = Object.values(selectedRoutes).flatMap((els) => {
        const { trackRangesWithBothDirections, returnedExtra } = makeSpeedRestrictionTrackRanges(
          els.trackRanges,
          els.track_nodes,
          selectedTrackNodes,
          true
        );
        if (returnedExtra) {
          newRouteExtra[routeId] = last(trackRangesWithBothDirections) as ApplicableTrackRange;
        }
        return trackRangesWithBothDirections;
      });
      properties.track_ranges = uniqWith(trackRangesBetweenTrackNodes, (a, b) => isEqual(a, b));
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

  const searchRoutesFromTrackNode = async () => {
    const body = Object.keys(selectedTrackNodes).reduce<TrackNodePosition>(
      (acc, trackNodeId) => ({ ...acc, [trackNodeId]: selectedTrackNodes[trackNodeId].position }),
      {}
    );

    setState({
      optionsState: { type: 'loading' },
    });
    const routesAndNodesPositions = await getRoutesFromTrackNode({
      infraId: infraID as number,
      body,
    }).unwrap();
    const { routes, available_node_positions } = routesAndNodesPositions;

    const newEntity = cloneDeep(entity) as SpeedSectionEntity;
    if (isSpeedRestriction) {
      newEntity.properties.on_routes = [];
    }
    setState({
      entity: newEntity,
    });

    setTrackNodesRouteCandidates(routes);
    setAvailableTrackNodesPositions(available_node_positions);
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
    if (track_nodesRouteCandidates.length) {
      handleRouteClicked(true)(track_nodesRouteCandidates[0]);
    }
  }, [routeElements]);

  useEffect(() => {
    if (isSpeedRestriction && !isEmpty(selectedTrackNodes)) {
      searchRoutesFromTrackNode();
    }
  }, [selectedTrackNodes]);

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
        id="get-route-from-track-node"
        name="get-route-from-track-node"
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
            {t('Editor.tools.speed-edition.select-track_nodes-to-get-route')}
            {Object.keys(selectedTrackNodes).length > 0 && (
              <>
                <TrackNodeList
                  selectedTrackNodes={selectedTrackNodes}
                  unselectTrackNode={unselectTrackNode}
                  setTrackNodeSelection={setState}
                  availableTrackNodesPositions={availableTrackNodesPositions}
                />
                {track_nodesRouteCandidates.length === 0 && (
                  <p className="text-muted">{t('Editor.tools.routes-edition.routes_zero')}</p>
                )}
              </>
            )}
            <hr />
          </>
        )}
        {track_nodesRouteCandidates.length > 0 && (
          <RouteList
            track_nodesRouteCandidates={track_nodesRouteCandidates}
            onRouteSelect={handleRouteClicked(true)}
            selectedRoutes={entity.properties.on_routes || []}
            onRouteHighlight={handleRouteClicked(false)}
            highlightedRoutes={highlightedRoutes}
          />
        )}
        <TrackRangesList speedRestrictionTool={isSpeedRestriction} />
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
      <TrackRangesList />
      {!isNew && <EntityError className="mt-1" entity={entity} />}
    </div>
  );
};

export default RangeEditionLeftPanel;
