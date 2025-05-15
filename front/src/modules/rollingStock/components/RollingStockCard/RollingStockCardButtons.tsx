import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { Comfort, LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import type { Option } from 'common/BootstrapSNCF/OptionsSNCF';
import { comfort2pictogram } from 'modules/rollingStock/components/RollingStockSelector/RollingStockHelpers';
import { getRollingStockComfort } from 'reducers/osrdconf/operationalStudiesConf/selectors';

type RollingStockCardButtonsProps = {
  rollingStock: LightRollingStockWithLiveries;
  curvesComfortList: Comfort[];
  onSelectRollingStock: (rollingStockId: LightRollingStockWithLiveries, comfort: Comfort) => void;
};

const RollingStockCardButtons = ({
  rollingStock,
  curvesComfortList,
  onSelectRollingStock,
}: RollingStockCardButtonsProps) => {
  const { t } = useTranslation();

  const currentComfortInStore = useSelector(getRollingStockComfort);
  const [comfort, setComfort] = useState<string>(currentComfortInStore);

  const comfortOptions = useMemo(() => {
    const options: Option[] = [
      { value: 'STANDARD', label: t('rollingStock.comfortTypes.STANDARD') },
    ];
    if (curvesComfortList.includes('HEATING')) {
      options.push({
        value: 'HEATING',
        label: (
          <span
            data-testid="comfort-heating-button"
            className="rollingstock-footer-button-with-picto"
          >
            {comfort2pictogram('HEATING')} {t('rollingStock.comfortTypes.HEATING')}
          </span>
        ),
      });
    }
    if (curvesComfortList.includes('AIR_CONDITIONING')) {
      options.push({
        value: 'AIR_CONDITIONING',
        label: (
          <span data-testid="comfort-ac-button" className="rollingstock-footer-button-with-picto">
            {comfort2pictogram('AIR_CONDITIONING')}{' '}
            {t('rollingStock.comfortTypes.AIR_CONDITIONING')}
          </span>
        ),
      });
    }
    return options;
  }, [curvesComfortList]);

  useEffect(() => {
    if (curvesComfortList.length === 0) {
      setComfort('STANDARD');
    } else {
      setComfort(
        curvesComfortList.includes(currentComfortInStore)
          ? currentComfortInStore
          : curvesComfortList[0]
      );
    }
  }, [curvesComfortList, currentComfortInStore]);

  return (
    <div className="rollingstock-footer-buttons">
      {curvesComfortList.length > 1 && (
        <OptionsSNCF
          onChange={(e) => setComfort(e.target.value)}
          options={comfortOptions}
          name="comfortChoice"
          selectedValue={comfort}
          sm
        />
      )}
      <button
        data-testid="select-rolling-stock-button"
        type="button"
        className="ml-2 btn btn-primary btn-sm"
        onClick={() => onSelectRollingStock(rollingStock, comfort as Comfort)}
      >
        {t('rollingStock.selectRollingStock')}
      </button>
    </div>
  );
};

export default RollingStockCardButtons;
