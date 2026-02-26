import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import { ArrowSwitch, FrameAll } from '@osrd-project/ui-icons';
import bbox from '@turf/bbox';
import type { Position } from 'geojson';
import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { v4 as uuidV4 } from 'uuid';

import useCategoryColors from 'applications/operationalStudies/hooks/useCategoryColors';
import { useManageTimetableItemContext } from 'applications/operationalStudies/hooks/useManageTimetableItemContext';
import { useOperationalPointSearch } from 'applications/operationalStudies/hooks/useOperationalPointSearch';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import AlertBox from 'common/AlertBox';
import { type PathProperties, type PathItemLocation } from 'common/api/osrdEditoastApi';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import IncompatibleConstraints from 'modules/pathfinding/components/IncompatibleConstraints';
import reversePathSteps from 'modules/pathfinding/helpers/reversePathSteps';
import usePathfindingV2 from 'modules/pathfinding/hooks/usePathfindingV2';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import { updatePathSteps } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getCategory,
  getOperationalStudiesRollingStockID,
  getOperationalStudiesSpeedLimitByTag,
  getPathSteps,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { PathStep, PathStepMetadata, PathStepV2 } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';

import { type OperationalPointSuggestion } from './ComboBoxCustomList/ListElementComponent';
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
  const {
    activeStepId,
    setActiveStepId,
    getInputForStep,
    setInputForStep,
    opSuggestions,
    resetOpSuggestions,
    formatChosenValue,
    commitSelectionForStep,
    chooseChForSuggestion,
    reopenSuggestionsForStep,
  } = useOperationalPointSearch({});

  const { launchPathfinding } = useManageTimetableItemContext();

  const { pathStepsMetadataById } = usePathStepsMetadata(pathSteps);
  const { launchPathfindingV2, pathProperties, pathfindingError } = usePathfindingV2();
  const applyOperationalPointToStep = (
    stepId: string,
    suggestion: OperationalPointSuggestion,
    forcedCh?: string
  ) => {
    const chosenCh = chooseChForSuggestion(stepId, suggestion, forcedCh);
    if (!chosenCh) return;

    const newLocation: PathItemLocation = {
      operational_point: {
        type: 'trigram',
        trigram: suggestion.trigram,
        secondary_code: chosenCh,
      },
    };

    setPathSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, location: newLocation } : s))
    );

    commitSelectionForStep(stepId, formatChosenValue(suggestion, chosenCh));
    resetOpSuggestions();
  };

  const hasInvalidPathStep = Array.from(pathStepsMetadataById.values()).some(
    (metadata) => metadata.isInvalid
  );
  const editingStepIdRef = useRef<string>('');

  const isStepInvalidAndIsEditing = (step: PathStepV2, metadata?: PathStepMetadata) => {
    if (step.location) return false;
    if (!metadata?.isInvalid) return false;

    const query = (getInputForStep(step.id) ?? '').trim();
    const isEditing = editingStepIdRef.current === step.id;

    return query.length > 0 && !isEditing;
  };

  const hasInvalidPathStepDisplay = pathSteps.some((step) =>
    isStepInvalidAndIsEditing(step, pathStepsMetadataById.get(step.id))
  );

  const locatedStepsCount = pathSteps.filter((step) => step.location !== null).length;

  const displayedPathProperties =
    workerStatus === 'READY' && locatedStepsCount >= 2 && !hasInvalidPathStep
      ? pathProperties
      : undefined;

  const markEditing = (stepId: string) => {
    editingStepIdRef.current = stepId;
    setActiveStepId(stepId);
  };

  const unmarkEditing = (stepId: string) => {
    if (editingStepIdRef.current === stepId) editingStepIdRef.current = '';
    if (activeStepId === stepId) setActiveStepId('');
  };

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

  const buildPathSteps = (steps: PathStepV2[], metadataById: Map<string, PathStepMetadata>) =>
    steps.map<PathStep | null>((s) => {
      if (!s.location) return null;

      const metadata = metadataById.get(s.id);
      if (!metadata || metadata.isInvalid) return null;

      const coordinates =
        metadata.type === 'trackOffset' ? metadata.coordinates : metadata.parts[0]?.coordinates;

      const secondary_code = metadata.type === 'opRef' ? metadata.secondaryCode : undefined;

      return {
        id: s.id,
        location: s.location,
        arrival: s.arrival,
        stopFor: s.stopFor,
        theoreticalMargin: s.theoreticalMargin ?? undefined,
        receptionSignal: s.receptionSignal ?? undefined,

        name: metadata.type === 'opRef' ? metadata.name : undefined,
        uic: metadata.type === 'opRef' ? metadata.uic : undefined,
        secondary_code,
        coordinates,
      };
    });

  const clearStep = (stepId: string) => {
    setInputForStep(stepId, '');
    resetOpSuggestions();

    setPathSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, location: null } : s)));
  };

  const reverseItinerary = () => {
    const updatedPathSteps = buildPathSteps(pathSteps, pathStepsMetadataById);

    // No step should be null when reverseItinerary is called (as start and arrival need to be defined), so compact should let the array unchanged but constrain the type
    const cPathSteps = compact(updatedPathSteps);
    launchPathfinding(reversePathSteps(cPathSteps));
  };

  const submitItinerary = () => {
    if (locatedStepsCount < 2) {
      return;
    }

    const updatedPathSteps = buildPathSteps(pathSteps, pathStepsMetadataById);

    dispatch(updatePathSteps(updatedPathSteps));
    launchPathfinding(updatedPathSteps, rollingStockId, {
      isInitialization: true,
    });
    closeModal();
  };

  useModalFocusTrap(modalRef, closeModal);

  useEffect(() => {
    if (itineraryModalIsOpen) {
      openModal();
    }
  }, [itineraryModalIsOpen]);

  useEffect(() => {
    if (locatedStepsCount < 2 || pathStepsMetadataById.size < 2) return;
    if (hasInvalidPathStep) return;

    frameAllPathSteps();
  }, [pathStepsMetadataById, hasInvalidPathStep]);

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
          {hasInvalidPathStepDisplay && <AlertBox type="error" message={t('alertInvalidOP')} />}
          {!hasInvalidPathStepDisplay && pathfindingError && (
            <AlertBox type="error" message={pathfindingError} />
          )}
          <div className="path-step-list">
            <button
              data-testid="reverse-itinerary-button"
              className="reverse-itinerary-button"
              type="button"
              onClick={reverseItinerary}
            >
              <ArrowSwitch />
            </button>
            <div className="itinerary-icons">
              <button className="frame-all" onClick={frameAllPathSteps}>
                <FrameAll title={t('frameAll')} aria-label={t('frameAll')} />
              </button>
            </div>
            <div className="path-step-list-header">
              <span>{t('opName')}</span>
              <span>{t('track')}</span>
              <span>{t('opType')}</span>
            </div>
            {pathSteps.map((pathStep, i) => {
              const pathStepMetadata = pathStepsMetadataById.get(pathStep.id);
              const isInvalid = isStepInvalidAndIsEditing(pathStep, pathStepMetadata);

              return (
                <PathStepItem
                  key={pathStep.id}
                  setPathSteps={setPathSteps}
                  pathStep={pathStep}
                  pathStepMetadata={pathStepMetadata}
                  index={i + 1}
                  categoryColors={categoryColors}
                  hidePathfindingLine={i > 0 && isInvalid}
                  onOpFocus={() => markEditing(pathStep.id)}
                  onOpInputChange={(value) => {
                    markEditing(pathStep.id);
                    if (value === '') {
                      clearStep(pathStep.id);
                      return;
                    }
                    setInputForStep(pathStep.id, value);
                  }}
                  onTrackNameChange={(trackName) => {
                    setPathSteps((prev) =>
                      prev.map((step) => {
                        if (step.id !== pathStep.id) return step;
                        if (!step.location || !('operational_point' in step.location)) return step;
                        return {
                          ...step,
                          location: {
                            ...step.location,
                            local_track_name: trackName || undefined,
                          },
                        };
                      })
                    );
                  }}
                  onOpBlur={() => unmarkEditing(pathStep.id)}
                  inputValue={getInputForStep(pathStep.id)}
                  opSuggestions={activeStepId === pathStep.id ? opSuggestions : []}
                  onSelectOpSuggestion={(suggestion, chCode) => {
                    applyOperationalPointToStep(pathStep.id, suggestion, chCode);
                  }}
                  onChevronClick={(queryValue) => {
                    reopenSuggestionsForStep(pathStep.id, queryValue);
                  }}
                  isInvalidAndIsEditing={isInvalid}
                />
              );
            })}
            <PathStepItem
              hidePathfindingLine={pathSteps.length === 0}
              categoryColors={categoryColors}
            />
          </div>
        </div>
        <div className="itinerary-modal-form-footer">
          <Button label={t('cancel')} variant="Cancel" size="medium" onClick={closeModal} />
          <Button label={t('next')} variant="Primary" size="medium" onClick={submitItinerary} />
        </div>
      </div>
      <div className="itinerary-modal-map">
        <ItineraryModalMap
          pathSteps={pathSteps}
          pathStepsMetadata={pathStepsMetadataById}
          pathProperties={displayedPathProperties}
        >
          <IncompatibleConstraints
            geometry={pathProperties?.geometry}
            pathLength={pathProperties?.length}
            incompatibleConstraints={pathProperties?.incompatibleConstraints}
          />
        </ItineraryModalMap>
      </div>
    </dialog>
  );
};

export default ItineraryModal;
