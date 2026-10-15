/** Momentul cererii (ms), pentru componentele server care compară cu „acum" (o singură citire pe randare). */
export function requestTime(): number {
  return Date.now();
}
