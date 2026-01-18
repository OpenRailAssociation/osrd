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

import { processJsonFile } from './helpers/parseJson';
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
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(fileContent, 'application/xml');

    const parserError = xmlDoc.getElementsByTagName('parsererror');
    if (parserError.length > 0) {
      throw new Error('Invalid XML');
    }

    const trainData = await parseXML(xmlDoc);
    setTrainsJsonData(trainData);
  };

  const processXmlFile = async (file: File, fileContent: string) => {
    if (!railwayManagerUrl) {
      await locallyProcessXmlFile(fileContent);
      return;
    }
    try {
      const trainData = await postTransformTimetable({ body: file }).unwrap();
      setTrainsJsonData(trainData as TimetableJsonPayload);
    } catch (error: unknown) {
      //TODO: check whether the code should be: if (isObject(error) && 'status' in error && error.status === '415') await locallyProcessXmlFile(fileContent); else throw error
      await locallyProcessXmlFile(fileContent);
      dispatch(setFailure(castErrorToFailure(error)));
    }
  };

  const importFile = async (file: File) => {
    try {
      closeModal();
      setIsLoading(true);
      const fileContent = await file.text();

      const fileHasBeenParsed = processJsonFile(
        fileContent,
        file.type,
        setTrainsJsonData,
        dispatch,
        t
      );

      if (!fileHasBeenParsed) {
        await processXmlFile(file, fileContent);
      }
    } catch (error: unknown) {
      dispatch(setFailure(castErrorToFailure(error)));
    } finally {
      setIsLoading(false);
    }
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
