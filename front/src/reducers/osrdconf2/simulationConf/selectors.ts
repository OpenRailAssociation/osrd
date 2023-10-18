import { simulationConfSlice } from '.';
import buildCommonConfSelectors from '../common/selectors';

const selectors = buildCommonConfSelectors(simulationConfSlice);

export type simulationConfSelectorsType = ReturnType<typeof buildCommonConfSelectors>;

export default selectors;
