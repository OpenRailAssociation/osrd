import { useState } from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { ChevronDown, ChevronRight, Clock, Flame, Manchette } from '@osrd-project/ui-icons';
import cx from 'classnames';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import type { PacedTrainId } from 'reducers/osrdconf/types';
import { ms2min } from 'utils/timeManipulation';

import TimetableItemActions from '../TimetableItemActions';
import type { PacedTrainWithResult } from '../types';

type PacedTrainItemProps = {
  isInSelection: boolean;
  handleSelectPacedTrain: (pacedTrainId: PacedTrainId) => void;
  pacedTrain: PacedTrainWithResult;
  isOnEdit: boolean;
  isProjectionPathUsed: boolean;
  selectPacedTrainToEdit: (pacedTrain: PacedTrainWithResult) => void;
};

const PacedTrainItem = ({
  isInSelection,
  handleSelectPacedTrain,
  pacedTrain,
  isOnEdit,
  isProjectionPathUsed,
  selectPacedTrainToEdit,
}: PacedTrainItemProps) => {
  const { t } = useTranslation(['operationalStudies/scenario']);

  const [isOccurrencesListOpen, setIsOccurrencesListOpen] = useState(false);

  const toggleOccurrencesList = () => setIsOccurrencesListOpen((open) => !open);
  const selectPathProjection = async () => {};
  const duplicatePacedTrain = async () => {};
  const deletePacedTrain = async () => {};

  const pacedTrainCadence = pacedTrain.paced.step;

  const occurrencesCount = Math.ceil(pacedTrain.paced.duration.ms / pacedTrain.paced.step.ms);
  return (
    <div
      data-testid="scenario-timetable-train"
      className={cx('scenario-timetable-train paced-train', {
        modified: isOnEdit,
        'in-selection': isInSelection,
        closed: !isOccurrencesListOpen,
        invalid: pacedTrain.invalidReason,
      })}
    >
      <div
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
          title={pacedTrain.trainName}
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
          <div className="occurrences-count">{occurrencesCount}</div>
          {isOccurrencesListOpen ? (
            <ChevronDown className="toggle-icon center-icon" />
          ) : (
            <ChevronRight className="toggle-icon center-icon" />
          )}
          <div className="train-info">
            <span className="train-name">{pacedTrain.trainName}</span>
          </div>
        </div>

        {!pacedTrain.invalidReason ? (
          <div className="paced-train-right-zone">
            {pacedTrain.isValid && <div>&mdash;&nbsp;{`${ms2min(pacedTrainCadence.ms)}min`}</div>}
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
      </div>
      <TimetableItemActions
        selectPathProjection={selectPathProjection}
        duplicateTimetableItem={duplicatePacedTrain}
        editTimetableItem={() => selectPacedTrainToEdit(pacedTrain)}
        deleteTimetableItem={deletePacedTrain}
      />
      <div className="occurrences" />
      {pacedTrain.isValid && (
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
              {dayjs.duration(pacedTrain.duration!.ms).format('HH[h]mm')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PacedTrainItem;
