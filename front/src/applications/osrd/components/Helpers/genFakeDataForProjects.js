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
const NB_STUDIES = 15;
const NB_SCENARIOS = 6;
const NB_TAGS = 6;

export function projectsListJSON(nb = NB_PROJECTS) {
  const json = [];
  for (let index = 0; index < nb; index += 1) {
    const studiesIDs = [];
    for (let i = 0; i < Math.round(Math.random() * NB_STUDIES); i += 1) {
      studiesIDs.push(faker.datatype.uuid());
    }
    json.push({
      id: faker.datatype.uuid(),
      name: faker.lorem.words(),
      description: faker.lorem.paragraphs(1),
      image: chooseRandomIMG(),
      studies: studiesIDs,
      tags: faker.lorem.words(Math.round(Math.random() * NB_TAGS)).split(' '),
      lastModified: faker.date.past(10),
    });
  }
  return json;
}

export function projectJSON() {
  const json = {
    id: faker.datatype.uuid(),
    name: faker.lorem.words(),
    image: chooseRandomIMG(),
    description: faker.lorem.paragraphs(1),
    objectives: faker.lorem.sentences(10),
    financials: `${faker.name.fullName()}, ${faker.company.name()}`,
    tags: faker.lorem.words(Math.round(Math.random() * NB_TAGS)).split(' '),
    budget: faker.finance.amount(10000, 1000000, 0),
  };
  return json;
}

export function studiesListJSON(nb = NB_STUDIES) {
  const json = [];
  for (let index = 0; index < nb; index += 1) {
    const scenariosIDs = [];
    for (let i = 0; i < Math.round(Math.random() * NB_SCENARIOS); i += 1) {
      scenariosIDs.push(faker.datatype.uuid());
    }
    json.push({
      id: faker.datatype.uuid(),
      name: faker.lorem.words(),
      description: faker.lorem.paragraphs(1),
      geremiCode: faker.internet.password(10),
      affairCode: faker.internet.password(10),
      creationDate: faker.date.past(2),
      startDate: faker.date.past(2),
      estimatedEndingDate: faker.date.future(),
      realEndingDate: faker.date.soon(30),
      lastModifiedDate: faker.date.recent(10),
      step: faker.lorem.word(),
      budget: faker.finance.amount(5000, 500000, 0),
      type: faker.lorem.words(),
      scenarios: scenariosIDs,
      tags: faker.lorem.words(Math.round(Math.random() * NB_TAGS)).split(' '),
    });
  }
  return json;
}
