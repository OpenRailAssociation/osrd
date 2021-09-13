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
        longitude={osrdconf.origin.clickLngLat[0]}
        latitude={osrdconf.origin.clickLngLat[1]}
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
        longitude={osrdconf.destination.clickLngLat[0]}
        latitude={osrdconf.destination.clickLngLat[1]}
        offsetLeft={-12}
        offsetTop={-24}
        key={nextId()}
      >
        <img src={destinationSVG} alt="Destination" style={{ height: '1.5rem' }} />
      </Marker>,
    );
  }
  if (osrdconf.vias.length > 0) {
    osrdconf.vias.forEach((via, idx) => {
      markers.push(
        <Marker
          longitude={via.clickLngLat[0]}
          latitude={via.clickLngLat[1]}
          offsetLeft={-12}
          offsetTop={-24}
          key={nextId()}
        >
          <img src={viaSVG} alt="Destination" style={{ height: '1.5rem' }} />
          <span className="osrd-conf-map-via-number">{idx + 1}</span>
        </Marker>,
      );
    });
  }

  return markers.map((marker) => marker);
}
