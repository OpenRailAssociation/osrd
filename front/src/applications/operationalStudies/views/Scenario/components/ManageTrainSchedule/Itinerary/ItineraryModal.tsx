import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import { ArrowSwitch, Fold, FrameAll, Plus, Unfold } from '@osrd-project/ui-icons';
import along from '@turf/along';
import bbox from '@turf/bbox';
import { lineString } from '@turf/helpers';
import cx from 'classnames';
import type { Position } from 'geojson';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import useCategoryColors from 'applications/operationalStudies/hooks/useCategoryColors';
import {
  useItineraryModalContext,
  type TrainScheduleToEditData,
} from 'applications/operationalStudies/hooks/useItineraryModalContext';
import { useOperationalPointSearch } from 'applications/operationalStudies/hooks/useOperationalPointSearch';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { PowerRestriction } from 'applications/operationalStudies/types';
import type {
  CoreOperationalPointOnPath,
  OperationalPointReference,
  PathProperties,
  PathItemLocation,
  TrainCategory,
  Distribution,
  Comfort,
  TimetableType,
} from 'common/api/osrdEditoastApi';
import Banner from 'common/Banner';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { useInfraID } from 'common/osrdContext';
import IncompatibleConstraints from 'modules/pathfinding/components/IncompatibleConstraints';
import TypeAndPath from 'modules/pathfinding/components/Pathfinding/TypeAndPath';
import reversePathSteps from 'modules/pathfinding/helpers/reversePathSteps';
import usePathfindingV2 from 'modules/pathfinding/hooks/usePathfindingV2';
import computeBasePathStep from 'modules/trainSchedule/helpers/computeBasePathStep';
import {
  DEFAULT_PACED_TRAIN_INTERVAL,
  getDefaultPacedTrainTimeWindow,
  isPacedTrainWithDetails,
} from 'modules/trainSchedule/helpers/pacedTrain';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type {
  EditingTrainType,
  PathStep,
  PathStepMetadata,
  PathStepV2,
} from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { addElementAtIndex } from 'utils/array';
import { Duration, type StartTime, startTimeToDate } from 'utils/duration';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';
import { msToKmh } from 'utils/physics';

import {
  createEmptyPathStep,
  ensureTrailingEmptyStep,
  isEmptyStep,
  deletePathStep,
} from '../helpers/pathStepsActions';
import { useCreateTrainSchedule } from '../hooks/useCreateTrainSchedule';
import useMapTrackSelection from '../hooks/useMapTrackSelection';
import useUpdateTrainSchedule from '../hooks/useUpdateTrainSchedule';
import type { FeatureInfoClick } from '../types';
import type { OperationalPointSuggestion } from './ComboBoxCustomList/ListElementComponent';
import { usePathStepsMetadata } from './hooks/usePathStepsMetadata';
import IntermediateWaypointsPanel from './IntermediateWaypointsPanel/IntermediateWaypointsPanel';
import ItineraryModalFooter from './ItineraryModalFooter';
import ItineraryModalFormHeader from './ItineraryModalFormHeader';
import ItineraryModalMap from './ItineraryModalMap';
import PathStepItem from './PathStepItem';
import { computePathStepCoordinates, getOpKey, isOpRefMetadata } from './utils';

type ItineraryModalProps = {
  onTrainCreated: () => void;
  trainScheduleToEditData?: TrainScheduleToEditData;
  defaultStartTime?: StartTime;
};

export type ItineraryModalFormState = {
  name: string;
  rollingStockId?: number;
  rollingStockName: string;
  speedLimitTag?: string;
  category?: TrainCategory;
};

export type ItineraryModalTrainState = {
  name: string;
  category: TrainCategory | null;
  startTime: StartTime;
  initialSpeed?: number;
  labels: string[];
  rollingStockId?: number;
  rollingStockName: string;
  rollingStockComfort: Comfort;
  pathSteps: (PathStep | null)[];
  constraintDistribution: Distribution;
  usingElectricalProfiles: boolean;
  usingSpeedLimits: boolean;
  stopsAtEndOfBlock: boolean;
  powerRestriction: PowerRestriction[];
  timeWindow: Duration;
  interval: Duration;
  addedExceptions: {
    startTime: StartTime;
  }[];
  editingTrainType: 'uniqueTrain' | 'pacedTrain' | 'occurrence';
  speedLimitByTag?: string;
};

