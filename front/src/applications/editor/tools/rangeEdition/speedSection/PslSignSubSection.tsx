import type { TFunction } from 'i18next';
import { FaPlus } from 'react-icons/fa';

import type {
  PSLSign,
  PSL_SIGN_TYPES,
  PslSignInformation,
} from 'applications/editor/tools/rangeEdition/types';

import PslSignCard from './PslSignCard';

const PslSignSubSection = ({
  signType,
  signs,
  addSign,
  removeSign,
  selectSign,
  t,
  updateSign,
}: {
  signType: PSL_SIGN_TYPES.ANNOUNCEMENT | PSL_SIGN_TYPES.R;
  signs: PSLSign[];
  addSign: (signType: PSL_SIGN_TYPES.ANNOUNCEMENT | PSL_SIGN_TYPES.R) => void;
  updateSign: (signInfo: PslSignInformation, sign: PSLSign) => void;
  removeSign?: (signInfo: Exclude<PslSignInformation, { signType: PSL_SIGN_TYPES.Z }>) => void;
  selectSign: (signInfo: PslSignInformation) => void;
  t: TFunction;
}) => (
  <div>
    <div>
      <h4>{t('Editor.tools.speed-edition.sign-category', { signType }).toString()}</h4>
    </div>
    <button
      type="button"
      className="btn btn-primary btn-sm px-2 d-flex align-items-center"
      onClick={() => addSign(signType)}
    >
      <FaPlus />
      <span className="ml-1">
        {t('Editor.tools.speed-edition.add-sign', { signType }).toString()}
      </span>
    </button>
    {signs.map((sign, signIndex) => (
      <PslSignCard
        key={`${signType}-${signIndex}`}
        sign={sign}
        signInfo={{ signType, signIndex }}
        removeSign={removeSign}
        selectSign={selectSign}
        t={t}
        updateSign={updateSign}
      />
    ))}
  </div>
);

export default PslSignSubSection;
