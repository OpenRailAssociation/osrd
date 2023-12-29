import React, { FC, Suspense, lazy } from 'react';
import LoaderSNCF from 'common/Loader/Loader';
import { FieldProps } from '@rjsf/core';
import SchemaField from '@rjsf/core/lib/components/fields/SchemaField';
import useSwitch from '../useSwitch';
import { FLAT_SWITCH_PORTS_PREFIX, GROUP_CHANGE_DELAY } from '../utils';
import TrackSectionEndpointSelector from './TrackSectionEndpointSelector';

const TrackNodeTypeDiagram = lazy(() => import('./TrackNodeTypeDiagram'));

export const CustomSchemaField: FC<FieldProps> = (props) => {
  const { name = '' } = props;
  const { switchType } = useSwitch();
  if (name === GROUP_CHANGE_DELAY)
    return (
      <div>
        <SchemaField {...props} />
        {switchType && (
          <div className="mt-5">
            <Suspense fallback={<LoaderSNCF />}>
              <TrackNodeTypeDiagram trackNodeType={switchType.id} />
            </Suspense>
          </div>
        )}
      </div>
    );
  if (name.indexOf(FLAT_SWITCH_PORTS_PREFIX) === 0)
    return <TrackSectionEndpointSelector {...props} />;
  return <SchemaField {...props} />;
};

export default CustomSchemaField;
