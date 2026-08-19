import { describe, it, expect } from 'vitest';

import getInfraErrorFromTileProperties from 'applications/editor/components/InfraErrors/utils';

describe('getInfraErrorFromTileProperties', () => {
  it('should nest the sub type properties', () => {
    expect(
      getInfraErrorFromTileProperties({
        obj_id: 'speed_section.1',
        obj_type: 'SpeedSection',
        is_warning: true,
        sub_type_error_type: 'overlapping_speed_sections',
        sub_type_reference_obj_id: 'speed_section.0',
      }).sub_type
    ).toEqual({
      error_type: 'overlapping_speed_sections',
      reference_obj_id: 'speed_section.0',
    });
  });
});
