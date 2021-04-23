import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import ReactMapGL, { AttributionControl, Popup, ScaleControl } from 'react-map-gl';
import { withTranslation } from 'react-i18next';

import Modal from '../Modal';
import { updateViewport } from 'reducers/map';

import colors from 'common/Map/Consts/colors';
import 'common/Map/Map.scss';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import OSM from 'common/Map/Layers/OSM';
import Hillshade from 'common/Map/Layers/Hillshade';
import Platform from 'common/Map/Layers/Platform';
import GeoJSONs from 'common/Map/Layers/GeoJSONs';
import EditorZone from 'common/Map/Layers/EditorZone';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';

const INTERACTIVE_LAYER_IDS = ['editor/geo-main-layer'];

const SelectItemUnplugged = ({ t }) => {
  const { mapStyle, viewport } = useSelector((state) => state.map);
  const [hovered, setHovered] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const editorState = useSelector((state) => state.editor);
  const { urlLat, urlLon, urlZoom, urlBearing, urlPitch } = useParams();
  const dispatch = useDispatch();
  const updateViewportChange = useCallback((value) => dispatch(updateViewport(value, '/editor')), [
    dispatch,
  ]);

  /* Interactions */
  const getCursor = useCallback((params) => {
    if (params.isDragging) return 'grabbing';
    if (params.isHovering) return 'pointer';
    return 'default';
  }, []);
  const onFeatureClick = useCallback(() => {
    if (hovered) {
      setSelectedFeature(hovered.feature);
    }
  }, [editorState, hovered]);
  const onFeatureHover = useCallback(
    (event) => {
      const feature = event.features[0];

      if (feature) {
        setHovered({
          feature,
          longitude: event.lngLat[0],
          latitude: event.lngLat[1],
        });
      } else {
        setHovered(null);
      }
    },
    [editorState]
  );

  useEffect(() => {
    if (urlLat) {
      updateViewportChange({
        ...viewport,
        latitude: parseFloat(urlLat),
        longitude: parseFloat(urlLon),
        zoom: parseFloat(urlZoom),
        bearing: parseFloat(urlBearing),
        pitch: parseFloat(urlPitch),
      });
    }
  }, []);

  return (
    <>
      <ReactMapGL
        {...viewport}
        width="100%"
        height="100%"
        getCursor={getCursor}
        mapStyle={osmBlankStyle}
        onViewportChange={updateViewportChange}
        attributionControl={false} // Defined below
        clickRadius={4}
        interactiveLayerIds={INTERACTIVE_LAYER_IDS}
        onClick={onFeatureClick}
        onHover={onFeatureHover}
        touchRotate
        asyncRender
      >
        <AttributionControl
          className="attribution-control"
          customAttribution="©SNCF/DGEX Solutions"
        />
        <ScaleControl
          maxWidth={100}
          unit="metric"
          style={{
            left: 20,
            bottom: 20,
          }}
        />

        {/* OSM layers */}
        <Background colors={colors[mapStyle]} />
        <OSM mapStyle={mapStyle} />
        <Hillshade mapStyle={mapStyle} />
        <Platform colors={colors[mapStyle]} />

        {/* Editor layers */}
        <EditorZone />
        <GeoJSONs
          colors={colors[mapStyle]}
          idHover={
            hovered && hovered.feature.layer.id === 'editor/geo-main-layer'
              ? hovered.feature.properties.OP_id
              : undefined
          }
        />

        {/* Popover */}
        {hovered && (
          <Popup
            longitude={hovered.longitude}
            latitude={hovered.latitude}
            closeButton={false}
            offsetTop={-10}
          >
            Layer : {hovered.feature.layer.id}
            <br />
            OP_id : {hovered.feature.properties.OP_id}
          </Popup>
        )}
      </ReactMapGL>

      {/* Selected element modal */}
      {selectedFeature && (
        <Modal onClose={() => setSelectedFeature(null)} title={t('Editor.tools.select-item.focus')}>
          <pre>
            <code>{JSON.stringify(selectedFeature, null, '  ')}</code>
          </pre>
        </Modal>
      )}
    </>
  );
};

const SelectItem = withTranslation()(SelectItemUnplugged);

export default SelectItem;
