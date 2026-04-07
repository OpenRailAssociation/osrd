import { useContext, useMemo } from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { ChevronDown, ChevronRight, Clock, Flame, Manchette } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { isEqual, omit } from 'lodash';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { EditedElementContainerContext } from 'applications/operationalStudies/views/Scenario/components/EditedElementContainerContext';
import { formatPacedTrainWithDetailsToPacedTrainPayload } from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem/helpers/formatTimetableItemPayload';
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
import isMainCategory from 'modules/rollingStock/helpers/category';
import { getOccurrencesWorstStatus } from 'modules/timetableItem/helpers/pacedTrain';
import {
  createExceptions,
  createPacedTrains,
  deleteExceptions,
  deleteTrainSchedules,
} from 'modules/timetableItem/helpers/updateTimetableItemHelpers';
import type { PacedTrainWithPacedWithDetails } from 'modules/timetableItem/types';
import { setFailure, setSuccess } from 'reducers/main';
import type { TimetableItem, TrainId, OccurrenceId } from 'reducers/osrdconf/types';
import {
  updateHoveredTrainId,
  updateProjectionType,
  updateSelectedTrainId,
  updateTrainIdUsedForProjection,
} from 'reducers/simulationResults';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { addDurationToDate, Duration } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  isPacedTrainId,
  formatPacedTrainIdToOccurrenceId,
  formatEditoastIdToPacedTrainId,
} from 'utils/trainId';

import { TIMETABLE_ITEM_DELTA } from '../consts';
import TimetableItemActions from '../TimetableItemActions';
import { formatTrainDuration, getTrainCategoryClassName } from '../utils';
import useOccurrenceActions from './hooks/useOccurrenceActions';
import useOccurrences from './hooks/useOccurrences';
import OccurrenceItem from './OccurrenceItem';

type PacedTrainItemProps = {
  isInSelection: boolean;
  handleSelectPacedTrain: (pacedTrainId: number) => void;
  isOccurrencesListOpen: boolean;
  handleOpenOccurrencesList: (pacedTrainId: number) => void;
  pacedTrain: PacedTrainWithPacedWithDetails;
  isOnEdit: boolean;
  selectedTrainId?: TrainId;
  selectPacedTrainToEdit: (
    pacedTrainToEdit: PacedTrainWithPacedWithDetails,
    originalPacedTrain?: PacedTrainWithPacedWithDetails,
    occurrenceId?: OccurrenceId
  ) => void;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  removePacedTrains: (pacedTrainIdsToRemove: number[]) => void;
  setSelectedTimetableItemIds: React.Dispatch<React.SetStateAction<number[]>>;
  subCategories: SubCategory[];
  infraIsCached: boolean;
  projectingOnSimulatedPathException: boolean | undefined;
  isSelectMode: boolean;
  moveTimetableItem: () => void;
  showMovebutton: boolean;
  timetableId: number;
};

