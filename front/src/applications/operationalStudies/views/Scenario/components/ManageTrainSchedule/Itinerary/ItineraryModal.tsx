import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import { ArrowSwitch, Fold, FrameAll, Plus, Unfold } from '@osrd-project/ui-icons';
import along from '@turf/along';
import bbox from '@turf/bbox';
import { lineString } from '@turf/helpers';
import cx from 'classnames';
import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useCategoryColors from 'applications/operationalStudies/hooks/useCategoryColors';
import { useManageTrainScheduleContext } from 'applications/operationalStudies/hooks/useManageTrainScheduleContext';
import { useOperationalPointSearch } from 'applications/operationalStudies/hooks/useOperationalPointSearch';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type {
  CoreOperationalPointOnPath,
  OperationalPointReference,
  PathProperties,
  PathItemLocation,
  TrainCategory,
} from 'common/api/osrdEditoastApi';
import Banner from 'common/Banner';
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
  getRollingStockName,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { PathStep, PathStepMetadata, PathStepV2 } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { addElementAtIndex } from 'utils/array';
import { Duration } from 'utils/duration';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from '../../../consts';
import {
  createEmptyPathStep,
  ensureTrailingEmptyStep,
  isEmptyStep,
  deletePathStep,
} from '../helpers/pathStepsActions';
import useMapTrackSelection from '../hooks/useMapTrackSelection';
import type { FeatureInfoClick } from '../types';
import type { OperationalPointSuggestion } from './ComboBoxCustomList/ListElementComponent';
import { usePathStepsMetadata } from './hooks/usePathStepsMetadata';
import IntermediateWaypointsPanel from './IntermediateWaypointsPanel/IntermediateWaypointsPanel';
import ItineraryModalFormHeader from './ItineraryModalFormHeader';
import ItineraryModalMap from './ItineraryModalMap';
import PathStepItem from './PathStepItem';
import { computePathStepCoordinates, getOpKey, isOpRefMetadata } from './utils';

type ItineraryModalProps = {
  itineraryModalIsOpen: boolean;
  onClose: ({ withChanges }: { withChanges: boolean }) => void;
  displayTrainScheduleManagement: string;
};

export type ItineraryModalFormState = {
  name?: string;
  rollingStockId?: number;
  rollingStockName: string;
  speedLimitTag?: string;
  category?: TrainCategory;
};

