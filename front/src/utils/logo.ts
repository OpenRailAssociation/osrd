import defaultLogo from 'assets/logo-color.svg';
import defaultOsrdLogo from 'assets/logo-osrd-color-white.svg';
import proudLogo from 'assets/proud-logo-color.svg';
import proudOsrdLogo from 'assets/proud-logo-osrd-color-white.svg';
import xmasLogo from 'assets/xmas-logo-color.svg';
import xmasOsrdLogo from 'assets/xmas-logo-osrd-color-white.svg';

const MONTH_VALUES = {
  JUNE: 5,
  DECEMBER: 11,
};

export const getOsrdLogo = () => {
  if (new Date().getMonth() === MONTH_VALUES.JUNE) {
    return proudOsrdLogo;
  }
  if (new Date().getMonth() === MONTH_VALUES.DECEMBER) {
    return xmasOsrdLogo;
  }
  return defaultOsrdLogo;
};

export const getLogo = () => {
  if (new Date().getMonth() === MONTH_VALUES.JUNE) {
    return proudLogo;
  }
  if (new Date().getMonth() === MONTH_VALUES.DECEMBER) {
    return xmasLogo;
  }
  return defaultLogo;
};
