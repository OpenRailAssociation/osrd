import { useEffect, useRef, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useCategoryColors from 'applications/operationalStudies/hooks/useCategoryColors';
import AlertBox from 'common/AlertBox';
import { getCategory } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { PathStepV2 } from 'reducers/osrdconf/types';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';

import ItineraryModalFormHeader from './ItineraryModalFormHeader';
import ItineraryModalMap from './ItineraryModalMap';
import PathStepItem from './PathStepItem';

type ItineraryModalProps = {
  itineraryModalIsOpen: boolean;
  setItineraryModalIsOpen: (isOpen: boolean) => void;
};

const ItineraryModal = ({ itineraryModalIsOpen, setItineraryModalIsOpen }: ItineraryModalProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTimetableItem.itineraryModal',
  });
  const category = useSelector(getCategory);

  const { categoryColors, currentSubCategory } = useCategoryColors(category);

  const modalRef = useRef<HTMLDialogElement>(null);

  const [pathSteps] = useState<PathStepV2[]>([]);
  const [categoryWarning, setCategoryWarning] = useState<string | undefined>(undefined);

  const openModal = () => {
    modalRef.current?.showModal();
  };

  const closeModal = () => {
    modalRef.current?.close();
    setItineraryModalIsOpen(false);
  };

  useModalFocusTrap(modalRef, closeModal);

  useEffect(() => {
    if (itineraryModalIsOpen) {
      openModal();
    }
  }, [itineraryModalIsOpen]);

  return (
    <dialog ref={modalRef} className="itinerary-modal">
      <div className="itinerary-modal-form">
        <div className="itinerary-modal-form-header">
          <ItineraryModalFormHeader
            onCategoryWarningChange={setCategoryWarning}
            category={category}
            currentSubCategory={currentSubCategory}
            categoryColors={categoryColors}
          />
        </div>
        <div className="itinerary-modal-form-body">
          {categoryWarning && <AlertBox message={categoryWarning} closeable />}
          <div className="path-step-list">
            <div className="path-step-list-header">
              <span>{t('opName')}</span>
              <span>{t('secondaryCode')}</span>
              <span>{t('track')}</span>
            </div>
            {pathSteps.map((pathStep, i) => (
              <PathStepItem
                key={pathStep.id}
                pathStep={pathStep}
                index={i + 1}
                categoryColors={categoryColors}
              />
            ))}
            <PathStepItem
              hidePathfindingLine={pathSteps.length === 0}
              categoryColors={categoryColors}
            />
          </div>
        </div>
        <div className="itinerary-modal-form-footer">
          <Button label={t('next')} variant="Primary" size="medium" onClick={closeModal} />
        </div>
      </div>
      <div className="itinerary-modal-map">
        <ItineraryModalMap />
      </div>
    </dialog>
  );
};

export default ItineraryModal;
