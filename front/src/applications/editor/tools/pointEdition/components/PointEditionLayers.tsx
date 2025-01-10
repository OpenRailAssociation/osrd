import { useContext, useMemo, useState } from 'react';

import { featureCollection } from '@turf/helpers';
import { isEqual } from 'lodash';
import type { Map } from 'maplibre-gl';
import { Popup } from 'react-map-gl/dist/esm/exports-maplibre';
import { useSelector } from 'react-redux';

import EntitySumUp from 'applications/editor/components/EntitySumUp';
import EditorContext from 'applications/editor/context';
import { NEW_ENTITY_ID, cleanSymbolType, flattenEntity } from 'applications/editor/data/utils';
import { POINT_LAYER_ID } from 'applications/editor/tools/pointEdition/consts';
import type { PointEditionState } from 'applications/editor/tools/pointEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import colors from 'common/Map/Consts/colors';
import GeoJSONs, {
  EditorSource,
  SourcesDefinitionsIndex,
} from 'common/Map/Layers/InfraObjectLayers/GeoJSONs';
import { useInfraID } from 'common/osrdContext';
import { getMap } from 'reducers/map/selectors';
import { NULL_GEOMETRY } from 'types';

interface BasePointEditionLayersProps {
  // eslint-disable-next-line react/no-unused-prop-types
  map: Map;
  mergeEntityWithNearestPoint?: (
    entity: EditorEntity,
    nearestPoint: NonNullable<PointEditionState<EditorEntity>['nearestPoint']>
  ) => EditorEntity;
  interactiveLayerIDRegex?: RegExp;
}

export const BasePointEditionLayers = ({
  mergeEntityWithNearestPoint,
  interactiveLayerIDRegex,
}: BasePointEditionLayersProps) => {
  const infraID = useInfraID();
  const {
    renderingFingerprint,
    state: { nearestPoint, mousePosition, entity, objType },
    editorState: { editorLayers },
  } = useContext(EditorContext) as ExtendedEditorContextType<PointEditionState<EditorEntity>>;
  const { mapStyle, layersSettings, issuesSettings } = useSelector(getMap);

  const [showPopup, setShowPopup] = useState(true);

  const renderedEntity = useMemo(() => {
    let res: EditorEntity | null = null;
    if (entity.geometry && !isEqual(entity.geometry, NULL_GEOMETRY)) {
      res = entity;
    } else if (nearestPoint) {
      if (mergeEntityWithNearestPoint) {
        res = mergeEntityWithNearestPoint(entity, nearestPoint);
      } else {
        res = {
          ...entity,
          geometry: nearestPoint.feature.geometry,
          properties: entity.properties,
        };
      }
    } else if (mousePosition) {
      res = { ...entity, geometry: { type: 'Point', coordinates: mousePosition } };
    }

    return res;
  }, [entity, mergeEntityWithNearestPoint, mousePosition, nearestPoint]);

  const flatRenderedEntity = useMemo(
    () => (renderedEntity ? flattenEntity(renderedEntity) : null),
    [renderedEntity]
  );

  const type = cleanSymbolType((entity.properties || {}).extensions?.sncf?.installation_type || '');
  const layers = useMemo(
    () =>
      SourcesDefinitionsIndex[objType](
        {
          prefix: '',
          colors: colors[mapStyle],
          isEmphasized: true,
          showIGNBDORTHO: false,
          layersSettings,
          issuesSettings,
        },
        `editor/${objType}/`
      ).map((layer) =>
        // Quick hack to keep a proper interactive layer:
        layer?.id?.match(interactiveLayerIDRegex || /-main$/)
          ? { ...layer, id: POINT_LAYER_ID }
          : layer
      ),
    [interactiveLayerIDRegex, mapStyle, objType, type, layersSettings, issuesSettings]
  );

  return (
    <>
      {/* Editor data layer */}
      <GeoJSONs
        colors={colors[mapStyle]}
        hidden={entity.properties.id !== NEW_ENTITY_ID ? [entity.properties.id] : undefined}
        layers={editorLayers}
        fingerprint={renderingFingerprint}
        layersSettings={layersSettings}
        issuesSettings={issuesSettings}
        infraID={infraID}
      />

      {/* Edited entity */}
      <EditorSource layers={layers} data={flatRenderedEntity || featureCollection([])} />
      {showPopup && renderedEntity && renderedEntity.geometry.type === 'Point' && (
        <Popup
          className="popup py-2"
          anchor="bottom"
          longitude={renderedEntity.geometry.coordinates[0]}
          latitude={renderedEntity.geometry.coordinates[1]}
          onClose={() => setShowPopup(false)}
        >
          <EntitySumUp entity={renderedEntity} status="edited" />
        </Popup>
      )}
    </>
  );
};

export const SignalEditionLayers = ({ map }: { map: Map }) => (
  <BasePointEditionLayers
    map={map}
    interactiveLayerIDRegex={/signal-point$/}
    mergeEntityWithNearestPoint={(entity, nearestPoint) => ({
      ...entity,
      geometry: nearestPoint.feature.geometry,
      properties: entity.properties,
    })}
  />
);
