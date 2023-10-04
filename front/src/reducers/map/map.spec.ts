import {
  MapState,
  mapInitialState,
  updateViewportAction,
  updateMapStyle,
  Viewport,
  transformMapRequest,
  updateMapSearchMarker,
  updateLineSearchCode,
  updateShowIGNBDORTHO,
  updateShowIGNSCAN25,
  updateShowIGNCadastre,
  updateShowOSM,
  updateShowOSMtracksections,
  updateFeatureInfoClick,
  updateLayersSettings,
  updateSignalsSettings,
  updateTerrain3DExaggeration,
  updateTransformRequest,
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
      transformRequest: transformMapRequest,
    } as Partial<Viewport>;
    store.dispatch(updateViewportAction(viewport));
    expect(store.getState().map.viewport).toEqual(viewport);
  });

  it('should handle updateMapStyle', () => {
    const store = createStore();
    store.dispatch(updateMapStyle('dark'));
    expect(store.getState().map.mapStyle).toEqual('dark');
  });

  it('should handle updateTransformRequest', () => {
    const store = createStore();
    store.dispatch(updateTransformRequest(transformMapRequest));
    expect(store.getState().map.viewport.transformRequest).toEqual(transformMapRequest);
  });

  it('should handle updateMapSearchMarker', () => {
    const store = createStore();
    const searchMarker = { title: 'test', lonlat: [1, 2] };
    store.dispatch(updateMapSearchMarker(searchMarker));
    expect(store.getState().map.mapSearchMarker).toEqual(searchMarker);
  });

  it('should handle updateLineSearchCode', () => {
    const store = createStore();
    store.dispatch(updateLineSearchCode(0));
    expect(store.getState().map.lineSearchCode).toEqual(0);
  });

  it('should handle updateShowIGNBDORTHO', () => {
    const store = createStore();
    store.dispatch(updateShowIGNBDORTHO(true));
    expect(store.getState().map.showIGNBDORTHO).toEqual(true);
  });

  it('should handle updateShowIGNSCAN25', () => {
    const store = createStore();
    store.dispatch(updateShowIGNSCAN25(true));
    expect(store.getState().map.showIGNSCAN25).toEqual(true);
  });

  it('should handle updateShowIGNCadastre', () => {
    const store = createStore();
    store.dispatch(updateShowIGNCadastre(true));
    expect(store.getState().map.showIGNCadastre).toEqual(true);
  });

  it('should handle updateShowOSM', () => {
    const store = createStore();
    store.dispatch(updateShowOSM(true));
    expect(store.getState().map.showOSM).toEqual(true);
  });

  it('should handle updateShowOSMtracksections', () => {
    const store = createStore();
    store.dispatch(updateShowOSMtracksections(true));
    expect(store.getState().map.showOSMtracksections).toEqual(true);
  });

  it('should handle updateFeatureInfoClick', () => {
    const store = createStore();
    store.dispatch(updateFeatureInfoClick(1));
    expect(store.getState().map.featureInfoClickID).toEqual(1);
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
      signalingtype: true,
      sncf_psl: true,
      speedlimittag: '60',
      speedlimits: true,
      switches: true,
      tvds: true,
      errors: true,
    };
    store.dispatch(updateLayersSettings(layersSettings));
    expect(store.getState().map.layersSettings).toEqual(layersSettings);
  });

  it('should handle updateSignalsSettings', () => {
    const store = createStore();
    const signalsSettings = {
      all: true,
      stops: true,
      lights: true,
      tivs: true,
    };
    store.dispatch(updateSignalsSettings(signalsSettings));
    expect(store.getState().map.signalsSettings).toEqual(signalsSettings);
  });

  it('should handle updateTerrain3DExaggeration', () => {
    const store = createStore();
    store.dispatch(updateTerrain3DExaggeration(10));
    expect(store.getState().map.terrain3DExaggeration).toEqual(10);
  });
});
