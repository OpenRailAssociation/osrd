import React, { FC, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Marker } from 'react-map-gl';
import nextId from 'react-id-generator';
import originSVG from 'assets/pictures/origin.svg';
import destinationSVG from 'assets/pictures/destination.svg';
import viaSVG from 'assets/pictures/via.svg';
import { RootState } from 'reducers';

const RenderItineraryMarkers: FC = () => {
  const { origin, destination, vias } = useSelector((state: RootState) => state.osrdconf);
  const markers = useMemo(() => {
    const result = [];
    if (origin !== undefined) {
      result.push(
        <Marker
          longitude={origin.clickLngLat[0]}
          latitude={origin.clickLngLat[1]}
          offset={[0, -12]}
          key={nextId()}
        >
          <img src={originSVG} alt="Origin" style={{ height: '1.5rem' }} />
        </Marker>
      );
    }
    if (destination !== undefined) {
      result.push(
        <Marker
          longitude={destination.clickLngLat[0]}
          latitude={destination.clickLngLat[1]}
          offset={[0, -12]}
          key={nextId()}
        >
          <img src={destinationSVG} alt="Destination" style={{ height: '1.5rem' }} />
        </Marker>
      );
    }
    if (vias.length > 0) {
      vias.forEach((via, idx) => {
        result.push(
          <Marker
            longitude={via.clickLngLat[0]}
            latitude={via.clickLngLat[1]}
            offset={[0, -12]}
            key={nextId()}
          >
            <img src={viaSVG} alt="Destination" style={{ height: '1.5rem' }} />
            <span className="osrd-conf-map-via-number">{idx + 1}</span>
          </Marker>
        );
      });
    }
    return result;
  }, [origin, destination, vias]);

  return <>{markers.map((marker) => marker)}</>;
};

export default RenderItineraryMarkers;
