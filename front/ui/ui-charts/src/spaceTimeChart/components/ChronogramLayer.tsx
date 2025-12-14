import { useCallback } from 'react';

import type { DrawingFunction } from '../../common/types';
import { useDraw } from '../../common/useCanvas';
import { SpaceTimeChartCanvasContext } from '../lib/context';
import type { SpaceTimeChartContextType } from '../lib/types';

export type Block = {
  startTime: number;
  endTime: number;
};

export type LevelCrossingOccupancy = {
  spaceStart: number;
  spaceEnd: number;
  occupancy: Block[][];
};

export type ChronogramLayerProps = {
  data?: LevelCrossingOccupancy[];
};

const drawStripedBlock = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  if (width <= 0 || height <= 0) return;

  // On s'adapte un peu à la hauteur du bloc
  const stripeWidth = Math.max(6, height / 8); // épaisseur des rayures
  const stripeSpacing = stripeWidth * 4; // espace entre deux rayures

  ctx.save();

  // On clippe tout ce qu'on dessine à l'intérieur du bloc
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();

  // Fond blanc
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, width, height);

  // Rayures rouges diagonales
  ctx.strokeStyle = '#d8342a';
  ctx.lineWidth = 9;

  for (let offset = -height; offset < width + height; offset += stripeSpacing) {
    ctx.beginPath();
    ctx.moveTo(x + offset, y + height + 2);
    ctx.lineTo(x + offset + height, y - 2);
    ctx.stroke();
  }

  ctx.restore(); // on enlève le clip

  // Bordure noire par-dessus
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
};

const fakeLevelCrossingData: LevelCrossingOccupancy[] = [
  {
    // PN 1
    spaceStart: 1000000, // Distance en mm
    spaceEnd: 1200000,
    occupancy: [
      [
        {
          startTime: +new Date('2025-12-10T00:00:00Z'),
          endTime: +new Date('2025-12-10T00:03:00Z'),
        },
      ], // Timestamp en ms

      [
        {
          startTime: +new Date('2025-12-10T00:20:00Z'),
          endTime: +new Date('2025-12-10T00:25:00Z'),
        },
        {
          startTime: +new Date('2025-12-10T00:25:10Z'),
          endTime: +new Date('2025-12-10T00:25:50Z'),
        },
      ],

      [
        {
          startTime: +new Date('2025-12-10T00:30:00Z'),
          endTime: +new Date('2025-12-10T00:35:00Z'),
        },
      ],
    ],
  },

  {
    // PN 2
    spaceStart: 3000000,
    spaceEnd: 3200000,
    occupancy: [
      [
        {
          startTime: +new Date('2025-12-10T00:02:30Z'),
          endTime: +new Date('2025-12-10T00:04:30Z'),
        },
        {
          startTime: +new Date('2025-12-10T00:04:40Z'),
          endTime: +new Date('2025-12-10T00:05:50Z'),
        },
      ],

      [
        {
          startTime: +new Date('2025-12-10T00:10:40Z'),
          endTime: +new Date('2025-12-10T00:12:35Z'),
        },
      ],
      [
        {
          startTime: +new Date('2025-12-10T00:15:00Z'),
          endTime: +new Date('2025-12-10T00:18:00Z'),
        },
        {
          startTime: +new Date('2025-12-10T00:18:15Z'),
          endTime: +new Date('2025-12-10T00:19:30Z'),
        },
      ],

      [
        {
          startTime: +new Date('2025-12-10T00:25:00Z'),
          endTime: +new Date('2025-12-10T00:26:30Z'),
        },
      ],
    ],
  },

  /*{
    // PN 3
    spaceStart: 3000000,
    spaceEnd: 3080000,
    occupancy: [
      [
        { startTime: 50000, endTime: 53000 },
        { startTime: 54000, endTime: 57000 },
        { startTime: 58000, endTime: 60000 },
      ],

      [{ startTime: 65000, endTime: 70000 }],
    ],
  },*/
];

export const ChronogramLayer = ({ data = fakeLevelCrossingData }: ChronogramLayerProps) => {
  const drawChronogramLayer = useCallback<DrawingFunction<SpaceTimeChartContextType>>(
    (ctx, { getTimePixel, getSpacePixel }) => {
      if (!data.length) return;
      const { width } = ctx.canvas.getBoundingClientRect();

      for (const levelCrossing of data) {
        const { spaceStart, spaceEnd, occupancy } = levelCrossing;
        if (!occupancy || !occupancy.length) continue;

        // Aplatir tous les blocks pour calculer min/max temps du PN
        const flatBlocks = occupancy.flat();
        if (!flatBlocks.length) continue;

        const bandTop = getSpacePixel(spaceStart);
        const bandBottom = getSpacePixel(spaceEnd);
        const bandHeight = bandBottom - bandTop;

        // --- 1) 4 lignes horizontales (voies) ---

        const lineYs = [
          bandTop,
          bandTop + bandHeight / 3,
          bandTop + (2 * bandHeight) / 3,
          bandBottom,
        ];

        ctx.strokeStyle = '#08080881';
        ctx.lineWidth = 1;

        lineYs.forEach((y) => {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        });

        // --- 2) Blocs rayés + blocs noirs de jointure ---

        // Chaque sous-array = une séquence de fermetures reliées entre elles
        for (const blocks of occupancy) {
          if (!blocks.length) continue;

          let previousBlock: Block | undefined;

          for (const block of blocks) {
            const xStart = getTimePixel(block.startTime);
            const xEnd = getTimePixel(block.endTime);
            const blocWidth = xEnd - xStart;
            if (blocWidth <= 0) continue;

            // Bloc noir de jointure si on a un bloc précédent dans la même séquence
            if (previousBlock) {
              const gapStartX = getTimePixel(previousBlock.endTime);
              const gapEndX = getTimePixel(block.startTime);
              const gapWidth = gapEndX - gapStartX;

              if (gapWidth > 0) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(gapStartX, bandTop - 1, gapWidth, bandHeight + 1);
              }
            }

            drawStripedBlock(ctx, xStart, bandTop, blocWidth, bandHeight);

            previousBlock = block;
          }
        }
      }
    },
    [data]
  );

  useDraw(SpaceTimeChartCanvasContext, 'background', drawChronogramLayer);

  return null;
};
