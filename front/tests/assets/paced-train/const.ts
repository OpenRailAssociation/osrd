import type { OccurrenceMenuButton } from '../../utils/types';

export const EDITED_OCCURRENCE_NAME = 'Paced train occurrence edited';

export const INITIAL_OCCURRENCE_NAME = '8608';

export const CONFORM_ACTIVE_OCCURRENCE_MENU_BUTTONS: OccurrenceMenuButton[] = [
  'disable',
  'edit',
  'project',
];

export const EXCEPTION_ACTIVE_OCCURRENCE_MENU_BUTTONS: OccurrenceMenuButton[] = [
  'disable',
  'edit',
  'project',
  'restore',
];

export const ADDED_EXCEPTION_MENU_BUTTONS: OccurrenceMenuButton[] = ['edit', 'project', 'delete'];
export const ADDED_AND_MODIFIED_EXCEPTION_MENU_BUTTONS: OccurrenceMenuButton[] = [
  'edit',
  'project',
  'delete',
  'restore',
];

export const DISABLED_OCCURRENCE_MENU_BUTTONS: OccurrenceMenuButton[] = ['enable'];
