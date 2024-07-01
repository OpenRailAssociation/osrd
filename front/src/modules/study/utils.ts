import { isEmpty, sortBy } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { StudyState } from 'applications/operationalStudies/consts';
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
  name: !study.name || study.name.length > 128,
  description: (study.description ?? '').length > 1024,
  business_code: (study.business_code ?? '').length > 128,
  service_code: (study.service_code ?? '').length > 128,
  budget: (study.budget ?? 0) > 2147483647,
});
