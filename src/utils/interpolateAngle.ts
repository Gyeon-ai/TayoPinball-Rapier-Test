/** Interpolate adjacent physics poses without jumping at Rapier's +/-PI wrap. */
export function interpolateAngle(previous: number, current: number, alpha: number): number {
  if (previous === current) return current;
  const delta = current - previous;
  return previous + Math.atan2(Math.sin(delta), Math.cos(delta)) * Math.max(0, Math.min(1, alpha));
}
