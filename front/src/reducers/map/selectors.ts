import type { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';

import type { MapState } from '.';

export const getMap = (state: RootState) => state.map;

const makeMapStateSelector = makeSubSelector<MapState>(getMap);

export const getUrl = makeMapStateSelector('url');
export const getMapSettings = makeMapStateSelector('mapSettings');
