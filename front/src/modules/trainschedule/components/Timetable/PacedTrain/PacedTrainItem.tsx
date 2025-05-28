import { useCallback, useContext, useState } from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { ChevronDown, ChevronRight, Clock, Flame, Manchette } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';

import {
  osrdEditoastApi,
  type PacedTrain,
  type PacedTrainResponse,
} from 'common/api/osrdEditoastApi';
import DeleteModal from 'common/BootstrapSNCF/ModalSNCF/DeleteModal';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { setFailure, setSuccess } from 'reducers/main';
import type {
  PacedTrainId,
  PacedTrainResponseWithPacedTrainId,
  TimetableItemId,
  TimetableItem,
  TrainId,
} from 'reducers/osrdconf/types';
import { updateSelectedTrainId, updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { addDurationToDate, Duration } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';
import { formatEditoastIdToPacedTrainId, extractEditoastIdFromPacedTrainId } from 'utils/trainId';

import TimetableItemActions from '../TimetableItemActions';
import useOccurrences from './hooks/useOccurrences';
import OccurrenceItem from './OccurrenceItem';
import { TRAIN_CATEGORY_CLASS } from '../consts';
import type { PacedTrainWithDetails } from '../types';
import { formatTrainDuration } from '../utils';

type PacedTrainItemProps = {
  isInSelection: boolean;
  handleSelectPacedTrain: (pacedTrainId: PacedTrainId) => void;
  pacedTrain: PacedTrainWithDetails;
  isOnEdit: boolean;
  isProjectionPathUsed: boolean;
  selectedTrainId?: TrainId;
  selectPacedTrainToEdit: (pacedTrain: PacedTrainWithDetails) => void;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  removePacedTrains: (pacedTrainIdsToRemove: TimetableItemId[]) => void;
};

const PacedTrainItem = ({
  isInSelection,
  handleSelectPacedTrain,
  pacedTrain,
  isOnEdit,
  isProjectionPathUsed,
  selectPacedTrainToEdit,
  selectedTrainId,
  upsertTimetableItems,
  removePacedTrains,
}: PacedTrainItemProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const dispatch = useAppDispatch();
  const { openModal } = useContext(ModalContext);

  const [isOccurrencesListOpen, setIsOccurrencesListOpen] = useState(false);

  const { occurrences, occurrencesCount } = useOccurrences(pacedTrain);

  const [postPacedTrain] = osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.useMutation();
  const [getPacedTrainById] = osrdEditoastApi.endpoints.getPacedTrainById.useLazyQuery();
  const [deletePacedTrains] = osrdEditoastApi.endpoints.deletePacedTrain.useMutation();

  const toggleOccurrencesList = () => setIsOccurrencesListOpen((open) => !open);

  const selectOccurrence = useCallback((occurrenceId: TrainId) => {
    dispatch(updateSelectedTrainId(occurrenceId));
  }, []);

  const selectPathProjection = async () => {
    dispatch(updateTrainIdUsedForProjection(pacedTrain.id));
  };

  const deletePacedTrain = async (currentSelectedTrainId?: TrainId) => {
    const hasOccurrenceSelected = selectedTrainId?.includes(pacedTrain.id);
    if (hasOccurrenceSelected) {
      // we need to set selectedTrainId to undefined, otherwise just after the delete,
      // some unvalid rtk calls are dispatched (see rollingstock request in SimulationResults)
      dispatch(updateSelectedTrainId(undefined));
    }

    try {
      await deletePacedTrains({
        body: { ids: [extractEditoastIdFromPacedTrainId(pacedTrain.id)] },
      }).unwrap();
      removePacedTrains([pacedTrain.id]);
      dispatch(
        setSuccess({
          title: t('timetable.pacedTrainDeleted', { name: pacedTrain.name }),
          text: '',
        })
      );
    } catch (e) {
      dispatch(setFailure(castErrorToFailure(e)));
      if (hasOccurrenceSelected) {
        dispatch(updateSelectedTrainId(currentSelectedTrainId));
      }
    }
  };

  const duplicatePacedTrain = async () => {
    // Static for now, will be dynamic when UI will be ready
    const pacedTrainName = `${pacedTrain.name} (${t('timetable.copy')})`;
    const pacedTrainDelta = 5;

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

    const startTime = new Date(pacedTrainDetail.start_time);
    const newStartTimeString = addDurationToDate(
      startTime,
      new Duration({ minutes: pacedTrainDelta })
    );
    const newPacedTrain: PacedTrain = {
      ...omit(pacedTrainDetail, ['id', 'timetable_id']),
      start_time: newStartTimeString.toISOString(),
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

    const formattedPacedTrainResponse: PacedTrainResponseWithPacedTrainId = {
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

  return (
    <div
      data-testid="scenario-timetable-train"
      className={cx('scenario-timetable-train paced-train', {
        modified: isOnEdit,
        'in-selection': isInSelection,
        closed: !isOccurrencesListOpen,
      })}
    >
      <div
        data-testid="paced-train"
        className={cx('base-info', {
          warning: pacedTrain.invalidReason || pacedTrain.notHonoredReason,
          invalid: pacedTrain.invalidReason,
          'not-honored': pacedTrain.notHonoredReason,
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
          data-testid="paced-train-main-info"
          title={pacedTrain.name}
          className="paced-train-main-info"
          onClick={toggleOccurrencesList}
          role="button"
          tabIndex={0}
        >
          {isProjectionPathUsed && (
            <div className="train-projected">
              <Manchette iconColor="var(--white100)" />
            </div>
          )}
          <div
            data-testid="occurrences-count"
            className={cx(
              'occurrences-count',
              `train-category-bg-${TRAIN_CATEGORY_CLASS[pacedTrain.category ?? 'None']}`
            )}
          >
            {occurrencesCount}
          </div>
          {isOccurrencesListOpen ? (
            <ChevronDown
              data-testid="hide-occurrences-button"
              className="toggle-icon center-icon"
            />
          ) : (
            <ChevronRight
              data-testid="show-occurrences-button"
              className="toggle-icon center-icon"
            />
          )}
          <div className="train-info">
            <span
              data-testid="paced-train-name"
              className={cx(
                'train-name',
                `train-category-text-${TRAIN_CATEGORY_CLASS[pacedTrain.category ?? 'None']}`
              )}
            >
              {pacedTrain.name}
            </span>
          </div>
        </div>

        {!pacedTrain.invalidReason ? (
          <div className="paced-train-right-zone">
            {pacedTrain.isValid && (
              <div data-testid="paced-train-interval">
                &mdash;&nbsp;{`${pacedTrain.paced.interval.total('minute')}min`}
              </div>
            )}
            <div
              className={cx('status-icon', {
                'not-honored-or-too-fast': pacedTrain.notHonoredReason,
              })}
            >
              {pacedTrain.notHonoredReason &&
                (pacedTrain.notHonoredReason === 'scheduleNotHonored' ? (
                  <Clock className="center-icon" />
                ) : (
                  <Flame className="center-icon" />
                ))}
            </div>
          </div>
        ) : (
          <div className="invalid-reason">
            <span title={t(`timetable.invalid.${pacedTrain.invalidReason}`)}>
              {t(`timetable.invalid.${pacedTrain.invalidReason}`)}
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
                handleDelete={async () => deletePacedTrain(selectedTrainId)}
                selectedPacedTrainIds={[pacedTrain.id]}
                selectedTrainScheduleIds={[]}
              />,
              'sm'
            );
          }}
        />
      </div>
      {pacedTrain.isValid && (
        <div className="more-info">
          <div className="more-info-left">
            {/* TODO : add a category span in https://github.com/OpenRailAssociation/osrd/issues/11542 */}
            <span className="more-info-item">
              {t('timetable.stopsCount', { count: pacedTrain.stopsCount })}
            </span>
            <span className="more-info-item">{pacedTrain.pathLength}</span>
            <span className="more-info-item m-0" data-testid="allowance-energy-consumed">
              {pacedTrain.mechanicalEnergyConsumed}&nbsp;kWh
            </span>
          </div>
          <div className="duration-time">
            <span data-testid="train-duration">{formatTrainDuration(pacedTrain.duration!)}</span>
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
              selectOccurrence={selectOccurrence}
              currentPacedTrain={pacedTrain}
              // selectPacedTrainToEdit={selectPacedTrainToEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PacedTrainItem;
