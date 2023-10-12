import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Grid from 'common/Grid';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalBodySNCF, ModalHeaderSNCF, useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { splitArrayByFirstLetter } from 'utils/array';

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

  // Allow the user to escape the modal by pressing escape and to trap the focus inside it
  useEffect(() => {
    const modalElement = modalRef.current;

    const focusableElements = modalElement?.querySelectorAll(
      // last declaration stands for all elements not natively focusable like li
      'input, button, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<Element>;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements?.length - 1] as HTMLElement;

    /**
     *
     * Prevent the tab event and set focus on :
     * - last element if we are pressing on "shift" in addition to "tab" and are on the first element
     * - first element if we are only pressing "tab" and are on the last element
     */
    const handleTabKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    const handleEscapeKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    modalElement?.addEventListener('keydown', handleTabKeyPress);
    modalElement?.addEventListener('keydown', handleEscapeKeyPress);

    return () => {
      modalElement?.removeEventListener('keydown', handleTabKeyPress);
      modalElement?.removeEventListener('keydown', handleEscapeKeyPress);
    };
  }, []);

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
          unit={<i className="icons-search" />}
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
