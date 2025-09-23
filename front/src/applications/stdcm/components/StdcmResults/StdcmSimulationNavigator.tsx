import { CheckCircle, ChevronLeft, ChevronRight, Sparkle } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useHorizontalScroll from 'applications/stdcm/hooks/useHorizontalScroll';
import { hasResults } from 'applications/stdcm/utils/simulationOutputUtils';
import { getStdcmCompletedSimulations } from 'reducers/osrdconf/stdcmConf/selectors';
import { formatTimeDifference, useDateTimeLocale } from 'utils/date';
import { mmToKm } from 'utils/physics';

export const SIMULATION_ITEM_CLASSNAME = 'simulation-item';
const ITEM_TO_SHOW_COUNT_ON_SCROLL = 3;

type StdcmSimulationNavigatorProps = {
  retainedSimulationIndex?: number;
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
  const dateTimeLocale = useDateTimeLocale();

  const completedSimulations = useSelector(getStdcmCompletedSimulations);

  const { scrollableRef, showLeftBtn, showRightBtn, scrollLeft, scrollRight } = useHorizontalScroll(
    SIMULATION_ITEM_CLASSNAME,
    ITEM_TO_SHOW_COUNT_ON_SCROLL
  );

  let displayedIndex = 0;

  return (
    <div
      className={cx('simulation-navigator', {
        'with-error-status': showStatusBanner && isCalculationFailed,
      })}
    >
      {completedSimulations.length > 0 && (
        <>
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
              {completedSimulations.map(({ index, creationDate, outputs, alternativePath }) => {
                let formatedTotalLength = '';
                let formatedTripDuration = '';
                const hasValidResults = hasResults(outputs);

                if (hasValidResults) {
                  const { results } = outputs;
                  const lastPointTime = results.simulation.final_output.times.at(-1)!;
                  const departureTime = new Date(results.departure_time);

                  formatedTotalLength = `${Math.round(mmToKm(results.pathfinding_result.length))} ${t('common.units.km', { ns: 'translation' })} `;
                  formatedTripDuration = formatTimeDifference(
                    departureTime,
                    new Date(lastPointTime + departureTime.getTime()),
                    t
                  );
                }
                if (hasValidResults) {
                  displayedIndex += 1;
                }
                const simulationId = hasValidResults ? displayedIndex : '';
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    key={index}
                    data-testid="simulation-item-button"
                    className={cx(SIMULATION_ITEM_CLASSNAME, {
                      retained: retainedSimulationIndex === index,
                      selected: selectedSimulationIndex === index,
                      anyRetained: retainedSimulationIndex !== undefined,
                    })}
                    onClick={() => onSelectSimulation(index)}
                  >
                    <div data-testid="simulation-name" className="simulation-name">
                      <span>
                        {hasValidResults
                          ? t('simulation.results.simulationName.withOutputs', {
                              id: simulationId,
                              ns: 'stdcm',
                            })
                          : t('simulation.results.simulationName.withoutOutputs', {
                              ns: 'stdcm',
                            })}
                      </span>
                      {retainedSimulationIndex === index && (
                        <CheckCircle className="check-circle" variant="fill" />
                      )}
                      {alternativePath && (
                        <Sparkle className="alternative-simulation" variant="fill" />
                      )}
                    </div>
                    <div className="simulation-metadata" key={index}>
                      <span className="creation-date">
                        {creationDate.toLocaleString(dateTimeLocale, {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span
                        data-testid="total-length-trip-duration"
                        className="total-length-trip-duration"
                      >{`${formatedTotalLength}— ${formatedTripDuration}`}</span>
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
        </>
      )}
    </div>
  );
};

export default StdcmSimulationNavigator;
