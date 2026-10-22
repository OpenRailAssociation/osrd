import { useContext } from 'react';

import { useTranslation } from 'react-i18next';

import EntityError from 'applications/editor/components/EntityError';
import EditorContext from 'applications/editor/context';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

import type { OpEditionState, OpEntity } from '../types';
import { isNewOp } from '../utils';
import OpPartList from './OpPartList';

const TEXT_FIELDS = [
  'name',
  'secondary_name',
  'country_code',
  'main_code',
  'secondary_code',
  'plc',
] as const;
const REQUIRED_FIELDS = new Set(['name', 'country_code', 'main_code']);

const OpEditionLeftPanel = () => {
  const { t } = useTranslation();
  const {
    state: { entity },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<OpEditionState>;

  const { properties } = entity;
  const isNew = isNewOp(entity);

  const updateProperties = (patch: Partial<OpEntity['properties']>) =>
    setState({ entity: { ...entity, properties: { ...properties, ...patch } } });

  return (
    <div className="position-relative">
      <legend>
        {isNew ? t('Editor.tools.op-edition.create-op') : t('Editor.tools.op-edition.edit-op')}
      </legend>

      {TEXT_FIELDS.map((field, i) => {
        const required = REQUIRED_FIELDS.has(field);
        return (
          <InputSNCF
            key={field}
            id={`op-${field}`}
            type="text"
            label={
              <>
                {t(`Editor.tools.op-edition.fields.${field}`)}
                {required && <span className="required">*</span>}
              </>
            }
            value={properties[field] ?? ''}
            inputProps={{ required }}
            whiteBG
            focus={i === 0}
            // Empty optional fields are saved as null (Editoast rejects a blank secondary_code)
            onChange={(e) =>
              updateProperties({ [field]: required ? e.target.value : e.target.value || null })
            }
          />
        );
      })}

      <InputSNCF
        id="op-uic"
        type="number"
        label={t('Editor.tools.op-edition.fields.uic')}
        value={properties.uic ?? ''}
        min={0}
        step={1}
        whiteBG
        onChange={(e) =>
          updateProperties({ uic: e.target.value ? parseInt(e.target.value, 10) : null })
        }
      />

      <CheckboxRadioSNCF
        type="checkbox"
        id="op-is_passenger_station"
        name="op-is_passenger_station"
        checked={properties.is_passenger_station}
        label={t('Editor.tools.op-edition.fields.is_passenger_station')}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          updateProperties({ is_passenger_station: e.target.checked })
        }
      />

      <OpPartList />

      {!isNew && <EntityError className="my-2" entity={entity} />}
    </div>
  );
};

export default OpEditionLeftPanel;
