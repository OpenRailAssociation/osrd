import React, { useState } from 'react';
import { AiOutlinePicture } from 'react-icons/ai';
import { useTranslation } from 'react-i18next';
import { SiFoodpanda } from 'react-icons/si';
import { GiTigerHead } from 'react-icons/gi';
import { IoMdTrain } from 'react-icons/io';
import { TiDelete } from 'react-icons/ti';
import { TbCheese } from 'react-icons/tb';
import { configItemsTypes } from './types';

type PropsPlaceholder = {
  configItems: configItemsTypes;
  isValid: boolean;
};

type Props = {
  configItems: configItemsTypes;
  setConfigItems: (configItems: configItemsTypes) => void;
};

function PicturePlaceholder({ configItems, isValid }: PropsPlaceholder) {
  const { t } = useTranslation('operationalStudies/project');
  if (configItems.image) {
    return <img src={URL.createObjectURL(configItems.image)} alt="Project illustration" />;
  }
  if (configItems.image_url) {
    return <img src={configItems.image_url} alt="Project illustration" />;
  }
  return (
    <>
      <AiOutlinePicture />
      {isValid ? (
        <div className="project-edition-modal-picture-placeholder-text">
          {t('picturePlaceholder')}
        </div>
      ) : (
        <div className="project-edition-modal-picture-placeholder-text invalid">
          {t('picturePlaceholderInvalid')}
        </div>
      )}
    </>
  );
}

function PicturePlaceholderButtons({ configItems, setConfigItems }: Props) {
  async function getRandomImage(theme: string) {
    try {
      const image = await fetch(`https://place${theme}.osrd.fr/`).then((res) => res.blob());
      setConfigItems({ ...configItems, image });
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="project-edition-modal-picture-placeholder-buttons">
      <button className="redpanda" type="button" onClick={() => getRandomImage('redpanda')}>
        <SiFoodpanda />
      </button>
      <button className="tiger" type="button" onClick={() => getRandomImage('tiger')}>
        <GiTigerHead />
      </button>
      <button className="train" type="button" onClick={() => getRandomImage('train')}>
        <IoMdTrain />
      </button>
      <button className="cheese" type="button" onClick={() => getRandomImage('cheese')}>
        <TbCheese />
      </button>
      <button
        className="remove"
        type="button"
        onClick={() => setConfigItems({ ...configItems, image: undefined, image_url: undefined })}
      >
        <TiDelete />
      </button>
    </div>
  );
}

export default function PictureUploader({ configItems, setConfigItems }: Props) {
  const [isValid, setIsValid] = useState<boolean>(true);

  const handleUpload = async (file?: File) => {
    if (file && file.type.startsWith('image/')) {
      setConfigItems({ ...configItems, image: file });
      setIsValid(true);
    } else {
      setConfigItems({ ...configItems, image: undefined });
      setIsValid(false);
    }
  };
  return (
    <div className="project-edition-modal-picture-placeholder">
      <label htmlFor="picture-upload">
        <PicturePlaceholder configItems={configItems} isValid={isValid} />
        <input
          id="picture-upload"
          type="file"
          name="imageFile"
          onChange={(e) => handleUpload(e.target.files ? e.target.files[0] : undefined)}
          accept=".png"
          className="d-none"
        />
      </label>
      <PicturePlaceholderButtons configItems={configItems} setConfigItems={setConfigItems} />
    </div>
  );
}
