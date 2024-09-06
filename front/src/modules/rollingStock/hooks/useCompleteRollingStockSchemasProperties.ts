import { useMemo } from 'react';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { RS_SCHEMA_PROPERTIES } from 'modules/rollingStock/consts';
import type { SchemaProperty } from 'modules/rollingStock/types';
import { replaceElementAtIndex } from 'utils/array';

/** Custom hook to get all available signaling systems from editoast.

 * It will then fill the *supportedSignalingSystems* property's enum in the rollingStock schema

 * properties list that is used to create the form */
function useCompleteRollingStockSchemasProperties(): readonly SchemaProperty[] {
  const { data: supportedSignalingSystems } =
    osrdEditoastApi.endpoints.getSpritesSignalingSystems.useQuery();

  const completeRsSchemaProperties = useMemo(() => {
    const sigSystemsIndex = RS_SCHEMA_PROPERTIES.findIndex(
      (s) => s.title === 'supportedSignalingSystems'
    );
    const completeSigSystemsSchema = {
      ...RS_SCHEMA_PROPERTIES[sigSystemsIndex],
      enum: supportedSignalingSystems || [],
    };
    return replaceElementAtIndex(RS_SCHEMA_PROPERTIES, sigSystemsIndex, completeSigSystemsSchema);
  }, [supportedSignalingSystems]);

  return completeRsSchemaProperties;
}

export default useCompleteRollingStockSchemasProperties;
