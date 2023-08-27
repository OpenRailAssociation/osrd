import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { Comfort } from 'common/api/osrdEditoastApi';
import { RollingStockSelectorParams } from 'modules/rollingStock/consts';
import React from 'react';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { RiAddFill } from 'react-icons/ri';
import { compact } from 'lodash';

export default function AddRollingstockParam({
  listName,
  allOptionsList,
  displayedLists,
  updateDisplayedLists,
}: {
  listName: string;
  allOptionsList: string[] | (string | null)[];
  displayedLists: RollingStockSelectorParams;
  updateDisplayedLists: (arg: string) => void;
}) {
  const { openModal } = useModal();
  const { t } = useTranslation('rollingstock');

  const COMFORT_LEVELS_KEY: keyof RollingStockSelectorParams = 'comfortLevels';

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
    <button
      type="button"
      className={cx('rollingstock-selector-buttons', 'mb-2', {
        disabled: (!optionsList || optionsList.length < 1) && listName !== 'tractionModes',
      })}
      onClick={() => {
        if (optionsList)
          openModal(
            <SelectImprovedSNCF
              options={optionsList}
              onChange={(e) => {
                if (e) updateDisplayedLists(e.id);
              }}
              withSearch
              withNewValueInput
              addButtonTitle={t('addNewTractionMode')}
              bgWhite
              isOpened
            />
          );
      }}
    >
      <RiAddFill />
    </button>
  );
}
