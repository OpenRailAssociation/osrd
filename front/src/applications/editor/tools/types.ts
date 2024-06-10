import type { Feature } from 'geojson';

import type { EditoastType } from 'applications/editor/consts';
import type { InfraError } from 'common/api/osrdEditoastApi';

export type CommonToolState = {
  mousePosition: [number, number] | null;
  hovered: {
    type: EditoastType;
    id: string;
    renderedEntity: Feature;
    error?: InfraError;
  } | null;
};
