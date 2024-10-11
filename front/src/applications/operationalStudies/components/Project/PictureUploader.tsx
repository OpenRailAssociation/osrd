import { useState, useEffect, useCallback, type ChangeEvent } from 'react';

import { Image, XCircle } from '@osrd-project/ui-icons';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { getDocument } from 'common/api/documentApi';
import { notifyFailure } from 'reducers/main';
import { getUserSafeWord } from 'reducers/user/userSelectors';
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

type PicturePlaceholderButtonsProps = {
  setTempProjectImage: (tempProjectImage: Blob | null | undefined) => void;
  tempProjectImage: Blob | null | undefined;
  safeWord: string;
  t: TFunction;
};

const IMAGE_MAX_SIZE = 2 * 1024 * 1024; // 2MiB

function displayNoImageMessages(isValid: boolean, t: (arg0: string) => string) {
  return (
    <>
      <Image />
      {isValid ? (
        <div className="project-edition-modal-picture-placeholder-text">{t('addImage')}</div>
      ) : (
        <div className="project-edition-modal-picture-placeholder-text invalid">
          {t('noImageInvalid')}
        </div>
      )}
    </>
  );
}

const PicturePlaceholder = ({ image, isValid, tempProjectImage }: PicturePlaceholderProps) => {
  const { t } = useTranslation('operationalStudies/project');
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

type Categories = {
  [key: string]: {
    category_image: string;
    images: string[];
  };
};

const PicturePlaceholderButtons = ({
  setTempProjectImage,
  tempProjectImage,
  safeWord,
  t,
}: PicturePlaceholderButtonsProps) => {
  const [categories, setCategories] = useState<Categories>({});
  const [imageIndexes, setImageIndexes] = useState<{ [category: string]: number }>({});

  async function getNextImage(category: string, images: string[]) {
    try {
      if (images.length === 0) {
        throw new Error('No images available');
      }

      const currentIndex = imageIndexes[category] ?? Math.floor(Math.random() * images.length);
      const nextIndex = (currentIndex + 1) % images.length;

      const imageUrl = images[currentIndex];

      const currentImage = await fetch(`/images/src/${imageUrl}`).then((res) => {
        if (!res.ok) {
          throw new Error(`Error fetching image: ${res.statusText}`);
        }
        return res.blob();
      });

      setTempProjectImage(currentImage);
      // Update the image index for the category
      setImageIndexes((prevIndexes) => ({
        ...prevIndexes,
        [category]: nextIndex,
      }));
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    async function fetchCategories(): Promise<Categories> {
      try {
        const response = await fetch('/images/image_path.json');

        if (!response.ok) {
          throw new Error(`Error fetching data: ${response.statusText}`);
        }

        const result: Categories = await response.json();

        return result;
      } catch (error) {
        console.error('Error fetching categories:', error);
        throw error;
      }
    }

    const loadCategories = async () => {
      const fetchedCategories = await fetchCategories();
      setCategories(fetchedCategories);
    };

    loadCategories();
  }, []);

  return (
    <div className="project-edition-modal-picture-placeholder-buttons">
      {safeWord === '' && (
        <>
          {Object.keys(categories).map((category) => (
            <button
              key={category}
              type="button"
              aria-label={category}
              title={category}
              onClick={() => getNextImage(category, categories[category].images)}
            >
              <img
                src={`/images/src/${categories[category].category_image}`}
                alt={`${category} logo`}
              />
            </button>
          ))}
        </>
      )}

      {tempProjectImage && (
        <button
          className="remove"
          type="button"
          aria-label={t('removeImage')}
          onClick={() => setTempProjectImage(null)}
        >
          <XCircle variant="fill" />
        </button>
      )}
    </div>
  );
};

export default function PictureUploader({
  image,
  setTempProjectImage,
  tempProjectImage,
}: PictureUploaderProps) {
  const [isValid, setIsValid] = useState<boolean>(true);
  const { t } = useTranslation('operationalStudies/project');
  const safeWord = useSelector(getUserSafeWord);
  const dispatch = useAppDispatch();

  const handleUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files ? e.target.files[0] : undefined;
      const isSizeTooLarge =
        file && file.type.startsWith('image/') && file.size && file.size > IMAGE_MAX_SIZE;
      const isWrongType = file && !file.type.startsWith('image/');

      if (isSizeTooLarge || isWrongType) {
        dispatch(
          notifyFailure({
            name: isSizeTooLarge
              ? t('error.uploadImageSizeTitle')
              : t('error.uploadImageTypeTitle'),
            message: isSizeTooLarge ? t('error.uploadImageSize') : t('error.uploadImageType'),
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
          aria-label={t('uploadImage')}
          onChange={handleUpload}
          accept=".png, .jpg, .jpeg"
          className="d-none"
        />
      </label>
      <PicturePlaceholderButtons
        setTempProjectImage={setTempProjectImage}
        tempProjectImage={tempProjectImage}
        safeWord={safeWord}
        t={t}
      />
    </div>
  );
}
