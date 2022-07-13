/* eslint-disable no-restricted-globals */
import { useState, useEffect } from 'react';
import { DATA_TYPES } from 'common/types';
import moment from 'moment';
import 'moment/locale/fr';
import { LAYER_VARIABLES } from 'common/Map/const';

/**
 * Fonctions utiles pour les cartes des différents projets
 */

/**
 * Debounce input fields
 */

export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value]);
  return debouncedValue;
};

/**
 * Donne le bon type de curseur au survol
 * @param {boolean} isHovering - S'il est à True, retourne le bon type de pointeur
 * @returns {string} La classe correspondant au pointeur
 */
export function getCursor(isHovering) {
  return isHovering ? 'pointer' : 'default';
}

export const getSignalLayerId = (type) => `signal_${type.toLowerCase().replace(/ |\./g, '_')}`;

/**
 * Donne la propriété en string de la visibilité d'un layer
 * @param {boolean} isVisible - Si le layer doit être visible ou non
 * @returns 'visible' si le layer doit être visible, 'none' sinon
 */
export function booleanToStringLayerVisibility(isVisible) {
  return isVisible ? 'visible' : 'none';
}

/**
 * Donne la valeur arrondie d'une coordonnée GPS
 * @param {number} val - La valeur à arrondir
 * @returns {number} La coordonnée arrondie au 10 000ème
 */
export function gpsRound(val) {
  return Math.round(val * 10000) / 10000;
}

/**
 * Fonction de callback lors d'un requête vers une URL extérieure
 * @param {string} url - L'URL de la requête
 * @param {string} resourceType - Le type de ressource
 * @param {string} urlmap - L'URL de base pour la carte
 * @returns {(object| null)} Le token d'authentifcation lorsqu'il est nécessaire
 */
export function transformRequest(url, resourceType, urlmap) {
  if ((resourceType === 'Source' || resourceType === 'Tile') && url.startsWith(urlmap)) {
    return {
      url,
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    };
  }
  return null;
}

/**
 * Validate the PK format of a string
 * @param {string} pk
 * @returns {boolean} false if pk is not valid, true if it is
 */
export function validatePk(pk) {
  const { length } = pk;
  const pkProps = {
    sign: undefined,
    previousRk: undefined,
    previousRkLetter: undefined,
    distFromPreviousPk: undefined,
    internPk: undefined,
  };
  let splitedPk;
  // only a number allowed for pk < 1000
  if (length <= 3) {
    return !isNaN(pk);
  }

  if (length > 3) {
    // '+' or '-' required when pk > 999
    if (!pk.includes('+') && !pk.includes('-')) {
      return false;
    }

    if (pk.includes('+')) {
      pkProps.sign = '+';
    } else {
      pkProps.sign = '-';
    }

    splitedPk = pk.split(pkProps.sign);

    // before '+' and '-', there needs to be something
    if (splitedPk.length !== 2 || splitedPk[0].length === 0) {
      return false;
    }

    // the second part should be a number
    if (isNaN(splitedPk[1])) {
      return false;
    }

    // '-' is only allowed when RK is 0
    if (pkProps.sign === '-' && splitedPk[0] !== '0') {
      return false;
    }

    if (!isNaN(splitedPk[0])) {
      pkProps.previousRk = Number(splitedPk[0]);
    } else {
      try {
        pkProps.previousRk = Number(splitedPk[0].slice(0, -1));
      } catch (err) {
        pkProps.previousRk = undefined;
      }
      pkProps.previousRkLetter = splitedPk[0].slice(-1);
    }

    pkProps.distFromPreviousPk = Number(splitedPk[1]);
  }
  return true;
}

/**
 *
 * @param {object} geom - GeoJSON coordinates of the object
 * @returns {array} array for the first coordinates
 */
export const getFirstCoordinates = (geom, zoom = 16) => {
  const { type, coordinates } = geom;

  let firstCoordinate;
  switch (type) {
    case 'MultiPolygon':
      [[[firstCoordinate]]] = coordinates;
      break;
    case 'Polygon':
      [[firstCoordinate]] = coordinates;
      break;
    case 'MultiLineString':
      [[firstCoordinate]] = coordinates;
      break;
    case 'LineString':
      [firstCoordinate] = coordinates;
      break;
    case 'Point':
      firstCoordinate = coordinates;
      zoom = 16;
      break;
    default:
      break;
  }

  const longitude = firstCoordinate[0];
  const latitude = firstCoordinate[1];
  return [longitude, latitude, zoom];
};

/**
 * Fonctions diverses
 */

