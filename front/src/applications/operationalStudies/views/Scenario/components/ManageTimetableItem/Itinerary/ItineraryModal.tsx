import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import { FrameAll } from '@osrd-project/ui-icons';
import bbox from '@turf/bbox';
import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { v4 as uuidV4 } from 'uuid';

import useCategoryColors from 'applications/operationalStudies/hooks/useCategoryColors';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import AlertBox from 'common/AlertBox';
import type { PathProperties } from 'common/api/osrdEditoastApi';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import usePathfindingV2 from 'modules/pathfinding/hooks/usePathfindingV2';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import {
  getCategory,
  getOperationalStudiesRollingStockID,
  getOperationalStudiesSpeedLimitByTag,
  getPathSteps,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { PathStepV2 } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';

import { usePathStepsMetadata } from './hooks/usePathStepsMetadata';
import ItineraryModalFormHeader from './ItineraryModalFormHeader';
import ItineraryModalMap from './ItineraryModalMap';
import PathStepItem from './PathStepItem';
import { computePathStepCoordinates } from './utils';
import { MANAGE_TIMETABLE_ITEM_TYPES } from '../../../consts';

type ItineraryModalProps = {
  itineraryModalIsOpen: boolean;
  setItineraryModalIsOpen: (isOpen: boolean) => void;
  displayTimetableItemManagement: string;
};

const ItineraryModal = ({
  itineraryModalIsOpen,
  setItineraryModalIsOpen,
  displayTimetableItemManagement,
}: ItineraryModalProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTimetableItem.itineraryModal',
  });
  const storePathSteps = useSelector(getPathSteps);
  const category = useSelector(getCategory);
  const { workerStatus } = useScenarioContext();
  const rollingStockId = useSelector(getOperationalStudiesRollingStockID);
  const speedLimitTag = useSelector(getOperationalStudiesSpeedLimitByTag);
  const mapSettings = useMapSettings();
  const dispatch = useAppDispatch();
  const { updateViewport } = useMapSettingsActions();

  const { categoryColors, currentSubCategory } = useCategoryColors(category);

  const modalRef = useRef<HTMLDialogElement>(null);

  const [pathSteps, setPathSteps] = useState<PathStepV2[]>([]);
  const [categoryWarning, setCategoryWarning] = useState<string | undefined>(undefined);

  const { pathStepsMetadataById } = usePathStepsMetadata(pathSteps);
  const { launchPathfindingV2, pathProperties } = usePathfindingV2();

  const isMapDisabled = window.matchMedia('(max-width: 1028px)').matches;

  const frameAllPathSteps = () => {
    if (pathProperties && pathProperties.geometry) {
      const newViewport = computeBBoxViewport(bbox(pathProperties.geometry), mapSettings.viewport, {
        padding: 64,
      });
      dispatch(updateViewport(newViewport));
    } else {
      // Zoom on all path steps markers
      const allMarkersCoordinates = pathStepsMetadataById
        .values()
        .reduce<Position[]>((acc, pathStepMetadata) => {
          acc.push(...computePathStepCoordinates(pathStepMetadata));
          return acc;
        }, []);
      const box = bbox({
        type: 'MultiPoint',
        coordinates: allMarkersCoordinates,
      });
      const newViewport = computeBBoxViewport(box, mapSettings.viewport, { padding: 64 });
      dispatch(updateViewport(newViewport));
    }
  };

  useEffect(() => {
    if (
      displayTimetableItemManagement === MANAGE_TIMETABLE_ITEM_TYPES.edit ||
      displayTimetableItemManagement === MANAGE_TIMETABLE_ITEM_TYPES.add
    ) {
      const formattedPathSteps = storePathSteps.map<PathStepV2>((pathStep) => {
        // TODO : Remove this condition when PathStepV2 will be the default path step type in the store
        if (!pathStep) {
          return {
            id: uuidV4(),
            location: null,
            arrival: null,
            stopFor: null,
            theoreticalMargin: null,
            receptionSignal: null,
          };
        }
        return {
          id: pathStep.id,
          location: pathStep.location,
          arrival: pathStep.arrival ?? null,
          stopFor: pathStep.stopFor ?? null,
          theoreticalMargin: pathStep.theoreticalMargin ?? null,
          receptionSignal: pathStep.receptionSignal ?? null,
        };
      });
      setPathSteps(formattedPathSteps);
    }
  }, [storePathSteps]);

  useEffect(() => {
    if (
      workerStatus === 'READY' &&
      pathSteps.length >= 2 &&
      pathStepsMetadataById.size === pathSteps.length &&
      rollingStockId
    ) {
      launchPathfindingV2({
        pathSteps: pathSteps.map((step) => step.location),
        pathStepsMetadataById,
        rollingStockId,
        speedLimitTag,
      });
    }
  }, [
    workerStatus,
    pathSteps,
    pathStepsMetadataById,
    rollingStockId,
    speedLimitTag,
    launchPathfindingV2,
  ]);

  const onPathfindingLoad = useEffectEvent((geometry: PathProperties['geometry']) => {
    const newViewport = computeBBoxViewport(bbox(geometry), mapSettings.viewport, {
      padding: 64,
    });
    dispatch(updateViewport(newViewport));
  });

  useEffect(() => {
    if (pathProperties?.geometry) {
      onPathfindingLoad(pathProperties.geometry);
    }
  }, [pathProperties]);

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
            <div className="itinerary-icons">
              <button className="frame-all" onClick={frameAllPathSteps}>
                <FrameAll title={t('frameAll')} aria-label={t('frameAll')} />
              </button>
            </div>
            <div className="path-step-list-header">
              <span>{t('opName')}</span>
              <span>{t('secondaryCode')}</span>
              <span>{t('track')}</span>
            </div>
            {pathSteps.map((pathStep, i) => (
              <PathStepItem
                key={pathStep.id}
                pathStep={pathStep}
                pathStepMetadata={pathStepsMetadataById.get(pathStep.id)}
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
      {!isMapDisabled && (
        <div className="itinerary-modal-map">
          <ItineraryModalMap
            pathSteps={pathSteps}
            pathStepsMetadata={pathStepsMetadataById}
            pathProperties={pathProperties}
          />
        </div>
      )}
    </dialog>
  );
};

export default ItineraryModal;
