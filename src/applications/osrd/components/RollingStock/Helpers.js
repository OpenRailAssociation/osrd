import React from 'react';
// import config from 'config/config';
import nextId from 'react-id-generator';

const config = {
  proxy: 'https://api.dev.osrd.fr',
};

export function displayCompo(compo) {
  return compo.map((img) => <img src={img} alt="?" key={nextId()} />);
}

export function genGifCompo(image, index = 0) {
  const gifCompo = [];
  const regex = /'/g;
  if (image.composition[index] !== undefined && image.composition[index].composition_U !== '') {
    try {
      const dataArray = JSON.parse(image.composition[index].composition_U.replace(regex, '"'));
      dataArray.forEach((name) => {
        gifCompo.push(`${config.proxy}/media/images/${name}.gif`);
      });
    } catch (e) { // If data isn't json valid (when 1 value only)
      gifCompo.push(`${config.proxy}/media/images/${image.composition[index].composition_U}.gif`);
    }
  } else if (image.composition[index] !== undefined) {
    try {
      const dataArray = JSON.parse(image.composition[index].composition_L.replace(regex, '"'));
      dataArray.forEach((name) => {
        gifCompo.push(`${config.proxy}/media/images/${name}.gif`);
      });
    } catch (e) { // If data isn't json valid (when 1 value only)
      gifCompo.push(`${config.proxy}/media/images/${image.composition[index].composition_L}.gif`);
    }
  }
  return gifCompo;
}

export function imageCompo(data) {
  if (data.first_image === undefined && data.images === undefined) {
    return [];
  }

  const compos = [];
  const images = data.images || data.first_image;
  if (images !== null) {
    images.forEach((image) => {
      const gifCompo = genGifCompo(image);
      if (gifCompo.length !== 0) {
        compos.push({ image: gifCompo, commentaire: image.commentaire });
      }
    });
  }
  return compos;
}
