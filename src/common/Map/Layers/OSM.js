import React from 'react';
import PropTypes from 'prop-types';
import { Source, Layer } from 'react-map-gl';
import mapStyleJson from 'assets/mapstyles/OSMStyle.json';
import mapStyleDarkJson from 'assets/mapstyles/OSMDarkStyle.json';
import mapStyleBluePrintJson from 'assets/mapstyles/OSMBluePrintStyle.json';
import { OSM_URL } from 'common/Map/const';

const OSM = (props) => {
  const { mapStyle } = props;

  const getMapStyle = () => {
    switch (mapStyle) {
      case 'empty':
        return [];
      case 'dark':
        return mapStyleDarkJson;
      case 'blueprint':
        return mapStyleBluePrintJson;
      default:
        return mapStyleJson;
    }
  };

  const genLayers = () => {
    const osmStyle = getMapStyle();
    return osmStyle.map((layer) => <Layer {...layer} key={layer.id} id={`osm/${layer.id}`} />);
  };

  return (
    <Source
      id="osm"
      type="vector"
      url={OSM_URL}
    >
      {genLayers()}
    </Source>
  );
};

OSM.propTypes = {
  mapStyle: PropTypes.string.isRequired,
};

export default OSM;
