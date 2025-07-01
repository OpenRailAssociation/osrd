import { ArrowLeft } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import useDeploymentSettings from 'utils/hooks/useDeploymentSettings';

import SectionContentManager from './SectionContentManager';
import type { Section } from './types';

type HelpSectionProps = {
  section: string;
  isActive: boolean;
  closeHelpSection: () => void;
};

const HelpSection = ({ section, isActive, closeHelpSection }: HelpSectionProps) => {
  const { t } = useTranslation('stdcm-help-section');
  const stdcmFeedbackMail = useDeploymentSettings()?.stdcmFeedbackMail;
  const currentSection = t(`sections.${section}`, {
    returnObjects: true,
    stdcmFeedbackMail,
  }) as Section;

  return (
    <div className={cx('stdcm__help-section', { active: isActive })}>
      <div className="stdcm__help-section__header">
        <button
          type="button"
          onClick={closeHelpSection}
          className="flex align-items-center stdcm__help-section__back-button"
        >
          <span className="mr-2 icon">
            <ArrowLeft size="lg" />
          </span>
          {t('backToIndex')}
        </button>
      </div>
      <div className="stdcm__help-section__content">
        <h1 className={cx('stdcm__help-section__title', { active: isActive })}>
          {currentSection.title}
        </h1>
        {Array.isArray(currentSection.content) &&
          currentSection.content.map((content, index) => (
            <SectionContentManager key={index} content={content} />
          ))}
        {currentSection.subSections?.map((subSection) => (
          <div key={subSection.title}>
            <h2 className="stdcm__help-section__subtitle">{subSection.title}</h2>
            {subSection.content?.map((content, idx) => (
              <SectionContentManager key={idx} content={content} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HelpSection;
