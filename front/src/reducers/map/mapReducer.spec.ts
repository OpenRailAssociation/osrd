import {
  MapState,
  mapInitialState,
  updateViewportAction,
  updateMapStyle,
  Viewport,
  updateMapSearchMarker,
  updateLineSearchCode,
  updateShowIGNBDORTHO,
  updateShowIGNSCAN25,
  updateShowIGNCadastre,
  updateShowOSM,
  updateShowOSMtracksections,
  updateFeatureInfoClick,
  updateLayersSettings,
  updateTerrain3DExaggeration,
} from 'reducers/map';
import { createStoreWithoutMiddleware } from 'Store';

import { describe, expect } from 'vitest';

const createStore = (initialStateExtra?: MapState) =>
  createStoreWithoutMiddleware({
    map: initialStateExtra,
  });

describe('mapReducer', () => {
  it('should return initial state', () => {
    const store = createStore();
    const mapState = store.getState().map;
    expect(mapState).toEqual(mapInitialState);
  });

  it(`should handle updateViewportAction`, () => {
    const store = createStore();
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
    const store = createStore();
    store.dispatch(updateMapStyle('dark'));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapInitialState, mapStyle: 'dark' });
  });

  it('should handle updateMapSearchMarker', () => {
    const store = createStore();
    const searchMarker = { title: 'test', lonlat: [1, 2] };
    store.dispatch(updateMapSearchMarker(searchMarker));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, mapSearchMarker: searchMarker });
  });

  it('should handle updateLineSearchCode', () => {
    const store = createStore();
    store.dispatch(updateLineSearchCode(0));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, lineSearchCode: 0 });
  });

  it('should handle updateShowIGNBDORTHO', () => {
    const store = createStore();
    store.dispatch(updateShowIGNBDORTHO(true));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, showIGNBDORTHO: true });
  });

  it('should handle updateShowIGNSCAN25', () => {
    const store = createStore();
    store.dispatch(updateShowIGNSCAN25(true));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, showIGNSCAN25: true });
  });

  it('should handle updateShowIGNCadastre', () => {
    const store = createStore();
    store.dispatch(updateShowIGNCadastre(true));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, showIGNCadastre: true });
  });

  it('should handle updateShowOSM', () => {
    const store = createStore();
    store.dispatch(updateShowOSM(true));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, showOSM: true });
  });

  it('should handle updateShowOSMtracksections', () => {
    const store = createStore();
    store.dispatch(updateShowOSMtracksections(true));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, showOSMtracksections: true });
  });

  it('should handle updateFeatureInfoClick', () => {
    const store = createStore();
    store.dispatch(updateFeatureInfoClick(1));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, featureInfoClickID: 1 });
  });

  it('should handle updateLayersSettings', () => {
    const store = createStore();
    const layersSettings = {
      bufferstops: true,
      catenaries: true,
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
    };
    store.dispatch(updateLayersSettings(layersSettings));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, layersSettings });
  });

  it('should handle updateTerrain3DExaggeration', () => {
    const store = createStore();
    store.dispatch(updateTerrain3DExaggeration(10));
    const mapState = store.getState().map;
    expect(mapState).toEqual({ ...mapState, terrain3DExaggeration: 10 });
  });
});
