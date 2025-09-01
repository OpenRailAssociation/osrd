// React Component displaying different applications versions and license attributions
// List of applications : Editoast, Core, Api

import { DE, FR, GB, PT } from 'country-flag-icons/react/3x2';
import { useTranslation } from 'react-i18next';

import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { supportedLngs } from 'i18n';

// We don't use `t` cause language names are fixed
export const languageName = (lng: string) => {
  switch (lng) {
    case 'de':
      return 'Deutsch';
    case 'en':
      return 'English';
    case 'fr':
      return 'Français';
    case 'pt':
      return 'Português';
    default:
      return null;
  }
};

const languageSvgFlag = (lng: string) => {
  switch (lng) {
    case 'de':
      return <DE title="Deutsch" />;
    case 'en':
      return <GB title="English" />;
    case 'fr':
      return <FR title="Français" />;
    case 'pt':
      return <PT title="Português" />;
    default:
      return null;
  }
};

const Languages = () => {
  const { i18n } = useTranslation();
  const { closeModal } = useModal();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    closeModal();
  };

  return (
    <>
      {supportedLngs.map((languageCode) => (
        <button
          type="button"
          className="btn btn-secondary btn-block language-choice-btn"
          key={`language-btn-${languageCode}`}
          disabled={i18n.language === languageCode}
          onClick={() => changeLanguage(languageCode)}
        >
          {languageSvgFlag(languageCode)}
          {languageName(languageCode)}
        </button>
      ))}
    </>
  );
};

export default function ChangeLanguageModal() {
  const { t } = useTranslation();

  return (
    <div className="informations">
      <ModalHeaderSNCF withCloseButton>
        <h1>{t('nav-bar.languages')}</h1>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <Languages />
      </ModalBodySNCF>
    </div>
  );
}
