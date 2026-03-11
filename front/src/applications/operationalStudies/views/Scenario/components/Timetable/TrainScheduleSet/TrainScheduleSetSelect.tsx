import { useEffect, useMemo, useState } from 'react';

import { Select } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import type { CatalogEntry, TrainScheduleSet } from 'common/api/osrdEditoastApi';

type TrainScheduleSetSelectProps = {
  formId: string;
  trainScheduleSets: TrainScheduleSet[];
  setTrainScheduleSetIdSelected: (id: number | undefined) => void;
  trainScheduleSetIdSelected: number | undefined;
  catalogEntries: CatalogEntry[];
  onSubmit: (ttsid: number) => Promise<void>;
};

const TrainScheduleSetSelect = ({
  formId,
  trainScheduleSets,
  setTrainScheduleSetIdSelected,
  trainScheduleSetIdSelected,
  catalogEntries,
  onSubmit,
}: TrainScheduleSetSelectProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main.timetable.trainScheduleSets',
  });

  const [catalogEntry, setCatalogEntry] = useState<TrainScheduleSet['catalog_entry_id']>();

  const catalogSorted = useMemo(
    () => [...catalogEntries].sort((a, b) => (a.name && b.name ? a.name.localeCompare(b.name) : 0)),
    [catalogEntries]
  );

  const catalogSelected = catalogEntries.find((e) => e.id === catalogEntry);

  const trainScheduleSetsSorted = useMemo(() => {
    const filtered = trainScheduleSets.filter((tts) =>
      catalogSelected ? tts.catalog_entry_id === catalogSelected.id : tts.catalog_entry_id === null
    );

    const normalized = filtered.map((schedule) =>
      schedule.name ? schedule : { ...schedule, name: t('sandbox') }
    );

    const withName = normalized
      .filter((s) => s.name && s.name.trim() !== '')
      .sort((a, b) => a.name!.localeCompare(b.name!));

    const withoutName = normalized.filter((s) => !s.name || s.name.trim() === '');

    return [...withName, ...withoutName];
  }, [trainScheduleSets, catalogSelected]);

  const trainScheduleSetSelected =
    trainScheduleSetIdSelected === undefined
      ? undefined
      : trainScheduleSetsSorted.find((tts) => tts.id === trainScheduleSetIdSelected);

  useEffect(() => {
    setTrainScheduleSetIdSelected(undefined);
  }, [catalogSelected]);

  return (
    <form
      id={formId}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!trainScheduleSetIdSelected) return;
        await onSubmit(trainScheduleSetIdSelected);
        setTrainScheduleSetIdSelected(undefined);
      }}
    >
      {/* Catalog */}
      <div className="catalog-entry">
        <Select<CatalogEntry>
          id="catalogue-entry"
          label={t('parentCatalogEntry')}
          placeholder={t('choose')}
          value={catalogSelected}
          onChange={(item) => setCatalogEntry(item ? item.id : undefined)}
          options={catalogSorted}
          getOptionLabel={(option) => option.name ?? ''}
          getOptionValue={(option) => `${option.id}`}
        />
      </div>

      {/* Train Schedule Set */}
      <div className="train-schedule-set-id">
        <Select<TrainScheduleSet>
          id="train-schedule-set-id"
          label={t('package')}
          placeholder={t('choose')}
          value={trainScheduleSetSelected}
          onChange={(item) => setTrainScheduleSetIdSelected(item ? item.id : undefined)}
          options={trainScheduleSetsSorted}
          getOptionLabel={(option) => option.name ?? ''}
          getOptionValue={(option) => `${option.id}`}
        />
      </div>
    </form>
  );
};

export default TrainScheduleSetSelect;
