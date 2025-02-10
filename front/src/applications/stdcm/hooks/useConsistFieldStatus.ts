import type { InputProps } from '@osrd-project/ui-core';
import type { StatusWithMessage } from '@osrd-project/ui-core/dist/components/inputs/StatusMessage';
import { useTranslation } from 'react-i18next';

import type { RollingStockWithLiveries, TowedRollingStock } from 'common/api/osrdEditoastApi';
import { kgToT, kmhToMs, msToKmh } from 'utils/physics';

import type { ConsistErrors } from '../types';
import {
  CONSIST_MAX_SPEED_MIN,
  CONSIST_TOTAL_LENGTH_MAX,
  CONSIST_TOTAL_MASS_MAX,
} from '../utils/consistValidation';

const useConsistFieldStatus = (
  type: 'totalMass' | 'totalLength' | 'maxSpeed',
  statusWithMessage: {
    totalMass?: InputProps['statusWithMessage'];
    totalLength?: InputProps['statusWithMessage'];
    maxSpeed?: InputProps['statusWithMessage'];
  },
  consistErrors: ConsistErrors,
  statusMessagesVisible: { mass: boolean; length: boolean; speed: boolean },
  rollingStock: RollingStockWithLiveries | undefined,
  towedRollingStock: TowedRollingStock | undefined
): StatusWithMessage | undefined => {
  const { t } = useTranslation('stdcm');

  switch (type) {
    case 'totalMass': {
      if (consistErrors.totalMass.message && consistErrors.totalMass.display) {
        return {
          status: 'error',
          tooltip: 'left',
          message: t(consistErrors.totalMass.message, {
            low: Math.ceil(kgToT((rollingStock?.mass ?? 0) + (towedRollingStock?.mass ?? 0))),
            high: CONSIST_TOTAL_MASS_MAX,
          }),
        };
      }
      if (statusMessagesVisible.mass) {
        return statusWithMessage?.totalMass;
      }
      return undefined;
    }

    case 'totalLength': {
      if (consistErrors.totalLength.message && consistErrors.totalLength.display) {
        return {
          status: 'error',
          tooltip: 'left',
          message: t(consistErrors.totalLength.message, {
            low: Math.ceil((rollingStock?.length ?? 0) + (towedRollingStock?.length ?? 0)),
            high: CONSIST_TOTAL_LENGTH_MAX,
          }),
        };
      }
      if (statusMessagesVisible.length) {
        return statusWithMessage?.totalLength;
      }
      return undefined;
    }

    case 'maxSpeed': {
      if (consistErrors.maxSpeed.message && consistErrors.maxSpeed.display) {
        return {
          status: 'error',
          tooltip: 'left',
          message: t(consistErrors.maxSpeed.message, {
            low: CONSIST_MAX_SPEED_MIN,
            high: Math.floor(
              msToKmh(Math.min(rollingStock?.max_speed ?? kmhToMs(CONSIST_MAX_SPEED_MIN)))
            ),
          }),
        };
      }
      if (statusMessagesVisible.speed) {
        return statusWithMessage?.maxSpeed;
      }
      return undefined;
    }

    default:
      return undefined;
  }
};

export default useConsistFieldStatus;
