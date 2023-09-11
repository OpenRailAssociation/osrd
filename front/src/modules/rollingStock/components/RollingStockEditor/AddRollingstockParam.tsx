import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { Comfort } from 'common/api/osrdEditoastApi';
import { RollingStockSelectorParams } from 'modules/rollingStock/consts';
import React, { useState } from 'react';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { RiAddFill } from 'react-icons/ri';
import { compact } from 'lodash';

export default function AddRollingstockParam({
  listName,
  allOptionsList,
  displayedLists,
  disabled,
  updateDisplayedLists,
}: {
  listName: string;
  allOptionsList: string[] | (string | null)[];
  displayedLists: RollingStockSelectorParams;
  disabled?: boolean;
  updateDisplayedLists: (arg: string) => void;
}) {
  const COMFORT_LEVELS_KEY: keyof RollingStockSelectorParams = 'comfortLevels';
  const TRACTION_MODES_KEY: keyof RollingStockSelectorParams = 'tractionModes';

  const { t } = useTranslation('rollingstock');
  const [isSelectVisible, setIsSelectVisible] = useState(false);
  const isTractionModes = listName === TRACTION_MODES_KEY;

  const optionsList = compact(allOptionsList)
    .filter(
      (option) =>
        !displayedLists[listName as keyof RollingStockSelectorParams].includes(option as Comfort)
    )
    .map((option) => {
      if (listName === COMFORT_LEVELS_KEY) {
        return {
          id: option,
          label: t(`comfortTypes.${option}`),
        };
      }
      return {
        id: option,
        label: t(option),
      };
    });

  return (
    <div>
      <button
        type="button"
        className={cx('rollingstock-selector-buttons', 'mb-2', {
          disabled: disabled || (optionsList.length < 1 && listName !== 'tractionModes'),
        })}
        onClick={() => setIsSelectVisible(true)}
      >
        <RiAddFill />
      </button>
      {isSelectVisible && (
        <div className="selector-select">
          <SelectImprovedSNCF
            options={optionsList}
            onChange={(e) => {
              if (e) {
                updateDisplayedLists(e.id);
                setIsSelectVisible(false);
              }
            }}
            withSearch
            withNewValueInput={isTractionModes}
            addButtonTitle={isTractionModes ? t('addNewTractionMode') : undefined}
            bgWhite
            isOpened
            setSelectVisibility={setIsSelectVisible}
          />
        </div>
      )}
    </div>
  );
}
