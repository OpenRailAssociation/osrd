/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import nextId from 'react-id-generator';
import { seconds2hhmmss } from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleHelpers';
import RollingStock2Img from 'common/RollingStockSelector/RollingStock2Img';
import { LazyLoadComponent } from 'react-lazy-load-image-component';
import { TrainSchedule } from 'applications/operationalStudies/types';
import { LightRollingStock, RollingStock } from 'common/api/osrdEditoastApi';

type Props = {
  trainData: TrainSchedule;
  idx: number;
  rollingStock?: LightRollingStock | RollingStock;
};

export default function ImportTrainScheduleTrainDetail({ trainData, idx, rollingStock }: Props) {
  const [isOpened, setIsOpened] = useState(false);

  const openCard = () => {
    if (trainData.steps.length > 2) {
      setIsOpened(!isOpened);
    }
  };
  const trainDuration = Math.round(
    (new Date(trainData.arrivalTime).getTime() - new Date(trainData.departureTime).getTime()) / 1000
  );
  return (
    <div
      className="import-train-schedule-traindetail import-train-schedule-traindetail-no-hover"
      role="button"
      tabIndex={0}
      onClick={openCard}
    >
      <div
        className={`import-train-schedule-traindetail-main ${
          trainData.steps.length > 2 ? 'import-train-schedule-traindetail-with-hover' : null
        }`}
      >
        <span className="import-train-schedule-traindetail-idx">{idx + 1}</span>
        <span className="import-train-schedule-traindetail-num">
          {trainData.trainNumber}
          <span className="import-train-schedule-traindetail-activity">
            {trainData.departure.name}
          </span>
        </span>
        <span className="import-train-schedule-traindetail-startend">
          {trainData.departureTime.slice(-8)} - {trainData.arrivalTime.slice(-8)}
        </span>
        <span className="import-train-schedule-traindetail-duration">
          {seconds2hhmmss(trainDuration)}
        </span>
        {rollingStock && (
          <LazyLoadComponent>
            <span className="import-train-schedule-traindetail-rollingstock">
              <RollingStock2Img rollingStock={rollingStock} />
            </span>
          </LazyLoadComponent>
        )}
        <span className="import-train-schedule-traindetail-rollingstock-name">
          {trainData.rollingStock}
          {trainData.transilienName && (
            <span className="import-train-schedule-traindetail-transilien">
              {trainData.transilienName}
            </span>
          )}
        </span>
        <span
          className={`import-train-schedule-traindetail-stepnb ${
            trainData.steps.length <= 2 ? 'bg-secondary' : 'bg-primary'
          }`}
        >
          {trainData.steps.length - 2}
        </span>
      </div>
      <div className={`import-train-schedule-traindetail-steps ${isOpened ? 'opened' : ''}`}>
        {trainData.steps.map(
          (step: any, stepIdx: number) =>
            // Remove origin & destination
            stepIdx !== 0 &&
            stepIdx !== trainData.steps.length - 1 && (
              <div className="import-train-schedule-traindetail-step" key={nextId()}>
                <span className="import-train-schedule-traindetail-step-nb">{stepIdx}</span>
                <span className="import-train-schedule-traindetail-step-startend">
                  {`${step.debut} - ${step.fin}`}
                </span>
                <span className="import-train-schedule-traindetail-step-duration">
                  {step.duree}s
                </span>
                <span className="import-train-schedule-traindetail-step-name">{step.gare}</span>
              </div>
            )
        )}
      </div>
    </div>
  );
}