export function blankNewTrainState(
  startTime: StartTime | undefined,
  timetableType: TimetableType
): ItineraryModalTrainState {
  startTime ??= timetableType === 'CALENDAR' ? new Date() : Duration.zero;

  return {
    name: '',
    startTime,
    initialSpeed: 0,
    labels: [],
    rollingStockId: undefined,
    rollingStockName: '',
    rollingStockComfort: 'STANDARD',
    category: null,
    // Corresponds to origin and destination not defined
    pathSteps: [null, null],
    constraintDistribution: 'STANDARD',
    usingElectricalProfiles: true,
    usingSpeedLimits: true,
    stopsAtEndOfBlock: false,
    powerRestriction: [],
    timeWindow: getDefaultPacedTrainTimeWindow(timetableType),
    interval: DEFAULT_PACED_TRAIN_INTERVAL,
    addedExceptions: [],
    // An hourly timetable only holds services, never unique trains
    editingTrainType: timetableType === 'HOURLY' ? 'pacedTrain' : 'uniqueTrain',
  };
}

export function setupStateWithTrainSchedule(
  trainSchedule: TrainScheduleWithDetails,
  timetableType: TimetableType,
  isOccurrence?: boolean
): ItineraryModalTrainState {
  const state: ItineraryModalTrainState = {
    rollingStockName: trainSchedule.rollingStockName,
    rollingStockId: trainSchedule.rollingStock?.id,
    rollingStockComfort: trainSchedule.comfort ?? 'STANDARD',
    pathSteps: trainSchedule.path.map((_, index) => computeBasePathStep(trainSchedule, index)),
    // TODO Hourly timetables: keep the Duration start time in the conf state instead of a fictive date
    startTime: startTimeToDate(trainSchedule.startTime),
    name: trainSchedule.name,
    category: trainSchedule.category ?? null,
    initialSpeed: trainSchedule.initial_speed
      ? Math.floor(msToKmh(trainSchedule.initial_speed) * 10) / 10
      : 0,
    usingElectricalProfiles: trainSchedule.options?.use_electrical_profiles ?? true,
    usingSpeedLimits: trainSchedule.options?.use_speed_limits_for_simulation ?? true,
    stopsAtEndOfBlock: trainSchedule.options?.stops_at_end_of_block ?? false,
    labels: trainSchedule.labels,
    speedLimitByTag: trainSchedule.speedLimitTag || undefined,
    powerRestriction: trainSchedule.power_restrictions || [],
    constraintDistribution: trainSchedule.constraint_distribution || 'STANDARD',
    editingTrainType: 'uniqueTrain',
    timeWindow: getDefaultPacedTrainTimeWindow(timetableType),
    interval: DEFAULT_PACED_TRAIN_INTERVAL,
    addedExceptions: [],
  };

  if (isPacedTrainWithDetails(trainSchedule)) {
    state.editingTrainType = isOccurrence ? 'occurrence' : 'pacedTrain';
    state.timeWindow = trainSchedule.paced.timeWindow;
    state.interval = trainSchedule.paced.interval;
  }

  return state;
}

const createDefaultTrainName = (
  t: TFunction<'operational-studies', 'manageTrainSchedule.itineraryModal'>,
  stepsWithLocationOrInput: PathStepV2[],
  pathStepsMetadataById: Map<string, PathStepMetadata>
): string => {
  const createDefaultStepName = (pathStep: PathStepV2, trackOffsetDefault: string): string => {
    const location = pathStep.location;
    if (!location) return '';
    if (location.type === 'track_offset') return trackOffsetDefault;
    const op = location.operational_point;
    if (op.type === 'domestic') return op.main_code;
    const metadata = pathStepsMetadataById.get(pathStep.id);
    if (isOpRefMetadata(metadata)) return metadata.mainCode;
    return op.type === 'id' ? `ID ${op.operational_point}` : `UIC ${op.uic}`;
  };

  const origin = stepsWithLocationOrInput[0];
  const destination = stepsWithLocationOrInput[stepsWithLocationOrInput.length - 1];
  return `${createDefaultStepName(origin, t('origin'))} → ${createDefaultStepName(destination, t('destination'))}`;
};

