import React from 'react';

import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';

import type { StdcmV2SuccessResponse } from '../types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type StcdmResultsProps = {
  mapCanvas?: string;
  stdcmResults: StdcmV2SuccessResponse;
  rollingStockData: RollingStockWithLiveries;
};

// TODO TS2 : Adapt StdcmResult to trainSchedule v2 (SpaceTimeChart and SpeedSpaceChart)

const StcdmResultsV2 = () => <div>Stdcm results in progress</div>;

export default StcdmResultsV2;
