import { useState } from 'react';

import {
  isBrokenLinkingPickingElement,
  isLinkingPickingElement,
  type PickingElement,
} from '@osrd-project/ui-charts';

import type { TrainId } from 'reducers/osrdconf/types';

import { parseLinkingId } from './helpers/linkings';

/**
 * Handles the linking mode of the TODs: whether it is on, and the clicks it turns into creations
 * and deletions.
 */
const useLinkingMode = ({
  hasDeployedWaypoint,
  onCreateLinking,
  onDeleteLinking,
}: {
  hasDeployedWaypoint: boolean;
  onCreateLinking?: (source: TrainId, target: TrainId) => void;
  onDeleteLinking?: (linkingId: number) => void;
}): {
  linkingMode: boolean;
  toggleLinkingMode: () => void;
  handleLinkingClick: (element: PickingElement | undefined) => boolean;
} => {
  const [linkingMode, setLinkingMode] = useState(false);
  // The mode only applies to deployed TODs: closing them all leaves it for good.
  if (linkingMode && !hasDeployedWaypoint) setLinkingMode(false);

  /** Creates or deletes the clicked linking, and tells whether the click was on one. */
  const handleLinkingClick = (element: PickingElement | undefined) => {
    if (!linkingMode || !element) return false;

    if (isLinkingPickingElement(element)) {
      const reference = parseLinkingId(element.linkingId);
      if ('linkingId' in reference) onDeleteLinking?.(reference.linkingId);
      else onCreateLinking?.(reference.source, reference.target);
      return true;
    }

    if (isBrokenLinkingPickingElement(element)) {
      const reference = parseLinkingId(element.brokenLinkingId);
      if ('linkingId' in reference) onDeleteLinking?.(reference.linkingId);
      return true;
    }

    return false;
  };

  return {
    linkingMode,
    toggleLinkingMode: () => setLinkingMode((mode) => !mode),
    handleLinkingClick,
  };
};

export default useLinkingMode;
