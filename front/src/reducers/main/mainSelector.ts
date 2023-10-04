import { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';
import { MainState } from 'reducers/main/index';

export const getMain = (state: RootState) => state.main;
const makeMainSelector = makeSubSelector<MainState>(getMain);

export const getLoading = makeMainSelector('loading');
export const getNotifications = makeMainSelector('notifications');
export const getLastInterfaceVersion = makeMainSelector('lastInterfaceVersion');
