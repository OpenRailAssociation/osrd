import { SECOND } from "../../common/consts";

export function formatDuration(start: number, end: number): string {
  const totalSeconds = Math.floor((end - start) / SECOND);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m${String(seconds).padStart(2, '0')}s`;
}
