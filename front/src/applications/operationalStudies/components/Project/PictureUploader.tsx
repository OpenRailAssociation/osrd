import React, { useState, useEffect } from 'react';
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
import { getDocument } from 'common/api/documentApi';

type PropsPlaceholder = {
  image?: number | null;
  isValid: boolean;
  tempProjectImage: Blob | null | undefined;
};

type Props = {
  image?: number | null;
  setTempProjectImage: (tempProjectImage: Blob | null | undefined) => void;
  tempProjectImage: Blob | null | undefined;
};

type PropsButtons = {
  setTempProjectImage: (tempProjectImage: Blob | null | undefined) => void;
};

function displayNoImageMessages(isValid: boolean, t: (arg0: string) => string) {
  return (
    <>
      <AiOutlinePicture />
      {isValid ? (
        <div className="project-edition-modal-picture-placeholder-text">{t('noImage')}</div>
      ) : (
        <div className="project-edition-modal-picture-placeholder-text invalid">
          {t('noImageInvalid')}
        </div>
      )}
    </>
  );
}

function PicturePlaceholder({ image, isValid, tempProjectImage }: PropsPlaceholder) {
  const { t } = useTranslation('operationalStudies/project');
  const [projectImage, setProjectImage] = useState<Blob | undefined>(undefined);

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
}

function PicturePlaceholderButtons({ setTempProjectImage }: PropsButtons) {
  async function getRandomImage(url: string) {
    try {
      const currentImage = await fetch(url).then((res) => res.blob());
      setTempProjectImage(currentImage);
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
      <button className="remove" type="button" onClick={() => setTempProjectImage(null)}>
        <TiDelete />
      </button>
    </div>
  );
}

export default function PictureUploader({ image, setTempProjectImage, tempProjectImage }: Props) {
  const [isValid, setIsValid] = useState<boolean>(true);

  const handleUpload = async (file?: File) => {
    if (file && file.type.startsWith('image/')) {
      setTempProjectImage(file);
      setIsValid(true);
    } else {
      setTempProjectImage(undefined);
      setIsValid(false);
    }
  };
  return (
    <div className="project-edition-modal-picture-placeholder">
      <label htmlFor="picture-upload">
        <PicturePlaceholder image={image} isValid={isValid} tempProjectImage={tempProjectImage} />
        <input
          id="picture-upload"
          type="file"
          name="imageFile"
          onChange={(e) => handleUpload(e.target.files ? e.target.files[0] : undefined)}
          accept=".png, .jpg, .jpeg"
          className="d-none"
        />
      </label>
      <PicturePlaceholderButtons setTempProjectImage={setTempProjectImage} />
    </div>
  );
}
