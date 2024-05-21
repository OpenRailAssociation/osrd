function generateRandomString(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

// TODO: The number must be calculated from a hash of stdcm inputs (to have a stable number). It is currently generated randomly, so there could be duplicates.
export function generateCodeNumber(): string {
  const currentDate = new Date();
  const year = currentDate.getFullYear().toString().substr(-2);
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const randomPart1 = generateRandomString(3);
  const randomPart2 = generateRandomString(3);
  return `${month}${year}-${randomPart1}-${randomPart2}`;
}

export function formatCreationDate(date: string) {
  const creationDate = new Date(date);
  const day = creationDate.getDate();
  const month = creationDate.getMonth() + 1;
  const year = creationDate.getFullYear();
  const hours = creationDate.getHours();
  const minutes = creationDate.getMinutes();

  const formattedDay = day < 10 ? `0${day}` : day;
  const formattedMonth = month < 10 ? `0${month}` : month;
  const formattedHours = hours < 10 ? `0${hours}` : hours;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;

  return {
    day: formattedDay,
    month: formattedMonth,
    year,
    hours: formattedHours,
    minutes: formattedMinutes,
  };
}

export function extractSpeedLimit(speedLimitByTag: string): string {
  const parts = speedLimitByTag.split(' - ');
  return parts.length > 1 ? parts[1] : speedLimitByTag;
}
