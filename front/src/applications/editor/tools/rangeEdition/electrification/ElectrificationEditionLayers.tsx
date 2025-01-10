import { useContext, useEffect, useMemo } from 'react';

import { featureCollection } from '@turf/helpers';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { mapValues } from 'lodash';
import { useTranslation } from 'react-i18next';
import { Layer, Popup, Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import EntitySumUp from 'applications/editor/components/EntitySumUp';
import EditorContext from 'applications/editor/context';
import { getEntities, getEntity } from 'applications/editor/data/api';
import { flattenEntity } from 'applications/editor/data/utils';
import type {
  ElectrificationEntity,
  RangeEditionState,
  TrackState,
} from 'applications/editor/tools/rangeEdition/types';
import { getTrackRangeFeatures, isOnModeMove } from 'applications/editor/tools/rangeEdition/utils';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import colors from 'common/Map/Consts/colors';
import GeoJSONs, { SourcesDefinitionsIndex } from 'common/Map/Layers/InfraObjectLayers/GeoJSONs';
import { useInfraID } from 'common/osrdContext';
import { getMap } from 'reducers/map/selectors';
import { useAppDispatch } from 'store';

export const ElectrificationEditionLayers = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const {
    editorState: { editorLayers },
    renderingFingerprint,
    state: { entity, trackSectionsCache, hoveredItem, interactionState, mousePosition },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<ElectrificationEntity>
  >;

  const { mapStyle, layersSettings, issuesSettings, showIGNBDORTHO } = useSelector(getMap);

  const infraID = useInfraID();
  const selection = useMemo(() => {
    // Dragging an extremity:
    if (interactionState.type === 'moveRangeExtremity')
      return [(entity.properties.track_ranges || [])[interactionState.rangeIndex].track];

    // Custom hovered element:
    if (hoveredItem?.itemType) return [hoveredItem.track.properties.id];

    return undefined;
  }, [interactionState, hoveredItem, entity]);

  const electrificationsFeature: FeatureCollection = useMemo(() => {
    const flatEntity = flattenEntity(entity);
    // generate trackRangeFeatures
    const trackRanges = entity.properties?.track_ranges || [];
    const trackRangeFeatures = trackRanges.flatMap((range, i) => {
      const trackState = trackSectionsCache[range.track];
      return trackState?.type === 'success'
        ? getTrackRangeFeatures(trackState.track, range, i, flatEntity.properties)
        : [];
    }) as Feature<LineString | Point>[];

    return featureCollection([...trackRangeFeatures]);
  }, [entity, trackSectionsCache]);

  const layersProps = useMemo(() => {
    const context = {
      prefix: mapStyle === 'blueprint' ? 'SCHB ' : '',
      colors: colors[mapStyle],
      signalsList: [],
      symbolsList: [],
      isEmphasized: true,
      showIGNBDORTHO,
      layersSettings,
      issuesSettings,
    };
    return SourcesDefinitionsIndex.electrifications(context, 'rangeEditors/electrifications/');
  }, [mapStyle, showIGNBDORTHO, layersSettings, issuesSettings]);

  // Here is where we handle loading the TrackSections attached to the speed section:
  useEffect(() => {
    const trackIDs = entity.properties?.track_ranges?.map((range) => range.track) || [];
    const missingTrackIDs = trackIDs.filter((id) => !trackSectionsCache[id]);

    if (missingTrackIDs.length) {
      setState((s) => ({
        ...s,
        trackSectionsCache: missingTrackIDs.reduce(
          (iter, id) => ({ ...iter, [id]: { type: 'loading' } }),
          s.trackSectionsCache
        ),
      }));

      getEntities<TrackSectionEntity>(infraID!, missingTrackIDs, 'TrackSection', dispatch).then(
        (res) => {
          setState((s) => ({
            ...s,
            trackSectionsCache: {
              ...s.trackSectionsCache,
              ...mapValues(res, (track) => ({ type: 'success', track }) as TrackState),
            },
          }));
        }
      );
    }
  }, [entity.properties?.track_ranges]);

  // Here is where we load hovered track sections that are not in ranges yet:
  useEffect(() => {
    if (hoveredItem?.type === 'TrackSection' && !trackSectionsCache[hoveredItem.id]) {
      setState((s) => ({
        ...s,
        trackSectionsCache: {
          ...s.trackSectionsCache,
          [hoveredItem.id]: { type: 'loading' },
        },
      }));

      getEntity<TrackSectionEntity>(infraID!, hoveredItem.id, 'TrackSection', dispatch).then(
        (track) => {
          setState((s) => ({
            ...s,
            trackSectionsCache: {
              ...s.trackSectionsCache,
              [hoveredItem.id]: { type: 'success', track },
            },
          }));
        }
      );
    }
  }, [hoveredItem]);

  const popUps = !isOnModeMove(interactionState.type) && (
    <>
      {hoveredItem?.itemType === 'TrackRangeExtremity' && (
        <Popup
          className="popup"
          anchor="bottom"
          longitude={hoveredItem.position[0]}
          latitude={hoveredItem.position[1]}
          closeButton={false}
        >
          <div>{t('Editor.tools.speed-edition.move-range-extremity')}</div>
          <EntitySumUp entity={hoveredItem.track} />
        </Popup>
      )}
      {hoveredItem?.itemType === 'TrackRange' && (
        <Popup
          className="popup"
          anchor="bottom"
          longitude={hoveredItem.position[0]}
          latitude={hoveredItem.position[1]}
          closeButton={false}
        >
          <div>{t('Editor.tools.speed-edition.remove-track-range')}</div>
          <EntitySumUp entity={hoveredItem.track} />
        </Popup>
      )}
      {interactionState.type !== 'moveRangeExtremity' &&
        hoveredItem?.type === 'TrackSection' &&
        !(entity.properties.track_ranges || []).find((range) => range.track === hoveredItem.id) &&
        mousePosition && (
          <Popup
            className="popup"
            anchor="bottom"
            longitude={mousePosition[0]}
            latitude={mousePosition[1]}
            closeButton={false}
          >
            <div>{t('Editor.tools.speed-edition.add-track-range')}</div>
            <EntitySumUp id={hoveredItem.id} objType={hoveredItem.type} />
          </Popup>
        )}
    </>
  );

  return (
    <>
      <GeoJSONs
        colors={colors[mapStyle]}
        layers={editorLayers}
        selection={selection}
        fingerprint={renderingFingerprint}
        layersSettings={layersSettings}
        issuesSettings={issuesSettings}
        isEmphasized={false}
        infraID={infraID}
      />
      <Source type="geojson" data={electrificationsFeature} key="electrifications">
        {layersProps.map((props, i) => (
          <Layer {...props} key={i} />
        ))}
        <Layer
          type="line"
          id="electrification/track-sections"
          paint={{
            'line-dasharray': [3, 3],
            'line-color': '#000000',
            'line-width': 1,
          }}
        />
        <Layer
          type="circle"
          id="electrification/extremities"
          paint={{
            'circle-radius': 4,
            'circle-color': '#fff',
            'circle-stroke-color': '#000000',
            'circle-stroke-width': 2,
          }}
          filter={['has', 'extremity']}
        />
      </Source>
      {popUps}
    </>
  );
};

export const ElectrificationMessages = () => {
  const { t } = useTranslation();
  const { state } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<ElectrificationEntity>
  >;
  if (state.hoveredItem && state.hoveredItem.type === 'TrackSection')
    return t('Editor.tools.electrification-edition.help.add-track', {
      track: state.hoveredItem,
      voltage: state.initialEntity.properties.voltage,
    });

  if (state.hoveredItem && state.hoveredItem.itemType === 'TrackRange')
    return t('Editor.tools.electrification-edition.help.remove-range', {
      range: state.hoveredItem,
      voltage: state.initialEntity.properties.voltage,
    });

  return t('Editor.tools.electrification-edition.help.init');
};
