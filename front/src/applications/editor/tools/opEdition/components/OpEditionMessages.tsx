import { useTranslation } from 'react-i18next';

const OpEditionMessages = () => {
  const { t } = useTranslation();
  return t('Editor.tools.op-edition.help.init');
};

export default OpEditionMessages;
