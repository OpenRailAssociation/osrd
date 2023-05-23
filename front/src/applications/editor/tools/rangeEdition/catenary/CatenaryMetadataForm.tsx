import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import EditorContext from 'applications/editor/context';
import { CatenaryEntity } from 'types';
import { GiElectric } from 'react-icons/all';
import { cloneDeep } from 'lodash';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { ExtendedEditorContextType } from '../../editorContextTypes';
import { RangeEditionState } from '../types';

const CatenaryMetadataForm = ({ voltages }: { voltages: string[] }) => {
  const { t } = useTranslation();
  const {
    state: { entity },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<RangeEditionState<CatenaryEntity>>;

  return (
    <SelectImprovedSNCF
      title={
        <>
          <GiElectric className="me-1" /> {t('Editor.tools.catenary-edition.catenaries')}
        </>
      }
      options={voltages}
      selectedValue={entity.properties.voltage || ''}
      onChange={(newCatenary) => {
        const newEntity = cloneDeep(entity);
        newEntity.properties.voltage = newCatenary;
        setState({ entity: newEntity });
      }}
      withSearch
      withNewValueInput
      addButtonTitle={t('Editor.tools.catenary-edition.add-new-catenary')}
    />
  );
};

export default CatenaryMetadataForm;
