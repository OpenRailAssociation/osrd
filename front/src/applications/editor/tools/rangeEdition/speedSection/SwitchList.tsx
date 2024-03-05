import React from 'react';

import { t } from 'i18next';
import { FaTimes } from 'react-icons/fa';

type SwitchListProps = {
  selectedSwitches: string[];
  unselectSwitch: (swId: string) => () => void;
};
const SwitchList: React.FC<SwitchListProps> = ({ selectedSwitches, unselectSwitch }) => (
  <div className="mt-3">
    {selectedSwitches.map((swId, index) => (
      <div className="mb-2" key={index}>
        <button
          type="button"
          className="btn btn-primary btn-sm px-2 mr-2"
          aria-label={t('common.delete')}
          title={t('common.delete')}
          onClick={unselectSwitch(swId)}
        >
          <FaTimes />
        </button>
        {`${t('Editor.obj-types.Switch')} ${swId}`}
      </div>
    ))}
  </div>
);

export default SwitchList;
