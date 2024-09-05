import { groupBy } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { TrainScheduleScenarioStudyProject } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';

type RollingStockEditorFormModalProps = {
  setAddOrEditState?: React.Dispatch<React.SetStateAction<boolean>>;
  // request can be a POST, PUT, PATCH or DELETE request
  request?: () => void;
  mainText: string;
  errorObject?: TrainScheduleScenarioStudyProject[];
  buttonText?: string;
  deleteAction?: boolean;
};

const RollingStockEditorFormModal = ({
  request,
  setAddOrEditState,
  mainText,
  errorObject,
  buttonText,
  deleteAction,
}: RollingStockEditorFormModalProps) => {
  const { closeModal } = useModal();
  const { t } = useTranslation(['translation', 'rollingstock']);

  const displayErrorObject = (errorList: TrainScheduleScenarioStudyProject[]) => {
    const projectList = groupBy(errorList, 'project_name');
    const scenarioList = Object.keys(projectList).map((projectName) =>
      groupBy(projectList[projectName], 'scenario_name')
    );

    return (
      <div className=" d-flex flex-column form-error mb-3">
        <span className="text-uppercase text-center mb-2">{mainText}</span>
        <span>{t('rollingstock:errorMessages.rollingStockUsed')}</span>
        {Object.keys(projectList).map((projectName: string, index: number) => (
          <ul className="mt-1 mb-0">
            <span>{t('rollingstock:project', { projectName })}</span>
            {Object.keys(scenarioList[index]).map((scenarioName) => (
              <li className="ml-5">{scenarioName}</li>
            ))}
          </ul>
        ))}
      </div>
    );
  };

  return (
    <div className="d-flex flex-column align-items-center p-3 w-100">
      {!errorObject ? (
        <span className="text-primary mb-3">{mainText}</span>
      ) : (
        displayErrorObject(errorObject)
      )}
      <div className="d-flex justify-content-end w-100">
        <button
          data-testid="confirm-modal-button-no"
          type="button"
          className="btn btn-sm btn-primary-gray"
          onClick={() => closeModal()}
        >
          {t('common.no')}
        </button>
        {!errorObject && (
          <button
            data-testid="confirm-modal-button-yes"
            type="button"
            className={`btn btn-sm ${deleteAction ? 'bg-red text-white' : 'btn-primary'} ml-3`}
            onClick={() => {
              if (request) request();
              if (!request && setAddOrEditState) {
                setAddOrEditState(false);
              }
              closeModal();
            }}
          >
            {buttonText}
          </button>
        )}
      </div>
    </div>
  );
};

export default RollingStockEditorFormModal;
