import { type ReactNode } from 'react';

import { Gear, Info, Report, SignOut } from '@osrd-project/ui-icons';
import getUnicodeFlagIcon from 'country-flag-icons/unicode';
import { useTranslation } from 'react-i18next';

import DropdownSNCF, { type DROPDOWN_STYLE_TYPES } from 'common/BootstrapSNCF/DropdownSNCF';
import HelpModalSNCF from 'common/BootstrapSNCF/HelpModalSNCF';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import useAuth from 'utils/hooks/useAuth';
import { languageCodeToCountryCode } from 'utils/strings';

import ChangeLanguageModal, { languageName } from './ChangeLanguageModal';
import ReleaseInformation from './ReleaseInformation';
import UserSettings from './UserSettings';

type UserActionsDropdownProps = {
  titleContent: ReactNode;
  className?: string;
  type?: keyof typeof DROPDOWN_STYLE_TYPES;
};

const UserActionsDropdown = ({
  titleContent,
  className,
  type = 'transparent',
}: UserActionsDropdownProps) => {
  const { logout } = useAuth();
  const { openModal } = useModal();
  const { t, i18n } = useTranslation();

  const dropdownItems = [
    {
      node: (
        <button
          type="button"
          className="btn-link text-reset"
          onClick={() => openModal(<ReleaseInformation />, 'lg')}
        >
          <span className="mr-2">
            <Info />
          </span>
          {t('nav-bar.about')}
        </button>
      ),
      key: 'about',
    },
    {
      node: (
        <button
          type="button"
          className="btn-link text-reset"
          onClick={() => openModal(<HelpModalSNCF />, 'lg')}
        >
          <span className="mr-2">
            <Report />
          </span>
          {t('nav-bar.help')}
        </button>
      ),
      key: 'help',
    },
    {
      node: (
        <button
          type="button"
          className="btn-link text-reset"
          onClick={() => openModal(<ChangeLanguageModal />, 'sm')}
        >
          <span className="mr-2">
            {i18n.language && getUnicodeFlagIcon(languageCodeToCountryCode(i18n.language))}
          </span>
          <span data-testid="language-info">{languageName(i18n.language)}</span>
        </button>
      ),
      key: 'language',
    },
    {
      node: (
        <button
          data-testid="user-settings-btn"
          type="button"
          className="user-settings-btn btn-link text-reset"
          onClick={() => openModal(<UserSettings />)}
        >
          <span className="mr-2">
            <Gear variant="fill" />
          </span>
          {t('nav-bar.userSettings')}
        </button>
      ),
      key: 'user-settings',
    },
    {
      node: (
        <button type="button" className="btn-link text-reset" onClick={() => logout()}>
          <span className="mr-2">
            <SignOut />
          </span>
          {t('nav-bar.disconnect')}
        </button>
      ),
      key: 'sign-out',
    },
  ];

  return (
    <DropdownSNCF
      className={className}
      titleContent={titleContent}
      type={type}
      items={dropdownItems}
    />
  );
};

export default UserActionsDropdown;
