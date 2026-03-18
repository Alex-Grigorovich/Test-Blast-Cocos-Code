import { GameConfig, BoardValue } from './GameConfig';

export type Cell = [number, number];

export class GameBoard {
    private grid: number[][];
    private readonly rows: number;
    private readonly cols: number;
    private readonly colors: number;

    constructor(rows: number = GameConfig.ROWS, cols: number = GameConfig.COLS, colorCount: number = GameConfig.COLORS) {
        this.rows = rows;
        this.cols = cols;
        this.colors = colorCount;
        this.grid = [];
        this.fillWithRandom();
    }

    getRows(): number { return this.rows; }
    getCols(): number { return this.cols; }
    getColors(): number { return this.colors; }

    getAt(row: number, col: number): BoardValue {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return -1;
        const v = this.grid[row][col];
        if (v == null) return -1;
        const n = typeof v === 'number' && !isNaN(v) ? v : Number(v);
        return (isNaN(n) ? -1 : Math.floor(n)) as BoardValue;
    }

    isNormal(value: number): boolean { return value >= 0 && value <= 4; }
    isSpecial(value: number): boolean { return value >= 5 && value <= 11; }

    isTeleport(value: number): boolean { return value === GameConfig.TILE_TELEPORT; }

    setAt(row: number, col: number, value: number): void {
        if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
            const n = typeof value === 'number' && !isNaN(value) ? value : Number(value);
            this.grid[row][col] = Math.floor(n);
        }
    }

    fillWithRandom(): void {
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.grid[r][c] = Math.floor(Math.random() * this.colors);
            }
        }
        const n = GameConfig.INITIAL_BOMB_COUNT || 0;
        if (n <= 0) return;
        const bombTypes = [GameConfig.TILE_ROCKET_H, GameConfig.TILE_ROCKET_V, GameConfig.TILE_BOMB, GameConfig.TILE_BOMB_MAX];
        let placed = 0;
        for (let i = 0; i < 200 && placed < n; i++) {
            const r = Math.floor(Math.random() * this.rows);
            const c = Math.floor(Math.random() * this.cols);
            if (this.grid[r][c] >= 0 && this.grid[r][c] <= 4) {
                this.grid[r][c] = bombTypes[Math.floor(Math.random() * bombTypes.length)];
                placed++;
            }
        }
    }

    private getNeighbors(row: number, col: number): Cell[] {
        const out: Cell[] = [];
        const d: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of d) {
            const r = row + dr, c = col + dc;
            if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) out.push([r, c]);
        }
        return out;
    }

    getConnectedGroup(row: number, col: number): Cell[] {
        const raw = this.getAt(row, col);
        const color = typeof raw === 'number' && !isNaN(raw) ? raw : Number(raw);
        if (!this.isNormal(color)) return [];
        const group: Cell[] = [];
        const visited = new Set<string>();
        const key = (r: number, c: number) => `${r},${c}`;
        const dfs = (r: number, c: number) => {
            const cellRaw = this.getAt(r, c);
            const cellColor = typeof cellRaw === 'number' && !isNaN(cellRaw) ? cellRaw : Number(cellRaw);
            if (cellColor !== color) return;
            const k = key(r, c);
            if (visited.has(k)) return;
            visited.add(k);
            group.push([r, c]);
            for (const [nr, nc] of this.getNeighbors(r, c)) dfs(nr, nc);
        };
        dfs(row, col);
        return group;
    }

    getConnectedBombGroup(row: number, col: number): Cell[] {
        const v = this.getAt(row, col);
        if (v < GameConfig.TILE_ROCKET_H || v > GameConfig.TILE_BOMB_MAX) return [];
        const group: Cell[] = [];
        const visited = new Set<string>();
        const key = (r: number, c: number) => `${r},${c}`;
        const dfs = (r: number, c: number) => {
            const cellVal = this.getAt(r, c);
            if (cellVal < GameConfig.TILE_ROCKET_H || cellVal > GameConfig.TILE_BOMB_MAX) return;
            const k = key(r, c);
            if (visited.has(k)) return;
            visited.add(k);
            group.push([r, c]);
            for (const [nr, nc] of this.getNeighbors(r, c)) dfs(nr, nc);
        };
        dfs(row, col);
        return group;
    }

    getNeighborGroupSameColor(row: number, col: number): Cell[] {
        const color = this.getAt(row, col);
        if (!this.isNormal(color)) return [];
        const out: Cell[] = [[row, col]];
        for (const [r, c] of this.getNeighbors(row, col)) {
            if (this.getAt(r, c) === color) out.push([r, c]);
        }
        return out;
    }

    getSpecialEffectCells(row: number, col: number): Cell[] {
        const v = this.getAt(row, col);
        if (!this.isSpecial(v)) return [];
        const out: Cell[] = [];
        if (v === GameConfig.TILE_ROCKET_H) {
            for (let c = 0; c < this.cols; c++) out.push([row, c]);
        } else if (v === GameConfig.TILE_ROCKET_V) {
            for (let r = 0; r < this.rows; r++) out.push([r, col]);
        } else if (v === GameConfig.TILE_BOMB) {
            const R = GameConfig.BOMB_RADIUS;
            for (let dr = -R; dr <= R; dr++)
                for (let dc = -R; dc <= R; dc++) {
                    const r = row + dr, c = col + dc;
                    if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) out.push([r, c]);
                }
        } else if (v === GameConfig.TILE_BOMB_MAX) {
            const R = GameConfig.BOMB_MAX_RADIUS;
            for (let dr = -R; dr <= R; dr++)
                for (let dc = -R; dc <= R; dc++) {
                    const r = row + dr, c = col + dc;
                    if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) out.push([r, c]);
                }
        } else if (v === GameConfig.TILE_CLEAR_ALL || v === GameConfig.TILE_BOMB_CLEAR_FIELD) {
            for (let r = 0; r < this.rows; r++)
                for (let c = 0; c < this.cols; c++) out.push([r, c]);
        }
        return out;
    }

    getBombEffectCells(row: number, col: number, radius: number = GameConfig.BOMB_RADIUS): Cell[] {
        const out: Cell[] = [];
        for (let dr = -radius; dr <= radius; dr++)
            for (let dc = -radius; dc <= radius; dc++) {
                const r = row + dr, c = col + dc;
                if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) out.push([r, c]);
            }
        return out;
    }

    getCellsInRadiusAroundGroup(group: Cell[], radius: number = GameConfig.BOMB_RADIUS): Cell[] {
        const set = new Set<string>();
        const key = (r: number, c: number) => `${r},${c}`;
        for (const [r, c] of group) {
            for (const cell of this.getBombEffectCells(r, c, radius)) set.add(key(cell[0], cell[1]));
        }
        return Array.from(set).map(s => { const [r, c] = s.split(',').map(Number); return [r, c] as Cell; });
    }

    getUnionEffectCellsForBombGroup(group: Cell[]): Cell[] {
        const set = new Set<string>();
        const key = (r: number, c: number) => `${r},${c}`;
        for (const [r, c] of group) {
            const effect = this.getSpecialEffectCells(r, c);
            for (const cell of effect) set.add(key(cell[0], cell[1]));
        }
        return Array.from(set).map(s => { const [r, c] = s.split(',').map(Number); return [r, c] as Cell; });
    }

    private getEffectCellsForValue(row: number, col: number, v: number): Cell[] {
        if (v === GameConfig.TILE_ROCKET_H) {
            const out: Cell[] = [];
            for (let c = 0; c < this.cols; c++) out.push([row, c]);
            return out;
        }
        if (v === GameConfig.TILE_ROCKET_V) {
            const out: Cell[] = [];
            for (let r = 0; r < this.rows; r++) out.push([r, col]);
            return out;
        }
        if (v === GameConfig.TILE_BOMB) {
            return this.getBombEffectCells(row, col, GameConfig.BOMB_RADIUS);
        }
        if (v === GameConfig.TILE_BOMB_MAX) {
            return this.getBombEffectCells(row, col, GameConfig.BOMB_MAX_RADIUS);
        }
        if (v === GameConfig.TILE_CLEAR_ALL || v === GameConfig.TILE_BOMB_CLEAR_FIELD) {
            const out: Cell[] = [];
            for (let r = 0; r < this.rows; r++)
                for (let c = 0; c < this.cols; c++) out.push([r, c]);
            return out;
        }
        return [];
    }

    getCellsWithChainReaction(initialCells: Cell[]): Cell[] {
        const key = (r: number, c: number) => `${r},${c}`;
        const seen = new Set<string>();
        const queue: Cell[] = [];
        for (const [r, c] of initialCells) {
            const k = key(r, c);
            if (seen.has(k)) continue;
            seen.add(k);
            queue.push([r, c]);
        }
        let idx = 0;
        while (idx < queue.length) {
            const [r, c] = queue[idx++];
            const v = this.getAt(r, c);
            if (!this.isSpecial(v)) continue;
            const extra = this.getEffectCellsForValue(r, c, v);
            for (const [er, ec] of extra) {
                const kk = key(er, ec);
                if (seen.has(kk)) continue;
                seen.add(kk);
                queue.push([er, ec]);
            }
        }
        return Array.from(seen).map(k => {
            const [r, c] = k.split(',').map(Number);
            return [r, c] as Cell;
        });
    }

    swap(row1: number, col1: number, row2: number, col2: number): void {
        if (row1 < 0 || row1 >= this.rows || col1 < 0 || col1 >= this.cols) return;
        if (row2 < 0 || row2 >= this.rows || col2 < 0 || col2 >= this.cols) return;
        const t = this.grid[row1][col1];
        this.grid[row1][col1] = this.grid[row2][col2];
        this.grid[row2][col2] = t;
    }

    shuffle(): void {
        this.fillWithRandom();
    }

    shuffleUntilValid(maxAttempts: number = 120): void {
        for (let i = 0; i < maxAttempts; i++) {
            this.fillWithRandom();
            if (this.hasValidMove()) return;
        }
        this.forceAdjacentPairForValidMove();
    }

    private forceAdjacentPairForValidMove(): void {
        this.fillWithRandom();
        const color = Math.floor(Math.random() * this.colors);
        const r = this.rows - 1;
        const c = this.cols - 1;
        this.grid[r][c] = color;
        this.grid[r][c - 1] = color;
    }

    burnCells(cells: Cell[]): number {
        let count = 0;
        for (const [r, c] of cells) {
            if (this.getAt(r, c) >= 0) {
                this.setAt(r, c, -1);
                count++;
            }
        }
        return count;
    }

    burnCellsAndSpawnSpecial(cells: Cell[], spawnAt: Cell, specialType: number): number {
        const count = this.burnCells(cells);
        this.setAt(spawnAt[0], spawnAt[1], specialType);
        return count;
    }

    applyGravity(): void {
        for (let c = 0; c < this.cols; c++) {
            let write = 0;
            for (let r = 0; r < this.rows; r++) {
                const v = this.grid[r][c];
                if (v >= 0) {
                    if (write !== r) {
                        this.grid[write][c] = v;
                        this.grid[r][c] = -1;
                    }
                    write++;
                }
            }
            for (let r = write; r < this.rows; r++) this.grid[r][c] = -1;
        }
    }

    refill(): void {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] === -1) {
                    this.grid[r][c] = Math.floor(Math.random() * this.colors);
                }
            }
        }
    }

    hasValidMove(): boolean {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const v = this.getAt(r, c);
                if (v < 0) continue;
                if (this.isSpecial(v)) return true;
                if (this.getConnectedGroup(r, c).length >= GameConfig.MIN_GROUP_SIZE) return true;
            }
        }
        return false;
    }

    getGridSnapshot(): number[][] {
        return this.grid.map(row => [...row]);
    }
}
