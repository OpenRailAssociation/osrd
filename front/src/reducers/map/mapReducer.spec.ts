import { describe, beforeEach, it, expect } from 'vitest';

import type { MapState, Viewport } from 'reducers/map';
import {
  mapInitialState,
  updateViewportAction,
  updateMapStyle,
  updateMapSearchMarker,
  updateLineSearchCode,
  updateShowIGNBDORTHO,
  updateShowIGNSCAN25,
  updateShowIGNCadastre,
  updateShowOSM,
  updateShowOSM3dBuildings,
  updateShowOSMtracksections,
  updateLayersSettings,
  updateTerrain3DExaggeration,
} from 'reducers/map';
import { createStoreWithoutMiddleware } from 'store';

const createStore = (initialStateExtra?: MapState) =>
  createStoreWithoutMiddleware({
    map: initialStateExtra,
  });

describe('mapReducer', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it('should return initial state', () => {
    const mapState = store.getState().map;
    expect(mapState).toEqual(mapInitialState);
  });

  it(`should handle updateViewportAction`, () => {
    const viewport = {
      latitude: 40,
      longitude: 50,
      zoom: 6.2,
      bearing: 0,
      pitch: 0,
      padding: { top: 0, left: 0, bottom: 0, right: 0 },
      width: 0,
      height: 0,
    } as Partial<Viewport>;
    store.dispatch(updateViewportAction(viewport));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapInitialState, viewport });
  });

  it('should handle updateMapStyle', () => {
    store.dispatch(updateMapStyle('dark'));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapInitialState, mapStyle: 'dark' });
  });

  it('should handle updateMapSearchMarker', () => {
    const searchMarker = { title: 'test', lonlat: [1, 2] };
    store.dispatch(updateMapSearchMarker(searchMarker));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, mapSearchMarker: searchMarker });
  });

  it('should handle updateLineSearchCode', () => {
    store.dispatch(updateLineSearchCode(0));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, lineSearchCode: 0 });
  });

  it('should handle updateShowIGNBDORTHO', () => {
    store.dispatch(updateShowIGNBDORTHO(true));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, showIGNBDORTHO: true });
  });

  it('should handle updateShowIGNSCAN25', () => {
    store.dispatch(updateShowIGNSCAN25(true));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, showIGNSCAN25: true });
  });

  it('should handle updateShowIGNCadastre', () => {
    store.dispatch(updateShowIGNCadastre(true));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, showIGNCadastre: true });
  });

  it('should handle updateShowOSM', () => {
    store.dispatch(updateShowOSM(true));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, showOSM: true });
  });

  it('should handle updateShow3dBuildings', () => {
    store.dispatch(updateShowOSM3dBuildings(true));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, showOSM3dBuildings: true });
  });

  it('should handle updateShowOSMtracksections', () => {
    store.dispatch(updateShowOSMtracksections(true));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, showOSMtracksections: true });
  });

  it('should handle updateLayersSettings', () => {
    const layersSettings = {
      bufferstops: true,
      electrifications: true,
      neutral_sections: true,
      detectors: true,
      operationalpoints: true,
      routes: true,
      signals: false,
      signalingtype: true,
      sncf_psl: true,
      speedlimittag: '60',
      speedlimits: true,
      switches: true,
      tvds: true,
      errors: true,
      platforms: true,
    };
    store.dispatch(updateLayersSettings(layersSettings));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, layersSettings });
  });

  it('should handle updateTerrain3DExaggeration', () => {
    store.dispatch(updateTerrain3DExaggeration(10));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, terrain3DExaggeration: 10 });
  });
});
