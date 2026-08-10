import { Plus } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { getOperationalStudiesConf } from 'reducers/osrdconf/operationalStudiesConf/selectors';

import { useCreateTrainSchedule } from './hooks/useCreateTrainSchedule';

type CreateTrainScheduleButtonProps = {
  setIsWorking: (isWorking: boolean) => void;
  closeManageTrainScheduleAndOpenTableBoard: () => void;
};

/**
 * Create unique trains and paced trains
 */
const CreateTrainScheduleButton = ({
  setIsWorking,
  closeManageTrainScheduleAndOpenTableBoard,
}: CreateTrainScheduleButtonProps) => {
  const { workerStatus } = useScenarioContext();
  const simulationConf = useSelector(getOperationalStudiesConf);
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });

  const createTrainSchedule = useCreateTrainSchedule(
    setIsWorking,
    closeManageTrainScheduleAndOpenTableBoard
  );
  const isPacedTrainMode = simulationConf.editingTrainType === 'pacedTrain';

  return (
    <button
      className="btn btn-primary mb-2"
      type="button"
      disabled={workerStatus !== 'READY'}
      onClick={createTrainSchedule}
      data-testid="create-train-schedule-button"
    >
      <span className="mr-2">
        <Plus size="lg" />
      </span>
      {isPacedTrainMode ? t('addPacedTrain') : t('addUniqueTrain')}
    </button>
  );
};

export default CreateTrainScheduleButton;
