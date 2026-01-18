import { useContext } from 'react';

import { Download } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { TimetableJsonPayload } from 'applications/operationalStudies/types';
import { osrdRailwayManagerApi } from 'common/api/osrdRailwayManagerApi';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import UploadFileModal from 'common/uploadFileModal';
import { setFailure } from 'reducers/main';
import { getRailwayManagerInterfaceUrl } from 'reducers/main/mainSelector';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import { processJsonFile, handleFileReadingError } from './helpers/parseJson';
import parseXML from './helpers/parseXML';

type ImportTimetableItemConfigProps = {
  setIsLoading: (isLoading: boolean) => void;
  setTrainsJsonData: (trainsJsonData: TimetableJsonPayload) => void;
};

const ImportTimetableItemConfig = ({
  setIsLoading,
  setTrainsJsonData,
}: ImportTimetableItemConfigProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrains' });
  const railwayManagerUrl = useSelector(getRailwayManagerInterfaceUrl);
  const dispatch = useAppDispatch();
  const { openModal, closeModal } = useContext(ModalContext);
  const [postTransformTimetable] =
    osrdRailwayManagerApi.endpoints.postTransformTimetable.useMutation();

  const locallyProcessXmlFile = async (fileContent: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(fileContent, 'application/xml');
      const parserError = xmlDoc.getElementsByTagName('parsererror');

      if (parserError.length > 0) {
        throw new Error('Invalid XML');
      }

      const trainData = await parseXML(xmlDoc);
      setTrainsJsonData(trainData);
    } catch (error: unknown) {
      const failure = castErrorToFailure(error);
      dispatch(setFailure(failure));
    }
  };

  const processXmlFile = async (file: File, fileContent: string) => {
    setIsLoading(true);

    if (!railwayManagerUrl) {
      await locallyProcessXmlFile(fileContent);
      setIsLoading(false);
      return;
    }
    try {
      const trainData = await postTransformTimetable({ body: file }).unwrap();
      setTrainsJsonData(trainData as TimetableJsonPayload);
    } catch (error: unknown) {
      await locallyProcessXmlFile(fileContent);
      const failure = castErrorToFailure(error);
      dispatch(setFailure(failure));
    } finally {
      setIsLoading(false);
    }
  };

  const importFile = async (file: File) => {
    closeModal();

    let fileContent: string;
    try {
      fileContent = await file.text();
    } catch (error) {
      handleFileReadingError(error as Error);
      return;
    }

    const fileHasBeenParsed = processJsonFile(
      fileContent,
      file.type,
      setTrainsJsonData,
      dispatch,
      t
    );

    // the file has been processed, return
    if (fileHasBeenParsed) {
      return;
    }

    // try to parse the file as an XML file
    await processXmlFile(file, fileContent);
  };
  return (
    <div className="container-fluid mb-2">
      <div className="row no-gutters">
        <div className="col-12 d-flex flex-column no-gutters pl-1">
          <button
            type="button"
            className="btn btn-sm btn-secondary btn-block import-button"
            aria-label={t('importTimetable')}
            title={t('importTimetable')}
            onClick={() => openModal(<UploadFileModal handleSubmit={importFile} />)}
            data-testid="import-timetable-item-upload-button"
          >
            <Download />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportTimetableItemConfig;
