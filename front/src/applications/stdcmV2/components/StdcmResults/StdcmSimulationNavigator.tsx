import React from 'react';

import { CheckCircle, ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import useHorizontalScroll from 'applications/stdcmV2/hooks/useHorizontalScroll';
import type { StdcmSimulation } from 'applications/stdcmV2/types';
import { formatDateToString } from 'utils/date';

export const SIMULATION_ITEM_CLASSNAME = 'simulation-item';
const ITEM_TO_SHOW_COUNT_ON_SCROLL = 3;

type StdcmSimulationNavigatorProps = {
  simulationsList: StdcmSimulation[];
  retainedSimulationIndex: number;
  selectedSimulationIndex: number;
  showStatusBanner: boolean;
  isCalculationFailed: boolean;
  onSelectSimulation: (simulationIndex: number) => void;
};

const StdcmSimulationNavigator = ({
  simulationsList,
  retainedSimulationIndex,
  selectedSimulationIndex,
  showStatusBanner,
  isCalculationFailed,
  onSelectSimulation,
}: StdcmSimulationNavigatorProps) => {
  const { t } = useTranslation('stdcm', { keyPrefix: 'simulation.results' });

  const { scrollableRef, showLeftBtn, showRightBtn, scrollLeft, scrollRight } = useHorizontalScroll(
    SIMULATION_ITEM_CLASSNAME,
    ITEM_TO_SHOW_COUNT_ON_SCROLL
  );

  return (
    <div
      className={cx('simulation-navigator', {
        'with-error-status': showStatusBanner && isCalculationFailed,
      })}
    >
      <div className="simulation-list-wrapper">
        {showLeftBtn && (
          <div
            className="scroll-btn left"
            role="button"
            tabIndex={0}
            aria-label="Scroll left"
            onClick={scrollLeft}
          >
            <ChevronLeft size="lg" />
          </div>
        )}
        <div className="simulation-list" ref={scrollableRef}>
          {simulationsList?.map(({ id, creationDate, outputs }, index) => (
            <div
              role="button"
              tabIndex={0}
              key={index}
              className={cx(SIMULATION_ITEM_CLASSNAME, {
                retained: retainedSimulationIndex === index,
                selected: selectedSimulationIndex === index,
                anyRetained: retainedSimulationIndex !== -1,
              })}
              onClick={() => onSelectSimulation(index)}
            >
              <div className="simulation-name">
                <div>
                  {outputs
                    ? t('simulationName.withOutputs', { id })
                    : t('simulationName.withoutOutputs')}
                </div>
                {retainedSimulationIndex === index && (
                  <span className="check-circle">
                    <CheckCircle variant="fill" />
                  </span>
                )}
              </div>
              <div className="creation-date">
                <span key={index}>
                  {t('formatCreationDate', formatDateToString(creationDate, true))}
                </span>
              </div>
              {selectedSimulationIndex === index && (
                <div className="selected-simulation-indicator" />
              )}
            </div>
          ))}
        </div>
        {showRightBtn && (
          <div
            className="scroll-btn right"
            role="button"
            tabIndex={0}
            aria-label="Scroll right"
            onClick={scrollRight}
          >
            <ChevronRight size="lg" />
          </div>
        )}
      </div>
      <div className="separator" />
    </div>
  );
};

export default StdcmSimulationNavigator;
