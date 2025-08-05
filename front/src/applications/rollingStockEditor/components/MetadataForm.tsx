import { useTranslation } from 'react-i18next';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { SMALL_INPUT_MAX_LENGTH } from 'utils/strings';

import { RS_REQUIRED_FIELDS, RollingStockEditorMetadata } from '../consts';
import { splitRollingStockProperties } from '../helpers/utils';
import type { RollingStockParametersValues, SchemaProperty } from '../types';

type RollingStockMetadataFormProps = {
  rollingStockValues: RollingStockParametersValues;
  setRollingStockValues: (
    rollingStockValue: React.SetStateAction<RollingStockParametersValues>
  ) => void;
};

const RollingStockEditorMetadataFormColumn = ({
  propertiesList,
  rollingStockValues,
  setRollingStockValues,
}: RollingStockMetadataFormProps & { propertiesList: SchemaProperty[] }) => {
  const { t } = useTranslation('translation', { keyPrefix: 'rollingStock' });
  return (
    <>
      {propertiesList.map((property, index) => {
        const titleKey = `metadata.${property.title}`;
        return (
          <InputSNCF
            containerClass="col-6 px-0"
            id={property.title}
            name={property.title}
            label={property.title in RS_REQUIRED_FIELDS ? `${t(titleKey)}\u00a0*` : t(titleKey)}
            type={property.type}
            value={rollingStockValues[property.title] as string | number}
            onChange={(e) =>
              setRollingStockValues({ ...rollingStockValues, [property.title]: e.target.value })
            }
            sm
            isFlex
            key={index}
            inputProps={{
              maxLength: SMALL_INPUT_MAX_LENGTH,
            }}
          />
        );
      })}
    </>
  );
};

const RollingStockEditorMetadataForm = ({
  rollingStockValues,
  setRollingStockValues,
}: RollingStockMetadataFormProps) => {
  const refListOfProperties = Object.keys(RollingStockEditorMetadata);
  const {
    left: leftSideList,
    middle: middleSideList,
    right: rightSideList,
  } = splitRollingStockProperties(refListOfProperties);

  return (
    <div className="d-xl-flex justify-content-center mb-2 px-1">
      <div className="col-xl-4 rollingstock-editor-input-container">
        <RollingStockEditorMetadataFormColumn
          propertiesList={leftSideList}
          rollingStockValues={rollingStockValues}
          setRollingStockValues={setRollingStockValues}
        />
      </div>
      <div className="col-xl-4 rollingstock-editor-input-container">
        <RollingStockEditorMetadataFormColumn
          propertiesList={middleSideList}
          rollingStockValues={rollingStockValues}
          setRollingStockValues={setRollingStockValues}
        />
      </div>
      <div className="col-xl-4 rollingstock-editor-input-container">
        <RollingStockEditorMetadataFormColumn
          propertiesList={rightSideList}
          rollingStockValues={rollingStockValues}
          setRollingStockValues={setRollingStockValues}
        />
      </div>
    </div>
  );
};

export default RollingStockEditorMetadataForm;
