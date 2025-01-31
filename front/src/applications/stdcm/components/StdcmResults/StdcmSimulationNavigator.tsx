import { CheckCircle, ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useHorizontalScroll from 'applications/stdcm/hooks/useHorizontalScroll';
import { hasConflicts, hasResults } from 'applications/stdcm/utils/simulationOutputUtils';
import { getStdcmSimulations } from 'reducers/osrdconf/stdcmConf/selectors';
import { formatDateToString, formatTimeDifference } from 'utils/date';
import { mmToKm } from 'utils/physics';

export const SIMULATION_ITEM_CLASSNAME = 'simulation-item';
const ITEM_TO_SHOW_COUNT_ON_SCROLL = 3;

type StdcmSimulationNavigatorProps = {
  retainedSimulationIndex: number;
  selectedSimulationIndex: number;
  showStatusBanner: boolean;
  isCalculationFailed: boolean;
  onSelectSimulation: (simulationIndex: number) => void;
};

const StdcmSimulationNavigator = ({
  retainedSimulationIndex,
  selectedSimulationIndex,
  showStatusBanner,
  isCalculationFailed,
  onSelectSimulation,
}: StdcmSimulationNavigatorProps) => {
  const { t } = useTranslation();

  const simulationsList = useSelector(getStdcmSimulations);

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
          {simulationsList?.map(({ id, creationDate, outputs }, index) => {
            let formatedTotalLength = '';
            let formatedTripDuration = '';

            if (hasResults(outputs)) {
              const { results } = outputs;
              const lastPointTime = results.simulation.final_output.times.at(-1)!;
              const departureTimeInMs = new Date(results.departure_time).getTime();

              formatedTotalLength = `${Math.round(mmToKm(results.path.length))} ${t('common.units.km', { ns: 'translation' })} `;
              formatedTripDuration = formatTimeDifference(
                departureTimeInMs,
                lastPointTime + departureTimeInMs
              );
            }

            return (
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
                  <span>
                    {outputs && !hasConflicts(outputs)
                      ? t('simulation.results.simulationName.withOutputs', {
                          id,
                          ns: 'stdcm',
                        })
                      : t('simulation.results.simulationName.withoutOutputs', {
                          ns: 'stdcm',
                        })}
                  </span>
                  {retainedSimulationIndex === index && (
                    <CheckCircle className="check-circle" variant="fill" />
                  )}
                </div>
                <div className="simulation-metadata" key={id}>
                  <span className="creation-date">
                    {t('simulation.results.formatCreationDate', {
                      ...formatDateToString(creationDate, true),
                      ns: 'stdcm',
                    })}
                  </span>
                  <span className="total-length-trip-duration">{`${formatedTotalLength}— ${formatedTripDuration}`}</span>
                </div>
                {selectedSimulationIndex === index && (
                  <div className="selected-simulation-indicator" />
                )}
              </div>
            );
          })}
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
