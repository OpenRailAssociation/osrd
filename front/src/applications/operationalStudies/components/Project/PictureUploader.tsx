import React, { useState, useEffect } from 'react';
import { AiOutlinePicture } from 'react-icons/ai';
import { useTranslation } from 'react-i18next';
import { TiDelete } from 'react-icons/ti';
import logoCheese from 'assets/pictures/misc/cheese.svg';
import logoDog from 'assets/pictures/misc/dog.svg';
import logoCat from 'assets/pictures/misc/cat.svg';
import logoMeat from 'assets/pictures/misc/meat.svg';
import logoTrain from 'assets/pictures/misc/train.svg';
import logoPanda from 'assets/pictures/misc/panda.svg';
import logoRedPanda from 'assets/pictures/misc/redpanda.svg';
import logoTeddyBear from 'assets/pictures/misc/teddybear.svg';
import logoTiger from 'assets/pictures/misc/tiger.svg';
import logoGhibli from 'assets/pictures/misc/ghibli.svg';
import logoSNCF from 'assets/pictures/misc/sncf.svg';
import { getDocument } from 'common/api/documentApi';
import { useSelector } from 'react-redux';
import { RootState } from 'reducers';

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
  safeWord: string;
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

function PicturePlaceholderButtons({ setTempProjectImage, safeWord }: PropsButtons) {
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
      {safeWord === '' && (
        <>
          <button
            className="barbecue"
            type="button"
            onClick={() => getRandomImage('https://picplaceholder.osrd.fr/barbecue/')}
          >
            <img src={logoMeat} alt="Meat logo" />
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
            <img src={logoCat} alt="Cat logo" />
          </button>
          <button
            className="dog"
            type="button"
            onClick={() => getRandomImage('https://picplaceholder.osrd.fr/dog/')}
          >
            <img src={logoDog} alt="Dog logo" />
          </button>
          <button
            className="redpanda"
            type="button"
            onClick={() => getRandomImage('https://picplaceholder.osrd.fr/redpanda/')}
          >
            <img src={logoRedPanda} alt="Red panda logo" />
          </button>
          <button
            className="panda"
            type="button"
            onClick={() => getRandomImage('https://picplaceholder.osrd.fr/panda/')}
          >
            <img src={logoPanda} alt="Panda logo" />
          </button>
          <button
            className="teddybear"
            type="button"
            onClick={() => getRandomImage('https://picplaceholder.osrd.fr/teddybear/')}
          >
            <img src={logoTeddyBear} alt="Teddybear logo" />
          </button>
          <button
            className="tiger"
            type="button"
            onClick={() => getRandomImage('https://picplaceholder.osrd.fr/tiger/')}
          >
            <img src={logoTiger} alt="Tiger logo" />
          </button>
          <button
            className="cheese"
            type="button"
            onClick={() => getRandomImage('https://picplaceholder.osrd.fr/cheese/')}
          >
            <img src={logoCheese} alt="Cheese logo" />
          </button>
        </>
      )}
      <button
        className="railways"
        type="button"
        onClick={() => getRandomImage('https://picplaceholder.osrd.fr/railways/')}
      >
        <img src={logoTrain} alt="Train logo" />
      </button>
      <button
        className="sncf"
        type="button"
        onClick={() => getRandomImage('https://picplaceholder.osrd.fr/sncf/')}
      >
        <img src={logoSNCF} alt="SNCF LOGO" />
      </button>
      <button className="remove" type="button" onClick={() => setTempProjectImage(null)}>
        <TiDelete />
      </button>
    </div>
  );
}

export default function PictureUploader({ image, setTempProjectImage, tempProjectImage }: Props) {
  const [isValid, setIsValid] = useState<boolean>(true);
  const safeWord = useSelector((state: RootState) => state.main.safeWord);
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
      <PicturePlaceholderButtons setTempProjectImage={setTempProjectImage} safeWord={safeWord} />
    </div>
  );
}
