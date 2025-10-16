import { useContext, useMemo } from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { ChevronDown, ChevronRight, Clock, Flame, Manchette } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { isEqual, omit } from 'lodash';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { EditedElementContainerContext } from 'applications/operationalStudies/views/Scenario/components/EditedElementContainerContext';
import { formatPacedTrainWithDetailsToPacedTrainPayload } from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem/helpers/formatTimetableItemPayload';
import {
  osrdEditoastApi,
  type PacedTrain,
  type PacedTrainResponse,
  type SubCategory,
} from 'common/api/osrdEditoastApi';
import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { useRollingStockContext } from 'common/RollingStockContext';
import isMainCategory from 'modules/rollingStock/helpers/category';
import { getOccurrencesWorstStatus } from 'modules/timetableItem/helpers/pacedTrain';
import {
  deletePacedTrains,
  storePacedTrain,
} from 'modules/timetableItem/helpers/updateTimetableItemHelpers';
import type { PacedTrainWithDetails } from 'modules/timetableItem/types';
import { setFailure, setSuccess } from 'reducers/main';
import type {
  PacedTrainId,
  PacedTrainWithPacedTrainId,
  TimetableItemId,
  TimetableItem,
  TrainId,
  OccurrenceId,
} from 'reducers/osrdconf/types';
import { updateProjectionType, updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { addDurationToDate, Duration } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';
import {
  formatEditoastIdToPacedTrainId,
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  isTrainScheduleId,
  isPacedTrainId,
  formatPacedTrainIdToOccurrenceId,
} from 'utils/trainId';

import TimetableItemActions from '../TimetableItemActions';
import useOccurrences from './hooks/useOccurrences';
import OccurrenceItem from './OccurrenceItem';
import { TIMETABLE_ITEM_DELTA } from '../consts';
import { formatTrainDuration, getTrainCategoryClassName, isValidPathfinding } from '../utils';
import useOccurrenceActions from './hooks/useOccurrenceActions';

type PacedTrainItemProps = {
  isInSelection: boolean;
  handleSelectPacedTrain: (pacedTrainId: PacedTrainId) => void;
  isOccurrencesListOpen: boolean;
  handleOpenOccurrencesList: (pacedTrainId: PacedTrainId) => void;
  pacedTrain: PacedTrainWithDetails;
  isOnEdit: boolean;
  selectedTrainId?: TrainId;
  selectPacedTrainToEdit: (
    pacedTrainToEdit: PacedTrainWithDetails,
    originalPacedTrain?: PacedTrainWithDetails,
    occurrenceId?: OccurrenceId
  ) => void;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  removePacedTrains: (pacedTrainIdsToRemove: TimetableItemId[]) => void;
  subCategories: SubCategory[];
  infraIsCached: boolean;
  projectingOnSimulatedPathException: boolean | undefined;
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
  subCategories,
  infraIsCached,
  projectingOnSimulatedPathException,
}: PacedTrainItemProps) => {
  const { editedElementContainer } = useContext(EditedElementContainerContext);
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const dispatch = useAppDispatch();
  const { openModal } = useContext(ModalContext);
  const { closeModal } = useContext(ModalContext);

  const { timetableId } = useScenarioContext();
  const { rollingStocks } = useRollingStockContext();

  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const { showPacedTrainProjectionIcon, pathUsedForProjectionIsException } = useMemo(() => {
    if (!trainIdUsedForProjection || isTrainScheduleId(trainIdUsedForProjection))
      return { showPacedTrainProjectionIcon: false, pathUsedForProjectionIsException: false };
    if (isPacedTrainId(trainIdUsedForProjection))
      return {
        showPacedTrainProjectionIcon: pacedTrain.id === trainIdUsedForProjection,
        pathUsedForProjectionIsException: false,
      };
    const exception = pacedTrain.exceptions.find(
      (ex) => formatPacedTrainIdToOccurrenceId(pacedTrain.id, ex) === trainIdUsedForProjection
    );
    const pacedTrainTrackOffsets = pacedTrain.path.filter((step) => 'track' in step);
    const exceptionTrackOffsets = exception?.path_and_schedule?.path?.filter(
      (step) => 'track' in step
    );
    const isTrackOffsetsException = // This will affect the manchette even if the computed projection path is not affected
      exceptionTrackOffsets && !isEqual(pacedTrainTrackOffsets, exceptionTrackOffsets);

    return {
      showPacedTrainProjectionIcon:
        extractPacedTrainIdFromOccurrenceId(trainIdUsedForProjection) === pacedTrain.id,
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
    removePacedTrains,
  });

  const [postPacedTrain] = osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.useMutation();
  const [getPacedTrainById] = osrdEditoastApi.endpoints.getPacedTrainById.useLazyQuery();

  const selectPathProjection = async () => {
    dispatch(updateTrainIdUsedForProjection(pacedTrain.id));
    if (!summary?.isValid) dispatch(updateProjectionType('operationalPointProjection'));
  };

  const deletePacedTrain = async () => {
    try {
      await deletePacedTrains(dispatch, [pacedTrain.id]);
      removePacedTrains([pacedTrain.id]);
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

  async function deleteExceptions() {
    const updatedPacedTrainPayload = {
      ...formatPacedTrainWithDetailsToPacedTrainPayload(pacedTrain),
      exceptions: [],
    };

    await storePacedTrain(
      pacedTrain.id,
      updatedPacedTrainPayload,
      timetableId,
      dispatch,
      upsertTimetableItems,
      removePacedTrains
    );

    closeModal();
  }

  const duplicatePacedTrain = async () => {
    // Static for now, will be dynamic when UI will be ready
    const pacedTrainName = `${pacedTrain.name} (${t('timetable.copy')})`;

    const editoastTrainId = extractEditoastIdFromPacedTrainId(pacedTrain.id);

    let pacedTrainDetail: PacedTrainResponse;
    try {
      const pacedTrainDetailPromise = getPacedTrainById({
        id: editoastTrainId,
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
    const newPacedTrain: PacedTrain = {
      ...omit(pacedTrainDetail, ['id', 'timetable_id']),
      start_time: startTime.toISOString(),
      train_name: pacedTrainName,
    };

    let pacedTrainResult;
    try {
      [pacedTrainResult] = await postPacedTrain({
        id: pacedTrainDetail.timetable_id,
        body: [newPacedTrain],
      }).unwrap();
    } catch (e) {
      dispatch(setFailure(castErrorToFailure(e)));
      return;
    }

    const formattedPacedTrainResponse: PacedTrainWithPacedTrainId = {
      ...pacedTrainResult,
      id: formatEditoastIdToPacedTrainId(pacedTrainResult.id),
    };
    upsertTimetableItems([formattedPacedTrainResponse]);
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
    () => getOccurrencesWorstStatus(pacedTrain),
    [pacedTrain.summary, pacedTrain.exceptions]
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
        })}
      >
        <div className="checkbox-title">
          <Checkbox
            label=""
            checked={isInSelection}
            onChange={() => handleSelectPacedTrain(pacedTrain.id)}
            small
          />
        </div>

        <div
          title={pacedTrain.name}
          className="paced-train-main-info"
          onClick={() => handleOpenOccurrencesList(pacedTrain.id)}
          role="button"
          tabIndex={0}
        >
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
            <ChevronDown className="toggle-icon center-icon" />
          ) : (
            <ChevronRight className="toggle-icon center-icon" />
          )}
          <div className="train-info">
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
          duplicateTimetableItem={duplicatePacedTrain}
          editTimetableItem={() => selectPacedTrainToEdit(pacedTrain)}
          deleteTimetableItem={async () => {
            openModal(
              <DeleteModal
                handleDelete={async () => deletePacedTrain()}
                selectedPacedTrainIds={[pacedTrain.id]}
                selectedTrainScheduleIds={[]}
              />,
              'sm'
            );
          }}
          canBeUsedForProjection={isValidPathfinding(summary)}
          showResetExceptionsButton={pacedTrain.exceptions.length > 0}
          resetAllExceptions={() => {
            openModal(
              <ConfirmModal
                onConfirm={() => deleteExceptions()}
                title={t('timetable.resetAllExceptions')}
              />
            );
          }}
        />
      </div>
      {summary?.isValid && (
        <div className="more-info">
          <div className="more-info-left">
            <span className="more-info-item">
              {t('timetable.stopsCount', { count: pacedTrain.stopsCount })}
            </span>
            <span className="more-info-item">{summary.pathLength}</span>
            <span className="more-info-item m-0" data-testid="allowance-energy-consumed">
              {summary.mechanicalEnergyConsumed}&nbsp;kWh
            </span>
          </div>
          <div className="duration-time">
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
