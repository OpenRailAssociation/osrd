import { type ReactNode } from 'react';

import { Gear, Report, SignOut, Tools } from '@osrd-project/ui-icons';
import getUnicodeFlagIcon from 'country-flag-icons/unicode';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import useAllowedUserRoles from 'common/authorization/hooks/useAllowedUserRoles';
import DropdownSNCF, { type DROPDOWN_STYLE_TYPES } from 'common/BootstrapSNCF/DropdownSNCF';
import HelpModalSNCF from 'common/BootstrapSNCF/HelpModalSNCF';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import useAuth from 'utils/hooks/useAuth';
import { languageCodeToCountryCode } from 'utils/strings';

import ChangeLanguageModal, { languageName } from './ChangeLanguageModal';
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
  const { adminDashboardAllowed } = useAllowedUserRoles();
  const { openModal } = useModal();
  const { t, i18n } = useTranslation();

  const openUserSettingsModal = () => openModal(<UserSettings />);
  const openChangeLanguageModal = () => openModal(<ChangeLanguageModal />, 'sm');
  const openHelpModalSNCF = () => openModal(<HelpModalSNCF />, 'lg');

  const dropdownItems = [
    {
      node: (
        <button
          data-testid="user-settings-btn"
          type="button"
          className="user-settings-btn btn-link text-reset"
          onClick={openUserSettingsModal}
        >
          <Gear variant="fill" className="mr-2" />
          {t('nav-bar.userSettings')}
        </button>
      ),
      key: 'user-settings',
    },
    {
      node: (
        <button type="button" className="btn-link text-reset" onClick={openChangeLanguageModal}>
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
        <button type="button" className="btn-link text-reset" onClick={openHelpModalSNCF}>
          <Report className="mr-2" />
          {t('nav-bar.help')}
        </button>
      ),
      key: 'help',
    },
    {
      node: (
        <button type="button" className="btn-link text-reset" onClick={() => logout()}>
          <SignOut className="mr-2" />
          {t('nav-bar.disconnect')}
        </button>
      ),
      key: 'sign-out',
    },
  ];
  if (adminDashboardAllowed) {
    const adminDownItem = {
      node: (
        <Link to="/admin-dashboard">
          <Tools className="mr-2" />
          {t('nav-bar.adminDashboard')}
        </Link>
      ),
      key: 'admin-dashboard',
    };
    dropdownItems.unshift(adminDownItem);
  }

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
