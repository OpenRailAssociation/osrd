import { useMemo, useState } from 'react';

import { Button, Dialog, Input, Select, TextArea } from '@osrd-project/ui-core';
import cx from 'classnames';
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
  const [isNameMissing, setIsNameMissing] = useState(false);
  const [catalogEntry, setCatalogEntry] = useState<CatalogEntry>();
  const [description, setDescription] = useState('');
  const [catalogEntryMode, setCatalogEntryMode] = useState<'select' | 'create'>('select');
  const [newCatalogEntryName, setNewCatalogEntryName] = useState('');
  const [catalogEntryError, setCatalogEntryError] = useState<'duplicate' | 'missing' | 'none'>(
    'none'
  );

  const { data: catalogueEntryResult } = osrdEditoastApi.endpoints.getCatalogEntry.useQuery(
    {
      pageSize: 1000,
    },
    { skip: !!MOCK_CATALOG }
  );

  const [postTrainScheduleSet] = osrdEditoastApi.endpoints.postTrainScheduleSet.useMutation();
  const [postCatalogEntry] = osrdEditoastApi.endpoints.postCatalogEntry.useMutation();

  const catalogEntries = useMemo(() => {
    // TODO Package : return [] when back ready
    if (!catalogueEntryResult) return MOCK_CATALOG;
    return catalogueEntryResult.results.sort((a, b) =>
      a.name && b.name ? a.name.localeCompare(b.name) : 0
    );
  }, [catalogueEntryResult, MOCK_CATALOG]);

  const catalogEntryNameExists = useMemo(() => {
    if (catalogEntryMode === 'create') {
      return catalogEntries.some((entry) => entry.name === newCatalogEntryName);
    }
    return false;
  }, [catalogEntryMode, catalogEntries, newCatalogEntryName]);

  const getCatalogEntryErrorMessage = () => {
    if (catalogEntryNameExists) {
      return {
        status: 'error' as const,
        message: t('duplicateCatalogEntry'),
      };
    }
    if (catalogEntryError === 'missing') {
      return {
        status: 'error' as const,
      };
    }
    return;
  };

  const handleSubmit = async () => {
    if (!name) {
      setIsNameMissing(true);
      return;
    }

    let catalogEntryId = catalogEntry?.id ?? null;
    if (catalogEntryMode === 'create') {
      if (!newCatalogEntryName) {
        setCatalogEntryError('missing');
        return;
      }
      if (catalogEntryNameExists) {
        setCatalogEntryError('duplicate');
        return;
      }

      const newCatalogEntry = await postCatalogEntry({
        catalogEntryForm: { name: newCatalogEntryName },
      }).unwrap();
      catalogEntryId = newCatalogEntry.id;
    }

    const payload: TrainScheduleSetForm = {
      name,
      description,
      catalog_entry_id: catalogEntryId,
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
          <Button
            label={t('addTrainScheduleSet')}
            className={cx('submit-button', {
              'wizz-effect': catalogEntryError !== 'none' || isNameMissing,
            })}
            onClick={handleSubmit}
          />
        </>
      }
    >
      <div className="train-schedule-set-name">
        <Input
          id="train-schedule-set-name"
          label={t('name')}
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (isNameMissing) {
              setIsNameMissing(false);
            }
          }}
          statusWithMessage={
            isNameMissing
              ? {
                  status: 'error',
                }
              : undefined
          }
        />
      </div>
      {catalogEntryMode === 'select' && (
        <div className="catalog-entry">
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
          <button
            className="catalog-entry-mode-button"
            onClick={() => setCatalogEntryMode('create')}
          >
            {t('createNewCatalogEntry')}
          </button>
        </div>
      )}
      {catalogEntryMode === 'create' && (
        <div className="catalog-entry">
          <div className="new-catalog-entry-input">
            <Input
              id="new-catalog-entry-name"
              label={t('newCatalogEntry')}
              required
              value={newCatalogEntryName}
              onChange={(e) => {
                setNewCatalogEntryName(e.target.value);
                if (catalogEntryError !== 'none') {
                  setCatalogEntryError('none');
                }
              }}
              statusWithMessage={getCatalogEntryErrorMessage()}
            />
          </div>
          <button
            className="catalog-entry-mode-button existing"
            onClick={() => {
              setCatalogEntryMode('select');
              setNewCatalogEntryName('');
              setCatalogEntryError('none');
            }}
          >
            {t('existingCatalogEntry')}
          </button>
        </div>
      )}
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
