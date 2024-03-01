import type { SelectOptionObject } from 'common/BootstrapSNCF/SelectImprovedSNCF';
import type { StudyState, StudyType } from 'applications/operationalStudies/consts';
import { isEmpty, sortBy } from 'lodash';
import { useTranslation } from 'react-i18next';

type OptionsList = StudyType[] | StudyState[];

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

// Must get rid of the default export when there will be more than a single export.
export default createSelectOptions;
