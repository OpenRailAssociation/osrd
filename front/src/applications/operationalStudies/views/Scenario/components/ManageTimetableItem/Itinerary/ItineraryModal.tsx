import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import { ArrowSwitch, FrameAll, Plus } from '@osrd-project/ui-icons';
import bbox from '@turf/bbox';
import cx from 'classnames';
import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useCategoryColors from 'applications/operationalStudies/hooks/useCategoryColors';
import { useManageTimetableItemContext } from 'applications/operationalStudies/hooks/useManageTimetableItemContext';
import { useOperationalPointSearch } from 'applications/operationalStudies/hooks/useOperationalPointSearch';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import AlertBox from 'common/AlertBox';
import type {
  OperationalPointReference,
  PathProperties,
  PathItemLocation,
  TrainCategory,
} from 'common/api/osrdEditoastApi';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { useInfraID } from 'common/osrdContext';
import IncompatibleConstraints from 'modules/pathfinding/components/IncompatibleConstraints';
import TypeAndPath from 'modules/pathfinding/components/Pathfinding/TypeAndPath';
import reversePathSteps from 'modules/pathfinding/helpers/reversePathSteps';
import usePathfindingV2 from 'modules/pathfinding/hooks/usePathfindingV2';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import { updateItineraryForm } from 'reducers/osrdconf/operationalStudiesConf';
import {
  getCategory,
  getName,
  getOperationalStudiesRollingStockID,
  getOperationalStudiesSpeedLimitByTag,
  getPathSteps,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { PathStep, PathStepMetadata, PathStepV2 } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { addElementAtIndex } from 'utils/array';
import { Duration } from 'utils/duration';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';

import { MANAGE_TIMETABLE_ITEM_TYPES } from '../../../consts';
import {
  createEmptyPathStep,
  ensureTrailingEmptyStep,
  isEmptyStep,
  deletePathStep,
} from '../helpers/pathStepsActions';
import useMapTrackSelection from '../hooks/useMapTrackSelection';
import type { FeatureInfoClick } from '../types';
import { type OperationalPointSuggestion } from './ComboBoxCustomList/ListElementComponent';
import { usePathStepsMetadata } from './hooks/usePathStepsMetadata';
import ItineraryModalFormHeader from './ItineraryModalFormHeader';
import ItineraryModalMap from './ItineraryModalMap';
import PathStepItem from './PathStepItem';
import { computePathStepCoordinates } from './utils';

type ItineraryModalProps = {
  itineraryModalIsOpen: boolean;
  setItineraryModalIsOpen: (isOpen: boolean) => void;
  displayTimetableItemManagement: string;
};

export type ItineraryModalFormState = {
  name?: string;
  rollingStockId?: number;
  speedLimitTag?: string;
  category?: TrainCategory;
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
  const name = useSelector(getName);
  const speedLimitTag = useSelector(getOperationalStudiesSpeedLimitByTag);
  const mapSettings = useMapSettings();
  const dispatch = useAppDispatch();
  const { updateViewport } = useMapSettingsActions();
  const infraId = useInfraID();

  const [modalFormState, setModalFormState] = useState<ItineraryModalFormState>({
    name,
    rollingStockId,
    speedLimitTag,
    category: category ?? undefined,
  });

  const { categoryColors, currentSubCategory } = useCategoryColors(modalFormState.category);

  const modalRef = useRef<HTMLDialogElement>(null);
  const editingStepIdRef = useRef<string>('');
  const pendingStepIdRef = useRef<string>('');
  const confirmedStepIdRef = useRef<string>('');
  const focusValueRef = useRef<Record<string, string | undefined>>({});

  const [pathSteps, setPathSteps] = useState<PathStepV2[]>([]);
  const [categoryWarning, setCategoryWarning] = useState<string | undefined>(undefined);
  const [alertBoxWiggle, setAlertBoxWiggle] = useState(0);

  const [hoveredGapIndex, setHoveredGapIndex] = useState<number | null>(null);
  const [mapSelectionStepId, setMapSelectionStepId] = useState<string | null>(null);

  const closeModal = () => {
    modalRef.current?.close();
    setItineraryModalIsOpen(false);
  };

  const handleCancelMapSelection = useCallback(() => {
    setMapSelectionStepId(null);
  }, []);

  const handleEscapeOrClose = useCallback(() => {
    if (mapSelectionStepId !== null) {
      handleCancelMapSelection();
    } else {
      closeModal();
    }
  }, [mapSelectionStepId, handleCancelMapSelection]);

  useModalFocusTrap(modalRef, handleEscapeOrClose);

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

  const { pathStepsMetadataById } = usePathStepsMetadata(pathSteps, pendingStepIdRef);
  const { launchPathfindingV2, pathProperties, pathfindingError } = usePathfindingV2();
  const { convertFeatureClickToLocation } = useMapTrackSelection(infraId);

  const applyOperationalPointToStep = (
    stepId: string,
    suggestion: OperationalPointSuggestion,
    forcedCh?: string
  ) => {
    const chosenCh = chooseChForSuggestion(stepId, suggestion, forcedCh);
    if (!chosenCh) return;
    pendingStepIdRef.current = stepId;
    confirmedStepIdRef.current = stepId;
    let opRef: OperationalPointReference;
    if (suggestion.trigram) {
      opRef = { type: 'trigram', trigram: suggestion.trigram, secondary_code: chosenCh };
    } else if (suggestion.uic) {
      opRef = { type: 'uic', uic: suggestion.uic, secondary_code: chosenCh };
    } else {
      const chosenOpId = suggestion.secondaryCodeList.find((c) => c.code === chosenCh)?.opId;
      opRef = { type: 'id', operational_point: chosenOpId! };
    }
    const newLocation: PathItemLocation = {
      type: 'operational_point_part_reference',
      operational_point: opRef,
    };

    setPathSteps((prev) => {
      const next = prev.map((step) =>
        step.id === stepId ? { ...step, location: newLocation } : step
      );
      return ensureTrailingEmptyStep(next);
    });

    commitSelectionForStep(stepId, formatChosenValue(suggestion, chosenCh));
    resetOpSuggestions();
  };
  const isOnlyStep = pathSteps.length === 1;

  const hasInvalidPathStep = pathSteps.some((step) => {
    if (isEmptyStep(step, getInputForStep(step.id))) return false;
    const meta = pathStepsMetadataById.get(step.id);
    return !meta || meta.isInvalid;
  });
  const handleDeletePathStep = (stepId: string) => {
    resetOpSuggestions();

    if (activeStepId === stepId) setActiveStepId('');

    setPathSteps((prev) => {
      const step = prev.find((s) => s.id === stepId);
      if (!step) return prev;

      const next = deletePathStep(prev, stepId);
      return ensureTrailingEmptyStep(next);
    });
  };

  const handleAddIntermediateStep = (insertIndex: number) => {
    resetOpSuggestions();
    setHoveredGapIndex(null);

    const newStep = createEmptyPathStep();

    setPathSteps((prev) => ensureTrailingEmptyStep(addElementAtIndex(prev, insertIndex, newStep)));

    setActiveStepId(newStep.id);
    setInputForStep(newStep.id, '');
  };

  const isStepInvalidAndIsEditing = (step: PathStepV2, metadata?: PathStepMetadata) => {
    if (!metadata?.isInvalid) return false;

    const query = (getInputForStep(step.id) ?? '').trim();
    const isEditing = editingStepIdRef.current === step.id;
    const isPending = pendingStepIdRef.current === step.id;
    // A step with no location is invalid only if the user typed something and isn't currently editing

    if (!step.location) {
      return query.length > 0 && !isEditing;
    }

    // A step with a location can still be invalid (OP not found in current infra).
    // Show the error as long as the user is not actively editing it, or if the query is empty
    return !isEditing && !isPending && query.length === 0;
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

  const handleStartMapSelection = useCallback(
    (stepId: string) => {
      setMapSelectionStepId(stepId);
      const metadata = pathStepsMetadataById.get(stepId);
      if (metadata) {
        const coordinates = computePathStepCoordinates(metadata);
        if (coordinates.length > 0) {
          dispatch(updateViewport({ longitude: coordinates[0][0], latitude: coordinates[0][1] }));
        }
      }
    },
    [pathStepsMetadataById, dispatch, updateViewport]
  );

  const handleOutsideMapClick = useCallback(() => {}, []);

  const handleMapSelectionClick = useCallback(
    async (featureInfoClick: FeatureInfoClick) => {
      if (!mapSelectionStepId) return;

      const selectedStep = pathSteps.find((s) => s.id === mapSelectionStepId);
      if (selectedStep?.location) return;

      const location = await convertFeatureClickToLocation(featureInfoClick);
      if (!location) return;

      const stepId = mapSelectionStepId;
      setPathSteps((prev) =>
        ensureTrailingEmptyStep(prev.map((s) => (s.id === stepId ? { ...s, location } : s)))
      );
      setInputForStep(stepId, '');
      setMapSelectionStepId(null);
    },
    [mapSelectionStepId, pathSteps, convertFeatureClickToLocation, setInputForStep]
  );

  const handlePathStepDragEnd = useCallback(
    async (stepId: string, featureInfoClick: FeatureInfoClick) => {
      const location = await convertFeatureClickToLocation(featureInfoClick);
      if (!location) return;

      setPathSteps((prev) =>
        ensureTrailingEmptyStep(
          prev.map((step) => (step.id === stepId ? { ...step, location } : step))
        )
      );
      setInputForStep(stepId, '');
      setMapSelectionStepId(null);
    },
    [convertFeatureClickToLocation, setInputForStep]
  );

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
      if (allMarkersCoordinates.length === 0) return;
      const box = bbox({
        type: 'MultiPoint',
        coordinates: allMarkersCoordinates,
      });
      const newViewport = computeBBoxViewport(box, mapSettings.viewport, { padding: 64 });
      dispatch(updateViewport(newViewport));
    }
  };

  const isNameEmpty = !modalFormState.name || modalFormState.name.trim() === '';
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    setSubmitAttempted(false);
  }, [pathSteps]);

  useEffect(() => {
    if (
      displayTimetableItemManagement === MANAGE_TIMETABLE_ITEM_TYPES.edit ||
      displayTimetableItemManagement === MANAGE_TIMETABLE_ITEM_TYPES.add
    ) {
      const formattedPathSteps = storePathSteps
        .filter((pathStep): pathStep is PathStep => pathStep !== null)
        .map<PathStepV2>((pathStep) => ({
          id: pathStep.id,
          location: pathStep.location,
          arrival: pathStep.arrival ?? null,
          stopFor: pathStep.stopFor ?? null,
          theoreticalMargin: pathStep.theoreticalMargin ?? null,
          receptionSignal: pathStep.receptionSignal ?? null,
        }));

      setPathSteps(ensureTrailingEmptyStep(formattedPathSteps));
    }
  }, [storePathSteps, displayTimetableItemManagement]);

  const pathfindingStepsWithLocations = useMemo(
    () =>
      pathSteps.filter((s) => {
        if (!s.location) return false;
        const meta = pathStepsMetadataById.get(s.id);
        return !!meta && !meta.isInvalid;
      }),
    [pathSteps, pathStepsMetadataById]
  );
  const pathfindingStepsRef = useRef<PathStepV2[]>([]);

  const pathfindingSteps = useMemo(() => {
    const prev = pathfindingStepsRef.current;
    const next = pathfindingStepsWithLocations;

    const sameSteps =
      prev.length === next.length &&
      prev.every((p, i) => p.id === next[i].id && p.location === next[i].location);

    if (sameSteps) return prev;

    pathfindingStepsRef.current = next;
    return next;
  }, [pathfindingStepsWithLocations]);

  useEffect(() => {
    if (workerStatus !== 'READY' || !modalFormState.rollingStockId || pathfindingSteps.length < 2)
      return;

    const pathfindingLocations = pathfindingSteps.map((s) => s.location!);
    const metadataByPathStepId = new Map(
      pathfindingSteps.map((s) => [s.id, pathStepsMetadataById.get(s.id)!])
    );

    launchPathfindingV2({
      pathSteps: pathfindingLocations,
      pathStepsMetadataById: metadataByPathStepId,
      rollingStockId: modalFormState.rollingStockId,
      speedLimitTag: modalFormState.speedLimitTag ?? null,
    });
  }, [workerStatus, modalFormState.rollingStockId, modalFormState.speedLimitTag, pathfindingSteps]);

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

  const buildPathSteps = (steps: PathStepV2[], metadataById: Map<string, PathStepMetadata>) =>
    steps
      .filter((step) => step.location !== null)
      .map<PathStep>((step) => {
        const metadata = metadataById.get(step.id);

        const baseStep = {
          id: step.id,
          location: step.location!,
          arrival: step.arrival,
          stopFor: step.stopFor,
          theoreticalMargin: step.theoreticalMargin ?? undefined,
          receptionSignal: step.receptionSignal ?? undefined,
        };

        if (!metadata || metadata.isInvalid) {
          return { ...baseStep, isInvalid: true };
        }

        return {
          ...baseStep,
          name: metadata.type === 'opRef' ? metadata.name : undefined,
          uic: metadata.type === 'opRef' ? metadata.uic : undefined,
          secondary_code: metadata.type === 'opRef' ? metadata.secondaryCode : undefined,
          coordinates:
            metadata.type === 'trackOffset' ? metadata.coordinates : metadata.parts[0]?.coordinates,
        };
      });

  const clearStep = (stepId: string) => {
    setInputForStep(stepId, '');
    resetOpSuggestions();

    setPathSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, location: null } : step))
    );
  };

  const reverseItinerary = () => {
    const filledSteps = pathSteps.filter((step) => !isEmptyStep(step, getInputForStep(step.id)));
    const updatedPathSteps = buildPathSteps(filledSteps, pathStepsMetadataById);

    if (updatedPathSteps.length < 2) return;

    launchPathfinding(reversePathSteps(updatedPathSteps), modalFormState.rollingStockId);
  };
  const submitItinerary = () => {
    setSubmitAttempted(true);
    setAlertBoxWiggle((c) => c + 1);
    if (isNameEmpty) return;

    const stepsWithLocationOrInput = pathSteps.filter(
      (step) => !isEmptyStep(step, getInputForStep(step.id))
    );
    if (stepsWithLocationOrInput.length < 2) return;

    const stepsWithStopAtDestination = stepsWithLocationOrInput.map((step, i) =>
      i === stepsWithLocationOrInput.length - 1
        ? { ...step, stopFor: new Duration({ minutes: 0 }) }
        : step
    );
    //TODO this variable name should be changed when we no longer have to convert from v2 to v1 for path steps
    const pathStepsFromV2 = buildPathSteps(stepsWithStopAtDestination, pathStepsMetadataById);

    if (pathStepsFromV2.length < 2) return;

    dispatch(
      updateItineraryForm({
        name: modalFormState.name ?? '',
        category: modalFormState.category ?? null,
        rollingStockId: modalFormState.rollingStockId,
        speedLimitTag: modalFormState.speedLimitTag,
        pathSteps: pathStepsFromV2,
      })
    );

    launchPathfinding(pathStepsFromV2, modalFormState.rollingStockId, { isInitialization: true });
    closeModal();
  };

  useModalFocusTrap(modalRef, handleEscapeOrClose);

  // Prevent the dialog from natively closing on Escape when the map selection mode is on
  useEffect(() => {
    const dialog = modalRef.current;
    if (!dialog) return;
    const preventNativeClose = (e: Event) => e.preventDefault();
    dialog.addEventListener('cancel', preventNativeClose);
    return () => dialog.removeEventListener('cancel', preventNativeClose);
  }, []);

  useEffect(() => {
    if (itineraryModalIsOpen) {
      openModal();
    }
  }, [itineraryModalIsOpen]);

  useEffect(() => {
    if (locatedStepsCount < 2 || pathStepsMetadataById.size < 2) return;

    frameAllPathSteps();
  }, [pathStepsMetadataById, hasInvalidPathStep]);

  return (
    <dialog ref={modalRef} className="itinerary-modal">
      <div className="itinerary-modal-form" onClick={handleOutsideMapClick} role="presentation">
        {mapSelectionStepId && <div className="map-selection-form-overlay" />}
        <div className="itinerary-modal-form-header">
          <ItineraryModalFormHeader
            modalFormState={modalFormState}
            onModalFormStateChange={setModalFormState}
            onCategoryWarningChange={setCategoryWarning}
            currentSubCategory={currentSubCategory}
            categoryColors={categoryColors}
            submitAttempted={submitAttempted}
            isNameEmpty={isNameEmpty}
          />
        </div>
        <div className="itinerary-modal-form-body">
          {categoryWarning && <AlertBox message={categoryWarning} closeable />}
          {hasInvalidPathStepDisplay && (
            <div key={`invalid-op-${alertBoxWiggle}`}>
              <AlertBox type="error" message={t('alertInvalidOP')} />
            </div>
          )}
          {!hasInvalidPathStepDisplay && pathfindingError && (
            <div key={`pathfinding-${alertBoxWiggle}`}>
              <AlertBox type="error" message={pathfindingError} />
            </div>
          )}
          {submitAttempted &&
            !hasInvalidPathStepDisplay &&
            (!pathSteps[0]?.location || locatedStepsCount < 2) && (
              <div key={`missing-step-${alertBoxWiggle}`}>
                <AlertBox
                  type="error"
                  message={t(
                    locatedStepsCount === 0
                      ? 'alertMissingRequestedPoint'
                      : !pathSteps[0]?.location
                        ? 'alertMissingOrigin'
                        : 'alertMissingDestination'
                  )}
                />
              </div>
            )}
          <TypeAndPath isInNewModal />
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
              const isMapSelecting = mapSelectionStepId === pathStep.id;

              const previousPathStepMetadata = pathStepsMetadataById.get(pathSteps[i - 1]?.id);
              const isTrailingPlaceholder =
                i === pathSteps.length - 1 && isEmptyStep(pathStep, getInputForStep(pathStep.id));

              return (
                <>
                  <div className="path-step-gap">
                    {hoveredGapIndex === i && <div className="path-step-gap-line" />}

                    <div
                      className="path-step-gap-hitbox"
                      onPointerEnter={() => setHoveredGapIndex(i)}
                      onPointerLeave={() => setHoveredGapIndex(null)}
                    >
                      {hoveredGapIndex === i && (
                        <button
                          type="button"
                          className="add-pathitem"
                          onClick={() => handleAddIntermediateStep(i)}
                        >
                          <Plus iconColor="var(--white100)" />
                        </button>
                      )}
                    </div>
                  </div>
                  <PathStepItem
                    key={pathStep.id}
                    pathStep={pathStep}
                    setPathSteps={setPathSteps}
                    pathStepMetadata={pathStepMetadata}
                    index={i + 1}
                    categoryColors={categoryColors}
                    hidePathfindingLine={
                      i > 0 &&
                      !isTrailingPlaceholder &&
                      (isInvalid || !!previousPathStepMetadata?.isInvalid)
                    }
                    onDelete={() => {
                      handleDeletePathStep(pathStep.id);
                    }}
                    onOpClear={() => {
                      clearStep(pathStep.id);
                      handleDeletePathStep(pathStep.id);
                    }}
                    onOpFocus={() => {
                      markEditing(pathStep.id);
                      if (!pathStep.location) {
                        clearStep(pathStep.id);
                      }
                      focusValueRef.current[pathStep.id] =
                        getInputForStep(pathStep.id) ??
                        (pathStepMetadata &&
                        !pathStepMetadata.isInvalid &&
                        pathStepMetadata.type === 'opRef'
                          ? `${pathStepMetadata.name} ${pathStepMetadata.secondaryCode}`
                          : '');
                    }}
                    onOpInputChange={(value) => {
                      markEditing(pathStep.id);
                      if (
                        value === '' &&
                        pathStep.location &&
                        getInputForStep(pathStep.id) === undefined
                      ) {
                        return;
                      }
                      setInputForStep(pathStep.id, value);
                    }}
                    onTrackNameChange={(trackName) => {
                      setPathSteps((prev) =>
                        prev.map((step) => {
                          if (step.id !== pathStep.id) return step;
                          if (!step.location || step.location.type === 'track_offset') return step;
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
                    onOpBlur={() => {
                      // If the user focuses out on an input with a valid op, we display the last valid op of this input (or empty)
                      const valueOnFocus = focusValueRef.current[pathStep.id];
                      const valueOnBlur = getInputForStep(pathStep.id);

                      if (
                        pendingStepIdRef.current === pathStep.id ||
                        confirmedStepIdRef.current === pathStep.id
                      ) {
                        pendingStepIdRef.current = '';
                        confirmedStepIdRef.current = '';
                        unmarkEditing(pathStep.id);
                        return;
                      }

                      const normalizedOnFocus = valueOnFocus ?? '';
                      const normalizedOnBlur = valueOnBlur ?? '';

                      if (normalizedOnBlur === '' && normalizedOnFocus === '') {
                        unmarkEditing(pathStep.id);
                        return;
                      }

                      if (normalizedOnBlur === '') {
                        clearStep(pathStep.id);
                      } else if (normalizedOnBlur !== normalizedOnFocus) {
                        setInputForStep(pathStep.id, normalizedOnFocus);
                      }

                      unmarkEditing(pathStep.id);
                    }}
                    inputValue={getInputForStep(pathStep.id)}
                    opSuggestions={activeStepId === pathStep.id ? opSuggestions : []}
                    onSelectOpSuggestion={(suggestion, chCode) => {
                      applyOperationalPointToStep(pathStep.id, suggestion, chCode);
                    }}
                    onChevronClick={(queryValue) => {
                      reopenSuggestionsForStep(pathStep.id, queryValue);
                    }}
                    resetOpSuggestions={resetOpSuggestions}
                    connectorLong={hoveredGapIndex === i}
                    isTrailingPlaceHolder={isTrailingPlaceholder}
                    isOnlyStep={isOnlyStep}
                    isInvalidAndIsEditing={isInvalid}
                    isMapSelectionMode={isMapSelecting}
                    isDestination={i === pathSteps.length - 2}
                    onStartMapSelection={() => handleStartMapSelection(pathStep.id)}
                    onCancelMapSelection={handleCancelMapSelection}
                  />
                </>
              );
            })}
          </div>
        </div>
        <div className="itinerary-modal-form-footer">
          <Button label={t('cancel')} variant="Cancel" size="medium" onClick={closeModal} />
          <Button label={t('next')} variant="Primary" size="medium" onClick={submitItinerary} />
        </div>
      </div>
      <div
        className={cx('itinerary-modal-map', {
          'map-selection-active': mapSelectionStepId !== null,
        })}
      >
        <ItineraryModalMap
          pathSteps={pathSteps}
          pathStepsMetadata={pathStepsMetadataById}
          pathProperties={displayedPathProperties}
          selectedStepId={mapSelectionStepId ?? undefined}
          isMapSelectionMode={mapSelectionStepId !== null}
          onMapSelectionClick={handleMapSelectionClick}
          onPathStepDragEnd={handlePathStepDragEnd}
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
