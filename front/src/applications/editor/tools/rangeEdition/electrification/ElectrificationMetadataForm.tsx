import { useContext } from 'react';

import { cloneDeep } from 'lodash';
import { useTranslation } from 'react-i18next';
import { GiElectric } from 'react-icons/gi';

import EditorContext from 'applications/editor/context';
import type {
  ElectrificationEntity,
  RangeEditionState,
} from 'applications/editor/tools/rangeEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';

const ElectrificationMetadataForm = ({ voltages }: { voltages: string[] }) => {
  const { t } = useTranslation();
  const {
    state: { entity },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<ElectrificationEntity>
  >;

  return (
    <SelectImprovedSNCF
      label={
        <>
          <GiElectric className="me-1" />{' '}
          {t('Editor.tools.electrification-edition.electrifications')}
        </>
      }
      options={voltages}
      value={entity.properties.voltage || ''}
      onChange={(newElectrification) => {
        const newEntity = cloneDeep(entity);
        newEntity.properties.voltage = newElectrification;
        setState({ entity: newEntity });
      }}
      withSearch
      withNewValueInput
      addButtonTitle={t('Editor.tools.electrification-edition.add-new-electrification')}
      bgWhite
    />
  );
};

export default ElectrificationMetadataForm;
