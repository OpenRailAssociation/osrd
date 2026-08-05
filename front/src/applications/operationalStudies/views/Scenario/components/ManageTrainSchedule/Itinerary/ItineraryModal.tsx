import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import { ArrowSwitch, Fold, FrameAll, Plus, Unfold } from '@osrd-project/ui-icons';
import along from '@turf/along';
import bbox from '@turf/bbox';
import { lineString } from '@turf/helpers';
import cx from 'classnames';
import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useCategoryColors from 'applications/operationalStudies/hooks/useCategoryColors';
import { useItineraryModalContext } from 'applications/operationalStudies/hooks/useItineraryModalContext';
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
  getEditingTrainType,
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
import ItineraryModalFooter, { type FooterTrainType } from './ItineraryModalFooter';
import ItineraryModalFormHeader from './ItineraryModalFormHeader';
import ItineraryModalMap from './ItineraryModalMap';
import PathStepItem from './PathStepItem';
import { computePathStepCoordinates, getOpKey, isOpRefMetadata } from './utils';

type ItineraryModalProps = {
  itineraryModalIsOpen: boolean;
  onClose: ({ withChanges }: { withChanges: boolean }) => void;
};

export type ItineraryModalFormState = {
  name?: string;
  rollingStockId?: number;
  rollingStockName: string;
  speedLimitTag?: string;
  category?: TrainCategory;
};

