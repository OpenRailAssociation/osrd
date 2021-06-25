import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { updateLabels } from 'reducers/osrdconf';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF/ChipsSNCF';

export default function AddTrainLabels() {
  const { t } = useTranslation(['osrdconf']);
  const { labels } = useSelector((state) => state.osrdconf);
  const dispatch = useDispatch();

  const removeLabel = (idx) => {
    const newLabels = Array.from(labels);
    newLabels.splice(idx, 1);
    dispatch(updateLabels(newLabels));
  };

  const addLabel = (label) => {
    const newLabels = Array.from(labels);
    newLabels.push(label);
    dispatch(updateLabels(newLabels));
  };

  return (
    <>
      <div className="osrd-config-item">
        <div className="osrd-config-item-container mb-2">
          <ChipsSNCF
            addLabel={addLabel}
            labels={labels}
            removeLabel={removeLabel}
            title={t('trainLabels')}
          />
        </div>
      </div>
    </>
  );
}
