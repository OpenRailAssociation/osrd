import React from 'react';
import { Source } from 'react-map-gl';

export default function Terrain() {
  return (
    <Source
      id="terrain"
      type="raster-dem"
      encoding="terrarium"
      tiles={['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png']}
      tileSize={256}
      maxzoom={12}
    />
  );
}
