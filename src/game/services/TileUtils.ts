import type { Tile } from '../types';

export function cloneTileRows(tiles: Tile[][], rows: number[] | Set<number>): Tile[][] {
  const rowSet = rows instanceof Set ? rows : new Set(rows);
  return tiles.map((row, r) => (rowSet.has(r) ? row.map(t => ({ ...t })) : row));
}

export function cloneAllTiles(tiles: Tile[][]): Tile[][] {
  return tiles.map(row => row.map(t => ({ ...t })));
}
