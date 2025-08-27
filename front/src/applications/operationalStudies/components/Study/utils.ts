import type { TFunction } from 'i18next';
import { isEmpty, sortBy } from 'lodash';

import { isInvalidName } from 'applications/operationalStudies/utils';
import type { StudyState } from 'applications/operationalStudies/views/Study/consts';
import type { SelectOptionObject } from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { SMALL_INPUT_MAX_LENGTH, SMALL_TEXT_AREA_MAX_LENGTH, isInvalidString } from 'utils/strings';

import type { StudyForm } from './AddOrEditStudyModal';

export const createSelectOptions = (
  t: TFunction<'operational-studies'>,
  list: StudyState[]
): SelectOptionObject[] => {
  if (isEmpty(list)) return [{ label: t('study.nothingSelected').toString() }];
  return sortBy(
    list.map((key) => ({ id: key, label: t(`study.studyStates.${key}`) })),
    'value'
  );
};

export const checkStudyFields = (
  study: StudyForm
): {
  name: boolean;
  description: boolean;
  business_code: boolean;
  service_code: boolean;
  budget: boolean;
} => ({
  name: isInvalidName(study.name),
  description: isInvalidString(SMALL_TEXT_AREA_MAX_LENGTH, study.description),
  business_code: isInvalidString(SMALL_INPUT_MAX_LENGTH, study.business_code),
  service_code: isInvalidString(SMALL_INPUT_MAX_LENGTH, study.service_code),
  budget:
    (study.budget ?? 0) > 2147483647 || (!Number.isInteger(study.budget) && study.budget !== null),
});
