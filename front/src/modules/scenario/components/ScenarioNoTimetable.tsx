import { useState } from 'react';

import { PatternHourly, TimetableCalendar } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { TimetableType } from 'common/api/osrdEditoastApi';

import AddOrEditTimetableModal from './AddOrEditTimetableModal';

/**
 * Displayed instead of the scenario content when a scenario has no timetable yet.
 */
const ScenarioNoTimetable = () => {
  const { t } = useTranslation('operational-studies');
  const [timetableTypeToCreate, setTimetableTypeToCreate] = useState<TimetableType | null>(null);

  return (
    <div className="scenario-no-timetable">
      <button
        type="button"
        className="scenario-no-timetable-button scenario-no-timetable-button--hourly"
        onClick={() => setTimetableTypeToCreate('HOURLY')}
      >
        <span className="hourly-pattern-icon-group">
          <PatternHourly size="lg" />
          <PatternHourly size="lg" className="hourly-pattern-ghost-icon" />
          <PatternHourly size="lg" className="hourly-pattern-ghost-icon" />
        </span>
        <span>{t('main.scenarioNoTimetableAddHourlyPattern')}</span>
      </button>
      <button
        type="button"
        className="scenario-no-timetable-button scenario-no-timetable-button--calendar"
        onClick={() => setTimetableTypeToCreate('CALENDAR')}
      >
        <TimetableCalendar size="lg" />
        <span>{t('main.scenarioNoTimetableAddCalendar')}</span>
      </button>
      {timetableTypeToCreate && (
        <AddOrEditTimetableModal
          timetableType={timetableTypeToCreate}
          onCancel={() => setTimetableTypeToCreate(null)}
        />
      )}
    </div>
  );
};

export default ScenarioNoTimetable;
