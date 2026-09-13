export type GridSize = 3 | 5 | 7 | 9 | 11;

export interface GridPoint {
  row: number;
  column: number;
  latitude: number;
  longitude: number;
  position: number | null;
}

export interface GridMetrics {
  averagePosition: number | null;
  bestPosition: number | null;
  worstPosition: number | null;
  top3Percent: number;
  top10Percent: number;
  top20Percent: number;
}

export function createGrid(size: GridSize, center: { latitude: number; longitude: number }, step = 0.002): GridPoint[] {
  const offset = Math.floor(size / 2);
  return Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const column = index % size;
    return {
      row,
      column,
      latitude: center.latitude + (row - offset) * step,
      longitude: center.longitude + (column - offset) * step,
      position: null,
    };
  });
}

export function aggregateGridMetrics(points: readonly Pick<GridPoint, "position">[]): GridMetrics {
  const positions = points.map((point) => point.position).filter((position): position is number => position !== null && position > 0);
  if (positions.length === 0) return { averagePosition: null, bestPosition: null, worstPosition: null, top3Percent: 0, top10Percent: 0, top20Percent: 0 };
  const percent = (limit: number): number => Math.round((positions.filter((position) => position <= limit).length / positions.length) * 10000) / 100;
  return {
    averagePosition: Math.round((positions.reduce((sum, position) => sum + position, 0) / positions.length) * 100) / 100,
    bestPosition: Math.min(...positions),
    worstPosition: Math.max(...positions),
    top3Percent: percent(3),
    top10Percent: percent(10),
    top20Percent: percent(20),
  };
}

export function positionBand(position: number | null): "green" | "yellow" | "orange" | "red" | "unknown" {
  if (position === null || position <= 0) return "unknown";
  if (position <= 3) return "green";
  if (position <= 10) return "yellow";
  if (position <= 20) return "orange";
  return "red";
}
