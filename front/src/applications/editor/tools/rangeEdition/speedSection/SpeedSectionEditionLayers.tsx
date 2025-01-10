import { useContext, useEffect, useMemo } from 'react';

import { featureCollection } from '@turf/helpers';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { mapValues, pick } from 'lodash';
import { useTranslation } from 'react-i18next';
import { Layer, Popup, Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import EntitySumUp from 'applications/editor/components/EntitySumUp';
import EditorContext from 'applications/editor/context';
import { getEntities, getEntity } from 'applications/editor/data/api';
import { flattenEntity } from 'applications/editor/data/utils';
import type {
  ApplicableTrackRange,
  PslSignFeature,
  RangeEditionState,
  SpeedSectionEntity,
  TrackState,
} from 'applications/editor/tools/rangeEdition/types';
import {
  generatePslSignFeatures,
  getTrackRangeFeatures,
  isOnModeMove,
  speedSectionIsPsl,
  speedSectionIsSpeedRestriction,
} from 'applications/editor/tools/rangeEdition/utils';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import colors from 'common/Map/Consts/colors';
import GeoJSONs, { SourcesDefinitionsIndex } from 'common/Map/Layers/InfraObjectLayers/GeoJSONs';
import { useInfraID } from 'common/osrdContext';
import { getMap } from 'reducers/map/selectors';
import { useAppDispatch } from 'store';

const emptyFeatureCollection = featureCollection([]);

export const SpeedSectionEditionLayers = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const {
    editorState: { editorLayers },
    renderingFingerprint,
    state: {
      entity,
      trackSectionsCache,
      hoveredItem,
      interactionState,
      mousePosition,
      hovered,
      selectedSwitches,
      routeElements,
      highlightedRoutes,
    },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<RangeEditionState<SpeedSectionEntity>>;
  const isPermanentSpeedLimit = speedSectionIsPsl(entity);
  const isSpeedRestriction = speedSectionIsSpeedRestriction(entity);

  const { mapStyle, layersSettings, issuesSettings, showIGNBDORTHO } = useSelector(getMap);
  const infraID = useInfraID();
  const selection = useMemo(() => {
    const res: string[] = [entity.properties.id];

    // Dragging an extremity:
    if (interactionState.type === 'moveRangeExtremity') {
      res.push((entity.properties.track_ranges || [])[interactionState.rangeIndex].track);
    }
    // Custom hovered element:
    else if (hoveredItem?.itemType) {
      res.push(hoveredItem.track.properties.id);
    } else if (interactionState.type === 'selectSwitch') {
      res.push(...Object.keys(selectedSwitches));
    }

    return res;
  }, [interactionState, hoveredItem, entity, selectedSwitches]);

  const extractTrackRangeFeatures = (
    flatEntity: EditorEntity,
    range: ApplicableTrackRange,
    i: number
  ) => {
    const trackState = trackSectionsCache[range.track];
    return (
      trackState?.type === 'success'
        ? getTrackRangeFeatures(trackState.track, range, i, flatEntity.properties)
        : []
    ) as Feature<LineString | Point>[];
  };

  // dashed lines - - - (selected routes tracks in the case of speed restrictions)
  const selectedTracksFeatures = useMemo(() => {
    const flatEntity = flattenEntity(entity);
    // generate trackRangeFeatures
    const trackRanges = isSpeedRestriction
      ? Object.values(pick(routeElements, highlightedRoutes)).flatMap((el) => el.trackRanges)
      : entity.properties?.track_ranges || [];
    const trackRangeFeatures = trackRanges.flatMap((range, i) =>
      extractTrackRangeFeatures(flatEntity, range, i)
    );

    // generate pslSignFeatures
    let pslSignFeatures = [] as PslSignFeature[];
    if (entity.properties?.extensions?.psl_sncf) {
      pslSignFeatures = generatePslSignFeatures(
        entity.properties?.extensions?.psl_sncf,
        trackSectionsCache
      );
    }
    return featureCollection([...trackRangeFeatures, ...pslSignFeatures]);
  }, [entity, highlightedRoutes, trackSectionsCache]);

  // Where the speed limit applies (entity track_ranges)
  const speedSectionsFeature: FeatureCollection = useMemo(() => {
    const flatEntity = flattenEntity(entity);
    // generate trackRangeFeatures
    const trackRanges = entity.properties?.track_ranges || [];
    const trackRangeFeatures = trackRanges.flatMap((range, i) =>
      extractTrackRangeFeatures(flatEntity, range, i)
    );
    return featureCollection(trackRangeFeatures);
  }, [entity, trackSectionsCache]);

  const { speedSectionLayerProps, pslLayerProps } = useMemo(() => {
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
    const speedSectionLayers = SourcesDefinitionsIndex.speed_sections(
      context,
      'speedSectionsEditor/speedSection/'
    );
    const pslLayers = SourcesDefinitionsIndex.psl(context, 'speedSectionsEditor/psl/');
    const pslSignLayers = SourcesDefinitionsIndex.psl_signs(
      context,
      'speedSectionsEditor/psl_signs/'
    );
    return {
      speedSectionLayerProps: speedSectionLayers,
      pslLayerProps: [...pslLayers, ...pslSignLayers],
    };
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
      {hoveredItem?.itemType === 'PSLSign' && (
        <Popup
          className="popup"
          anchor="bottom"
          longitude={hoveredItem.position[0]}
          latitude={hoveredItem.position[1]}
          closeButton={false}
        >
          {t('Editor.tools.speed-edition.hovered-sign', { signType: hoveredItem.signType })}
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
      {mousePosition && hovered && (
        <Popup
          className="popup editor-selection"
          anchor="bottom"
          longitude={mousePosition[0]}
          latitude={mousePosition[1]}
          closeButton={false}
        >
          <EntitySumUp
            key={hovered.id}
            id={hovered.id}
            objType={hovered.type}
            error={hovered.error}
            status="selected"
          />
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
        hidden={entity.properties.id ? [entity.properties.id] : undefined}
        layersSettings={layersSettings}
        issuesSettings={issuesSettings}
        isEmphasized={false}
        infraID={infraID}
      />
      {/* Colored sections where the speed limit actually applies */}
      <Source
        type="geojson"
        data={!isPermanentSpeedLimit ? speedSectionsFeature : emptyFeatureCollection}
        key="speed-section"
      >
        {speedSectionLayerProps.map((props, i) => (
          <Layer {...props} key={i} />
        ))}
      </Source>
      {/* complete routes (dashed) */}
      <Source
        type="geojson"
        data={!isPermanentSpeedLimit ? selectedTracksFeatures : emptyFeatureCollection}
        key="speed-section-full-route"
      >
        <Layer
          type="line"
          id="speed-section/track-sections"
          paint={{
            'line-dasharray': [3, 3],
            'line-color': '#000000',
            'line-width': 1,
          }}
        />
        <Layer
          type="circle"
          id="speed-section/extremities"
          paint={{
            'circle-radius': 4,
            'circle-color': '#fff',
            'circle-stroke-color': '#000000',
            'circle-stroke-width': 2,
          }}
          filter={['has', 'extremity']}
        />
      </Source>
      <Source
        type="geojson"
        data={isPermanentSpeedLimit ? selectedTracksFeatures : emptyFeatureCollection}
        key="psl"
      >
        {pslLayerProps.map((props, i) => (
          <Layer {...props} key={i} />
        ))}
        <Layer
          type="circle"
          id="speed-section/psl/extremities"
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

export const SpeedSectionMessages = () => null;
