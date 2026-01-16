import { useCallback, useEffect, useMemo, useState } from 'react';

import { Input, Select, TextArea, type StatusWithMessage } from '@osrd-project/ui-core';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { TrainScheduleSetFormData } from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import type { CatalogEntry, TrainScheduleSet } from 'common/api/osrdEditoastApi';

export type FieldName = 'name' | 'catalog' | 'description';

type TrainScheduleSetFormProps = {
  formId: string;
  trainScheduleSet?: TrainScheduleSet;
  catalog: CatalogEntry[];
  onSubmit: (data: TrainScheduleSetFormData) => Promise<void>;
  isCatalogEntryRequired?: boolean;
  additionalValidations?: (
    data: Partial<TrainScheduleSetFormData>
  ) => Partial<Record<FieldName, StatusWithMessage>>;
  onValidation: (hasError: boolean) => void;
};

const TrainScheduleSetForm = ({
  formId,
  trainScheduleSet,
  catalog,
  onSubmit,
  onValidation,
}: TrainScheduleSetFormProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main.timetable.trainScheduleSets',
  });
  const [catalogEntryMode, setCatalogEntryMode] = useState<'select' | 'create'>('select');

  // Name input
  const [name, setName] = useState<string>('');
  const [nameError, setNameError] = useState<StatusWithMessage>();
  const isNameValid = useCallback((value: string) => {
    let error: StatusWithMessage | null = null;
    if (!value || value.length === 0) error = { status: 'error' };
    setNameError(error ?? undefined);
    return error === null;
  }, []);

  // Description
  const [description, setDescription] = useState('');

  // Catalog
  const [catalogEntry, setCatalogEntry] = useState<TrainScheduleSetFormData['catalog']>();
  const [catalogEntryError, setCatalogEntryError] = useState<StatusWithMessage>();
  const checkCatalogEntryIsUniq = useCallback(
    (value: TrainScheduleSetFormData['catalog']): StatusWithMessage | undefined => {
      if (catalogEntryMode === 'create') {
        const catalogName = value && value.type === 'create' ? value.name : '';
        // Checking that the name is free
        if (catalog.findIndex((e) => e.name === catalogName) > -1) {
          return {
            status: 'error',
            message: t('duplicateCatalogEntry'),
          };
        }
      }
      return undefined;
    },
    [catalog, catalogEntryMode]
  );
  const isCatalogEntryValid = useCallback(
    (value?: TrainScheduleSetFormData['catalog']) => {
      let error: StatusWithMessage | undefined = undefined;

      if (catalogEntryMode === 'create') {
        const catalogName = value && value.type === 'create' ? value.name : '';
        if (catalogName.length === 0) {
          error = { status: 'error' };
        } else {
          // Checking that the name is free
          error = checkCatalogEntryIsUniq(value);
        }
      }

      setCatalogEntryError(error);
      return error === undefined;
    },
    [catalog, catalogEntryMode, checkCatalogEntryIsUniq]
  );

  /**
   * Sort the catalog for the select
   */
  const catalogSorted = useMemo(
    () => catalog.sort((a, b) => (a.name && b.name ? a.name.localeCompare(b.name) : 0)),
    [catalog]
  );

  /**
   * When trainScheduleSet
   * => set the form
   */
  useEffect(() => {
    setName(trainScheduleSet?.name || '');
    setCatalogEntry(
      trainScheduleSet?.catalog_entry_id
        ? { id: trainScheduleSet.catalog_entry_id, type: 'selected' }
        : undefined
    );
    setDescription(trainScheduleSet?.description || '');
  }, [trainScheduleSet]);

  /**
   * Get the selected catalog entry by its ID
   */
  const catalogSelected = useMemo(() => {
    if (catalogEntry && catalogEntry.type === 'selected') {
      const catalogId = catalogEntry.id;
      return catalog.find((e) => e.id === catalogId);
    }
    return undefined;
  }, [catalogEntry, catalog]);

  return (
    <form
      id={formId}
      onSubmit={async (e) => {
        e.preventDefault();
        if (isNameValid(name) && isCatalogEntryValid(catalogEntry)) {
          await onSubmit({
            name,
            description,
            catalog: catalogEntry!,
            published: false,
          });
        } else {
          onValidation(true);
        }
      }}
    >
      {/* Name */}
      <div className={cx('train-schedule-set-name', 'uniqueness-info')}>
        <Input
          id="train-schedule-set-name"
          label={t('name')}
          required
          value={name}
          onChange={(e) => {
            const newValue = e.target.value;
            setNameError(undefined);
            setName(newValue);
            isNameValid(newValue);
          }}
          statusWithMessage={nameError}
        />
      </div>

      {/* Catalog */}
      {catalogEntryMode === 'select' && (
        <div className="catalog-entry">
          <Select<CatalogEntry>
            id="catalogue-entry"
            label={t('catalogEntry')}
            placeholder={t('choose')}
            value={catalogSelected}
            onChange={(item) => {
              const newCatalog: TrainScheduleSetFormData['catalog'] = item
                ? { id: item.id, type: 'selected' }
                : undefined;
              setCatalogEntry(newCatalog);
              isCatalogEntryValid(newCatalog);
              setCatalogEntryError(checkCatalogEntryIsUniq(newCatalog));
            }}
            options={catalogSorted}
            getOptionLabel={(option) => option.name ?? ''}
            getOptionValue={(option) => `${option.id}`}
            statusWithMessage={catalogEntryError}
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
              value={catalogEntry?.type === 'create' ? catalogEntry.name : undefined}
              onChange={(e) => {
                const newCatalog: TrainScheduleSetFormData['catalog'] = {
                  name: e.target.value,
                  type: 'create',
                };
                setCatalogEntryError(checkCatalogEntryIsUniq(newCatalog));
                setCatalogEntry(newCatalog);
              }}
              statusWithMessage={catalogEntryError}
            />
          </div>
          <button
            className="catalog-entry-mode-button existing"
            onClick={() => {
              setCatalogEntryMode('select');
              setCatalogEntryError(undefined);
            }}
          >
            {t('existingCatalogEntry')}
          </button>
        </div>
      )}

      {/* Description */}
      <TextArea
        id="train-schedule-set-description"
        label={t('description')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
    </form>
  );
};

export default TrainScheduleSetForm;
