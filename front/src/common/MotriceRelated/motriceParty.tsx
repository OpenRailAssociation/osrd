import { confetti, range, spread } from 'party-js';

export default function motriceParty(ref: React.RefObject<HTMLImageElement | null>) {
  if (!ref.current) return;

  confetti(ref.current, {
    shapes: [
      { type: 'image', image: `/pictures/minimotrices/motrice_7.png` },
      { type: 'image', image: `/pictures/minimotrices/motrice_12.png` },
      { type: 'image', image: `/pictures/minimotrices/motrice_14.png` },
    ],
    count: range(30, 500),
    size: range(10, 30),
    startVelocity: range(800, 2000),
    spread: spread(10000, 20000),
  });
}
