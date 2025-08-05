import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';

import { DEFAULT_SIGNALING_SYSTEMS } from '../consts';
import useCompleteRollingStockSchemasProperties from '../hooks/useCompleteRollingStockSchemasProperties';
import type { RollingStockParametersValues } from '../types';

type RollingStockEditorOnboardSystemEquipmentFormProps = {
  rsSignalingSystemsList: RollingStockParametersValues['supportedSignalingSystems'];
  setRollingStockValues: (
    rollingStockValues: React.SetStateAction<RollingStockParametersValues>
  ) => void;
};

const RollingStockEditorOnboardSystemEquipmentForm = ({
  rsSignalingSystemsList,
  setRollingStockValues,
}: RollingStockEditorOnboardSystemEquipmentFormProps) => {
  const { t } = useTranslation('translation', { keyPrefix: 'rollingStock' });

  const rollingStockSchemasProperties = useCompleteRollingStockSchemasProperties();

  const sigSystemProperty = rollingStockSchemasProperties.filter(
    (property) => property.title === 'supportedSignalingSystems'
  )[0];

  const updateSigSystemsList = (sigSystem: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const newList = e.target.checked
      ? [...rsSignalingSystemsList, sigSystem]
      : rsSignalingSystemsList.filter((v) => v !== sigSystem);
    setRollingStockValues((prevRollingStockValues) => ({
      ...prevRollingStockValues,
      supportedSignalingSystems: newList,
    }));
  };

  const signalingSystemCheckboxes = sigSystemProperty.enum!.map((sigSystem, index) => {
    const checked = rsSignalingSystemsList.includes(sigSystem);
    return (
      <div key={`${index}-${sigSystem}`} className={cx('col-6', 'col-xl-3')}>
        <CheckboxRadioSNCF
          type="checkbox"
          id={sigSystem}
          name={sigSystem}
          label={sigSystem}
          checked={checked}
          onChange={updateSigSystemsList(sigSystem)}
          disabled={DEFAULT_SIGNALING_SYSTEMS.includes(sigSystem)}
        />
      </div>
    );
  });

  return (
    <div className="d-lg-flex rollingstock-editor-input-container px-1 pb-3">
      <div className="d-flex justify-content-space-around mr-2">
        <label className="signaling-systems-label col-xl-3" htmlFor="supportedSignalingSystems">
          {t('supportedSignalingSystems')}
        </label>
        <div className="d-flex flex-wrap col-xl-9 ">{signalingSystemCheckboxes}</div>
      </div>
    </div>
  );
};

export default RollingStockEditorOnboardSystemEquipmentForm;
