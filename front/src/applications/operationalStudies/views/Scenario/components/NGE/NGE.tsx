import { useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { EMPTY_DTO } from './consts';
import type { NetzgrafikDto, NGEEvent } from './types';

type NGEElement = HTMLElement & {
  language: string;
  netzgrafikDto: NetzgrafikDto;
};

type NGEProps = {
  dto?: NetzgrafikDto;
  onOperation?: (op: NGEEvent, netzgrafikDto: NetzgrafikDto) => void;
  onLoad?: () => void;
};

/**
 * Standalone NetzGraphik Editor component.
 *
 * Abstracts away low-level NGE details. Doesn't contain any OSRD-specific
 * logic.
 */
const NGE = ({ dto, onOperation, onLoad }: NGEProps) => {
  const { i18n } = useTranslation();

  const frameRef = useRef<HTMLIFrameElement>(null);

  const [ngeRootElement, setNgeRootElement] = useState<NGEElement | null>(null);

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
      // eslint-disable-next-line react-hooks-js/immutability
      ngeRootElement.language = i18n.language;
    }
  }, [i18n.language, ngeRootElement]);

  useEffect(() => {
    if (ngeRootElement && dto) {
      // eslint-disable-next-line react-hooks-js/immutability
      ngeRootElement.netzgrafikDto = dto;
    }
  }, [dto, ngeRootElement]);

  useEffect(() => {
    if (ngeRootElement && onOperation) {
      const fnOpListener = (event: Event) => {
        const customEvent = event as CustomEvent;
        const op = customEvent.detail as NGEEvent;
        if (onOperation) onOperation(op, ngeRootElement.netzgrafikDto);
      };
      ngeRootElement.addEventListener('operation', fnOpListener);
      return () => {
        ngeRootElement.removeEventListener('operation', fnOpListener);
      };
    }
    return () => {};
  }, [onOperation, ngeRootElement]);

  return (
    <iframe
      ref={frameRef}
      src="/netzgrafik-frontend/index.html"
      title="NGE"
      className="nge-iframe-container"
    />
  );
};

export default NGE;
