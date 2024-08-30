import { useTranslation } from 'react-i18next';

import type { InfraError } from 'common/api/osrdEditoastApi';

/**
 * A component that display an infra error type label.
 */
const InfraErrorTypeLabel = ({ error }: { error: InfraError }) => {
  const { t } = useTranslation();
  return t(`Editor.infra-errors.error-type.${error.error_type}.name`);
};

export default InfraErrorTypeLabel;
