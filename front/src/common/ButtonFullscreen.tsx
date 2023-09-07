import React, { FC, useCallback } from 'react';
import { MdFullscreen } from 'react-icons/md';
import { useDispatch } from 'react-redux';

import { toggleFullscreen } from 'reducers/main';

const ButtonFullscreen: FC<{ onClick: () => void }> = ({ onClick }) => (
  <button type="button" className="btn-rounded btn-rounded-white btn-fullscreen" onClick={onClick}>
    <span className="sr-only">Fullscreen</span>
    <MdFullscreen />
  </button>
);

const ButtonFullscreenState: FC<unknown> = () => {
  const dispatch = useDispatch();

  const onClick = useCallback(() => {
    dispatch(toggleFullscreen());
  }, [dispatch]);

  return <ButtonFullscreen onClick={onClick} />;
};

export default ButtonFullscreenState;
