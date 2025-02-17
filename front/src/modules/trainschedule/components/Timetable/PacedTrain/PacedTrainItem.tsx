import { useState } from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { ChevronDown, Clock, Flame, Manchette } from '@osrd-project/ui-icons';
import cx from 'classnames';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import { Duration } from 'utils/duration';
import { ms2min } from 'utils/timeManipulation';

import TimetableItemActions from '../TimetableItemActions';
import type { TrainScheduleWithDetails } from '../types';

export type PacedTrain = TrainScheduleWithDetails & {
  paced: {
    duration: string;
    step: string;
  };
};

type PacedTrainItemProps = {
  isInSelection: boolean;
  handleSelectPacedTrain: (pacedTrainId: number) => void;
  pacedTrain: PacedTrain;
  isOnEdit: boolean;
  isProjectionPathUsed: boolean;
};

const PacedTrainItem = ({
  isInSelection,
  handleSelectPacedTrain,
  pacedTrain,
  isOnEdit,
  isProjectionPathUsed,
}: PacedTrainItemProps) => {
  const { t } = useTranslation(['operationalStudies/scenario']);

  const [isOpened, setIsOpened] = useState(false);

  const toggle = () => setIsOpened((open) => !open);
  const selectPathProjection = async () => {};
  const duplicatePacedTrain = async () => {};
  const editPacedTrain = () => {};
  const deletePacedTrain = async () => {};

  const stepDuration = Duration.parse(pacedTrain.paced.step);

  const occurencesCount = Math.floor(
    (Duration.parse(pacedTrain.paced.duration).ms - 6000) / Duration.parse(pacedTrain.paced.step).ms
  );
  return (
    <div
      data-testid="scenario-timetable-train"
      className={cx('scenario-timetable-train paced-train', {
        modified: isOnEdit,
        'in-selection': isInSelection,
        closed: !isOpened,
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
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              label=""
              checked={isInSelection}
              onChange={() => handleSelectPacedTrain(pacedTrain.id)}
              small
            />
          </div>
        </div>

        <div
          title={pacedTrain.trainName}
          className="checkbox-label"
          onClick={toggle}
          role="button"
          tabIndex={0}
        >
          <div className="occurences-count">{occurencesCount}</div>
          <ChevronDown className="toggle-icon" />
          <div className="train-info">
            {isProjectionPathUsed && (
              <div className="train-projected">
                <Manchette iconColor="var(--white100)" />
              </div>
            )}
            <span className="train-name">{pacedTrain.trainName}</span>
          </div>
        </div>

        {!pacedTrain.invalidReason && (
          <div className="mission-time">
            {pacedTrain.isValid && (
              <div className="frequency">&mdash;{` ${ms2min(stepDuration.ms)}min`}</div>
            )}
            <div className="status-icon not-honored-or-too-fast">
              {pacedTrain.notHonoredReason &&
                (pacedTrain.notHonoredReason === 'scheduleNotHonored' ? <Clock /> : <Flame />)}
            </div>
          </div>
        )}
      </div>
      <TimetableItemActions
        selectPathProjection={selectPathProjection}
        duplicateTimetableItem={duplicatePacedTrain}
        editTimetableItem={editPacedTrain}
        deleteTimetableItem={deletePacedTrain}
      />
      <div className="occurences" />
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
              {dayjs.duration(pacedTrain.duration).format('HH[h]mm')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PacedTrainItem;
