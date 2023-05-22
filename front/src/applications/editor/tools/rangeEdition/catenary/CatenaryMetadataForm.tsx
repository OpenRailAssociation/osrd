import React, { FC, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import EditorContext from 'applications/editor/context';
import { CatenaryEntity } from 'types';
import { AiOutlinePlusCircle, GiElectric } from 'react-icons/all';
import { cloneDeep } from 'lodash';
import { ExtendedEditorContextType } from '../../editorContextTypes';
import { RangeEditionState } from '../types';
import CatenaryInput from './CatenaryInput';

const CatenaryMetadataForm: FC = () => {
  const { t } = useTranslation();
  const {
    state: { entity },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<RangeEditionState<CatenaryEntity>>;

  return (
    <div>
      <h4 className="pb-0">
        <GiElectric className="me-1" /> {t('Editor.tools.catenary-edition.catenaries')}
      </h4>
      {/* The following tag is here to mimick other tools' forms style: */}
      <form className="rjsf" onSubmit={(e) => e.preventDefault()}>
        <div className="form-group field field-string mb-2">
          <label className="control-label" htmlFor="catenary.default">
            {t('Editor.tools.catenary-edition.catenary-default')}
          </label>
          <div className="">
            <CatenaryInput
              className="form-control flex-grow-1 flex-shrink-1"
              id="catenary.default"
              value={entity.properties.voltage || ''}
              onChange={(newCatenary) => {
                const newEntity = cloneDeep(entity);
                newEntity.properties.voltage = newCatenary;
                setState({ entity: newEntity });
              }}
            />
          </div>
        </div>
        {/* TODO : Bouton créer si valeur rentrée n'existe pas déjà */}
        <button
          type="button"
          className="btn btn-secondary w-100 text-wrap small mb-2"
          onClick={async () => {
            const newEntity = cloneDeep(entity);
            setState({ entity: newEntity });
          }}
        >
          <AiOutlinePlusCircle className="mr-2" />
          {t('Editor.tools.catenary-edition.add-new-catenary')}
        </button>
      </form>
    </div>
  );
};

export default CatenaryMetadataForm;
