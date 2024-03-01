import type { FieldProps } from '@rjsf/utils';
import SchemaField from '@rjsf/core/lib/components/fields/SchemaField';
import React, { type FC, Suspense, lazy } from 'react';

import { Loader } from 'common/Loaders';
import useSwitch from 'applications/editor/tools/switchEdition/useSwitch';
import {
  FLAT_SWITCH_PORTS_PREFIX,
  GROUP_CHANGE_DELAY,
} from 'applications/editor/tools/switchEdition/utils';
import TrackSectionEndpointSelector from './TrackSectionEndpointSelector';

const TrackNodeTypeDiagram = lazy(() => import('./TrackNodeTypeDiagram'));

const CustomSchemaField: FC<FieldProps> = (props) => {
  const { name = '' } = props;
  const { switchType } = useSwitch();
  if (name === GROUP_CHANGE_DELAY)
    return (
      <div>
        <SchemaField {...props} />
        {switchType && (
          <div className="mt-5">
            <Suspense fallback={<Loader />}>
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
