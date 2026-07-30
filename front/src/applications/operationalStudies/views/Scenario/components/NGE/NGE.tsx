import { useEffect, useRef, useState } from 'react';

import type { NetzgrafikDto, Operation } from '@osrd-project/netzgrafik-frontend';
import { useTranslation } from 'react-i18next';

import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure, getErrorMessage } from 'utils/error';

import { EMPTY_DTO } from './consts';

type NGEElement = HTMLElement & {
  language: string;
  netzgrafikDto: NetzgrafikDto;
  activeFilterSettingId: number;
};

type NGEProps = {
  activeFilterSettingId?: number;
  dto?: NetzgrafikDto;
  onOperation?: (op: Operation, netzgrafikDto: NetzgrafikDto) => void;
  onLoad?: () => void;
};

const frameSrc = `
<!DOCTYPE html>
<html class="sbb-lean sbb-light">
  <head>
    <base href="/netzgrafik-frontend/">
    <link rel="stylesheet" href="/netzgrafik-frontend/styles.css"></link>
    <script type="module" src="/netzgrafik-frontend/polyfills.js"></script>
    <script type="module" src="/netzgrafik-frontend/main.js"></script>
  </head>
  <body></body>
</html>
`;

/**
 * Standalone NetzGraphik Editor component.
 *
 * Abstracts away low-level NGE details. Doesn't contain any OSRD-specific
 * logic.
 */
const NGE = ({ activeFilterSettingId, dto, onOperation, onLoad }: NGEProps) => {
  const { i18n } = useTranslation();
  const dispatch = useAppDispatch();

  const frameRef = useRef<HTMLIFrameElement>(null);

  const [ngeRootElement, setNgeRootElement] = useState<NGEElement | null>(null);
  const [ngeError, setNgeError] = useState<unknown>();

  useEffect(() => {
    const frame = frameRef.current!;

    const handleFrameLoad = () => {
      // Set the initial DTO as an empty state to avoid blinking with the
      // default sample nodes
      const ngeRoot = frame.contentDocument!.createElement('sbb-root') as NGEElement;
      ngeRoot.netzgrafikDto = EMPTY_DTO;
      frame.contentDocument!.body.appendChild(ngeRoot);
      setNgeRootElement(ngeRoot);

      if (onLoad) onLoad();
    };

    frame.addEventListener('load', handleFrameLoad);

    return () => {
      frame.removeEventListener('load', handleFrameLoad);
    };
  }, []);

  useEffect(() => {
    if (ngeRootElement && i18n.language) {
      // eslint-disable-next-line react/immutability
      ngeRootElement.language = i18n.language;
    }
  }, [i18n.language, ngeRootElement]);

  useEffect(() => {
    if (ngeRootElement && dto) {
      try {
        // eslint-disable-next-line react/immutability
        ngeRootElement.netzgrafikDto = dto;
        setNgeError(undefined);
      } catch (error) {
        dispatch(setFailure(castErrorToFailure(error)));
        setNgeError(error);
      }
    }
  }, [dto, ngeRootElement]);

  useEffect(() => {
    if (ngeRootElement && activeFilterSettingId !== undefined) {
      // eslint-disable-next-line react/immutability
      ngeRootElement.activeFilterSettingId = activeFilterSettingId;
    }
  }, [activeFilterSettingId, ngeRootElement]);

  useEffect(() => {
    if (ngeRootElement && onOperation) {
      const fnOpListener = (event: Event) => {
        const customEvent = event as CustomEvent;
        const op = customEvent.detail as Operation;
        if (onOperation) onOperation(op, ngeRootElement.netzgrafikDto);
      };
      ngeRootElement.addEventListener('operation', fnOpListener);
      return () => {
        ngeRootElement.removeEventListener('operation', fnOpListener);
      };
    }
    return () => {};
  }, [onOperation, ngeRootElement]);

  return !ngeError ? (
    <iframe ref={frameRef} srcDoc={frameSrc} title="NGE" className="nge-iframe-container" />
  ) : (
    <div title="NGE" className="nge-error-container">
      {getErrorMessage(ngeError)}
    </div>
  );
};

export default NGE;
