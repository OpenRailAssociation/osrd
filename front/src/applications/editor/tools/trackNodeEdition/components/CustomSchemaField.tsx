import React, { FC, Suspense, lazy } from 'react';
import { Loader } from 'common/Loaders';
import { FieldProps } from '@rjsf/core';
import SchemaField from '@rjsf/core/lib/components/fields/SchemaField';
import useTrackNode from '../useTrackNode';
import { FLAT_TRACK_NODE_PORTS_PREFIX, GROUP_CHANGE_DELAY } from '../utils';
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
  if (name.indexOf(FLAT_TRACK_NODE_PORTS_PREFIX) === 0)
    return <TrackSectionEndpointSelector {...props} />;
  return <SchemaField {...props} />;
};

export default CustomSchemaField;
