import { store } from 'Store';
import {
  updateOriginTime as updateOriginTimeRedux,
  updateDestinationTime as updateDestinationTimeRedux,
  updateViaTime as updateViaTimeRedux,
  updateViaStopTime as updateViaStopTimeRedux,
  deleteVias as deleteViasRedux,
  permuteVias as permuteViasRedux,
} from 'reducers/osrdconf';

export const updateOriginTime = (value) => {
  store.dispatch(updateOriginTimeRedux(value));
};

export const updateDestinationTime = (value) => {
  store.dispatch(updateDestinationTimeRedux(value));
};

export const updateViaTime = (index, value) => {
  const { osrdconf } = store.getState();
  store.dispatch(updateViaTimeRedux(osrdconf.vias, index, value));
};

export const updateViaStopTime = (index, value) => {
  const { osrdconf } = store.getState();
  store.dispatch(updateViaStopTimeRedux(osrdconf.vias, index, value));
};

export const deleteVias = (index) => {
  store.dispatch(deleteViasRedux(index));
};

export const permuteVias = (from, to) => {
  const { osrdconf } = store.getState();
  store.dispatch(permuteViasRedux(osrdconf.vias, from, to));
};
