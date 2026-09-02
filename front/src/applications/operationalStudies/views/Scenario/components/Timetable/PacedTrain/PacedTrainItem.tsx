import { useCallback, useContext, useMemo } from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { ChevronDown, ChevronRight, Clock, Flame, Manchette } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { isEqual, omit } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useTimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';
import { formatTrainScheduleWithDetailsToTrainSchedule } from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/helpers/formatTrainSchedulePayload';
import {
  osrdEditoastApi,
  type TrainSchedule,
  type TrainScheduleResponse,
  type SubCategory,
} from 'common/api/osrdEditoastApi';
import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { useRollingStockContext } from 'common/RollingStockContext';
import { findSubCategory } from 'modules/rollingStock/helpers/category';
import { getOccurrencesWorstStatus } from 'modules/trainSchedule/helpers/pacedTrain';
import {
  createExceptions,
  createTrainSchedules,
  deleteExceptions,
  deleteTrainSchedules,
} from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import type { PacedTrainWithDetails } from 'modules/trainSchedule/types';
import { setFailure, setSuccess } from 'reducers/main';
import type { TrainId, OccurrenceId } from 'reducers/osrdconf/types';
import {
  updateHoveredTrainId,
  updateProjectionType,
  updateSelectedTrain,
  updateTrainIdUsedForProjection,
} from 'reducers/simulationResults';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { addDurationToDate, Duration } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';
import {
  extractEditoastIdFromTrainScheduleId,
  extractTrainScheduleIdFromOccurrenceId,
  isTrainScheduleId,
  formatTrainScheduleIdToOccurrenceId,
  formatEditoastIdToTrainScheduleId,
} from 'utils/trainId';

import { TRAIN_SCHEDULE_DELTA } from '../consts';
import TrainScheduleActions from '../TrainScheduleActions';
import { formatTrainDuration, getTrainCategoryClassName } from '../utils';
import useOccurrenceActions from './hooks/useOccurrenceActions';
import useOccurrences from './hooks/useOccurrences';
import OccurrenceItem from './OccurrenceItem';

const openConfirmModal = ({
  openModal,
  deleteAllExceptions,
  title,
}: {
  openModal: (modal: React.ReactNode) => void;
  deleteAllExceptions: () => void;
  title: string;
}) => {
  openModal(<ConfirmModal onConfirm={() => deleteAllExceptions()} title={title} />);
};

type PacedTrainItemProps = {
  isInSelection: boolean;
  handleSelectPacedTrain: (pacedTrainId: number) => void;
  isOccurrencesListOpen: boolean;
  handleOpenOccurrencesList: (pacedTrainId: number) => void;
  pacedTrain: PacedTrainWithDetails;
  selectedTrainId?: TrainId;
  selectPacedTrainToEdit: (
    pacedTrainToEdit: PacedTrainWithDetails,
    originalPacedTrain?: PacedTrainWithDetails,
    occurrenceId?: OccurrenceId
  ) => void;
  setSelectedTrainScheduleIds: React.Dispatch<React.SetStateAction<number[]>>;
  subCategories: SubCategory[];
  infraIsCached: boolean;
  projectingOnSimulatedPathException: boolean | undefined;
  isSelectMode: boolean;
  moveTrainSchedule: () => void;
  showMovebutton: boolean;
  timetableId: number;
};

