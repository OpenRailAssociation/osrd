import { OsrdConfState } from 'applications/operationalStudies/consts';
import { createStoreWithoutMiddleware } from 'Store';
import {
  initialState,
  updateOriginTime,
  updateOriginUpperBoundTime,
  toggleOriginLinkedBounds,
} from '../osrdconf';

const createStore = (initialStateExtra?: Partial<OsrdConfState>) =>
  createStoreWithoutMiddleware({ osrdconf: { ...initialState, ...initialStateExtra } });

describe('osrdconfReducer', () => {
  describe('updateOriginTime', () => {
    it('should update only itself if not linked', () => {
      const store = createStore({
        originLinkedBounds: false,
        originTime: '11:00:00',
        originUpperBoundTime: '15:30:00',
      });

      const action = updateOriginTime('08:00:00');
      store.dispatch(action);

      const state = store.getState();
      expect(state.osrdconf.originTime).toEqual('08:00:00');
      expect(state.osrdconf.originUpperBoundTime).toEqual('15:30:00');
    });
    it('should update originUpperBoundTime if linked, and keep the difference between the two', () => {
      const store = createStore({
        originLinkedBounds: true,
        originTime: '11:00:00',
        originUpperBoundTime: '15:30:00',
      });

      const action = updateOriginTime('08:00:00');
      store.dispatch(action);

      const state = store.getState();
      expect(state.osrdconf.originTime).toEqual('08:00:00');
      expect(state.osrdconf.originUpperBoundTime).toEqual('12:30:00');
    });
    it('should use the default difference when originTime is not defined', () => {
      const store = createStore({
        originLinkedBounds: true,
        originUpperBoundTime: '15:30:00',
      });

      const action = updateOriginTime('08:00:00');
      store.dispatch(action);

      const state = store.getState();
      expect(state.osrdconf.originTime).toEqual('08:00:00');
      expect(state.osrdconf.originUpperBoundTime).toEqual('10:00:00');
    });
    it('should use the default difference when originUpperBoundTime is not defined', () => {
      const store = createStore({
        originLinkedBounds: true,
        originTime: '10:00:00',
      });

      const action = updateOriginTime('08:00:00');
      store.dispatch(action);

      const state = store.getState();
      expect(state.osrdconf.originTime).toEqual('08:00:00');
      expect(state.osrdconf.originUpperBoundTime).toEqual('10:00:00');
    });
    test('lower bound should not go above upper bound when unlinked', () => {
      const store = createStore({
        originLinkedBounds: false,
        originTime: '10:00:00',
        originUpperBoundTime: '12:00:00',
      });

      const action = updateOriginTime('13:00:00');
      store.dispatch(action);

      const state = store.getState();
      expect(state.osrdconf.originTime).toEqual('12:00:00');
      expect(state.osrdconf.originUpperBoundTime).toEqual('12:00:00');
    });
  });
  describe('updateOriginUpperBoundTime', () => {
    it('should update only itself if not linked', () => {
      const store = createStore({
        originLinkedBounds: false,
        originTime: '11:00:00',
        originUpperBoundTime: '15:30:00',
      });

      const action = updateOriginUpperBoundTime('20:00:00');
      store.dispatch(action);

      const state = store.getState();
      expect(state.osrdconf.originTime).toEqual('11:00:00');
      expect(state.osrdconf.originUpperBoundTime).toEqual('20:00:00');
    });
    it('should update originTime if linked, keeping the current difference between the two', () => {
      const store = createStore({
        originLinkedBounds: true,
        originTime: '11:00:00',
        originUpperBoundTime: '14:00:00',
      });

      const action = updateOriginUpperBoundTime('20:00:00');
      store.dispatch(action);

      const state = store.getState();
      expect(state.osrdconf.originTime).toEqual('17:00:00');
      expect(state.osrdconf.originUpperBoundTime).toEqual('20:00:00');
    });
    it('should use default difference if originTime not defined', () => {
      const store = createStore({
        originLinkedBounds: true,
        originUpperBoundTime: '14:00:00',
      });

      const action = updateOriginUpperBoundTime('20:00:00');
      store.dispatch(action);

      const state = store.getState();
      expect(state.osrdconf.originTime).toEqual('18:00:00');
      expect(state.osrdconf.originUpperBoundTime).toEqual('20:00:00');
    });
    it('should use default difference if originUpperBoundTime not defined', () => {
      const store = createStore({
        originLinkedBounds: true,
        originTime: '14:00:00',
      });

      const action = updateOriginUpperBoundTime('20:00:00');
      store.dispatch(action);

      const state = store.getState();
      expect(state.osrdconf.originTime).toEqual('18:00:00');
      expect(state.osrdconf.originUpperBoundTime).toEqual('20:00:00');
    });
    test('upper bound should not go below lower bonud when unlinked', () => {
      const store = createStore({
        originLinkedBounds: false,
        originTime: '14:00:00',
        originUpperBoundTime: '18:00:00',
      });

      const action = updateOriginUpperBoundTime('12:00:00');
      store.dispatch(action);

      const state = store.getState();
      expect(state.osrdconf.originTime).toEqual('14:00:00');
      expect(state.osrdconf.originUpperBoundTime).toEqual('14:00:00');
    });
  });
  describe('toggleOriginLinkedBounds', () => {
    it('should set to false if true', () => {
      const store = createStore();
      const action = toggleOriginLinkedBounds();
      store.dispatch(action);

      const state = store.getState();
      expect(state.osrdconf.originLinkedBounds).toEqual(false);
    });
    it('should set to true if false', () => {
      const store = createStore({ originLinkedBounds: false });
      const action = toggleOriginLinkedBounds();
      store.dispatch(action);

      const state = store.getState();
      expect(state.osrdconf.originLinkedBounds).toEqual(true);
    });
  });
});
