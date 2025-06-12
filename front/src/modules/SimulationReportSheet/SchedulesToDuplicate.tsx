import { Table, TD, TR } from '@ag-media/react-pdf-table';
import { View, Text } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { StdcmSuccessResponse } from 'applications/stdcm/types';
import type { StdcmPathStep } from 'reducers/osrdconf/types';

import styles from './styles/SimulationReportStyleSheet';
import type { RefSchedule } from './types';
import { getSecondaryCode } from './utils/formatSimulationReportSheet';

type SchedulesToDuplicateProps = {
  stdcmData: StdcmSuccessResponse;
  refSchedules: RefSchedule[];
};

const SchedulesToDuplicate = ({ stdcmData, refSchedules }: SchedulesToDuplicateProps) => {
  const { t } = useTranslation('stdcm');

  const fullUIC = (ci: number) => Number(`87${ci}`);

  const dateToDDMMYYYY = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const findSchedulesBetween = (
    beginStep: StdcmPathStep,
    allFollowingSteps: StdcmPathStep[],
    schedules: RefSchedule[]
  ) =>
    schedules.filter((schedule) => {
      const scheduleBeginUIC = fullUIC(schedule.begin.ci);
      const scheduleEndUIC = fullUIC(schedule.end.ci);

      const beginMatches =
        scheduleBeginUIC === beginStep.location?.uic &&
        schedule.begin.ch === beginStep.location?.secondary_code;

      const endMatches = allFollowingSteps.some(
        (step) =>
          scheduleEndUIC === step.location?.uic && schedule.end.ch === step.location?.secondary_code
      );

      return beginMatches && endMatches;
    });

  const isRelevantStep = (step: StdcmPathStep, schedules: RefSchedule[]) =>
    schedules.some(
      (s) =>
        step.location?.uic === Number(`87${s.begin.ci}`) &&
        step.location?.secondary_code === s.begin.ch
    ) ||
    schedules.some(
      (s) =>
        step.location?.uic === Number(`87${s.end.ci}`) && step.location?.secondary_code === s.end.ch
    );

  return (
    <View style={styles.schedulesToDuplicate.schedulesToDuplicate}>
      <View style={styles.schedulesToDuplicate.titleBox}>
        <Text style={styles.schedulesToDuplicate.title}>
          {t('reportSheet.schedulesToDuplicate')}
        </Text>

        <View style={styles.schedulesToDuplicate.container}>
          <Table style={styles.schedulesToDuplicate.table}>
            {stdcmData.simulationPathSteps
              .filter((step) => isRelevantStep(step, refSchedules))
              .map((step, index, array) => {
                const followingSteps = array.slice(index + 1);
                const matchedSchedules = findSchedulesBetween(step, followingSteps, refSchedules);
                const isEndStep = refSchedules.some(
                  (schedule) =>
                    step.location?.uic === Number(`87${schedule.end.ci}`) &&
                    step.location?.secondary_code === schedule.end.ch
                );

                return (
                  <>
                    <View style={styles.schedulesToDuplicate.stopTableContainer}>
                      <TR
                        key={index}
                        style={{
                          ...styles.schedulesToDuplicate.stopTableTbody,
                          alignSelf: isEndStep ? 'flex-end' : 'flex-start',
                          marginRight: isEndStep ? '24' : '0',
                        }}
                      >
                        <View style={styles.schedulesToDuplicate.opWidth}>
                          <TD style={styles.schedulesToDuplicate.opColumn}>
                            {step.location!.name}
                          </TD>
                        </View>
                        <View style={styles.schedulesToDuplicate.chWidth}>
                          <TD style={styles.schedulesToDuplicate.chColumn}>
                            {getSecondaryCode(step)}
                          </TD>
                        </View>
                      </TR>
                    </View>
                    {matchedSchedules.length > 0 && (
                      <TR style={styles.schedulesToDuplicate.schedulesToDuplicateTbody}>
                        <View style={styles.schedulesToDuplicate.schedulesToDuplicateWidth}>
                          {matchedSchedules.map((schedule, refIdx) => (
                            <View
                              key={`sched-wrapper-${index}-${refIdx}`}
                              style={styles.schedulesToDuplicate.scheduleWrapper}
                            >
                              <View
                                key={`sched-wrapper-${index}-${refIdx}`}
                                style={styles.schedulesToDuplicate.scheduleWrapper}
                              >
                                <View style={styles.schedulesToDuplicate.scheduleIdWidth}>
                                  <TD style={styles.schedulesToDuplicate.scheduleIdColumn}>
                                    {schedule.train_name}
                                  </TD>
                                </View>
                                <View style={styles.schedulesToDuplicate.startDateWidth}>
                                  <TD style={styles.schedulesToDuplicate.startDateColumn}>
                                    {dateToDDMMYYYY(new Date(schedule.start_time))}
                                  </TD>
                                </View>
                              </View>
                            </View>
                          ))}
                        </View>
                      </TR>
                    )}
                  </>
                );
              })}
          </Table>
        </View>
      </View>
    </View>
  );
};

export default SchedulesToDuplicate;
