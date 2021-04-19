import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import { withTranslation } from 'react-i18next';
import ReactMapGL, { AttributionControl, Layer, ScaleControl, Source } from 'react-map-gl';
import { isEqual } from 'lodash';
import { v1 } from 'uuid';

import { createLine } from 'reducers/editor';
import { updateViewport } from 'reducers/map';
import { getLineGeoJSON } from 'utils/helpers';
import { KeyDownMapController } from 'utils/mapboxHelper';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';
import Modal from '../Modal';

import colors from 'common/Map/Consts/colors';
import 'common/Map/Map.scss';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import OSM from 'common/Map/Layers/OSM';
import Hillshade from 'common/Map/Layers/Hillshade';
import Platform from 'common/Map/Layers/Platform';
import GeoJSONs from 'common/Map/Layers/GeoJSONs';
import EditorZone from 'common/Map/Layers/EditorZone';

const NEW_LINE_STYLE = {
  type: 'line',
  paint: {
    'line-color': '#000000',
  },
};

const LAST_LINE_STYLE = {
  type: 'line',
  paint: {
    'line-color': '#000000',
    'line-dasharray': [3, 3],
  },
};

function getFakeProperties() {
  return {
    default_id: 9999,
    id_lrs: 9999,
    OP_id_poste: '(OP_id_poste) Lorem ipsum',
    OP_id_nyx_gare_G_postesId: 9999,
    OP_id_gare: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
    RA_libelle: '(RA_libelle) Lorem ipsum',
    extremites: [
      {
        OP_id: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        V_nom: 'V1',
        id_pk: 9999,
        L_code: '9999',
        pk_sncf: 'abc+def',
        OP_id_voie: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        RLJDZ_sens: 'C',
        OP_id_ligne: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        P_pkInterne: 9999,
        OP_id_localisation: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        OP_id_localisationpk: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        OP_id_relationjointdezone: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        OP_id_tronconditineraireofpk: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        OP_id_tronconditinerairevoie: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        OP_id_relationlocalisationjdz: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        id_circuitdevoie_CDV_extremites: 9999,
        id_localisation_L_localisationPk: 9999,
        id_relationjointdezone_RJDZ_localisations: 9999,
        id_installationfixelocalisee_IFL_localisations: 9999,
      },
      {
        OP_id: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        V_nom: 'V1',
        id_pk: 9999,
        L_code: '9999',
        pk_sncf: 'abc+def',
        OP_id_voie: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        RLJDZ_sens: 'C',
        OP_id_ligne: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        P_pkInterne: 9999,
        OP_id_localisation: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        OP_id_localisationpk: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        OP_id_relationjointdezone: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        OP_id_tronconditineraireofpk: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        OP_id_tronconditinerairevoie: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        OP_id_relationlocalisationjdz: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        id_circuitdevoie_CDV_extremites: 9999,
        id_localisation_L_localisationPk: 9999,
        id_relationjointdezone_RJDZ_localisations: 9999,
        id_installationfixelocalisee_IFL_localisations: 9999,
      },
    ],
    RA_libelle_poste: '(RA_libelle_poste) Lorem ipsum',
    RA_libelle_gare: '(RA_libelle_gare) Lorem ipsum',
    isVerifie: [],
    isReverifie: [],
    isValidSch: true,
    isValidGeo: true,
    flagInvalidSch: '0000000',
    flagInvalidGeo: '0000000',
    OP_id: v1(), //'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
    isGeomSchFromLRS: false,
    isGeomGeoFromLRS: false,
    extremites_agg: null,
    OP_id_poste_metier: null,
    RA_libelle_poste_metier: null,
    table_responsable: null,
    last_midi_update: new Date().toISOString(),
  };
}

const CreateLineUnplugged = ({ t }) => {
  const { mapStyle, viewport } = useSelector((state) => state.map);
  const { urlLat, urlLon, urlZoom, urlBearing, urlPitch } = useParams();
  const dispatch = useDispatch();
  const updateViewportChange = useCallback((value) => dispatch(updateViewport(value, '/editor')), [
    dispatch,
  ]);

  const [state, setState] = useState({
    points: [],
    mousePoint: null,
    propertiesString: null,
    modal: false,
  });
  const { points, mousePoint, modal, propertiesString } = state;
  let isConfirmEnabled = true;

  try {
    JSON.parse(propertiesString);
  } catch (e) {
    isConfirmEnabled = false;
  }

  /* Actions */
  const actionCreateLine = useCallback(() => {
    dispatch(createLine(points, JSON.parse(propertiesString)));
    setState({ ...state, points: [], modal: false });
  }, [points, state]);
  const actionOpenModal = useCallback(() => {
    setState({
      ...state,
      modal: true,
      propertiesString: JSON.stringify(getFakeProperties(), null, '  '),
    });
  }, [state]);

  /* Interactions */
  const getCursor = (params) => (params.isDragging ? 'grabbing' : 'crosshair');
  const onClick = useCallback(
    (event) => {
      const point = event.lngLat;
      if (isEqual(point, points[points.length - 1]) && points.length > 1) {
        actionOpenModal();
      } else {
        setState({ ...state, points: points.concat([point]), mousePoint: point });
      }
    },
    [state]
  );
  const onMove = (event) => {
    setState({ ...state, mousePoint: event.lngLat });
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      setState({ ...state, points: [] });
    } else if (event.key === 'Backspace' && points.length) {
      setState({ ...state, points: points.slice(0, -1) });
    } else if (event.key === 'Enter' && points.length > 1) {
      actionOpenModal();
    }
  };

  /* Custom controller for keyboard handling */
  const [mapController] = useState(new KeyDownMapController(onKeyDown));

  useEffect(() => {
    mapController.setHandler(onKeyDown);
  }, [onKeyDown]);

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
        attributionControl={false}
        onClick={onClick}
        onMouseMove={onMove}
        controller={mapController}
        doubleClickZoom={false}
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
        <GeoJSONs colors={colors[mapStyle]} />

        {points.length > 1 ? (
          <Source type="geojson" data={getLineGeoJSON(points)}>
            <Layer {...NEW_LINE_STYLE} />
          </Source>
        ) : null}
        {points.length && (
          <Source type="geojson" data={getLineGeoJSON([points[points.length - 1], mousePoint])}>
            <Layer {...LAST_LINE_STYLE} />
          </Source>
        )}
      </ReactMapGL>

      {/* Metadata edition */}
      {modal && (
        <Modal onClose={() => setState({ ...state, modal: false })} title="Création d'une ligne">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              actionCreateLine();
            }}
          >
            <div className="form-group">
              <label htmlFor="new-line-properties">Propriétés de la nouvelle ligne :</label>
              <div className="form-control-container">
                <textarea
                  id="new-line-properties"
                  className="form-control "
                  value={propertiesString}
                  onChange={(e) => setState({ ...state, propertiesString: e.target.value })}
                />
              </div>
            </div>
            <div className="text-right">
              <button type="submit" className="btn btn-primary" disabled={!isConfirmEnabled}>
                {t('common.confirm')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

const CreateLine = withTranslation()(CreateLineUnplugged);

export default CreateLine;
