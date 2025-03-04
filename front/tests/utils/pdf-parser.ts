import { expect } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

import type { PdfSimulationContent } from './types';

export async function parsePdfText(buffer: Buffer) {
  const doc = await getDocument(new Uint8Array(buffer.buffer)).promise;
  let fullText = '';
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    let prevY = 0;
    for (const item of textContent.items) {
      if (!('str' in item)) {
        continue;
      }
      // transform contains a matrix
      const y = item.transform[5];
      if (prevY !== 0 && prevY !== y) {
        fullText += '\n';
      }
      fullText += item.str;
      prevY = y;
    }
    fullText += '\n\n';
  }
  return fullText;
}

/**
 * Verify the PDF content against the expected simulation.
 * @param pdfText The text extracted from the PDF.
 * @param expectedSimulation The expected simulation data.
 */
export function verifySimulationContent(pdfText: string, expectedSimulation: PdfSimulationContent) {
  const textChecks = [
    expectedSimulation.header.toolDescription,
    expectedSimulation.header.documentTitle,
    expectedSimulation.applicationDate,
    expectedSimulation.applicationDateValue,
    expectedSimulation.trainDetails.compositionCode,
    expectedSimulation.trainDetails.compositionCodeValue,
    expectedSimulation.trainDetails.towedMaterial,
    expectedSimulation.trainDetails.towedMaterialValue,
    expectedSimulation.trainDetails.maxSpeed,
    expectedSimulation.trainDetails.maxSpeedValue,
    expectedSimulation.trainDetails.maxTonnage,
    expectedSimulation.trainDetails.maxTonnageValue,
    expectedSimulation.trainDetails.referenceEngine,
    expectedSimulation.trainDetails.referenceEngineValue,
    expectedSimulation.trainDetails.maxLength,
    expectedSimulation.trainDetails.maxLengthValue,
    expectedSimulation.simulationDetails.totalDistance,
    ...Object.values(expectedSimulation.requestedRoute).flatMap((route) =>
      [
        route.name,
        route.ch,
        route.arrivalTime,
        route.plusTolerance,
        route.minusTolerance,
        route.stop,
        route.departureTime,
        route.reason,
      ].filter(Boolean)
    ),
    ...Object.values(expectedSimulation.simulationDetails.simulationRoute).flatMap((route) =>
      [
        route.name,
        route.ch,
        route.track,
        route.arrivalTime,
        route.passageTime,
        route.departureTime,
        route.tonnage,
        route.length,
        route.referenceEngine,
        route.stopType,
      ].filter(Boolean)
    ),
    expectedSimulation.simulationDetails.disclaimer,
  ];
  textChecks.forEach((check) => expect(pdfText).toContain(check));
}
