/* eslint-disable import/prefer-default-export */
import type { PowerRestrictionV2 } from 'applications/operationalStudies/consts';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import { isEmpty, keyBy, sortBy } from 'lodash';
import type { PathStep } from 'reducers/osrdconf/types';

const formatPowerRestrictions = (
  powerRestrictionRanges: PowerRestrictionV2[],
  changePoints: number[],
  pathSteps: PathStep[],
  pathLength: number
) => {
  // créer un dictionnaire de pathSteps par id
  const pathStepById = keyBy(pathSteps, 'id');
  const electrificationChangePoints = sortBy(changePoints, (position) => position);

  // parcourir toutes les restrictions de puissance
  const formattedPowerRestrictionRanges = powerRestrictionRanges.reduce(
    (acc, restriction, index) => {
      // on récupère la position du from de la restriction courante
      const fromPathStep = pathStepById[restriction.from];
      const toPathStep = pathStepById[restriction.to];
      const from = fromPathStep?.positionOnPath;
      const to = toPathStep?.positionOnPath;
      const prevEnd = isEmpty(acc) ? 0 : acc[acc.length - 1].end;

      // on regarde s'il y a un trou entre la restriction précédente et la courante
      if (from !== undefined && to !== undefined) {
        if (index === 0 || from > acc[acc.length - 1].end) {
          // s'il y a un trou, on regarde s'il y a des électrificationChangePoints dedans
          const insideChangePoints = electrificationChangePoints.filter(
            (changePoint) => changePoint > prevEnd && changePoint < from
          );
          if (insideChangePoints.length) {
            // si oui, on crée des ranges avec NO_POWER_RESTRICTION en valeur
            insideChangePoints.forEach((changePoint, idx) => {
              if (idx === 0) {
                acc.push({
                  begin: prevEnd,
                  end: changePoint,
                  value: 'NO_POWER_RESTRICTION',
                });
              }
              acc.push({
                begin: changePoint,
                end: idx === insideChangePoints.length - 1 ? from : insideChangePoints[idx + 1],
                value: 'NO_POWER_RESTRICTION',
              });
            });
          } else {
            // si non, on crée une seule range avec NO_POWER_RESTRICTION
            acc.push({
              begin: prevEnd,
              end: from,
              value: 'NO_POWER_RESTRICTION',
            });
          }
        }

        // on ajoute la restriction de puissance
        acc.push({
          begin: from,
          end: to,
          value: restriction.code,
        });
      }
      return acc;
    },
    [] as IntervalItem[]
  );

  // on regarde s'il y a des trous
  // s'il y a un trou, on regarde s'il y a des électrificationChangePoints dedans
  // si oui, on crée des ranges avec NO_POWER_RESTRICTION en valeur
  // si non, on crée une seule range avec NO_POWER_RESTRICTION

  if (formattedPowerRestrictionRanges.length !== 0) {
    const lastPowerRestrictionEnd =
      formattedPowerRestrictionRanges[formattedPowerRestrictionRanges.length - 1].end;
    if (lastPowerRestrictionEnd !== pathLength) {
      const insideChangePoints = electrificationChangePoints.filter(
        (changePoint) => changePoint > lastPowerRestrictionEnd
      );
      if (insideChangePoints.length) {
        insideChangePoints.forEach((changePoint, idx) => {
          if (idx === 0) {
            formattedPowerRestrictionRanges.push({
              begin: lastPowerRestrictionEnd,
              end: changePoint,
              value: 'NO_POWER_RESTRICTION',
            });
          }
          formattedPowerRestrictionRanges.push({
            begin: changePoint,
            end: idx === insideChangePoints.length - 1 ? pathLength : insideChangePoints[idx + 1],
            value: 'NO_POWER_RESTRICTION',
          });
        });
      } else {
        formattedPowerRestrictionRanges.push({
          begin: lastPowerRestrictionEnd,
          end: pathLength,
          value: 'NO_POWER_RESTRICTION',
        });
      }
    }
  } else if (electrificationChangePoints.length) {
    electrificationChangePoints.forEach((changePoint, idx) => {
      if (idx === 0) {
        formattedPowerRestrictionRanges.push({
          begin: 0,
          end: changePoint,
          value: 'NO_POWER_RESTRICTION',
        });
      }
      formattedPowerRestrictionRanges.push({
        begin: changePoint,
        end:
          idx === electrificationChangePoints.length - 1
            ? pathLength
            : electrificationChangePoints[idx + 1],
        value: 'NO_POWER_RESTRICTION',
      });
    });
  } else {
    formattedPowerRestrictionRanges.push({
      begin: 0,
      end: pathLength,
      value: 'NO_POWER_RESTRICTION',
    });
  }
  // begin: formattedPowerRestrictionRanges[formattedPowerRestrictionRanges.length -1].end
  // end: position du dernier pathStep ou longueur totale du chemin ?

  return formattedPowerRestrictionRanges;
};

export default formatPowerRestrictions;
