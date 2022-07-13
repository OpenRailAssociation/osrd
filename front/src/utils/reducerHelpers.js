import { store } from 'Store';
import { FlyToInterpolator } from 'react-map-gl';

export const dummy = () => {
  console.log('dummy');
};

export const flyTo = (
  longitude, latitude, zoom, updateLocalViewport,
  transitionDuration = 1000, transitionInterpolator = new FlyToInterpolator(),
) => {
  const { map } = store.getState();
  const newViewport = {
    ...map.viewport,
    longitude,
    latitude,
    zoom,
    transitionDuration,
    transitionInterpolator,
  };
  updateLocalViewport(newViewport, transitionDuration);
};
