import { useState, useEffect } from 'react';

import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';

const DEFAULT_TEXT = '# contact@osrd.fr';

const HelpModal = () => {
  const { t } = useTranslation('home/navbar');
  const [helpModalText, setHelpModalText] = useState<string>('');

  useEffect(() => {
    const checkHelpMarkdown = async () => {
      try {
        const response = await fetch('/help.md');

        if (!response.ok || response.headers.get('Content-Type') !== 'text/markdown') {
          setHelpModalText(DEFAULT_TEXT);
          return;
        }

        setHelpModalText(await response.text());
      } catch {
        setHelpModalText(DEFAULT_TEXT);
      }
    };
    checkHelpMarkdown();
  }, []);

  return (
    <div className="informations-modal">
      <ModalHeaderSNCF withCloseButton>{t('help')}</ModalHeaderSNCF>
      <ModalBodySNCF>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{helpModalText}</ReactMarkdown>
      </ModalBodySNCF>
    </div>
  );
};

export default HelpModal;
