import { useMemo, useRef, useState } from 'react';

import { Search } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalBodySNCF, ModalHeaderSNCF, useModal } from 'common/BootstrapSNCF/ModalSNCF';
import Grid from 'common/Grid/Grid';
import { splitArrayByFirstLetter } from 'utils/array';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';

type PowerRestrictionGridModalProps = {
  powerRestrictionsList: string[];
  updatePowerRestrictions: (data: string) => void;
  currentPowerRestrictions: (string | null)[];
};

const PowerRestrictionGridModal = ({
  powerRestrictionsList,
  updatePowerRestrictions,
  currentPowerRestrictions,
}: PowerRestrictionGridModalProps) => {
  const { closeModal } = useModal();
  const { t } = useTranslation('rollingstock');

  const [filter, setFilter] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Split the list in two arrays one with code starting with letter and one with digit
  const [digitalPowerRestrictions, letterPowerRestrictions] = useMemo(
    () => splitArrayByFirstLetter(powerRestrictionsList),
    [powerRestrictionsList]
  );

  const isNewValue = !powerRestrictionsList.some((code) => code.includes(filter));

  const addNewPowerRestriction = (data: string) => {
    updatePowerRestrictions(data);
    closeModal();
  };

  useModalFocusTrap(modalRef, closeModal);

  return (
    <div className="p-2" ref={modalRef}>
      <ModalHeaderSNCF withCloseButton withBorderBottom>
        <InputSNCF
          id="searchfilter"
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onClear={() => setFilter('')}
          noMargin
          unit={<Search />}
          clearButton
          focus
        />
        {isNewValue && filter !== '' && (
          <button
            className="btn btn-sm btn-primary align-self-center ml-3"
            type="button"
            onClick={() => {
              addNewPowerRestriction(filter);
            }}
          >
            {t('add')}
          </button>
        )}
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <Grid
          gridData={letterPowerRestrictions}
          filter={filter}
          updateData={addNewPowerRestriction}
          selectorData={currentPowerRestrictions}
        />
        <Grid
          gridData={digitalPowerRestrictions}
          filter={filter}
          updateData={addNewPowerRestriction}
          extraClass="mt-4 mb-2"
          selectorData={currentPowerRestrictions}
        />
      </ModalBodySNCF>
    </div>
  );
};

export default PowerRestrictionGridModal;
