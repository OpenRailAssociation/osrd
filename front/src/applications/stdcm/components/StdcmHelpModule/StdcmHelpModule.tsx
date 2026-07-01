import { useState } from 'react';

import { ChevronRight, X } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import useDeploymentSettings from 'utils/hooks/useDeploymentSettings';

import HelpSection from './HelpSection';

type StdcmHelpSectionProps = {
  toggleHelpModule: () => void;
  showHelpModule: boolean;
};

const StdcmHelpModule = ({ toggleHelpModule, showHelpModule }: StdcmHelpSectionProps) => {
  const { t, i18n } = useTranslation('stdcm-help-section');

  const [activeSection, setActiveSection] = useState<string | null>(null);

  const allContactSections = useDeploymentSettings()?.stdcmContactSections;
  const contactSections =
    allContactSections &&
    (allContactSections[i18n.language] ?? allContactSections.en ?? allContactSections.fr);

  const closeHelpModule = () => {
    setActiveSection(null);
    toggleHelpModule();
  };
  const closeHelpSection = () => setActiveSection(null);
  const sections = Object.keys(t('sections', { returnObjects: true }));
  return (
    <div className={cx('stdcm__help-module', { active: showHelpModule })}>
      <div className="stdcm__help-module__header">
        <button type="button" className="stdcm__help-module__close" onClick={closeHelpModule}>
          <X size="lg" />
        </button>
      </div>
      <div className="stdcm__help-module__content">
        <h1 className="stdcm__help-module__title">{t('help')}</h1>
        <div className="stdcm__help-module__chapters">
          {sections.map((section, index) => (
            <div key={section}>
              <button type="button" className="flex" onClick={() => setActiveSection(section)}>
                <div>{t(`sections.${section}.title`)}</div>
                <div className="ml-auto icon">
                  <ChevronRight />
                </div>
              </button>
              {index !== sections.length - 1 && <hr />}
            </div>
          ))}
        </div>
      </div>
      {contactSections && contactSections.length > 0 && (
        <footer>
          {contactSections.map((contactSection) => (
            <div className="contact" key={contactSection.title}>
              <h2 className="contact_title">{contactSection.title}</h2>
              {contactSection.items.map((item, index) => (
                <div key={item.title}>
                  <div className="support-info">
                    <div className="support-info__title">{item.title}</div>
                    <div className="support-info__content">{item.value}</div>
                  </div>
                  {index !== contactSection.items.length - 1 && <hr />}
                </div>
              ))}
              {contactSection.link && (
                <div className="support__link">
                  <a href={contactSection.link.url} target="_blank" rel="noreferrer">
                    {contactSection.link.label}
                  </a>
                </div>
              )}
            </div>
          ))}
        </footer>
      )}
      {sections.map((section) => (
        <HelpSection
          section={section}
          closeHelpSection={closeHelpSection}
          isActive={section === activeSection}
          key={section}
        />
      ))}
    </div>
  );
};

export default StdcmHelpModule;
