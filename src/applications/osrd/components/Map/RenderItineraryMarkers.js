import React from 'react';
import { useSelector } from 'react-redux';
import { Marker } from 'react-map-gl';
import nextId from 'react-id-generator';
import originSVG from 'assets/pictures/origin.svg';
import destinationSVG from 'assets/pictures/destination.svg';
import viaSVG from 'assets/pictures/via.svg';

export default function RenderItineraryMarkers() {
  const osrdconf = useSelector((state) => state.osrdconf);

  const markers = [];

  if (osrdconf.origin !== undefined) {
    markers.push(
      <Marker
        longitude={osrdconf.origin.startLonLat[0]}
        latitude={osrdconf.origin.startLonLat[1]}
        offsetLeft={-12}
        offsetTop={-24}
        key={nextId()}
      >
        <img src={originSVG} alt="Origin" style={{ height: '1.5rem' }} />
      </Marker>,
    );
  }
  if (osrdconf.destination !== undefined) {
    markers.push(
      <Marker
        longitude={osrdconf.destination.endLonLat[0]}
        latitude={osrdconf.destination.endLonLat[1]}
        offsetLeft={-12}
        offsetTop={-24}
        key={nextId()}
      >
        <img src={destinationSVG} alt="Destination" style={{ height: '1.5rem' }} />
      </Marker>,
    );
  }
  if (osrdconf.vias.length > 0) {
    osrdconf.vias.forEach((via) => {
      markers.push(
        <Marker
          longitude={via.startLonLat[0]}
          latitude={via.startLonLat[1]}
          offsetLeft={-12}
          offsetTop={-24}
          key={nextId()}
        >
          <img src={viaSVG} alt="Destination" style={{ height: '1.5rem' }} />
        </Marker>,
      );
    });
  }

  return markers.map((marker) => marker);
}
