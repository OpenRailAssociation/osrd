import { describe, beforeEach, it, expect } from 'vitest';

import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import { mapInitialState, mapSlice } from 'reducers/map';
import { createStoreWithoutMiddleware } from 'store';

const createStore = (initialMapSettingsExtra?: Partial<MapSettings>) =>
  createStoreWithoutMiddleware({
    map: {
      ...mapInitialState,
      mapSettings: { ...mapInitialState.mapSettings, ...initialMapSettingsExtra },
    },
  });

describe('mapReducer', () => {
  let store: ReturnType<typeof createStore>;
  const { updateMapSettings, updateLayersSettings, updateViewport } = mapSlice.actions;

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
    store.dispatch(updateViewport(viewport));
    const mapState = store.getState().map;
    expect(mapState).toEqual({
      ...mapInitialState,
      mapSettings: { ...mapInitialState.mapSettings, viewport },
    });
  });

  it('should handle updateMapStyle', () => {
    store.dispatch(updateMapSettings({ mapStyle: 'dark' }));
    const mapState = store.getState().map;
    expect(mapState).toEqual({
      ...mapInitialState,
      mapSettings: {
        ...mapInitialState.mapSettings,
        mapStyle: 'dark',
      },
    });
  });

  it('should handle updateMapSearchMarker', () => {
    const searchMarker = { title: 'test', lonlat: [1, 2] };
    store.dispatch(updateMapSettings({ mapSearchMarker: searchMarker }));
    const mapState = store.getState().map;
    expect(mapState).toEqual({
      ...mapState,
      mapSettings: { ...mapInitialState.mapSettings, mapSearchMarker: searchMarker },
    });
  });

  it('should handle updateLineSearchCode', () => {
    store.dispatch(updateMapSettings({ lineSearchCode: 0 }));
    const mapState = store.getState().map;
    expect(mapState).toEqual({
      ...mapState,
      mapSettings: { ...mapInitialState.mapSettings, lineSearchCode: 0 },
    });
  });

  it('should handle updateShowIGNBDORTHO', () => {
    store.dispatch(updateMapSettings({ showIGNBDORTHO: true }));
    const mapState = store.getState().map;
    expect(mapState).toEqual({
      ...mapState,
      mapSettings: { ...mapInitialState.mapSettings, showIGNBDORTHO: true },
    });
  });

  it('should handle updateShowIGNSCAN25', () => {
    store.dispatch(updateMapSettings({ showIGNSCAN25: true }));
    const mapState = store.getState().map;
    expect(mapState).toEqual({
      ...mapState,
      mapSettings: { ...mapInitialState.mapSettings, showIGNSCAN25: true },
    });
  });

  it('should handle updateShowIGNCadastre', () => {
    store.dispatch(updateMapSettings({ showIGNCadastre: true }));
    const mapState = store.getState().map;
    expect(mapState).toEqual({
      ...mapState,
      mapSettings: { ...mapInitialState.mapSettings, showIGNCadastre: true },
    });
  });

  it('should handle updateShowOSM', () => {
    store.dispatch(updateMapSettings({ showOSM: true }));
    const mapState = store.getState().map;
    expect(mapState).toEqual({
      ...mapState,
      mapSettings: { ...mapInitialState.mapSettings, showOSM: true },
    });
  });

  it('should handle updateShow3dBuildings', () => {
    store.dispatch(updateMapSettings({ showOSM3dBuildings: true }));
    const mapState = store.getState().map;
    expect(mapState).toEqual({
      ...mapState,
      mapSettings: { ...mapInitialState.mapSettings, showOSM3dBuildings: true },
    });
  });

  it('should handle updateShowOSMtracksections', () => {
    store.dispatch(updateMapSettings({ showOSMtracksections: true }));
    const mapState = store.getState().map;
    expect(mapState).toEqual({
      ...mapState,
      mapSettings: { ...mapInitialState.mapSettings, showOSMtracksections: true },
    });
  });

  it('should handle updateLayersSettings', () => {
    const layersSettings = {
      buffer_stops: true,
      electrifications: true,
      neutral_sections: true,
      detectors: true,
      operational_points: true,
      routes: true,
      signals: false,
      sncf_psl: true,
      speedlimittag: '60',
      speed_limits: true,
      switches: true,
      tvds: true,
      errors: true,
      platforms: true,
    };
    store.dispatch(updateLayersSettings(layersSettings));
    const mapState = store.getState().map;
    expect(mapState).toEqual({
      ...mapState,
      mapSettings: { ...mapInitialState.mapSettings, layersSettings },
    });
  });

  it('should handle updateTerrain3DExaggeration', () => {
    store.dispatch(updateMapSettings({ terrain3DExaggeration: 10 }));
    const mapState = store.getState().map;
    expect(mapState).toEqual({
      ...mapState,
      mapSettings: { ...mapInitialState.mapSettings, terrain3DExaggeration: 10 },
    });
  });
});
