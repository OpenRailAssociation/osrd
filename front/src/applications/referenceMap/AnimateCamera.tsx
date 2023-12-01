import React from 'react';
import * as d3 from 'd3';
import { GoVideo } from 'react-icons/go';
import { MapRef } from 'react-map-gl/maplibre';

type MapSearchProps = {
  map?: MapRef;
};

const animation = [
  '45.6163/5.8854/15.1412/150.1267/0/1',
  '45.6163/5.8854/15.1412/150.1267/0/4000',
  '45.5685/5.9232/15.16/148.5267/60/16000 easeQuadIn',
  // '45.5748/5.9274/15.3589/37.2121/81.9043/16000 easeCubicOut',
  '45.5865/5.9256/14.8384/0/81.9043/17000 easeSinOut',
];

export default function AnimateCamera({ map }: MapSearchProps) {
  function animationStep(cameraPosition: string, durationDefault: number) {
    if (map) {
      const [coordinates, easing = 'easeLinear' as any] = cameraPosition.split(' ');
      const [lat, lng, zoom, bearing, pitch, duration = durationDefault] = coordinates
        .split('/')
        .map((number) => +number);
      map.easeTo({
        center: {
          lat,
          lng,
        },
        zoom,
        bearing,
        pitch,
        essential: true,
        freezeElevation: true,
        easing: (x) => d3[easing](x),
        duration,
      });
    }
    return new Promise((resolve) => {
      if (map) map.once('moveend', resolve);
    });
  }

  async function launchAnimation() {
    await animation.reduce(async (promiseChain, step, idx) => {
      await promiseChain;
      await animationStep(step, idx === 0 ? 1 : 4000);
    }, Promise.resolve());
  }

  return (
    <div className="btn-map-animate">
      <button type="button" className="btn-rounded btn-rounded-white" onClick={launchAnimation}>
        <GoVideo />
      </button>
    </div>
  );
}
