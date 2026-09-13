import { describe, expect, it } from "vitest";
import { aggregateGridMetrics, createGrid, positionBand } from "./local-seo";

describe("local SEO GeoGrid", () => {
  it("creates a centered odd-sized grid", () => {
    const grid = createGrid(3, { latitude: -25.43, longitude: -49.27 });
    expect(grid).toHaveLength(9);
    expect(grid[4]).toMatchObject({ row: 1, column: 1, latitude: -25.43, longitude: -49.27 });
  });

  it("aggregates ranking metrics and bands", () => {
    const metrics = aggregateGridMetrics([{ position: 1 }, { position: 5 }, { position: 18 }, { position: null }]);
    expect(metrics).toEqual({ averagePosition: 8, bestPosition: 1, worstPosition: 18, top3Percent: 33.33, top10Percent: 66.67, top20Percent: 100 });
    expect(positionBand(2)).toBe("green");
    expect(positionBand(8)).toBe("yellow");
    expect(positionBand(15)).toBe("orange");
    expect(positionBand(21)).toBe("red");
  });
});
