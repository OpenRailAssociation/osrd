import React from 'react';
import * as d3 from 'd3';
import { GoVideo } from 'react-icons/go';
import { MapRef } from 'react-map-gl/maplibre';

type MapSearchProps = {
  map?: MapRef;
};

const animation = [
  '48.6728/2.3937/12.4703/0/0',
  '48.6728/2.3937/12.4703/0/0',
  '48.7399/2.4393/14.4744/-19.2/0/8000',
  '48.7525/2.4434/16.3838/-12.8/42.5/4000',
  '48.7692/2.4394/16.3838/-12.8/42.5/4000',
  '48.7801/2.4344/17.3858/-16.8/72',
  '48.8091/2.4235/17.3858/-16.8/72/8000',
  '48.8228/2.4087/17.3858/-40.8/71.5',
  '48.8408/2.381/17.3858/-57.6/72',
  '48.8416/2.3757/15.7157/-44.8/0'
];

export default function AnimateCamera({ map }: MapSearchProps) {
  function animationStep(cameraPosition: string, durationDefault: number) {
    if (map) {
      const [lat, lng, zoom, bearing, pitch, duration = durationDefault] = cameraPosition
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
        easing: (x) => x,
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
      <button
        type="button"
        className="btn-rounded btn-rounded-white"
        onClick={() => launchAnimation()}
      >
        <span className="sr-only">Reset north</span>
        <GoVideo />
      </button>
    </div>
  );
}
