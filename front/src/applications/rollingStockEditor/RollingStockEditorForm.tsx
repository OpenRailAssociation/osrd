import React from 'react';
import PropTypes from 'prop-types';
import { LightRollingStock } from 'common/api/osrdEditoastApi';
import { useTranslation } from 'react-i18next';

export default function RollingStockEditorForm(props: {
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  data: LightRollingStock;
}) {
  const { setIsEditing, data } = props;
  const { t } = useTranslation();

  return (
    <div>
      <button type="button" onClick={() => setIsEditing(false)}>
        {t('common.confirm')}
      </button>
    </div>
  );
}

RollingStockEditorForm.propTypes = {
  setIsEditing: PropTypes.func.isRequired,
  data: PropTypes.object,
};
