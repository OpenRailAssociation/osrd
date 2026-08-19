import { addProtocol, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { Protocol } from 'pmtiles';

setWorkerUrl(workerUrl);

const protocol = new Protocol();
addProtocol('pmtiles', protocol.tile);
