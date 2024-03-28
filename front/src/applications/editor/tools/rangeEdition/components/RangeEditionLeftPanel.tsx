import React, { useContext, useEffect, useState } from 'react';

import { cloneDeep } from 'lodash';
import { useTranslation } from 'react-i18next';

import EntityError from 'applications/editor/components/EntityError';
import EditorContext from 'applications/editor/context';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import ElectrificationMetadataForm from 'applications/editor/tools/rangeEdition/electrification/ElectrificationMetadataForm';
import EditPSLSection from 'applications/editor/tools/rangeEdition/speedSection/EditPSLSection';
import SpeedSectionMetadataForm from 'applications/editor/tools/rangeEdition/speedSection/SpeedSectionMetadataForm';
import type {
  ElectrificationEntity,
  RangeEditionState,
  SpeedSectionEntity,
  SpeedSectionPslEntity,
} from 'applications/editor/tools/rangeEdition/types';
import { speedSectionIsPsl } from 'applications/editor/tools/rangeEdition/utils';
import type { ExtendedEditorContextType, PartialOrReducer } from 'applications/editor/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import { useInfraID } from 'common/osrdContext';

import TrackRangesList from './RangeEditionTrackRangeList';
import SwitchList from '../speedSection/SwitchList';

const RangeEditionLeftPanel = () => {
  const { t } = useTranslation();
  const {
    setState,
    state: { entity, initialEntity, trackSectionsCache, selectedSwitches },
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<SpeedSectionEntity | ElectrificationEntity>
  >;

  const [getRouteFromSwitchSelection, setGetRouteFromSwitchSelection] = useState(false);

  const [getRoutesFromSwitch] =
    osrdEditoastApi.endpoints.postInfraByInfraIdRoutesNodes.useMutation();

  const [getTrackRangesByRoutes] =
    osrdEditoastApi.endpoints.getInfraByInfraIdRoutesTrackRanges.useLazyQuery();

  const [switchesRouteCandidates, setSwitchesRouteCandidates] = useState<string[] | null>(null);

  const toggleGetRouteFromSwitchSelection = () => {
    setGetRouteFromSwitchSelection(!getRouteFromSwitchSelection);
    const selectiontype = getRouteFromSwitchSelection ? 'idle' : 'selectSwitch';
    const newEntity = cloneDeep(entity) as SpeedSectionEntity;
    if (newEntity.properties.extensions) {
      newEntity.properties.extensions = undefined;
    }
    setState({
      entity: newEntity,
      interactionState: { type: selectiontype },
      selectedSwitches: [],
    });
  };

  const isNew = entity.properties.id === NEW_ENTITY_ID;
  const isPSL = speedSectionIsPsl(entity as SpeedSectionEntity);
  const infraID = useInfraID();

  const { data: voltages } = osrdEditoastApi.endpoints.getInfraByIdVoltages.useQuery(
    {
      id: infraID as number,
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
    setState({
      selectedSwitches: selectedSwitches.filter((s) => s !== swId),
    });
  };

  const searchRoutesFromSwitch = async () => {
    const body = selectedSwitches.reduce(
      (accumulator, switchId) => ({ ...accumulator, [switchId]: null }),
      {}
    );
    setState({
      optionsState: { type: 'loading' },
    });
    const routeCandidates = await getRoutesFromSwitch({
      infraId: infraID as number,
      body,
    }).unwrap();
    setSwitchesRouteCandidates(routeCandidates);
    setState({
      optionsState: { type: 'idle' },
    });
  };

  const getTrackRangesFromRouteId = async (routeId: string) => {
    const trackRangesResults = await getTrackRangesByRoutes({
      infraId: infraID as number,
      routes: routeId,
    }).unwrap();
    if (trackRangesResults.length && trackRangesResults[0].type === 'Computed') {
      const trackRanges = trackRangesResults[0].track_ranges.map((trackRange) => {
        const { begin, end, track } = trackRange;
        return {
          begin,
          end,
          track,
          applicable_directions: trackRange.direction,
        };
      });
      const newEntity = cloneDeep(entity) as SpeedSectionEntity;
      newEntity.properties.track_ranges = trackRanges;
      setState({
        optionsState: { type: 'idle' },
      });
      setState({
        entity: newEntity,
      });
    }
  };

  useEffect(() => {
    if (switchesRouteCandidates && switchesRouteCandidates.length > 0) {
      getTrackRangesFromRouteId(switchesRouteCandidates[0]);
    }
  }, [switchesRouteCandidates]);

  useEffect(() => {
    if (switchesRouteCandidates && switchesRouteCandidates.length) setSwitchesRouteCandidates(null);
  }, [selectedSwitches]);

  return (
    <div>
      <legend className="mb-4">
        {t(
          `Editor.obj-types.${
            entity.objType === 'SpeedSection' ? 'SpeedSection' : 'Electrification'
          }`
        )}
      </legend>
      {initialEntity.objType === 'SpeedSection' ? (
        <SpeedSectionMetadataForm />
      ) : (
        voltages && <ElectrificationMetadataForm voltages={voltages} />
      )}
      <hr />
      {initialEntity.objType === 'SpeedSection' && (
        <>
          <div>
            {!getRouteFromSwitchSelection && (
              <div className="d-flex">
                <CheckboxRadioSNCF
                  type="checkbox"
                  id="is-psl-checkbox"
                  name="is-psl-checkbox"
                  checked={isPSL}
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
            )}

            {!getRouteFromSwitchSelection && entity.properties.track_ranges?.length === 0 && (
              <p className="mt-3 font-size-1">{t('Editor.tools.speed-edition.toggle-psl-help')}</p>
            )}
            {!isPSL && (
              <div className="d-flex">
                <CheckboxRadioSNCF
                  type="checkbox"
                  id="get-route-from-switch"
                  name="get-route-from-switch"
                  checked={getRouteFromSwitchSelection}
                  label={t('Editor.tools.speed-edition.ralen-30-60')}
                  onChange={toggleGetRouteFromSwitchSelection}
                />
              </div>
            )}
            {!getRouteFromSwitchSelection && isPSL && (
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
        </>
      )}
      {getRouteFromSwitchSelection && (
        <>
          {t('Editor.tools.speed-edition.select-switches-to-get-route')}
          {selectedSwitches.length > 0 && (
            <>
              <SwitchList selectedSwitches={selectedSwitches} unselectSwitch={unselectSwitch} />
              <button
                type="button"
                className="btn btn-primary btn-sm mt-2 mb-2"
                onClick={searchRoutesFromSwitch}
              >
                {t('Editor.tools.speed-edition.search-routes')}
              </button>
              {switchesRouteCandidates && switchesRouteCandidates.length === 0 && (
                <p className="text-muted">
                  {t('Editor.tools.routes-edition.routes', { count: 0 })}
                </p>
              )}
            </>
          )}
          <hr />
        </>
      )}
      {switchesRouteCandidates && switchesRouteCandidates.length > 0 && (
        <div className="my-3">
          <label htmlFor="route-select">{t('Editor.tools.speed-edition.select-route')}</label>
          <select
            name="route-select"
            className="bg-white"
            onChange={(e) => {
              getTrackRangesFromRouteId(e.target.value);
            }}
          >
            {switchesRouteCandidates.map((route) => (
              <option key={route} value={route}>
                {route}
              </option>
            ))}
          </select>
        </div>
      )}

      <TrackRangesList />

      {!isNew && <EntityError className="mt-1" entity={entity} />}
    </div>
  );
};

export default RangeEditionLeftPanel;
