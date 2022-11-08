import {
  initialState,
  updateOriginTime,
} from '../osrdconf';
import { OsrdConfState } from 'applications/osrd/consts';
import { createStoreWithoutMiddleware } from 'Store'

const createStore = (initialStateExtra?: Partial<OsrdConfState>) => createStoreWithoutMiddleware({ osrdconf: { ...initialState, ...initialStateExtra } })

describe('osrdconfReducer', () => {
  describe('updateOriginTime, depending on current state of originTime and originUpperboundTime', () => {
    it('should update originUpperBoundTime with +2h if both are empty', () => {
      const store = createStore();
      const newTime = '11:00:00';
      const action = updateOriginTime(newTime)
      store.dispatch(action);

      const expectedUpperBound = '13:00:00';
      const state = store.getState();
      expect(state.osrdconf.originTime).toEqual(newTime)
      expect(state.osrdconf.originUpperBoundTime).toEqual(expectedUpperBound)
    })
    it('should update originUpperBoundTime with +2h if originUpperBoundTime is empty', () => {
      const store = createStore({ originTime: '09:00:00' });
      const newTime = '12:00:00';
      const action = updateOriginTime(newTime)
      store.dispatch(action);

      const expectedUpperBound = '14:00:00';
      const state = store.getState();
      expect(state.osrdconf.originTime).toEqual(newTime)
      expect(state.osrdconf.originUpperBoundTime).toEqual(expectedUpperBound)
    })
    it('should not touch originUpperBoundTime if defined and originTime empty', () => {
      const originUpperBoundTime = '14:00:00';
      const store = createStore({ originUpperBoundTime });
      const newTime = '11:00:00';
      const action = updateOriginTime(newTime)
      store.dispatch(action);

      const state = store.getState();
      expect(state.osrdconf.originTime).toEqual(newTime)
      expect(state.osrdconf.originUpperBoundTime).toEqual(originUpperBoundTime)
    })
    it('should update originUpperBoundTime with +2h if difference is 2h', () => {
      const store = createStore({ originTime: '10:00:00', originUpperBoundTime: '12:00:00' });
      const newTime = '11:00:00';
      const action = updateOriginTime(newTime)
      store.dispatch(action);

      const expectedUpperBound = '13:00:00';
      const state = store.getState();
      expect(state.osrdconf.originTime).toEqual(newTime)
      expect(state.osrdconf.originUpperBoundTime).toEqual(expectedUpperBound)
    })
    it('should not go beyond midnight', () => {
      const store = createStore({ originTime: '10:00:00', originUpperBoundTime: '12:00:00' });
      const newTime = '23:00:00';
      const action = updateOriginTime(newTime)
      store.dispatch(action);

      const expectedUpperBound = '23:59:59';
      const state = store.getState();
      expect(state.osrdconf.originTime).toEqual(newTime)
      expect(state.osrdconf.originUpperBoundTime).toEqual(expectedUpperBound)
    })
  });
});