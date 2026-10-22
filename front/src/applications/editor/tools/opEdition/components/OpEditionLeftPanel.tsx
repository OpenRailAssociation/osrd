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

type OpTextFieldProps = {
  field: 'name' | 'secondary_name' | 'country_code' | 'main_code' | 'secondary_code' | 'plc';
  value: string | null | undefined;
  onChange: (value: string) => void;
  required?: boolean;
  focus?: boolean;
};

const OpTextField = ({
  field,
  value,
  onChange,
  required = false,
  focus = false,
}: OpTextFieldProps) => {
  const { t } = useTranslation();
  return (
    <InputSNCF
      id={`op-${field}`}
      type="text"
      label={
        <>
          {t(`Editor.tools.op-edition.fields.${field}`)}
          {required && ' *'}
        </>
      }
      value={value ?? ''}
      inputProps={{ required }}
      whiteBG
      focus={focus}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

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

      {/* Empty optional fields are saved as null (Editoast rejects a blank secondary_code) */}
      <OpTextField
        field="name"
        value={properties.name}
        onChange={(name) => updateProperties({ name })}
        required
        focus
      />
      <OpTextField
        field="secondary_name"
        value={properties.secondary_name}
        onChange={(value) => updateProperties({ secondary_name: value || null })}
      />
      <OpTextField
        field="country_code"
        value={properties.country_code}
        onChange={(country_code) => updateProperties({ country_code })}
        required
      />
      <OpTextField
        field="main_code"
        value={properties.main_code}
        onChange={(main_code) => updateProperties({ main_code })}
        required
      />
      <OpTextField
        field="secondary_code"
        value={properties.secondary_code}
        onChange={(value) => updateProperties({ secondary_code: value || null })}
      />
      <OpTextField
        field="plc"
        value={properties.plc}
        onChange={(value) => updateProperties({ plc: value || null })}
      />

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
