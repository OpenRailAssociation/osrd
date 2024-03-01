import type { Feature } from 'geojson';

import type { InfraError } from 'applications/editor/components/InfraErrors';
import type { EditoastType } from 'applications/editor/consts';

export type CommonToolState = {
  mousePosition: [number, number] | null;
  hovered: {
    type: EditoastType;
    id: string;
    renderedEntity: Feature;
    error?: InfraError['information'];
  } | null;
};
