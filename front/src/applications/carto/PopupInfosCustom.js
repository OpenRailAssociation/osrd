import React from 'react';
import PropTypes from 'prop-types';
import kmORm from 'common/distances';

export function PopupInfosCustomTitle(props) {
  const {
    nomVoie, codeLigne, longueur, pkSncfDe, pkSncfFi, libelle, pk,
  } = props;
  const distance = kmORm(longueur);

  let title = '';
  if (libelle.length !== 0) {
    title = libelle;
  } else if (codeLigne.length !== 0) {
    title = `${codeLigne} ${nomVoie}`;
  }

  return (
    <>
      <strong className="mr-2">{title}</strong>
      {distance && (
        <small className="mr-2">
          {distance.value}
          <small className="text-uppercase">{distance.unit}</small>
        </small>
      )}
      <small>
        {pkSncfDe !== ''
        && (
          <>
            {pkSncfDe}
            <strong> / </strong>
            {pkSncfFi}
          </>
        )}
        {pk !== '' && (pk)}
      </small>
    </>
  );
}
PopupInfosCustomTitle.propTypes = {
  nomVoie: PropTypes.string,
  codeLigne: PropTypes.string,
  longueur: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  pkSncfDe: PropTypes.string,
  pkSncfFi: PropTypes.string,
  libelle: PropTypes.string,
  pk: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
};
PopupInfosCustomTitle.defaultProps = {
  nomVoie: '',
  codeLigne: '',
  longueur: '',
  pkSncfDe: '',
  pkSncfFi: '',
  libelle: '',
  pk: '',
};

export function PopupInfosCustomContent(props) {
  const {
    codeTiv, idGaia, id, predCategory, predTime, hideId, eventType, failingResource, failureType,
  } = props;
  return (
    <>
      {codeTiv && (
        <div className="labelvalue">
          <span className="labelvalue-label">CODE TIV</span>
          {codeTiv}
        </div>
      )}
      {!hideId && idGaia && (
        <div className="labelvalue">
          <span className="labelvalue-label">ID GAIA</span>
          {idGaia}
        </div>
      )}
      {!hideId && idGaia === undefined && id && (
        <div className="labelvalue">
          <span className="labelvalue-label">ID</span>
          {id}
        </div>
      )}
      {eventType && (
        <div className="labelvalue">
          <span className="labelvalue-label">TYPE INCIDENT</span>
          {eventType}
        </div>
      )}
      {failureType && (
        <div className="labelvalue">
          <span className="labelvalue-label">TYPE DEFAILLANCE</span>
          {failureType}
        </div>
      )}
      {failingResource && (
        <div className="labelvalue">
          <span className="labelvalue-label">RESSOURCE DEFAILLANTE</span>
          {failingResource}
        </div>
      )}
      {predCategory && (
        <div className="labelvalue">
          <span className="labelvalue-label">CAT PREDITE</span>
          {predCategory}
        </div>
      )}
      {predTime && (
        <div className="labelvalue">
          <span className="labelvalue-label">TEMPS PREDIT</span>
          {predTime}
        </div>
      )}
    </>
  );
}
PopupInfosCustomContent.propTypes = {
  codeTiv: PropTypes.string,
  idGaia: PropTypes.string,
  id: PropTypes.number,
  predCategory: PropTypes.string,
  predTime: PropTypes.string,
  hideId: PropTypes.bool,
  eventType: PropTypes.string,
  failureType: PropTypes.string,
  failingResource: PropTypes.string,
};
PopupInfosCustomContent.defaultProps = {
  codeTiv: undefined,
  idGaia: undefined,
  id: undefined,
  predCategory: undefined,
  predTime: undefined,
  hideId: false,
  eventType: undefined,
  failureType: undefined,
  failingResource: undefined,
};
