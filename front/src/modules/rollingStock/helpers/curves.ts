import type { Comfort } from 'common/api/osrdEditoastApi';
import { geti18nKeyForNull } from 'utils/strings';

// eslint-disable-next-line import/prefer-default-export
export const getCurveName = (
  name: string,
  comfort: Comfort,
  electricalProfileLevel: string | null,
  powerRestrictionCode: string | null,
  isOnEditionMode?: boolean
) => {
  const electricalProfile = isOnEditionMode ? ` ${geti18nKeyForNull(electricalProfileLevel)}` : '';
  const powerRestriction = powerRestrictionCode
    ? ` ${geti18nKeyForNull(powerRestrictionCode)}`
    : '';
  return `${name} ${comfort}${electricalProfile}${powerRestriction}`;
};
