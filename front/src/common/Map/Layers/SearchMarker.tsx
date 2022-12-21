import React from 'react';
import { Marker } from 'react-map-gl';

import { Theme } from 'types';
import { MapSearchMarker } from 'reducers/map';

interface SearchMarkerProps {
  data: MapSearchMarker;
  colors: Theme;
}

function SearchMarker(props: SearchMarkerProps) {
  const { data, colors } = props;

  return (
    <Marker longitude={data.lonlat[0]} latitude={data.lonlat[1]} anchor='left'>
      <div className="map-search-marker">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
          <circle
            style={{ fill: colors.mapmarker.circle, fillOpacity: '0.5' }}
            cx="16"
            cy="16"
            r="16"
          />
        </svg>
        <span className="map-search-marker-title" style={{ color: colors.mapmarker.text }}>
          {data.title}
        </span>
        {data.subtitle !== null ? (
          <span className="map-search-marker-subtitle" style={{ color: colors.mapmarker.text }}>
            {data.subtitle}
          </span>
        ) : null}
      </div>
    </Marker>
  );
}

export default SearchMarker;
