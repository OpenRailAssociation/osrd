import { useCallback, useEffect, useMemo, useState } from 'react';

import { Input, Select, TextArea, type StatusWithMessage } from '@osrd-project/ui-core';
import cx from 'classnames';
import { debounce } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { TrainScheduleSetFormData } from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import type { CatalogEntry, TrainScheduleSet } from 'common/api/osrdEditoastApi';
import type { AsyncStatus } from 'common/types';

export type FieldName = 'name' | 'catalog' | 'description';

type TrainScheduleSetFormProps = {
  formId: string;
  trainScheduleSet?: TrainScheduleSet;
  catalogEntries: CatalogEntry[];
  onSubmit: (data: TrainScheduleSetFormData) => Promise<void>;
  isCatalogEntryRequired?: boolean;
  additionalValidations?: (
    data: Partial<TrainScheduleSetFormData>
  ) => Partial<Record<FieldName, StatusWithMessage>>;
  onValidation: (hasError: boolean) => void;
  checkNameInCatalogIsUniq?: (name: string, catalogId: number) => Promise<boolean>;
  setIsEditing: (hasChanged: boolean) => void;
};

/**
 * Compute a basic train set name (series), defined as a 3 years in the future as it
 * was identified as a good middle point between long-term and short-term use cases.
 */
function trainSetNameExample(): string {
  const currentYear = new Date().getFullYear();
  return `${currentYear + 3}`;
}

const TrainScheduleSetForm = ({
  formId,
  trainScheduleSet,
  catalogEntries,
  onSubmit,
  onValidation,
  checkNameInCatalogIsUniq,
  setIsEditing,
}: TrainScheduleSetFormProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main.timetable.trainScheduleSets',
  });

  // Name input
  const [name, setName] = useState<string>('');
  const [nameError, setNameError] = useState<StatusWithMessage>();
  const [nameUniqueStatus, setNameUniqueStatus] = useState<AsyncStatus>({ type: 'idle' });
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
  const [catalogEntryMode, setCatalogEntryMode] = useState<'select' | 'create'>('select');
  const [catalogEntryError, setCatalogEntryError] = useState<StatusWithMessage>();
  const checkCatalogEntryIsUniq = useCallback(
    (value: TrainScheduleSetFormData['catalog']): StatusWithMessage | undefined => {
      if (catalogEntryMode === 'create') {
        const catalogName = value && value.type === 'create' ? value.name : '';
        // Checking that the name is free
        if (catalogEntries.findIndex((e) => e.name === catalogName) > -1) {
          return {
            status: 'error',
            message: t('duplicateCatalogEntry'),
          };
        }
      }
      return undefined;
    },
    [catalogEntryMode]
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
    [catalogEntryMode, checkCatalogEntryIsUniq]
  );

  /**
   * Function that check the uniqueness of the couple name/catalog.
   * This function is debounce by lodash to avoid multiple calls
   */
  const checkNameCatalogUniqueness = useCallback(
    // eslint-disable-next-line react-hooks/use-memo
    debounce(async (formName?: string, formCatalog?: TrainScheduleSetFormData['catalog']) => {
      if (checkNameInCatalogIsUniq && formName && formCatalog && 'id' in formCatalog) {
        const catalogId = formCatalog.id;
        setNameUniqueStatus({ type: 'loading' });
        try {
          const isUniq = await checkNameInCatalogIsUniq(formName, catalogId);
          if (isUniq) setNameUniqueStatus({ type: 'success' });
          else setNameUniqueStatus({ type: 'error' });
        } catch (e) {
          console.error(e);
          setNameUniqueStatus({ type: 'idle' });
        }
      }
    }, 300),
    [checkNameInCatalogIsUniq]
  );

  /**
   * Sort the catalog for the select
   */
  const catalogSorted = useMemo(
    () => [...catalogEntries].sort((a, b) => (a.name && b.name ? a.name.localeCompare(b.name) : 0)),
    [catalogEntries]
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
      return catalogEntries.find((e) => e.id === catalogId);
    }
    return undefined;
  }, [catalogEntry, catalogEntries]);

  /**
   *  Status of the package name
   *  We need it due to the async task that check if the name is unique.
   *  - the loading status is first
   *  - the success of the task is last order
   */
  const inputNameStatus: StatusWithMessage | undefined = useMemo(() => {
    // we check the status of uniqNameChecker for live validation
    if (nameUniqueStatus.type === 'loading') return { status: 'loading' };
    if (nameError) return nameError;
    if (nameUniqueStatus.type === 'error')
      return { status: 'error', message: t('checkingNameUniquenessError') };
    if (nameUniqueStatus.type === 'success') return { status: 'success' };
    return undefined;
  }, [nameError, nameUniqueStatus, t]);

  const placeholderName = useMemo(
    () => t('namePlaceholder', { series: trainSetNameExample() }),
    []
  );

  const isEditing = useMemo(() => {
    const catalogEntryChanged =
      catalogEntry?.type === 'create' || trainScheduleSet?.catalog_entry_id !== catalogEntry?.id;

    return (
      trainScheduleSet?.name !== name ||
      trainScheduleSet?.description !== description ||
      catalogEntryChanged
    );
  }, [trainScheduleSet, name, description, catalogEntry]);

  useEffect(() => {
    setIsEditing(isEditing);
  }, [isEditing]);

  return (
    <form
      id={formId}
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          isNameValid(name) &&
          isCatalogEntryValid(catalogEntry) &&
          nameUniqueStatus.type !== 'error' &&
          nameUniqueStatus.type !== 'loading'
        ) {
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
              setCatalogEntryError(checkCatalogEntryIsUniq(newCatalog));
              if (checkNameInCatalogIsUniq) {
                checkNameCatalogUniqueness(name, newCatalog);
              }
            }}
            required={checkNameInCatalogIsUniq !== undefined}
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
            if (checkNameInCatalogIsUniq) {
              checkNameCatalogUniqueness(newValue, catalogEntry);
            }
          }}
          statusWithMessage={inputNameStatus}
          placeholder={placeholderName}
        />
      </div>

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
