import { useState } from 'react';

import type { Train } from 'reducers/osrdconf/types';

import CollapsedTrainOverview from './CollapsedTrainOverview';
import ExpandedTrainForm from './ExpandedTrainForm';

export type TrainHeaderProps = {
  train: Train;
};

/**
 * A dual-purpose header that shows either a collapsed overview on some key train characteristics,
 * or an expanded form that allow the user to edit every data about the train outside of the train
 * stops themselves or its itinerary.
 */
const TrainHeader = ({ train }: TrainHeaderProps) => {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <ExpandedTrainForm
        train={train}
        onCollapse={() => {
          setExpanded(false);
        }}
      />
    );
  }

  return (
    <CollapsedTrainOverview
      train={train}
      onExpand={() => {
        setExpanded(true);
      }}
    />
  );
};

export default TrainHeader;
