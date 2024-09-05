import { useCallback } from 'react';

import { MdFullscreen } from 'react-icons/md';

import { useAppDispatch } from 'store';

const ButtonFullscreen = ({ onClick }: { onClick: () => void }) => (
  <button type="button" className="btn-rounded btn-rounded-white btn-fullscreen" onClick={onClick}>
    <span className="sr-only">Fullscreen</span>
    <MdFullscreen />
  </button>
);

const ButtonFullscreenState = () => {
  const dispatch = useAppDispatch();

  const onClick = useCallback(() => {
    dispatch({ type: 'TOGGLE_FULLSCREEN' });
  }, [dispatch]);

  return <ButtonFullscreen onClick={onClick} />;
};

export default ButtonFullscreenState;
