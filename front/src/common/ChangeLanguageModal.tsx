// React Component displaying different applications versions and license attributions
// List of applications : Editoast, Core, Api

import { DE, ES, FR, GB, IT, JP, RU, UA } from 'country-flag-icons/react/3x2';
import { useTranslation } from 'react-i18next';

import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import i18n from 'i18n';

import { useModal } from './BootstrapSNCF/ModalSNCF';

const SortedLanguages = () => {
  const { t } = useTranslation('home/navbar');
  const { closeModal } = useModal();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    closeModal();
  };

  const formatLanguageWithFlag = (lng: string) => {
    const title = t(`language.${lng}`);
    switch (lng) {
      case 'de':
        return <DE title={title} />;
      case 'en':
        return <GB title={title} />;
      case 'es':
        return <ES title={title} />;
      case 'fr':
        return <FR title={title} />;
      case 'it':
        return <IT title={title} />;
      case 'jp':
        return <JP title={title} />;
      case 'ru':
        return <RU title={title} />;
      case 'uk':
        return <UA title={title} />;
      default:
        return null;
    }
  };

  const availablesLanguages = i18n.languages.map((lng) => ({
    key: lng,
    value: t(`language.${lng}`),
  }));
  availablesLanguages.sort((a, b) => a.value.localeCompare(b.value));
  return (
    <>
      {availablesLanguages.map((lng) => (
        <button
          type="button"
          className="btn btn-secondary btn-block language-choice-btn"
          key={`language-btn-${lng.key}`}
          disabled={i18n.language === lng.key}
          onClick={() => changeLanguage(lng.key)}
        >
          {formatLanguageWithFlag(lng.key)}
          {lng.value}
        </button>
      ))}
    </>
  );
};

export default function ChangeLanguageModal() {
  const { t } = useTranslation('home/navbar');

  return (
    <div className="informations">
      <ModalHeaderSNCF withCloseButton>
        <h1>{t('language.languageChoice')}</h1>
      </ModalHeaderSNCF>
      <ModalBodySNCF>{i18n.languages && <SortedLanguages />}</ModalBodySNCF>
    </div>
  );
}
