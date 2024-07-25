import React, { type FC, Suspense, lazy } from 'react';

import SchemaField from '@rjsf/core/lib/components/fields/SchemaField';
import type { FieldProps } from '@rjsf/utils';

import useTrackNode from 'applications/editor/tools/trackNodeEdition/useTrackNode';
import {
  FLAT_SWITCH_PORTS_PREFIX,
  GROUP_CHANGE_DELAY,
} from 'applications/editor/tools/trackNodeEdition/utils';
import { Loader } from 'common/Loaders';

import TrackSectionEndpointSelector from './TrackSectionEndpointSelector';

const TrackNodeTypeDiagram = lazy(() => import('./TrackNodeTypeDiagram'));

const CustomSchemaField: FC<FieldProps> = (props) => {
  const { name = '' } = props;
  const { trackNodeType } = useTrackNode();
  if (name === GROUP_CHANGE_DELAY)
    return (
      <div>
        <SchemaField {...props} />
        {trackNodeType && (
          <div className="mt-5">
            <Suspense fallback={<Loader />}>
              <TrackNodeTypeDiagram trackNodeType={trackNodeType.id} />
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
