import { faker } from '@faker-js/faker';

faker.setLocale('fr');

function chooseRandomIMG() {
  return `https://placetiger.nethenic.net/?${Math.random()}`;
  /*
  const x = Math.floor(Math.random() * 400) + 640;
  const y = Math.floor(Math.random() * 400) + 480;
  const list = ['http://placebeard.it', 'http://placekitten.com', 'http://placebear.com'];
  return `${list[Math.floor(Math.random() * 3)]}/${x}/${y}`;
  */
}

const NB_PROJECTS = 10;
const NB_STUDIES_RND = 15;
const NB_TAGS_RND = 6;

export default function genJSON(nb = NB_PROJECTS) {
  const json = [];
  for (let index = 0; index < nb; index += 1) {
    const studiesIDs = [];
    for (let i = 0; i < Math.round(Math.random() * NB_STUDIES_RND); i += 1) {
      studiesIDs.push(faker.datatype.uuid());
    }
    json.push({
      id: faker.datatype.uuid(),
      name: faker.lorem.words(),
      description: faker.lorem.paragraphs(1),
      image: chooseRandomIMG(),
      studies: studiesIDs,
      tags: faker.lorem.words(Math.round(Math.random() * NB_TAGS_RND)).split(' '),
      lastModified: faker.date.past(10),
    });
  }
  return json;
}
