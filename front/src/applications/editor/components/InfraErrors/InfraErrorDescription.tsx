import { useTranslation } from 'react-i18next';

import type { InfraError } from 'common/api/osrdEditoastApi';

/**
 * A component that display an infra error description.
 */
const InfraErrorDescription = ({ error }: { error: InfraError }) => {
  const { t } = useTranslation();
  const i18nKey = `Editor.infra-errors.error-type.${error.error_type}.description`;
  return t(i18nKey, error);
};

export default InfraErrorDescription;
