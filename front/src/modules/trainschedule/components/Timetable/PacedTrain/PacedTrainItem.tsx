import { useState } from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { ChevronDown, ChevronRight, Clock, Flame, Manchette } from '@osrd-project/ui-icons';
import cx from 'classnames';
import dayjs from 'dayjs';
import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';

import {
  osrdEditoastApi,
  type PacedTrainBase,
  type PacedTrainResult,
} from 'common/api/osrdEditoastApi';
import { setFailure, setSuccess } from 'reducers/main';
import type {
  PacedTrainId,
  PacedTrainResultWithPacedTrainId,
  TimetableItemId,
  TimetableItemWithTimetableId,
  TrainId,
} from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { addDurationToDate, Duration } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';
import { ms2min } from 'utils/timeManipulation';
import {
  formatEditoastTrainIdToPacedTrainId,
  formatPacedTrainIdToEditoastTrainId,
} from 'utils/trainId';

import TimetableItemActions from '../TimetableItemActions';
import useOccurrences from './hooks/useOccurrences';
import OccurrenceItem from './OccurrenceItem';
import type { PacedTrainWithDetails } from '../types';

type PacedTrainItemProps = {
  isInSelection: boolean;
  handleSelectPacedTrain: (pacedTrainId: PacedTrainId) => void;
  pacedTrain: PacedTrainWithDetails;
  // isSelected: boolean;
  isOnEdit: boolean;
  isProjectionPathUsed: boolean;
  selectedTimeTableItemId: TrainId | undefined;
  selectPacedTrainToEdit: (pacedTrain: PacedTrainWithDetails) => void;
  upsertTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void;
  removePacedTrains: (pacedTrainIdsToRemove: TimetableItemId[]) => void;
  // dtoImport: () => void;
};

const PacedTrainItem = ({
  isInSelection,
  handleSelectPacedTrain,
  pacedTrain,
  // isSelected,
  isOnEdit,
  isProjectionPathUsed,
  selectPacedTrainToEdit,
  selectedTimeTableItemId,
  upsertTimetableItems,
  removePacedTrains,
  // dtoImport,
}: PacedTrainItemProps) => {
  const { t } = useTranslation(['operationalStudies/scenario']);
  const dispatch = useAppDispatch();

  const [isOccurrencesListOpen, setIsOccurrencesListOpen] = useState(false);
  const { occurrences, occurrencesCount } = useOccurrences(pacedTrain);

  const [postPacedTrain] = osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.useMutation();
  const [getPacedTrainById] = osrdEditoastApi.endpoints.getPacedTrainById.useLazyQuery();
  const [deletePacedTrains] = osrdEditoastApi.endpoints.deletePacedTrain.useMutation();

  const toggleOccurrencesList = () => setIsOccurrencesListOpen((open) => !open);
  const selectPathProjection = async () => {};

  const deletePacedTrain = async () => {
    // if (isSelected) {
    //   // we need to set selectedTrainId to undefined, otherwise just after the delete,
    //   // some unvalid rtk calls are dispatched (see rollingstock request in SimulationResults)
    //   dispatch(updateSelectedTrainId(undefined));
    // }

    try {
      await deletePacedTrains({
        body: { ids: [formatPacedTrainIdToEditoastTrainId(pacedTrain.id)] },
      }).unwrap();
      removePacedTrains([pacedTrain.id]);
      // dtoImport();
      dispatch(
        setSuccess({
          title: t('timetable.pacedTrainDeleted', { name: pacedTrain.name }),
          text: '',
        })
      );
    } catch (e) {
      dispatch(setFailure(castErrorToFailure(e)));
      // if (isSelected) {
      //   dispatch(updateSelectedTrainId(train.id));
      // }
    }
  };

  const duplicatePacedTrain = async () => {
    // Static for now, will be dynamic when UI will be ready
    const pacedTrainName = `${pacedTrain.name} (${t('timetable.copy')})`;
    const pacedTrainDelta = 5;

    const editoastTrainId = formatPacedTrainIdToEditoastTrainId(pacedTrain.id);

    let pacedTrainDetail: PacedTrainResult;
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
    const newPacedTrain: PacedTrainBase = {
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

    const formattedTrainScheduleResult: PacedTrainResultWithPacedTrainId = {
      ...pacedTrainResult,
      id: formatEditoastTrainIdToPacedTrainId(pacedTrainResult.id),
    };
    upsertTimetableItems([formattedTrainScheduleResult]);
    // dtoImport();
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
          <div data-testid="occurrences-count" className="occurrences-count">
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
            <span data-testid="paced-train-name" className="train-name">
              {pacedTrain.name}
            </span>
          </div>
        </div>

        {!pacedTrain.invalidReason ? (
          <div className="paced-train-right-zone">
            {pacedTrain.isValid && (
              <div data-testid="paced-train-cadence">
                &mdash;&nbsp;{`${ms2min(pacedTrain.paced.step.ms)}min`}
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
          deleteTimetableItem={deletePacedTrain}
        />
      </div>
      <div className="occurrences">
        {occurrences.map((occurrence, index) => (
          <OccurrenceItem
            occurrence={occurrence}
            key={occurrence.id}
            isSelected={selectedTimeTableItemId === occurrence.id}
            nextOccurrence={occurrences[index + 1]}
            isValid={pacedTrain.isValid}
          />
        ))}
      </div>
      {/* TODO PACED TRAIN: Remove conditon pacedTrain.duration after development paced train feature is done */}
      {pacedTrain.isValid && pacedTrain.duration && (
        <div className="more-info">
          <div className="more-info-left">
            <span className="more-info-item">
              {t('timetable.stopsCount', { count: pacedTrain.stopsCount })}
            </span>
            <span className="more-info-item">{pacedTrain.pathLength}</span>
            <span className="more-info-item m-0" data-testid="allowance-energy-consumed">
              {pacedTrain.mechanicalEnergyConsumed}&nbsp;kWh
            </span>
          </div>
          <div className="duration-time">
            <span data-testid="train-duration">
              {dayjs.duration(pacedTrain.duration.ms).format('HH[h]mm')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PacedTrainItem;