const ItineraryModal = ({
  itineraryModalIsOpen,
  onClose,
  displayTrainScheduleManagement,
}: ItineraryModalProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal',
  });
  const storePathSteps = useSelector(getPathSteps);
  const category = useSelector(getCategory);
  const { workerStatus } = useScenarioContext();
  const rollingStockId = useSelector(getOperationalStudiesRollingStockID);
  const rollingStockName = useSelector(getRollingStockName);
  const name = useSelector(getName);
  const speedLimitTag = useSelector(getOperationalStudiesSpeedLimitByTag);
  const mapSettings = useMapSettings();
  const dispatch = useAppDispatch();
  const { updateViewport } = useMapSettingsActions();
  const infraId = useInfraID();

  const [modalFormState, setModalFormState] = useState<ItineraryModalFormState>({
    name,
    rollingStockId,
    rollingStockName: rollingStockName ?? '',
    speedLimitTag,
    category: category ?? undefined,
  });

  const { categoryColors, currentSubCategory } = useCategoryColors(modalFormState.category);

  const modalRef = useRef<HTMLDialogElement>(null);
  const editingStepKeyRef = useRef<string>('');
  const pendingStepKeyRef = useRef<string>('');
  const confirmedStepKeyRef = useRef<string>('');
  const focusValueRef = useRef<Record<string, string | undefined>>({});

  const [pathSteps, setPathSteps] = useState<PathStepV2[]>([]);
  const [categoryWarning, setCategoryWarning] = useState<string | undefined>(undefined);
  const [rollingStockMessage, setRollingStockMessage] = useState<string | undefined>(undefined);
  const [bannerWiggle, setBannerWiggle] = useState(0);

  const [hoveredGapIndex, setHoveredGapIndex] = useState<number | null>(null);
  const [mapSelectionStepKey, setMapSelectionStepKey] = useState<string | null>(null);
  const [customTracksByOpKey, setCustomTracksByOpKey] = useState<
    Map<string, { trackId: string; trackName: string }[]>
  >(new Map());
  const [waypointsPanelOpen, setWaypointsPanelOpen] = useState(false);
  const toggleWaypointsPanelLabel = t(
    waypointsPanelOpen
      ? 'intermediateWaypointsPanel.hideLabel'
      : 'intermediateWaypointsPanel.showLabel'
  );

  const closeModal = ({ withChanges }: { withChanges: boolean }) => {
    modalRef.current?.close();
    onClose({ withChanges });
  };

  const handleCancelMapSelection = useCallback(() => {
    setMapSelectionStepKey(null);
  }, []);

  const handleEscapeOrClose = useCallback(() => {
    if (mapSelectionStepKey !== null) {
      handleCancelMapSelection();
    } else {
      closeModal({ withChanges: false });
    }
  }, [mapSelectionStepKey, handleCancelMapSelection]);

  useModalFocusTrap(modalRef, handleEscapeOrClose);

  const {
    activeStepKey,
    setActiveStepKey,
    getInputForStep,
    setInputForStep,
    opSuggestions,
    resetOpSuggestions,
    formatChosenValue,
    commitSelectionForStep,
    chooseChForSuggestion,
    reopenSuggestionsForStep,
  } = useOperationalPointSearch({});

  const { launchPathfinding } = useManageTrainScheduleContext();

  const { pathStepsMetadataByKey, setPathStepMetadata } = usePathStepsMetadata(
    pathSteps,
    pendingStepKeyRef
  );
  const { launchPathfindingV2, pathProperties, pathfindingError } = usePathfindingV2();
  const { convertFeatureClickToLocation } = useMapTrackSelection(infraId);

  // Fetch local track names from timetable train schedules is now handled inside usePathStepsMetadata
  const invalidTrackSteps = useMemo(
    () =>
      pathSteps.flatMap((step) => {
        if (isEmptyStep(step, getInputForStep(step.key))) return [];
        const metadata = pathStepsMetadataByKey.get(step.key);
        if (isOpRefMetadata(metadata) && metadata.trackName && !metadata.isValidLocalTrackName) {
          return [`${metadata.name} ${metadata.secondaryCode}`];
        }
        return [];
      }),
    [pathSteps, pathStepsMetadataByKey]
  );

  const initCustomTracksEntry = useCallback(
    (location: PathItemLocation | null) => {
      const opKey = getOpKey(location);
      if (opKey && !customTracksByOpKey.has(opKey)) {
        setCustomTracksByOpKey((prev) => new Map(prev).set(opKey, []));
      }
    },
    [customTracksByOpKey]
  );

  const applyOperationalPointToStep = (
    stepKey: string,
    suggestion: OperationalPointSuggestion,
    forcedCh?: string
  ) => {
    const chosenCh = chooseChForSuggestion(stepKey, suggestion, forcedCh);
    if (!chosenCh) return;
    pendingStepKeyRef.current = stepKey;
    confirmedStepKeyRef.current = stepKey;
    let opRef: OperationalPointReference;

    if (suggestion.uic) {
      opRef = { type: 'uic', uic: suggestion.uic, secondary_code: chosenCh };
    } else if (suggestion.mainCode) {
      opRef = { type: 'trigram', trigram: suggestion.mainCode, secondary_code: chosenCh };
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
        step.key === stepKey ? { ...step, location: newLocation } : step
      );
      return ensureTrailingEmptyStep(next);
    });
    initCustomTracksEntry(newLocation);
    commitSelectionForStep(stepKey, formatChosenValue(suggestion, chosenCh));
    resetOpSuggestions();
  };
  const isOnlyStep = pathSteps.length === 1;

  const hasInvalidPathStep = pathSteps.some((step) => {
    if (isEmptyStep(step, getInputForStep(step.key))) return false;
    const meta = pathStepsMetadataByKey.get(step.key);
    return !meta || meta.isInvalid;
  });
  const handleDeletePathStep = (stepKey: string) => {
    resetOpSuggestions();

    if (activeStepKey === stepKey) setActiveStepKey('');
    if (mapSelectionStepKey === stepKey) setMapSelectionStepKey(null);

    setPathSteps((prev) => {
      const step = prev.find((s) => s.key === stepKey);
      if (!step) return prev;

      const next = deletePathStep(prev, stepKey);
      return ensureTrailingEmptyStep(next);
    });
  };

  const handleAddIntermediateStep = (insertIndex: number) => {
    resetOpSuggestions();
    setHoveredGapIndex(null);

    const newStep = createEmptyPathStep();

    setPathSteps((prev) => ensureTrailingEmptyStep(addElementAtIndex(prev, insertIndex, newStep)));

    setActiveStepKey(newStep.key);
    setInputForStep(newStep.key, '');
  };

  const handleAddWaypoint = useCallback(
    (op: CoreOperationalPointOnPath, afterStepKey: string) => {
      const insertIndex = pathSteps.findIndex((step) => step.key === afterStepKey) + 1;
      if (insertIndex === 0) return;

      const newStep = createEmptyPathStep();

      newStep.location = {
        type: 'operational_point_part_reference',
        operational_point: {
          type: 'trigram',
          trigram: op.main_code,
          secondary_code: op.secondary_code,
        },
      };
      initCustomTracksEntry(newStep.location);

      // Sample the path geometry at the op position so the prefilled marker has
      // coordinates:
      const geometry = pathProperties?.geometry;
      const coordinates = geometry
        ? along(lineString(geometry.coordinates), op.position, { units: 'millimeters' }).geometry
            .coordinates
        : undefined;

      // Pre-fill the metadata so the new step shows its name right away and
      // is not briefly flagged invalid while its OP match is fetched
      setPathStepMetadata(newStep.key, {
        type: 'opRef',
        isInvalid: false,
        name: op.name,
        uic: op.uic,
        secondaryCode: op.secondary_code,
        parts: coordinates
          ? [
              {
                type: 'valid',
                trackId: op.part.track,
                trackName: op.part.local_track_name,
                coordinates,
              },
            ]
          : [],
      });

      setPathSteps((prev) =>
        ensureTrailingEmptyStep(addElementAtIndex(prev, insertIndex, newStep))
      );
    },
    [pathSteps, pathProperties, initCustomTracksEntry, setPathStepMetadata]
  );

  const isStepInvalidAndIsEditing = (step: PathStepV2, metadata?: PathStepMetadata) => {
    if (!metadata?.isInvalid) return false;

    const query = (getInputForStep(step.key) ?? '').trim();
    const isEditing = editingStepKeyRef.current === step.key;
    const isPending = pendingStepKeyRef.current === step.key;
    // A step with no location is invalid only if the user typed something and isn't currently editing

    if (!step.location) {
      return query.length > 0 && !isEditing;
    }

    // A step with a location can still be invalid (OP not found in current infra).
    // Show the error as long as the user is not actively editing it, or if the query is empty
    return !isEditing && !isPending && query.length === 0;
  };

  const hasInvalidPathStepDisplay = pathSteps.some((step) =>
    isStepInvalidAndIsEditing(step, pathStepsMetadataByKey.get(step.key))
  );

  const locatedStepsCount = pathSteps.filter((step) => step.location !== null).length;

  const displayedPathProperties =
    workerStatus === 'READY' && locatedStepsCount >= 2 && !hasInvalidPathStep
      ? pathProperties
      : undefined;

  const waypointsPanelStatus = useMemo<'idle' | 'loading' | 'error' | 'success'>(() => {
    if (pathfindingError) return 'error';
    if (displayedPathProperties) return 'success';

    // No path properties yet: distinguish "pathfinding is on its way" (loading)
    // from "the itinerary isn't set up enough to trigger it" (idle).
    const isPathfindingPending =
      workerStatus === 'READY' &&
      locatedStepsCount >= 2 &&
      !hasInvalidPathStep &&
      !!modalFormState.rollingStockId;
    return isPathfindingPending ? 'loading' : 'idle';
  }, [
    workerStatus,
    locatedStepsCount,
    hasInvalidPathStep,
    modalFormState.rollingStockId,
    pathfindingError,
    displayedPathProperties,
  ]);

  const canOpenWaypointsPanel =
    waypointsPanelStatus === 'success' || waypointsPanelStatus === 'loading';
  const waypointsPanelButtonDisabled = !waypointsPanelOpen && !canOpenWaypointsPanel;

  const markEditing = (stepId: string) => {
    editingStepKeyRef.current = stepId;
    setActiveStepKey(stepId);
  };

  const unmarkEditing = (stepId: string) => {
    if (editingStepKeyRef.current === stepId) editingStepKeyRef.current = '';
    if (activeStepKey === stepId) setActiveStepKey('');
  };

  const handleStartMapSelection = useCallback(
    (stepId: string) => {
      setMapSelectionStepKey(stepId);
      const metadata = pathStepsMetadataByKey.get(stepId);
      if (metadata) {
        const coordinates = computePathStepCoordinates(metadata);
        if (coordinates.length > 0) {
          dispatch(updateViewport({ longitude: coordinates[0][0], latitude: coordinates[0][1] }));
        }
      }
    },
    [pathStepsMetadataByKey, dispatch, updateViewport]
  );

  const handleOutsideMapClick = useCallback(() => {}, []);

  const handleMapSelectionClick = useCallback(
    async (featureInfoClick: FeatureInfoClick) => {
      if (!mapSelectionStepKey) return;

      const location = await convertFeatureClickToLocation(featureInfoClick);
      if (!location) return;

      const stepId = mapSelectionStepKey;
      setPathSteps((prev) =>
        ensureTrailingEmptyStep(prev.map((s) => (s.key === stepId ? { ...s, location } : s)))
      );
      setInputForStep(stepId, '');
      setMapSelectionStepKey(null);
    },
    [mapSelectionStepKey, pathSteps, convertFeatureClickToLocation, setInputForStep]
  );

  const handleOpSelectionConfirm = useCallback(
    (location: PathItemLocation, displayName: string) => {
      if (!mapSelectionStepKey) return;
      const stepId = mapSelectionStepKey;
      setPathSteps((prev) =>
        ensureTrailingEmptyStep(prev.map((s) => (s.key === stepId ? { ...s, location } : s)))
      );
      if (displayName) {
        commitSelectionForStep(stepId, displayName);
      } else {
        setInputForStep(stepId, '');
      }
      setMapSelectionStepKey(null);
    },
    [mapSelectionStepKey, commitSelectionForStep, setInputForStep]
  );

  const handlePathStepDragEnd = useCallback(
    async (stepKey: string, featureInfoClick: FeatureInfoClick) => {
      const location = await convertFeatureClickToLocation(featureInfoClick);
      if (!location) return;

      setPathSteps((prev) =>
        ensureTrailingEmptyStep(
          prev.map((step) => (step.key === stepKey ? { ...step, location } : step))
        )
      );
      setInputForStep(stepKey, '');
      setMapSelectionStepKey(null);
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
      const allMarkersCoordinates = pathStepsMetadataByKey
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
      displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit ||
      displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add ||
      displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.itinerary
    ) {
      const formattedPathSteps = storePathSteps
        .filter((pathStep): pathStep is PathStep => pathStep !== null)
        .map<PathStepV2>((pathStep) => ({
          key: pathStep.key,
          location: pathStep.location,
          arrival: pathStep.arrival ?? null,
          stopFor: pathStep.stopFor ?? null,
          theoreticalMargin: pathStep.theoreticalMargin ?? null,
          receptionSignal: pathStep.receptionSignal ?? null,
        }));
      formattedPathSteps.forEach((step) => {
        initCustomTracksEntry(step.location);
      });
      setPathSteps(ensureTrailingEmptyStep(formattedPathSteps));
    }
  }, [storePathSteps, displayTrainScheduleManagement]);

  const pathfindingStepsWithLocations = useMemo(
    () =>
      pathSteps.filter((s) => {
        if (!s.location) return false;
        const meta = pathStepsMetadataByKey.get(s.key);
        return !!meta && !meta.isInvalid;
      }),
    [pathSteps, pathStepsMetadataByKey]
  );
  const pathfindingStepsRef = useRef<PathStepV2[]>([]);

  const pathfindingSteps = useMemo(() => {
    const prev = pathfindingStepsRef.current;
    const next = pathfindingStepsWithLocations;

    const sameSteps =
      prev.length === next.length &&
      prev.every((p, i) => p.key === next[i].key && p.location === next[i].location);

    if (sameSteps) return prev;

    pathfindingStepsRef.current = next;
    return next;
  }, [pathfindingStepsWithLocations]);

  useEffect(() => {
    if (workerStatus !== 'READY' || !modalFormState.rollingStockId || pathfindingSteps.length < 2)
      return;

    const pathfindingLocations = pathfindingSteps.map((s) => s.location!);
    const metadataByPathStepKey = new Map(
      pathfindingSteps.map((s) => [s.key, pathStepsMetadataByKey.get(s.key)!])
    );

    launchPathfindingV2({
      pathSteps: pathfindingLocations,
      pathStepsMetadataByKey: metadataByPathStepKey,
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

  const buildPathSteps = (steps: PathStepV2[], metadataByKey: Map<string, PathStepMetadata>) =>
    steps
      .filter((step) => step.location !== null)
      .map<PathStep>((step) => {
        const metadata = metadataByKey.get(step.key);

        const baseStep = {
          key: step.key,
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
            metadata.type === 'trackOffset'
              ? metadata.coordinates
              : metadata.parts.find((p) => p.type === 'valid')?.coordinates,
        };
      });

  const clearStep = (stepKey: string) => {
    setInputForStep(stepKey, '');
    resetOpSuggestions();

    setPathSteps((prev) =>
      ensureTrailingEmptyStep(
        prev.map((step) => (step.key === stepKey ? { ...step, location: null } : step))
      )
    );
  };

  const reverseItinerary = () => {
    const filledSteps = pathSteps.filter((step) => !isEmptyStep(step, getInputForStep(step.key)));
    const updatedPathSteps = buildPathSteps(filledSteps, pathStepsMetadataByKey);

    if (updatedPathSteps.length < 2) return;

    launchPathfinding(reversePathSteps(updatedPathSteps), modalFormState.rollingStockId);
  };
  const submitItinerary = () => {
    setSubmitAttempted(true);
    setBannerWiggle((c) => c + 1);
    if (isNameEmpty) return;

    const stepsWithLocationOrInput = pathSteps.filter(
      (step) => !isEmptyStep(step, getInputForStep(step.key))
    );
    if (stepsWithLocationOrInput.length < 2) return;

    const stepsWithStopAtDestination = stepsWithLocationOrInput.map((step, i) =>
      i === stepsWithLocationOrInput.length - 1
        ? { ...step, stopFor: new Duration({ minutes: 0 }) }
        : step
    );
    //TODO this variable name should be changed when we no longer have to convert from v2 to v1 for path steps
    const pathStepsFromV2 = buildPathSteps(stepsWithStopAtDestination, pathStepsMetadataByKey);

    if (pathStepsFromV2.length < 2) return;

    dispatch(
      updateItineraryForm({
        name: modalFormState.name ?? '',
        category: modalFormState.category ?? null,
        rollingStockId: modalFormState.rollingStockId,
        rollingStockName: modalFormState.rollingStockName,
        speedLimitTag: modalFormState.speedLimitTag,
        pathSteps: pathStepsFromV2,
      })
    );

    launchPathfinding(pathStepsFromV2, modalFormState.rollingStockId, { isInitialization: true });
    closeModal({ withChanges: true });
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
    if (locatedStepsCount < 2 || pathStepsMetadataByKey.size < 2) return;

    frameAllPathSteps();
  }, [pathStepsMetadataByKey, hasInvalidPathStep]);

  const resetCategoryWarning = useCallback(() => {
    setCategoryWarning(undefined);
  }, [setCategoryWarning]);

  return (
    <dialog ref={modalRef} className="itinerary-modal" data-testid="itinerary-modal">
      <div
        className="itinerary-modal-form"
        data-testid="itinerary-modal-form"
        onClick={handleOutsideMapClick}
        role="presentation"
      >
        {mapSelectionStepKey && <div className="map-selection-form-overlay" />}
        <div className="itinerary-modal-form-header" data-testid="itinerary-modal-form-header">
          <ItineraryModalFormHeader
            modalFormState={modalFormState}
            onModalFormStateChange={setModalFormState}
            onCategoryWarningChange={setCategoryWarning}
            onRollingStockMessageChange={setRollingStockMessage}
            currentSubCategory={currentSubCategory}
            categoryColors={categoryColors}
            submitAttempted={submitAttempted}
            isNameEmpty={isNameEmpty}
          />
        </div>
        <div className="itinerary-modal-form-body" data-testid="itinerary-modal-form-body">
          {categoryWarning && <Banner message={categoryWarning} onClose={resetCategoryWarning} />}
          {rollingStockMessage && <Banner type="info" message={rollingStockMessage} />}
          {(hasInvalidPathStepDisplay || invalidTrackSteps.length > 0) && (
            <div key={`invalid-op-${bannerWiggle}`}>
              <Banner
                type="info"
                message={
                  invalidTrackSteps.length > 0
                    ? `${t('unknownTrack', {
                        names: invalidTrackSteps.join(', '),
                      })}. ${t('noComputation')}.`
                    : `${t('alertInvalidOP')}. ${t('noComputation')}.`
                }
              />
            </div>
          )}
          {!hasInvalidPathStepDisplay && invalidTrackSteps.length === 0 && pathfindingError && (
            <div key={`pathfinding-${bannerWiggle}`}>
              <Banner type="info" message={`${pathfindingError} ${t('noComputation')}.`} />
            </div>
          )}
          {submitAttempted &&
            !hasInvalidPathStepDisplay &&
            (!pathSteps[0]?.location || locatedStepsCount < 2) && (
              <div key={`missing-step-${bannerWiggle}`}>
                <Banner
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
          <div
            className={cx('path-step-list', {
              'with-invalid-step': hasInvalidPathStepDisplay || invalidTrackSteps.length > 0,
            })}
          >
            <div className="itinerary-icons">
              <button
                data-testid="reverse-itinerary-button"
                className="reverse-itinerary-button"
                type="button"
                onClick={reverseItinerary}
              >
                <ArrowSwitch />
              </button>
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
              const opKey = getOpKey(pathStep.location);
              const pathStepMetadata = pathStepsMetadataByKey.get(pathStep.key);
              const isInvalid = isStepInvalidAndIsEditing(pathStep, pathStepMetadata);
              const isMapSelecting = mapSelectionStepKey === pathStep.key;

              const previousPathStepMetadata = pathStepsMetadataByKey.get(pathSteps[i - 1]?.key);
              const isTrailingPlaceholder =
                i === pathSteps.length - 1 && isEmptyStep(pathStep, getInputForStep(pathStep.key));

              return (
                <>
                  {!isTrailingPlaceholder && (
                    <div className="path-step-gap">
                      {hoveredGapIndex === i && <div className="path-step-gap-line" />}

                      <div
                        className="path-step-gap-hitbox"
                        data-testId="path-step-gap"
                        onPointerEnter={() => setHoveredGapIndex(i)}
                        onPointerLeave={() => setHoveredGapIndex(null)}
                      >
                        {hoveredGapIndex === i && (
                          <button
                            type="button"
                            className="add-pathitem"
                            data-testId="add-path-step-button"
                            onClick={() => handleAddIntermediateStep(i)}
                          >
                            <Plus iconColor="var(--white100)" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <PathStepItem
                    key={pathStep.key}
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
                      handleDeletePathStep(pathStep.key);
                    }}
                    onOpClear={() => {
                      clearStep(pathStep.key);
                      handleDeletePathStep(pathStep.key);
                    }}
                    onOpFocus={() => {
                      markEditing(pathStep.key);
                      if (!pathStep.location) {
                        clearStep(pathStep.key);
                      }
                      focusValueRef.current[pathStep.key] =
                        getInputForStep(pathStep.key) ??
                        (pathStepMetadata &&
                        !pathStepMetadata.isInvalid &&
                        pathStepMetadata.type === 'opRef'
                          ? `${pathStepMetadata.name} ${pathStepMetadata.secondaryCode}`
                          : '');
                    }}
                    onOpInputChange={(value) => {
                      markEditing(pathStep.key);
                      if (
                        value === '' &&
                        pathStep.location &&
                        getInputForStep(pathStep.key) === undefined
                      ) {
                        return;
                      }
                      setInputForStep(pathStep.key, value);
                    }}
                    customTracks={customTracksByOpKey.get(opKey ?? '') ?? []}
                    onAddCustomTrack={(track) => {
                      if (!opKey) return;
                      setCustomTracksByOpKey((prev) => {
                        const next = new Map(prev);
                        const existing = next.get(opKey) ?? [];
                        next.set(opKey, [...existing, track]);
                        return next;
                      });
                    }}
                    onTrackNameChange={(trackName) => {
                      setPathSteps((prev) =>
                        prev.map((step) => {
                          if (step.key !== pathStep.key) return step;
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
                      const valueOnFocus = focusValueRef.current[pathStep.key];
                      const valueOnBlur = getInputForStep(pathStep.key);

                      if (
                        pendingStepKeyRef.current === pathStep.key ||
                        confirmedStepKeyRef.current === pathStep.key
                      ) {
                        pendingStepKeyRef.current = '';
                        confirmedStepKeyRef.current = '';
                        unmarkEditing(pathStep.key);
                        return;
                      }

                      if (valueOnBlur === undefined) {
                        unmarkEditing(pathStep.key);
                        return;
                      }

                      const normalizedOnFocus = valueOnFocus ?? '';
                      const normalizedOnBlur = valueOnBlur;

                      if (normalizedOnBlur === '' && normalizedOnFocus === '') {
                        unmarkEditing(pathStep.key);
                        return;
                      }

                      if (normalizedOnBlur === '') {
                        clearStep(pathStep.key);
                      } else if (normalizedOnBlur !== normalizedOnFocus) {
                        setInputForStep(pathStep.key, normalizedOnFocus);
                      }

                      unmarkEditing(pathStep.key);
                    }}
                    inputValue={getInputForStep(pathStep.key)}
                    opSuggestions={activeStepKey === pathStep.key ? opSuggestions : []}
                    onSelectOpSuggestion={(suggestion, chCode) => {
                      applyOperationalPointToStep(pathStep.key, suggestion, chCode);
                    }}
                    onChevronClick={(queryValue) => {
                      reopenSuggestionsForStep(pathStep.key, queryValue);
                    }}
                    resetOpSuggestions={resetOpSuggestions}
                    connectorLong={hoveredGapIndex === i}
                    isTrailingPlaceHolder={isTrailingPlaceholder}
                    isOnlyStep={isOnlyStep}
                    isInvalidAndIsEditing={isInvalid}
                    isMapSelectionMode={isMapSelecting}
                    isDestination={i === pathSteps.length - 2}
                    onStartMapSelection={() => handleStartMapSelection(pathStep.key)}
                    onCancelMapSelection={handleCancelMapSelection}
                  />
                </>
              );
            })}
            <button
              data-testid="show-intermediate-waypoints-button"
              className="show-intermediate-waypoints-button"
              type="button"
              onClick={() => setWaypointsPanelOpen((v) => !v)}
              disabled={waypointsPanelButtonDisabled}
              aria-expanded={waypointsPanelOpen}
              aria-label={toggleWaypointsPanelLabel}
            >
              {waypointsPanelOpen ? <Fold /> : <Unfold />}
              <span className="show-intermediate-waypoints-button__label" aria-hidden>
                {toggleWaypointsPanelLabel}
              </span>
            </button>
          </div>
        </div>
        <div className="itinerary-modal-form-footer" data-testid="itinerary-modal-form-footer">
          <Button
            label={t('cancel')}
            variant="Cancel"
            size="medium"
            onClick={() => closeModal({ withChanges: false })}
            dataTestID="close-itinerary-modal"
          />
          <Button
            label={
              displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.itinerary
                ? t('edit')
                : t('next')
            }
            variant="Primary"
            size="medium"
            onClick={submitItinerary}
            dataTestID="itinerary-modal-next-button"
          />
        </div>
      </div>
      {waypointsPanelOpen && (
        <div className="itinerary-modal-waypoints-panel-wrapper">
          <IntermediateWaypointsPanel
            pathSteps={pathSteps}
            pathProperties={displayedPathProperties}
            status={waypointsPanelStatus}
            onHide={() => setWaypointsPanelOpen(false)}
            onAddWaypoint={handleAddWaypoint}
          />
        </div>
      )}
      <div
        className={cx('itinerary-modal-map', {
          'map-selection-active': mapSelectionStepKey !== null,
        })}
        data-testid="itinerary-modal-map"
      >
        <ItineraryModalMap
          pathSteps={pathSteps}
          pathStepsMetadata={pathStepsMetadataByKey}
          pathProperties={displayedPathProperties}
          selectedStepKey={mapSelectionStepKey ?? undefined}
          isMapSelectionMode={mapSelectionStepKey !== null}
          onMapSelectionClick={handleMapSelectionClick}
          onPathStepDragEnd={handlePathStepDragEnd}
          onOpSelectionConfirm={handleOpSelectionConfirm}
          getStepName={getInputForStep}
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