const ItineraryModal = ({
  onTrainCreated,
  trainScheduleToEditData,
  defaultStartTime,
}: ItineraryModalProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal',
  });
  const { workerStatus, scenario } = useScenarioContext();
  const mapSettings = useMapSettings();
  const dispatch = useAppDispatch();
  const { updateViewport } = useMapSettingsActions();
  const infraId = useInfraID();

  const [trainState, setTrainState] = useState<ItineraryModalTrainState>(
    blankNewTrainState(defaultStartTime, scenario.timetable_type)
  );

  const modalRef = useRef<HTMLDialogElement>(null);
  const [wasInitialized, setWasInitialized] = useState<boolean>(false);
  const { closeItineraryModal } = useItineraryModalContext();

  const closeModal = useCallback(() => {
    modalRef.current?.close();
    closeItineraryModal();
    setWasInitialized(false);
  }, [closeItineraryModal, setWasInitialized]);

  const [isWorking, setIsWorking] = useState(false);
  const createTrain = useCreateTrainSchedule(trainState, setIsWorking, closeModal);
  const updateTimetable = useUpdateTrainSchedule(trainState, setIsWorking, closeModal);

  const [modalFormState, setModalFormState] = useState<ItineraryModalFormState>({
    name: trainState.name,
    rollingStockId: trainState.rollingStockId,
    rollingStockName: trainState.rollingStockName ?? '',
    speedLimitTag: trainState.speedLimitByTag,
    category: trainState.category ?? undefined,
  });

  useEffect(() => {
    if (!wasInitialized) {
      if (trainScheduleToEditData) {
        const train = trainScheduleToEditData.trainSchedule;
        setTrainState(
          setupStateWithTrainSchedule(
            train,
            scenario.timetable_type,
            !!trainScheduleToEditData.occurrenceId
          )
        );
        setModalFormState({
          name: train.name,
          rollingStockName: train.rollingStockName,
          rollingStockId: train.rollingStock?.id,
          speedLimitTag: train.speedLimitTag || undefined,
          category: train.category ?? undefined,
        });
      } else {
        setTrainState(blankNewTrainState(defaultStartTime, scenario.timetable_type));
        setModalFormState({
          name: '',
          rollingStockName: '',
          rollingStockId: undefined,
          speedLimitTag: undefined,
          category: undefined,
        });
      }

      setWasInitialized(true);
    }
  }, [wasInitialized, trainScheduleToEditData, scenario.timetable_type]);

  const { categoryColors, currentSubCategory } = useCategoryColors(modalFormState.category);

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

  const handleCancelMapSelection = useCallback(() => {
    setMapSelectionStepKey(null);
  }, []);

  const handleEscapeOrClose = useCallback(() => {
    if (mapSelectionStepKey !== null) {
      handleCancelMapSelection();
    } else {
      closeModal();
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
    chooseSecondaryCodeForSuggestion,
    reopenSuggestionsForStep,
  } = useOperationalPointSearch({});

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
    const chosenSecondaryCode = chooseSecondaryCodeForSuggestion(stepKey, suggestion, forcedCh);
    if (!chosenSecondaryCode) return;
    confirmedStepKeyRef.current = stepKey;
    confirmedStepKeyRef.current = stepKey;

    const opRef: OperationalPointReference = {
      type: 'domestic',
      main_code: suggestion.mainCode,
      secondary_code: chosenSecondaryCode,
      country_code: suggestion.countryCode,
    };
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
    commitSelectionForStep(stepKey, formatChosenValue(suggestion, chosenSecondaryCode));
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
      setPathStepMetadata(newStep.key, {
        type: 'opRef',
        isInvalid: false,
        name: op.name,
        mainCode: op.main_code,
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
    const query = (getInputForStep(step.key) ?? '').trim();
    const isEditing = editingStepKeyRef.current === step.key || query.length > 0;
    const isPending = pendingStepKeyRef.current === step.key;
    // if not step.location, the step is a placeholder waiting for user input
    return !isEditing && !isPending && !!step.location && !!metadata?.isInvalid;
  };

  const hasInvalidPathStepDisplay = pathSteps.some((step) =>
    isStepInvalidAndFinal(step, pathStepsMetadataByKey.get(step.key))
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

  const markEditing = (stepKey: string) => {
    editingStepKeyRef.current = stepKey;
    setActiveStepKey(stepKey);
  };

  const unmarkEditing = (stepKey: string) => {
    if (editingStepKeyRef.current === stepKey) editingStepKeyRef.current = '';
    if (activeStepKey === stepKey) setActiveStepKey('');
  };

  const handleStartMapSelection = useCallback(
    (stepKey: string) => {
      setMapSelectionStepKey(stepKey);
      const metadata = pathStepsMetadataByKey.get(stepKey);
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

      const stepKey = mapSelectionStepKey;
      setPathSteps((prev) =>
        ensureTrailingEmptyStep(prev.map((s) => (s.key === stepKey ? { ...s, location } : s)))
      );
      setInputForStep(stepKey, '');
      setMapSelectionStepKey(null);
    },
    [mapSelectionStepKey, pathSteps, convertFeatureClickToLocation, setInputForStep]
  );

  const handleOpSelectionConfirm = useCallback(
    (location: PathItemLocation, displayName: string) => {
      if (!mapSelectionStepKey) return;
      const stepKey = mapSelectionStepKey;
      setPathSteps((prev) =>
        ensureTrailingEmptyStep(prev.map((s) => (s.key === stepKey ? { ...s, location } : s)))
      );
      if (displayName) {
        commitSelectionForStep(stepKey, displayName);
      } else {
        setInputForStep(stepKey, '');
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

  const isNameEmpty = modalFormState.name.trim() === '';
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    setSubmitAttempted(false);
  }, [pathSteps]);

  useEffect(() => {
    const formattedPathSteps = trainState.pathSteps
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
  }, [trainState.pathSteps]);

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

  const buildPathSteps = (steps: PathStepV2[], metadataById: Map<string, PathStepMetadata>) =>
    steps
      .filter((step) => step.location !== null)
      .map<PathStep>((step) => {
        const metadata = metadataById.get(step.key);

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

  const setPathStepsWithTrailing = useCallback(
    (newPathSteps: PathStepV2[]) => {
      setPathSteps(ensureTrailingEmptyStep(newPathSteps));
    },
    [setPathSteps]
  );

  const reverseItinerary = () => {
    const filledSteps = pathSteps.filter((step) => !isEmptyStep(step, getInputForStep(step.key)));

    if (filledSteps.length < 2) return;

    setPathStepsWithTrailing(reversePathSteps(filledSteps));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitItinerary = (trainType?: EditingTrainType) => {
    setSubmitAttempted(true);
    setBannerWiggle((c) => c + 1);

    const stepsWithLocationOrInput = pathSteps.filter(
      (step) => !isEmptyStep(step, getInputForStep(step.key))
    );
    if (stepsWithLocationOrInput.length < 2) return;

    const name = isNameEmpty
      ? createDefaultTrainName(t, stepsWithLocationOrInput, pathStepsMetadataById)
      : modalFormState.name;

    const stepsWithStopAtDestination = stepsWithLocationOrInput.map((step, i) =>
      i === stepsWithLocationOrInput.length - 1 && !step.stopFor
        ? { ...step, stopFor: new Duration({ minutes: 0 }) }
        : step
    );
    //TODO this variable name should be changed when we no longer have to convert from v2 to v1 for path steps
    const pathStepsFromV2 = buildPathSteps(stepsWithStopAtDestination, pathStepsMetadataByKey);

    if (pathStepsFromV2.length < 2) return;

    setTrainState((oldTrainState: ItineraryModalTrainState) => ({
      ...oldTrainState,
      name,
      category: modalFormState.category ?? null,
      rollingStockId: modalFormState.rollingStockId,
      rollingStockName: modalFormState.rollingStockName,
      speedLimitByTag: modalFormState.speedLimitTag,
      pathSteps: pathStepsFromV2,
      editingTrainType: trainType ?? oldTrainState.editingTrainType,
    }));

    setIsSubmitting(true);
  };

  useEffect(() => {
    if (isSubmitting) {
      try {
        if (trainScheduleToEditData) {
          updateTimetable();
        } else {
          createTrain();
        }
        onTrainCreated();
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting]);

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
    openModal();
  }, []);

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
          <TypeAndPath onSubmit={setPathStepsWithTrailing} />
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
              const isInvalidAndFinal = isStepInvalidAndFinal(pathStep, pathStepMetadata);
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
                      (isInvalidAndFinal || !!previousPathStepMetadata?.isInvalid)
                    }
                    onDelete={() => {
                      handleDeletePathStep(pathStep.key);
                    }}
                    onOpClear={() => {
                      clearStep(pathStep.key);
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
                    isInvalidAndFinal={isInvalidAndFinal}
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
        <ItineraryModalFooter
          mode={trainScheduleToEditData === undefined ? 'new' : 'edit'}
          trainType={trainState.editingTrainType}
          onCancel={() => closeModal()}
          onSubmit={submitItinerary}
          isWorking={isWorking}
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
          'map-selection-active': mapSelectionStepKey !== null,
        })}
        data-testid="itinerary-modal-map"
      >
        <ItineraryModalMap
          pathSteps={pathSteps}
          pathStepsMetadata={pathStepsMetadataByKey}
          pathProperties={displayedPathProperties}
          selectedStepId={mapSelectionStepKey ?? undefined}
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
