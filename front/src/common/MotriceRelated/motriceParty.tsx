import party from 'party-js';

export default function motriceParty() {
  const listOfShapes: string[] = [];
  for (let i = 0; i <= 21; i += 1) {
    party.resolvableShapes[`motrice${i}`] = `<img src="/pictures/minimotrices/motrice_${i}.png" />`;
    // listOfShapes.push(`motrice${i}`);
  }
  listOfShapes.push('motrice7', 'motrice12', 'motrice14');
  party.confetti(document.body, {
    shapes: listOfShapes,
    count: party.variation.range(30, 500),
    size: party.variation.range(0.1, 1),
    speed: party.variation.range(50, 600),
  });
}