const ItineraryModal = ({ itineraryModalIsOpen, onClose }: ItineraryModalProps) => {
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
  const editingTrainType = useSelector(getEditingTrainType);

  const [modalFormState, setModalFormState] = useState<ItineraryModalFormState>({
    name,
    rollingStockId,
    rollingStockName: rollingStockName ?? '',
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
  const [rollingStockMessage, setRollingStockMessage] = useState<string | undefined>(undefined);
  const [bannerWiggle, setBannerWiggle] = useState(0);

  const [hoveredGapIndex, setHoveredGapIndex] = useState<number | null>(null);
  const [mapSelectionStepId, setMapSelectionStepId] = useState<string | null>(null);
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
    setMapSelectionStepId(null);
  }, []);

  const handleEscapeOrClose = useCallback(() => {
    if (mapSelectionStepId !== null) {
      handleCancelMapSelection();
    } else {
      closeModal({ withChanges: false });
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
    chooseSecondaryCodeForSuggestion,
    reopenSuggestionsForStep,
  } = useOperationalPointSearch({});

  const { trainScheduleToEditData } = useItineraryModalContext();
  const { launchPathfinding } = useManageTrainScheduleContext();

  const { pathStepsMetadataById, setPathStepMetadata } = usePathStepsMetadata(
    pathSteps,
    pendingStepIdRef
  );
  const { launchPathfindingV2, pathProperties, pathfindingError } = usePathfindingV2();
  const { convertFeatureClickToLocation } = useMapTrackSelection(infraId);

  // Fetch local track names from timetable train schedules is now handled inside usePathStepsMetadata
  const invalidTrackSteps = useMemo(
    () =>
      pathSteps.flatMap((step) => {
        if (isEmptyStep(step, getInputForStep(step.id))) return [];
        const metadata = pathStepsMetadataById.get(step.id);
        if (isOpRefMetadata(metadata) && metadata.trackName && !metadata.isValidLocalTrackName) {
          return [`${metadata.name} ${metadata.secondaryCode}`];
        }
        return [];
      }),
    [pathSteps, pathStepsMetadataById]
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
    stepId: string,
    suggestion: OperationalPointSuggestion,
    forcedCh?: string
  ) => {
    const chosenSecondaryCode = chooseSecondaryCodeForSuggestion(stepId, suggestion, forcedCh);
    if (!chosenSecondaryCode) return;
    pendingStepIdRef.current = stepId;
    confirmedStepIdRef.current = stepId;
    let opRef: OperationalPointReference;

    if (suggestion.uic) {
      opRef = { type: 'uic', uic: suggestion.uic, secondary_code: chosenSecondaryCode };
    } else if (suggestion.mainCode) {
      opRef = {
        type: 'domestic',
        main_code: suggestion.mainCode,
        secondary_code: chosenSecondaryCode,
        country_code: suggestion.countryCode,
      };
    } else {
      const chosenOpId = suggestion.secondaryCodeList.find(
        (c) => c.code === chosenSecondaryCode
      )?.opId;
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
    initCustomTracksEntry(newLocation);
    commitSelectionForStep(stepId, formatChosenValue(suggestion, chosenSecondaryCode));
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
    if (mapSelectionStepId === stepId) setMapSelectionStepId(null);

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

  const handleAddWaypoint = useCallback(
    (op: CoreOperationalPointOnPath, afterStepId: string) => {
      const insertIndex = pathSteps.findIndex((step) => step.id === afterStepId) + 1;
      if (insertIndex === 0) return;

      const newStep = createEmptyPathStep();

      newStep.location = {
        type: 'operational_point_part_reference',
        operational_point: {
          type: 'domestic',
          country_code: op.country_code,
          main_code: op.main_code,
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
      setPathStepMetadata(newStep.id, {
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

  /**Return true if the path step is invalid and is not a placeholder, not being fetched and not being edited */
  const isStepInvalidAndFinal = (step: PathStepV2, metadata?: PathStepMetadata) => {
    const query = (getInputForStep(step.id) ?? '').trim();
    const isEditing = editingStepIdRef.current === step.id || query.length > 0;
    const isPending = pendingStepIdRef.current === step.id;
    // if not step.location, the step is a placeholder waiting for user input
    return !isEditing && !isPending && !!step.location && !!metadata?.isInvalid;
  };

  const hasInvalidPathStepDisplay = pathSteps.some((step) =>
    isStepInvalidAndFinal(step, pathStepsMetadataById.get(step.id))
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

  const handleOpSelectionConfirm = useCallback(
    (location: PathItemLocation, displayName: string) => {
      if (!mapSelectionStepId) return;
      const stepId = mapSelectionStepId;
      setPathSteps((prev) =>
        ensureTrailingEmptyStep(prev.map((s) => (s.id === stepId ? { ...s, location } : s)))
      );
      if (displayName) {
        commitSelectionForStep(stepId, displayName);
      } else {
        setInputForStep(stepId, '');
      }
      setMapSelectionStepId(null);
    },
    [mapSelectionStepId, commitSelectionForStep, setInputForStep]
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
    formattedPathSteps.forEach((step) => {
      initCustomTracksEntry(step.location);
    });
    setPathSteps(ensureTrailingEmptyStep(formattedPathSteps));
  }, [storePathSteps]);

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
            metadata.type === 'trackOffset'
              ? metadata.coordinates
              : metadata.parts.find((p) => p.type === 'valid')?.coordinates,
        };
      });

  const clearStep = (stepId: string) => {
    setInputForStep(stepId, '');
    resetOpSuggestions();

    setPathSteps((prev) =>
      ensureTrailingEmptyStep(
        prev.map((step) => (step.id === stepId ? { ...step, location: null } : step))
      )
    );
  };

  const reverseItinerary = () => {
    const filledSteps = pathSteps.filter((step) => !isEmptyStep(step, getInputForStep(step.id)));
    const updatedPathSteps = buildPathSteps(filledSteps, pathStepsMetadataById);

    if (updatedPathSteps.length < 2) return;

    launchPathfinding(reversePathSteps(updatedPathSteps), modalFormState.rollingStockId);
  };
  const submitItinerary = (trainType?: FooterTrainType) => {
    setSubmitAttempted(true);
    setBannerWiggle((c) => c + 1);
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
        rollingStockName: modalFormState.rollingStockName,
        speedLimitTag: modalFormState.speedLimitTag,
        pathSteps: pathStepsFromV2,
        trainType,
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
    if (locatedStepsCount < 2 || pathStepsMetadataById.size < 2) return;

    frameAllPathSteps();
  }, [pathStepsMetadataById, hasInvalidPathStep]);

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
        {mapSelectionStepId && <div className="map-selection-form-overlay" />}
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
              <Banner type="info" message={`${pathfindingError}. ${t('noComputation')}.`} />
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
              const pathStepMetadata = pathStepsMetadataById.get(pathStep.id);
              const isInvalidAndFinal = isStepInvalidAndFinal(pathStep, pathStepMetadata);
              const isMapSelecting = mapSelectionStepId === pathStep.id;

              const previousPathStepMetadata = pathStepsMetadataById.get(pathSteps[i - 1]?.id);
              const isTrailingPlaceholder =
                i === pathSteps.length - 1 && isEmptyStep(pathStep, getInputForStep(pathStep.id));

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
                    key={pathStep.id}
                    pathStep={pathStep}
                    setPathSteps={setPathSteps}
                    pathStepMetadata={pathStepMetadata}
                    index={i + 1}
                    categoryColors={categoryColors}
                    hidePathfindingLine={
                      i > 0 &&
                      !isTrailingPlaceholder &&
                      (isInvalidAndFinal || !!previousPathStepMetadata?.isInvalid)
                    }
                    onDelete={() => {
                      handleDeletePathStep(pathStep.id);
                    }}
                    onOpClear={() => {
                      clearStep(pathStep.id);
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

                      if (valueOnBlur === undefined) {
                        unmarkEditing(pathStep.id);
                        return;
                      }

                      const normalizedOnFocus = valueOnFocus ?? '';
                      const normalizedOnBlur = valueOnBlur;

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
                    isInvalidAndFinal={isInvalidAndFinal}
                    isMapSelectionMode={isMapSelecting}
                    isDestination={i === pathSteps.length - 2}
                    onStartMapSelection={() => handleStartMapSelection(pathStep.id)}
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
        <ItineraryModalFooter
          mode={trainScheduleToEditData === undefined ? 'new' : 'edit'}
          trainType={editingTrainType}
          onCancel={() => closeModal({ withChanges: false })}
          onSubmit={submitItinerary}
        />
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
          'map-selection-active': mapSelectionStepId !== null,
        })}
        data-testid="itinerary-modal-map"
      >
        <ItineraryModalMap
          pathSteps={pathSteps}
          pathStepsMetadata={pathStepsMetadataById}
          pathProperties={displayedPathProperties}
          selectedStepId={mapSelectionStepId ?? undefined}
          isMapSelectionMode={mapSelectionStepId !== null}
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
