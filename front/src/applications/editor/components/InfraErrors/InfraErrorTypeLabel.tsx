import React from 'react';
import { useTranslation } from 'react-i18next';

import { InfraError } from './types';

/**
 * A component that display an infra error type label.
 */
const InfraErrorTypeLabel: React.FC<{ error: InfraError['information'] }> = ({ error }) => {
  const { t } = useTranslation();
  return t(`Editor.infra-errors.error-type.${error.error_type}.name`);
};

export default InfraErrorTypeLabel;
