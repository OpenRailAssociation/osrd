import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { updateLabels } from 'reducers/osrdconf';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';

export default function AddTrainLabels() {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const { labels } = useSelector((state) => state.osrdconf);
  const dispatch = useDispatch();

  const removeTag = (idx) => {
    const newTags = Array.from(labels);
    newTags.splice(idx, 1);
    dispatch(updateLabels(newTags));
  };

  const addTag = (tag) => {
    const newTags = Array.from(labels);
    newTags.push(tag);
    dispatch(updateLabels(newTags));
  };

  return (
    <div className="osrd-config-item" data-testid="add-train-labels">
      <div className="osrd-config-item-container mb-2">
        <ChipsSNCF addTag={addTag} tags={labels} removeTag={removeTag} title={t('trainLabels')} />
      </div>
    </div>
  );
}
