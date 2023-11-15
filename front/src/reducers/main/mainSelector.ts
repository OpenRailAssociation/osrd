import { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';
import { MainState } from 'reducers/main/index';

export const getMain = (state: RootState) => state.main;
const makeMainSelector = makeSubSelector<MainState>(getMain);

const getLoading = makeMainSelector('loading');
export const getIsLoading = (state: RootState) => getLoading(state) > 0;
export const getNotifications = makeMainSelector('notifications');
export const getLastInterfaceVersion = makeMainSelector('lastInterfaceVersion');
