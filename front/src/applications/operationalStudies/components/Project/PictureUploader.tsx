import React, { useState } from 'react';
import { AiOutlinePicture } from 'react-icons/ai';
import { useTranslation } from 'react-i18next';
import { SiFoodpanda } from 'react-icons/si';
import { GiBarbecue, GiTigerHead } from 'react-icons/gi';
import { IoMdTrain } from 'react-icons/io';
import { TiDelete } from 'react-icons/ti';
import { TbCheese } from 'react-icons/tb';
import { FaCat, FaDog } from 'react-icons/fa';
import logoSNCF from 'assets/logo_sncf_bw.png';
import logoGhibli from 'assets/pictures/misc/ghibli.svg';
import { projectTypes } from 'applications/operationalStudies/components/operationalStudiesTypes';

type PropsPlaceholder = {
  configItems: projectTypes;
  isValid: boolean;
};

type Props = {
  configItems: projectTypes;
  setConfigItems: (configItems: projectTypes) => void;
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
  async function getRandomImage(url: string) {
    try {
      const image = await fetch(url).then((res) => res.blob());
      setConfigItems({ ...configItems, image });
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="project-edition-modal-picture-placeholder-buttons">
      <button
        className="barbecue"
        type="button"
        onClick={() => getRandomImage('https://picplaceholder.osrd.fr/barbecue/')}
      >
        <GiBarbecue />
      </button>
      <button
        className="ghibli"
        type="button"
        onClick={() => getRandomImage('https://picplaceholder.osrd.fr/ghibli/')}
      >
        <img src={logoGhibli} alt="Ghibli logo" />
      </button>
      <button
        className="cat"
        type="button"
        onClick={() => getRandomImage('https://picplaceholder.osrd.fr/cat/')}
      >
        <FaCat />
      </button>
      <button
        className="dog"
        type="button"
        onClick={() => getRandomImage('https://picplaceholder.osrd.fr/dog/')}
      >
        <FaDog />
      </button>
      <button
        className="redpanda"
        type="button"
        onClick={() => getRandomImage('https://picplaceholder.osrd.fr/redpanda/')}
      >
        <SiFoodpanda />
      </button>
      <button
        className="tiger"
        type="button"
        onClick={() => getRandomImage('https://picplaceholder.osrd.fr/tiger/')}
      >
        <GiTigerHead />
      </button>
      <button
        className="cheese"
        type="button"
        onClick={() => getRandomImage('https://picplaceholder.osrd.fr/cheese/')}
      >
        <TbCheese />
      </button>
      <button
        className="railways"
        type="button"
        onClick={() => getRandomImage('https://picplaceholder.osrd.fr/railways/')}
      >
        <IoMdTrain />
      </button>
      <button
        className="sncf"
        type="button"
        onClick={() => getRandomImage('https://picplaceholder.osrd.fr/sncf/')}
      >
        <img src={logoSNCF} alt="SNCF BW LOGO" />
      </button>
      <button
        className="remove"
        type="button"
        onClick={() => setConfigItems({ ...configItems, image: null, image_url: undefined })}
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