export const findPathsToKey = (obj, key) => {
  const results = [];

  (function findKey(o, k, pathToKey) {
    const oldPath = `${pathToKey ? `${pathToKey}.` : ''}`;
    if (o[k]) {
      results.push(`${oldPath}${k}`);
    }

    if (o !== null && typeof o === 'object' && !Array.isArray(o)) {
      Object.keys(o).forEach((i) => {
        if (o[i]) {
          if (Array.isArray(o[i])) {
            o[i].forEach((val, j) => {
              findKey(o[i][j], k, `${oldPath}${i}[${j}]`);
            });
          }

          if (o[i] !== null && typeof o[i] === 'object') {
            findKey(o[i], k, `${oldPath}${i}`);
          }
        }
      });
    }
  }(obj, key));

  // const results = findKey(obj, key, undefined, []);

  console.log(results);

  return results;
};

/**
 * Normalize a string by lowering the case and removing accents
 * @param {string} str - Raw string to normalize
 * @returns {string} Normalized string
 */
export const normalizeString = (str) => str.toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

/**
 * Soft compare 2 strings, not taking into account case and accents
 * @param {string} str1
 * @param {string} str2
 * @returns {boolean} True if string are softly equals
 */
export const areSoftlyEqual = (str1, str2) => normalizeString(str1) === normalizeString(str2);

/**
 * Remove an element from an an array
 * @param {array} array - Array to filter
 * @param {obj} filteredElement - The element to remove from array
 * @returns {array} Filtered array
 */
export function filterByName(array, filteredElement) {
  return array.filter((element) => {
    if (element.name) {
      return element.name !== filteredElement.name;
    }
    return element !== filteredElement;
  });
}

/**
 * Filter an array of string by element's name or by string element itself, using a search value
 * @param {array} array - Array to filter
 * @param {string} search - Search term
 * @returns {array} Filtered array
 */
export function filterBySearch(array, search, key = undefined) {
  return array.filter((element) => {
    let value = element.name || element;
    if (key) {
      value = element[key];
    }
    return normalizeString(value).includes(normalizeString(search));
  });
}

/**
 * Get data from deep object, given the path leading to the data
 * @param {object} item - Object from which to get the data
 * @param {object} params - Params with:
 * * key {string} - required, if data is not deeply nested
 * * dataPath {array}, if deeply nested data
 * * dataType {oneOf DATA_TYPES}, if the data needs to be normalized
 * * arrayElementParams {params} - required if dataType is array, if the data needs to be normalized
 * @returns {any} The desired data, formated when needed
 */
export const getDeepObjectData = (item, params, itemsList) => {
  // Default value when formatting the data
  const DEFAULT_SPLITTER = ',';
  const DEFAULT_DATE_FORMAT = 'Do MMMM YYYY, HH:mm:ss';

  let data = item[params.key];

  if (params.data) {
    params.data.forEach((d, i) => {
      let tempData = data;
      if (d.path) {
        let tempContent = item;
        d.path.forEach((pathName) => {
          tempContent = tempContent[pathName];
        });
        tempData = tempContent;
      }

      if (d.type) {
        let str = '';
        switch (d.type) {
          // Format array
          case DATA_TYPES.array:
            tempData.forEach((element, index) => {
              const elementData = getDeepObjectData(element, params.arrayElementParams, itemsList);
              const splitter = d.splitter || DEFAULT_SPLITTER;
              if (index !== tempData.length - 1) {
                str += `${elementData}${splitter} `;
              } else {
                str += elementData;
              }
            });
            tempData = str;
            break;
          // Format date
          case DATA_TYPES.date: {
            const format = d.format || DEFAULT_DATE_FORMAT;
            tempData = moment(tempData).format(format);
            break;
          }
          // Format percent
          case DATA_TYPES.percent:
            tempData = `${Math.round(tempData)}%`;
            break;
          case DATA_TYPES.object:
            break;
          default:
            break;
        }
      }

      if (d.formatter) {
        tempData = d.formatter(item, params, tempData, itemsList);
      }

      data = i === 0 ? tempData : data + params.spliter + tempData;
    });
  }
  return data;
};

export const updateChildElementSelect = (draft, action, selected) => {
  draft.elements.selected[action.elementType] = draft.elements.selected[action.elementType].map(
    (element) => {
      if (element.key === action.parent.key) {
        return {
          ...element,
          children: element.children.map((child) => {
            if (child.key === action.child.key) {
              return {
                ...child,
                selected,
              };
            }
            return {
              ...child,
              selected: !selected,
            };
          }),
        };
      }
      return element;
    },
  );
};

/**
 * Exports a js object to an export.json file
 * @param {object} obj - Object to export
 */
export const exportToJson = (obj) => {
  const filename = 'export.json';
  const contentType = 'application/json;charset=utf-8;';
  if (window.navigator && window.navigator.msSaveOrOpenBlob) {
    const blob = new Blob([decodeURIComponent(encodeURI(JSON.stringify(obj)))], {
      type: contentType,
    });
    navigator.msSaveOrOpenBlob(blob, filename);
  } else {
    const a = document.createElement('a');
    a.download = filename;
    a.href = `data:${contentType},${encodeURIComponent(JSON.stringify(obj))}`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};
