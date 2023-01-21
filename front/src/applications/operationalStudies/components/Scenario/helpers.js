import { updateIsUpdating } from 'reducers/osrdsimulation/actions';
import { store } from 'Store';

export function simulationIsUpdating(bool) {
  store.dispatch(updateIsUpdating(bool));
}
export function dummy() {
  return null;
}
