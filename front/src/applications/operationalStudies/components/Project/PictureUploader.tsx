import { useState, useEffect, useCallback, type ChangeEvent } from 'react';

import { Image, XCircle } from '@osrd-project/ui-icons';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { getDocument } from 'common/api/documentApi';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';

type PicturePlaceholderProps = {
  image?: number | null;
  isValid: boolean;
  tempProjectImage: Blob | null | undefined;
};

type PictureUploaderProps = {
  image?: number | null;
  setTempProjectImage: (tempProjectImage: Blob | null | undefined) => void;
  tempProjectImage: Blob | null | undefined;
};

const IMAGE_MAX_SIZE = 2 * 1024 * 1024; // 2MiB

function displayNoImageMessages(isValid: boolean, t: TFunction<'operational-studies'>) {
  return (
    <>
      <Image />
      {isValid ? (
        <div className="project-edition-modal-picture-placeholder-text">
          {t('project.addImage')}
        </div>
      ) : (
        <div className="project-edition-modal-picture-placeholder-text invalid">
          {t('project.noImageInvalid')}
        </div>
      )}
    </>
  );
}

const PicturePlaceholder = ({ image, isValid, tempProjectImage }: PicturePlaceholderProps) => {
  const { t } = useTranslation('operational-studies');
  const [projectImage, setProjectImage] = useState<Blob>();

  const getProjectImageBlob = async () => {
    if (image) {
      try {
        const imageBlob = await getDocument(image);
        setProjectImage(imageBlob);
      } catch (error) {
        console.error(error);
      }
    }
  };

  useEffect(() => {
    getProjectImageBlob();
  }, [image]);
  if (tempProjectImage) {
    return <img src={URL.createObjectURL(tempProjectImage)} alt="Project illustration" />;
  }
  if (tempProjectImage === null) {
    return <>{displayNoImageMessages(isValid, t)}</>;
  }
  if (projectImage) {
    return <img src={URL.createObjectURL(projectImage)} alt="Project illustration" />;
  }
  return <>{displayNoImageMessages(isValid, t)}</>;
};

export default function PictureUploader({
  image,
  setTempProjectImage,
  tempProjectImage,
}: PictureUploaderProps) {
  const [isValid, setIsValid] = useState<boolean>(true);
  const { t } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();

  const handleUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files ? e.target.files[0] : undefined;
      const isSizeTooLarge = file && file.type.startsWith('image/') && file.size > IMAGE_MAX_SIZE;
      const isWrongType = file && !file.type.startsWith('image/');

      if (isSizeTooLarge || isWrongType) {
        dispatch(
          setFailure({
            name: isSizeTooLarge
              ? t('project.error.uploadImageSizeTitle')
              : t('project.error.uploadImageTypeTitle'),
            message: isSizeTooLarge
              ? t('project.error.uploadImageSize')
              : t('project.error.uploadImageType'),
          })
        );
        setIsValid(false);
        setTempProjectImage(undefined);
      } else {
        setTempProjectImage(file);
        setIsValid(true);
      }
    },
    [setIsValid, setTempProjectImage]
  );

  return (
    <div className="project-edition-modal-picture-placeholder">
      <label htmlFor="picture-upload">
        <PicturePlaceholder image={image} isValid={isValid} tempProjectImage={tempProjectImage} />
        <input
          id="picture-upload"
          type="file"
          name="imageFile"
          aria-label={t('project.uploadImage')}
          onChange={handleUpload}
          accept=".png, .jpg, .jpeg"
          className="d-none"
        />
      </label>

      {(!!image || !!tempProjectImage) && (
        <button
          className="remove"
          type="button"
          aria-label={t('project.removeImage')}
          onClick={() => setTempProjectImage(null)}
        >
          <XCircle variant="fill" />
        </button>
      )}
    </div>
  );
}
