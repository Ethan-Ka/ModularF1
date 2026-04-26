export const RACE_POINTS_BY_POSITION: Record<number, number> = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
}

export function getRacePoints(position: number): number {
  return RACE_POINTS_BY_POSITION[position] ?? 0
}
