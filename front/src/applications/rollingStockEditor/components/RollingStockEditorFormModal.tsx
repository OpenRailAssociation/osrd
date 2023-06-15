import React from 'react';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useTranslation } from 'react-i18next';
import { FieldValues } from 'react-hook-form';
import { RollingStockUsage } from 'common/api/osrdEditoastApi';
import { groupBy } from 'lodash';

type RollingStockEditorFormModalProps = {
  setAddOrEditState?: React.Dispatch<React.SetStateAction<boolean>>;
  data?: FieldValues;
  request?: (data: FieldValues) => void;
  mainText: string;
  errorObject?: RollingStockUsage['usage'][];
  buttonText?: string;
};

const RollingStockEditorFormModal = ({
  data,
  request,
  setAddOrEditState,
  mainText,
  errorObject,
  buttonText,
}: RollingStockEditorFormModalProps) => {
  const { closeModal } = useModal();
  const { t } = useTranslation(['translation', 'rollingstock']);

  const displayErrorObject = (errorList: RollingStockUsage['usage'][]): JSX.Element => {
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
      <div className="d-flex justify-content-around w-100">
        <button type="button" className="btn btn-sm btn-primary-gray" onClick={() => closeModal()}>
          {t('common.back')}
        </button>
        {!errorObject && (
          <button
            type="button"
            className="btn btn-sm btn-primary ml-3"
            onClick={() => {
              if (setAddOrEditState) setAddOrEditState(false);
              if (request) request(data as FieldValues);
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
