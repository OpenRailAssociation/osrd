import { isEmpty, sortBy } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { StudyState } from 'applications/operationalStudies/consts';
import { checkFieldInvalidity, checkNameInvalidity } from 'applications/operationalStudies/utils';
import type { SelectOptionObject } from 'common/BootstrapSNCF/SelectImprovedSNCF';

import type { StudyForm } from './components/AddOrEditStudyModal';

type OptionsList = StudyState[];

export const createSelectOptions = (
  translationList: string,
  list: OptionsList
): SelectOptionObject[] => {
  const { t } = useTranslation('operationalStudies/study');
  if (isEmpty(list)) return [{ label: t('nothingSelected').toString() }];
  return sortBy(
    list.map((key) => ({ id: key, label: t(`${translationList}.${key}`) })),
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
  name: checkNameInvalidity(study.name),
  description: checkFieldInvalidity(1024, study.description),
  business_code: checkFieldInvalidity(128, study.business_code),
  service_code: checkFieldInvalidity(128, study.service_code),
  budget: (study.budget ?? 0) > 2147483647,
});
