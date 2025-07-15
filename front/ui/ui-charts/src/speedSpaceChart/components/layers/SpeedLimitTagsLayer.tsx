import React, { useEffect, useRef, useState } from 'react';

import type { Store, tooltipInfos } from '../../types';
import Tooltip from '../common/Tooltip';
import { LINEAR_LAYERS_HEIGHTS } from '../const';
import { drawSpeedLimitTags, computeTooltip } from '../helpers/drawElements/speedLimitTags';
import { createSvgBlobUrl, loadSvgImage } from '../utils';

type SpeedLimitTagsLayerProps = {
  width: number;
  marginTop: number;
  store: Store;
};
type LoadedImages = {
  questionImage: HTMLImageElement | null;
  alertFillImage: HTMLImageElement | null;
};
const TOOLTIP_HEIGHT = 40;
const MARGIN_ADJUSTMENT = 2;

const SpeedLimitTagsLayer = ({ width, marginTop, store }: SpeedLimitTagsLayerProps) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tooltip = useRef<tooltipInfos | null>(null);
  const [images, setImages] = useState<LoadedImages>({ questionImage: null, alertFillImage: null });

  useEffect(() => {
    const fetchImages = async () => {
      const questionSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M6.92 6.085h.001a.75.75 0 1 1-1.342-.67c.169-.339.436-.701.849-.977C6.845 4.16 7.369 4 8 4a2.76 2.76 0 0 1 1.637.525c.503.377.863.965.863 1.725 0 .448-.115.83-.329 1.15-.205.307-.47.513-.692.662-.109.072-.22.138-.313.195l-.006.004a6 6 0 0 0-.26.16 1 1 0 0 0-.276.245.75.75 0 0 1-1.248-.832c.184-.264.42-.489.692-.661q.154-.1.313-.195l.007-.004c.1-.061.182-.11.258-.161a1 1 0 0 0 .277-.245C8.96 6.514 9 6.427 9 6.25a.61.61 0 0 0-.262-.525A1.27 1.27 0 0 0 8 5.5c-.369 0-.595.09-.74.187-.146.1-.263.238-.34.398M9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/></svg>';
      const alertFillSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" width = "16" height = "16" viewBox = "0 0 16 16" > <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575zM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5m1 6a1 1 0 1 0-2 0 1 1 0 0 0 2 0" /> </svg>';
      const questionBlobUrl = createSvgBlobUrl(questionSvg);
      const alertFillBlobUrl = createSvgBlobUrl(alertFillSvg);
      const questionImage = await loadSvgImage(questionBlobUrl);
      const alertFillImage = await loadSvgImage(alertFillBlobUrl);
      setImages({ questionImage, alertFillImage });
    };
    fetchImages();
  }, []);

  useEffect(() => {
    const updateCanvas = async () => {
      const currentCanvas = canvas.current as HTMLCanvasElement;
      const ctx = currentCanvas.getContext('2d') as CanvasRenderingContext2D;
      const restrictedStore = {
        speedLimitTags: store.speedLimitTags,
        ratioX: store.ratioX,
        leftOffset: store.leftOffset,
        layersDisplay: {
          electricalProfiles: store.layersDisplay.electricalProfiles,
          powerRestrictions: store.layersDisplay.powerRestrictions,
        },
        speeds: store.speeds,
      };
      await drawSpeedLimitTags({
        ctx,
        width,
        height: marginTop,
        store: restrictedStore,
        images,
      });
    };
    updateCanvas();
  }, [
    width,
    marginTop,
    store.speedLimitTags,
    store.ratioX,
    store.leftOffset,
    store.layersDisplay.electricalProfiles,
    store.layersDisplay.powerRestrictions,
    store.speeds,
    images,
  ]);

  useEffect(() => {
    const updateTooltip = async () => {
      const currentCanvas = canvas.current as HTMLCanvasElement;
      const ctx = currentCanvas.getContext('2d') as CanvasRenderingContext2D;
      tooltip.current = await computeTooltip({ ctx, width, height: marginTop, store });
    };
    updateTooltip();
  }, [width, marginTop, store]);

  return (
    <>
      <canvas
        id="speed-limit-tags-layer"
        className="absolute"
        ref={canvas}
        width={width}
        height={LINEAR_LAYERS_HEIGHTS.SPEED_LIMIT_TAGS_HEIGHT}
        style={{ marginTop }}
      />
      {tooltip.current && (
        <Tooltip
          cursorX={tooltip.current.cursorX}
          cursorY={marginTop - TOOLTIP_HEIGHT - MARGIN_ADJUSTMENT}
          height={TOOLTIP_HEIGHT}
          text={tooltip.current.text}
        />
      )}
    </>
  );
};

export default SpeedLimitTagsLayer;
