import { useMemo, useState } from 'react';

import { Button, Dialog, Input, Select, TextArea } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import {
  osrdEditoastApi,
  type CatalogEntry,
  type TrainScheduleSetForm,
} from 'common/api/osrdEditoastApi';

import { MOCK_CATALOG } from '../../../mockTrainScheduleSets';

type TrainScheduleSetDialogProps = {
  onCancel: () => void;
};

const TrainScheduleSetDialog = ({ onCancel }: TrainScheduleSetDialogProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main.timetable.trainScheduleSets',
  });

  const [name, setName] = useState('');
  const [catalogEntry, setCatalogEntry] = useState<CatalogEntry>();
  const [description, setDescription] = useState('');

  const { data: catalogueEntryResult } = osrdEditoastApi.endpoints.getCatalogEntry.useQuery(
    {
      pageSize: 1000,
    },
    { skip: !!MOCK_CATALOG }
  );

  const [postTrainScheduleSet] = osrdEditoastApi.endpoints.postTrainScheduleSet.useMutation();

  const catalogEntries = useMemo(() => {
    // TODO Package : return [] when back ready
    if (!catalogueEntryResult) return MOCK_CATALOG;
    return catalogueEntryResult.results.sort((a, b) =>
      a.name && b.name ? a.name.localeCompare(b.name) : 0
    );
  }, [catalogueEntryResult, MOCK_CATALOG]);

  const handleSubmit = () => {
    const payload: TrainScheduleSetForm = {
      name,
      description,
      catalog_entry_id: catalogEntry?.id ?? null,
      published: false, // new train schedule sets are always local by default
    };
    postTrainScheduleSet({ trainScheduleSetForm: payload });
    onCancel();
  };

  return (
    <Dialog
      className="train-schedule-set-dialog"
      header={<h5>{t('newLocalTrainScheduleSet')}</h5>}
      footer={
        <>
          <Button variant="Cancel" label={t('cancel')} onClick={onCancel} />
          <Button label={t('addTrainScheduleSet')} onClick={handleSubmit} />
        </>
      }
    >
      <Input
        id="train-schedule-set-name"
        label={t('name')}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Select
        id="catalogue-entry"
        label={t('catalogEntry')}
        placeholder={t('choose')}
        value={catalogEntry}
        onChange={(e) => {
          setCatalogEntry(e);
        }}
        options={catalogEntries}
        getOptionLabel={(option) => option.name ?? ''}
        getOptionValue={(option) => option.name ?? ''}
      />
      <TextArea
        id="train-schedule-set-description"
        label={t('description')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
    </Dialog>
  );
};

export default TrainScheduleSetDialog;