const PacedTrainItem = ({
  isInSelection,
  handleSelectPacedTrain,
  isOccurrencesListOpen,
  handleOpenOccurrencesList,
  pacedTrain,
  isOnEdit,
  selectPacedTrainToEdit,
  selectedTrainId,
  upsertTimetableItems,
  removePacedTrains,
  setSelectedTimetableItemIds,
  subCategories,
  infraIsCached,
  projectingOnSimulatedPathException,
  isSelectMode,
  moveTimetableItem,
  showMovebutton,
  timetableId,
}: PacedTrainItemProps) => {
  const { editedElementContainer } = useContext(EditedElementContainerContext);
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const dispatch = useAppDispatch();
  const { openModal, closeModal } = useContext(ModalContext);

  const { rollingStocks } = useRollingStockContext();

  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const formattedPacedTrainId = formatEditoastIdToPacedTrainId(pacedTrain.id);

  const { showPacedTrainProjectionIcon, pathUsedForProjectionIsException } = useMemo(() => {
    if (!trainIdUsedForProjection)
      return { showPacedTrainProjectionIcon: false, pathUsedForProjectionIsException: false };
    if (isPacedTrainId(trainIdUsedForProjection))
      return {
        showPacedTrainProjectionIcon:
          pacedTrain.id === extractEditoastIdFromPacedTrainId(trainIdUsedForProjection),
        pathUsedForProjectionIsException: false,
      };
    const exception = pacedTrain.paced.exceptions.find(
      (ex) =>
        formatPacedTrainIdToOccurrenceId(formattedPacedTrainId, ex) === trainIdUsedForProjection
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
        extractEditoastIdFromPacedTrainId(
          extractPacedTrainIdFromOccurrenceId(trainIdUsedForProjection)
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
    upsertTimetableItems,
    timetableId,
  });

  const [getTrainScheduleById] = osrdEditoastApi.endpoints.getTrainSchedulesById.useLazyQuery();

  const selectPathProjection = async () => {
    dispatch(updateTrainIdUsedForProjection(formattedPacedTrainId));
    if (!summary?.isValid) dispatch(updateProjectionType('operationalPointProjection'));
  };

  const deletePacedTrain = async () => {
    try {
      await deleteTrainSchedules(dispatch, [pacedTrain.id]);
      removePacedTrains([pacedTrain.id]);
      setSelectedTimetableItemIds((prev) => prev.filter((id) => id !== pacedTrain.id));
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

  const selectPacedTrainId = () => {
    dispatch(updateSelectedTrainId(formattedPacedTrainId));
  };

  const deleteAllExceptions = async () => {
    // TODO_EXCEPTION: remove filter when using TrainScheduleException type
    const allIds = pacedTrain.paced.exceptions.filter((e) => e.id != null).map((e) => e.id!);

    if (allIds.length > 0) {
      await deleteExceptions(dispatch, allIds);
    }

    // Use pacedTrain as the source for train_schedule_set_id and id
    const updatedPacedTrainPayload = formatPacedTrainWithDetailsToPacedTrainPayload({
      ...pacedTrain,
      paced: { ...pacedTrain.paced, exceptions: [] },
    });

    upsertTimetableItems([
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
      new Duration({ minutes: TIMETABLE_ITEM_DELTA })
    );
    const newPacedTrain: TrainSchedule = {
      ...omit(pacedTrainDetail, ['id', 'train_schedule_set_id']),
      start_time: startTime.toISOString(),
      train_name: pacedTrainName,
    };

    // We don't want to send summary to create exceptions
    const payloadExceptions = pacedTrain.paced?.exceptions.map((exception) => {
      const { summary: _summary, ...changeGroups } = exception;
      return changeGroups;
    });

    const formattedPacedTrainResponse: TimetableItem = (
      await createPacedTrains(dispatch, pacedTrainDetail.train_schedule_set_id, [newPacedTrain])
    )[0];

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
        key: restExceptions.id.toString(),
      };
    });

    // We add the new exceptions to the duplicate paced train, so they contain their new exception ids
    upsertTimetableItems([
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

  const currentSubCategory =
    category && !isMainCategory(category)
      ? subCategories.find((option) => option.code === category.sub_category_code)
      : undefined;

  const worstCase = useMemo(
    () => getOccurrencesWorstStatus(pacedTrain.summary, pacedTrain.paced.exceptions),
    [pacedTrain.summary, pacedTrain.paced.exceptions]
  );

  const content = (
    <div
      data-testid="scenario-timetable-item"
      data-train-id={pacedTrain.id}
      className={cx('scenario-timetable-train paced-train', {
        modified: isOnEdit,
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
          selected: selectedTrainId === formattedPacedTrainId,
        })}
        onMouseEnter={() => dispatch(updateHoveredTrainId(formattedPacedTrainId))}
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
            onClick={selectPacedTrainId}
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

        <TimetableItemActions
          selectPathProjection={selectPathProjection}
          moveTimetableItem={moveTimetableItem}
          duplicateTimetableItem={duplicatePacedTrain}
          editTimetableItem={() => selectPacedTrainToEdit(pacedTrain)}
          deleteTimetableItem={async () => {
            openModal(
              <DeleteModal
                handleDelete={async () => deletePacedTrain()}
                selectedPacedTrainCount={1}
              />,
              'sm'
            );
          }}
          showResetExceptionsButton={pacedTrain.paced.exceptions.length > 0}
          resetAllExceptions={() => {
            openModal(
              <ConfirmModal
                onConfirm={() => deleteAllExceptions()}
                title={t('timetable.resetAllExceptions')}
              />
            );
          }}
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
  if (!isOnEdit) {
    return content;
  }

  if (!editedElementContainer) {
    return null;
  }
  return createPortal(content, editedElementContainer);
};

export default PacedTrainItem;
