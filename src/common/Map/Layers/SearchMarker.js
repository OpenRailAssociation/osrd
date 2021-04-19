import React, { useContext, useRef } from 'react';
import PropTypes from 'prop-types';
import { MapContext } from 'react-map-gl';

const SearchMarker = (props) => {
  const { data, colors } = props;
  const { viewport } = useContext(MapContext);
  const ref = useRef();
  const [x, y] = viewport.project([data.lonlat[0], data.lonlat[1]]);
  const markerStyle = {
    left: x - 16,
    top: y - 16,
  };

  return (
    <div className="map-search-marker" style={markerStyle} ref={ref}>
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle style={{ fill: '#0088ce', fillOpacity: '0.5' }} cx="16" cy="16" r="16" />
      </svg>
      <span className="map-search-marker-title">{ data.title }</span>
    </div>
  );
};

SearchMarker.propTypes = {
  colors: PropTypes.object.isRequired,
  data: PropTypes.object.isRequired,
};

export default SearchMarker;
