import React from 'react';
import { useTranslation } from 'react-i18next';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF/ChipsSNCF';

export default function AddTrainLabels() {
  const { t } = useTranslation(['osrdconf']);
  return (
    <>
      <div className="osrd-config-item">
        <div className="osrd-config-item-container">
          <ChipsSNCF title={t('trainLabels')} />
        </div>
      </div>
    </>
  );
}
