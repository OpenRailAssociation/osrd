import React from 'react';
import PropTypes from 'prop-types';
import kmORm from 'common/distances';

export default function PopupInfosCustomTitle(props) {
  const { properties } = props;
  const {
    nomVoie, codeLigne, longueur, pkSncfDe, pkSncfFi, libelle, pk, libelleLigne,
  } = properties;
  const distance = kmORm(longueur);
  let title = '';
  if (libelle !== undefined && libelle.length !== 0) {
    title = libelle;
  } else if (codeLigne !== undefined && codeLigne.length !== 0) {
    title = `${codeLigne} ${nomVoie}`;
  }
  return (
    <>
      <strong className="mr-2">{title}</strong>
      <small className="mr-2">{libelleLigne}</small>
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
            <strong> &bull; </strong>
            {pkSncfFi}
          </>
        )}
        {pk !== '' && (pk)}
      </small>
    </>
  );
}

PopupInfosCustomTitle.propTypes = {
  properties: PropTypes.object.isRequired,
};