const PacedTrainItem = ({
  isInSelection,
  handleSelectPacedTrain,
  isOccurrencesListOpen,
  handleOpenOccurrencesList,
  pacedTrain,
  selectPacedTrainToEdit,
  selectedTrainId,
  setSelectedTrainScheduleIds,
  subCategories,
  infraIsCached,
  projectingOnSimulatedPathException,
  isSelectMode,
  moveTrainSchedule,
  showMovebutton,
  timetableId,
}: PacedTrainItemProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const dispatch = useAppDispatch();
  const { openModal, closeModal } = useContext(ModalContext);

  const { rollingStocks } = useRollingStockContext();
  const { removeTrainSchedules, upsertTrainSchedules } = useTimetableContext();

  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const formattedTrainScheduleId = formatEditoastIdToTrainScheduleId(pacedTrain.id);

  const { showPacedTrainProjectionIcon, pathUsedForProjectionIsException } = useMemo(() => {
    if (!trainIdUsedForProjection)
      return {
        showPacedTrainProjectionIcon: false,
        pathUsedForProjectionIsException: false,
      };
    if (isTrainScheduleId(trainIdUsedForProjection))
      return {
        showPacedTrainProjectionIcon:
          pacedTrain.id === extractEditoastIdFromTrainScheduleId(trainIdUsedForProjection),
        pathUsedForProjectionIsException: false,
      };
    const exception = pacedTrain.paced.exceptions.find(
      (ex) =>
        formatTrainScheduleIdToOccurrenceId(formattedTrainScheduleId, ex) ===
        trainIdUsedForProjection
    );
    const pacedTrainTrackOffsets = pacedTrain.path.filter(
      (step) => step.location.type === 'track_offset'
    );
    const exceptionTrackOffsets = exception?.path_and_schedule?.path?.filter(
      (step) => step.location.type === 'track_offset'
    );
    const isTrackOffsetsException = // This will affect the manchette even if the computed projection path is not affected
      exceptionTrackOffsets && !isEqual(pacedTrainTrackOffsets, exceptionTrackOffsets);

    return {
      showPacedTrainProjectionIcon:
        extractEditoastIdFromTrainScheduleId(
          extractTrainScheduleIdFromOccurrenceId(trainIdUsedForProjection)
        ) === pacedTrain.id,
      pathUsedForProjectionIsException:
        projectingOnSimulatedPathException || isTrackOffsetsException,
    };
  }, [trainIdUsedForProjection, pacedTrain]);

  const { summary } = pacedTrain;
  const { occurrences, occurrencesCount } = useOccurrences(pacedTrain, rollingStocks);

  const occurrenceActions = useOccurrenceActions({
    pacedTrain,
    occurrences,
    selectPacedTrainToEdit,
    timetableId,
  });

  const [getTrainScheduleById] = osrdEditoastApi.endpoints.getTrainSchedulesById.useLazyQuery();

  const selectPathProjection = async () => {
    dispatch(updateTrainIdUsedForProjection(formattedTrainScheduleId));
    if (!summary?.isValid) dispatch(updateProjectionType('operationalPointProjection'));
  };

  const deletePacedTrain = async () => {
    try {
      await deleteTrainSchedules(dispatch, [pacedTrain.id]);
      removeTrainSchedules([pacedTrain.id]);
      setSelectedTrainScheduleIds((prev) => prev.filter((id) => id !== pacedTrain.id));
      dispatch(
        setSuccess({
          title: t('timetable.pacedTrainDeleted', { name: pacedTrain.name }),
          text: '',
        })
      );
    } catch (e) {
      dispatch(setFailure(castErrorToFailure(e)));
    }
  };

  const togglePacedTrainSelection = () => {
    dispatch(
      updateSelectedTrain(
        selectedTrainId === formattedTrainScheduleId
          ? undefined
          : { id: formattedTrainScheduleId, by: 'timetable' }
      )
    );
  };

  const deleteAllExceptions = async () => {
    // TODO_EXCEPTION: remove filter when using TrainScheduleException type
    const allIds = pacedTrain.paced.exceptions
      .filter((e) => typeof e.id === 'number')
      .map((e) => e.id!);

    if (allIds.length > 0) {
      await deleteExceptions(dispatch, allIds);
    }

    // Use pacedTrain as the source for train_schedule_set_id and id
    const updatedPacedTrainPayload = formatTrainScheduleWithDetailsToTrainSchedule({
      ...pacedTrain,
      paced: { ...pacedTrain.paced, exceptions: [] },
    });

    upsertTrainSchedules([
      {
        ...updatedPacedTrainPayload,
        train_schedule_set_id: pacedTrain.train_schedule_set_id,
        id: pacedTrain.id,
      },
    ]);

    closeModal();
  };

  const duplicatePacedTrain = async () => {
    // Static for now, will be dynamic when UI will be ready
    const pacedTrainName = `${pacedTrain.name} (${t('timetable.copy')})`;

    let pacedTrainDetail: TrainScheduleResponse;
    try {
      const pacedTrainDetailPromise = getTrainScheduleById({
        id: pacedTrain.id,
      });
      pacedTrainDetail = await pacedTrainDetailPromise.unwrap();
      pacedTrainDetailPromise.unsubscribe();
    } catch (e) {
      dispatch(setFailure(castErrorToFailure(e)));
      return;
    }

    const startTime = addDurationToDate(
      new Date(pacedTrainDetail.start_time),
      new Duration({ minutes: TRAIN_SCHEDULE_DELTA })
    );
    const newPacedTrain: TrainSchedule = {
      ...omit(pacedTrainDetail, ['id', 'train_schedule_set_id']),
      start_time: startTime.getTime(),
      train_name: pacedTrainName,
    };

    // We don't want to send summary to create exceptions
    const payloadExceptions = pacedTrain.paced?.exceptions.map((exception) => {
      const { summary: _summary, ...changeGroups } = exception;
      return changeGroups;
    });

    const formattedPacedTrainResponse: TrainScheduleResponse = (
      await createTrainSchedules(dispatch, pacedTrainDetail.train_schedule_set_id, [newPacedTrain])
    )[0];
    dispatch(
      updateSelectedTrain({
        id: formatEditoastIdToTrainScheduleId(formattedPacedTrainResponse.id),
        by: 'timetable',
      })
    );
    upsertTrainSchedules([formattedPacedTrainResponse]);

    const newExceptions =
      payloadExceptions.length > 0
        ? await createExceptions(
            dispatch,
            payloadExceptions,
            formattedPacedTrainResponse.id,
            timetableId
          )
        : [];

    // TODO : remove this part when the back will be done inserting the new exception format in TrainSchedule
    const formattedExceptions = newExceptions.map((exceptionNewModel) => {
      const {
        change_groups,
        train_schedule_id: _train_schedule_id,
        timetable_id: _timetable_id,
        ...restExceptions
      } = exceptionNewModel;
      return {
        ...change_groups,
        ...restExceptions,
        // TODO_EXCEPTION: remove this when drop key in the model
        key: '',
      };
    });

    // We add the new exceptions to the duplicate paced train, so they contain their new exception ids
    upsertTrainSchedules([
      {
        ...formattedPacedTrainResponse,
        ...(formattedPacedTrainResponse.paced && {
          paced: {
            ...formattedPacedTrainResponse.paced,
            exceptions: formattedExceptions,
          },
        }),
      },
    ]);
    dispatch(
      setSuccess({
        title: t('timetable.pacedTrainAdded'),
        text: `${pacedTrainName}`,
      })
    );
  };

  const { category } = pacedTrain;

  const currentSubCategory = findSubCategory(subCategories, category);

  const worstCase = useMemo(
    () => getOccurrencesWorstStatus(pacedTrain.summary, pacedTrain.paced.exceptions),
    [pacedTrain.summary, pacedTrain.paced.exceptions]
  );

  const openDeleteModal = useCallback(async () => {
    openModal(
      <DeleteModal handleDelete={async () => deletePacedTrain()} selectedPacedTrainCount={1} />,
      'sm'
    );
  }, [deletePacedTrain, openModal, t]);

  return (
    <div
      data-testid="scenario-train-schedule"
      data-train-id={pacedTrain.id}
      className={cx('scenario-timetable-train paced-train', {
        'in-selection': isInSelection,
        closed: !isOccurrencesListOpen,
      })}
    >
      <div
        data-testid="paced-train"
        className={cx('base-info', {
          invalid: summary && !summary.isValid,
          warning: !!worstCase,
          [`warning-${worstCase}`]: !!worstCase,
          selected: selectedTrainId === formattedTrainScheduleId,
        })}
        onMouseEnter={() => dispatch(updateHoveredTrainId(formattedTrainScheduleId))}
        onMouseLeave={() => dispatch(updateHoveredTrainId(undefined))}
      >
        {isSelectMode && (
          <div className="checkbox-title">
            <Checkbox
              label=""
              checked={isInSelection}
              onChange={() => handleSelectPacedTrain(pacedTrain.id)}
              small
            />
          </div>
        )}
        <div title={pacedTrain.name} className="paced-train-main-info">
          {infraIsCached && showPacedTrainProjectionIcon && (
            <div
              className={cx('train-projected', {
                grayed: pathUsedForProjectionIsException,
              })}
            >
              <Manchette iconColor="var(--white100)" />
            </div>
          )}
          <div
            className="toggle-occurrences-list"
            role="button"
            onClick={() => handleOpenOccurrencesList(pacedTrain.id)}
            tabIndex={0}
          >
            <div
              data-testid="occurrences-count"
              className={cx(
                'occurrences-count',
                getTrainCategoryClassName(pacedTrain.category, 'bg')
              )}
              style={{ backgroundColor: currentSubCategory?.color }}
            >
              {occurrencesCount}
            </div>

            {isOccurrencesListOpen ? (
              <ChevronDown dataTestId="toggle-icon-close" className="toggle-icon center-icon" />
            ) : (
              <ChevronRight dataTestId="toggle-icon-open" className="toggle-icon center-icon" />
            )}
          </div>
          <div
            className="train-info"
            data-testid="selected-paced-train-area"
            role="button"
            onClick={togglePacedTrainSelection}
            tabIndex={0}
          >
            <span
              data-testid="paced-train-name"
              className={cx('train-name', getTrainCategoryClassName(pacedTrain.category, 'text'))}
              style={{ color: currentSubCategory?.color }}
            >
              {pacedTrain.name}
            </span>
          </div>
        </div>

        {summary?.isValid && (
          <div className="paced-train-right-zone">
            <div data-testid="paced-train-interval">
              &mdash;&nbsp;{`${pacedTrain.paced.interval.total('minute')}min`}
            </div>
            <div
              className={cx('status-icon', {
                'not-honored-or-too-fast': summary.notHonoredReason,
              })}
            >
              {summary.notHonoredReason &&
                (summary.notHonoredReason === 'scheduleNotHonored' ? (
                  <Clock className="center-icon" />
                ) : (
                  <Flame className="center-icon" />
                ))}
            </div>
          </div>
        )}
        {summary && !summary.isValid && (
          <div data-testid="invalid-reason" className="invalid-reason">
            <span title={t(`timetable.invalid.${summary.invalidReason}`)}>
              {t(`timetable.invalid.${summary.invalidReason}`)}
            </span>
          </div>
        )}

        <TrainScheduleActions
          selectPathProjection={selectPathProjection}
          moveTrainSchedule={moveTrainSchedule}
          duplicateTrainSchedule={duplicatePacedTrain}
          editTrainSchedule={() => selectPacedTrainToEdit(pacedTrain)}
          deleteTrainSchedule={openDeleteModal}
          showResetExceptionsButton={pacedTrain.paced.exceptions.length > 0}
          resetAllExceptions={() =>
            openConfirmModal({
              openModal,
              deleteAllExceptions,
              title: t('timetable.resetAllExceptions'),
            })
          }
          showMovebutton={showMovebutton}
        />
      </div>
      {summary?.isValid && (
        <div className="more-info">
          <div data-testid="paced-train-more-info" className="more-info-left">
            <span data-testid="paced-train-stop-count" className="more-info-item">
              {t('timetable.stopsCount', { count: pacedTrain.stopsCount })}
            </span>
            <span data-testid="paced-train-path-length" className="more-info-item">
              {summary.pathLength}
            </span>
            <span
              className="more-info-item m-0"
              data-testid="paced-train-allowance-energy-consumed"
            >
              {summary.mechanicalEnergyConsumed}&nbsp;kWh
            </span>
          </div>
          <div data-testid="paced-train-duration-time" className="duration-time">
            <span data-testid="train-duration">{formatTrainDuration(summary.duration)}</span>
          </div>
        </div>
      )}
      {isOccurrencesListOpen && (
        <div className="occurrences">
          {occurrences.map((occurrence, index) => (
            <OccurrenceItem
              occurrence={occurrence}
              key={occurrence.id}
              isSelected={selectedTrainId === occurrence.id}
              nextOccurrence={occurrences[index + 1]}
              occurrenceActions={occurrenceActions}
              subCategories={subCategories}
              pacedTrainInvalidReason={summary?.isValid ? undefined : summary?.invalidReason}
              pathUsedForProjectionIsException={pathUsedForProjectionIsException}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PacedTrainItem;
