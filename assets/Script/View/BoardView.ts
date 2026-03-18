const { ccclass, property } = cc._decorator;
import { GameBoard, Cell } from '../Game/GameBoard';
import { GameConfig } from '../Game/GameConfig';
import TileView, { TILE_COLORS, TileClickCallback } from './TileView';

function isBombIdleType(value: number): boolean {
    return (value >= GameConfig.TILE_ROCKET_H && value <= GameConfig.TILE_BOMB_MAX)
        || value === GameConfig.TILE_BOMB_CLEAR_FIELD;
}

function isClassicBombPrefabTile(value: number): boolean {
    return value >= GameConfig.TILE_ROCKET_H && value <= GameConfig.TILE_BOMB_MAX;
}

const TILE_FRAME_COUNT = 12;

@ccclass
export default class BoardView extends cc.Component {
    @property(cc.Prefab)
    bombTilePrefab: cc.Prefab = null;

    @property(cc.SpriteFrame)
    bombFrame: cc.SpriteFrame = null;

    @property(cc.SpriteFrame)
    bombHorizontalFrame: cc.SpriteFrame = null;

    @property(cc.SpriteFrame)
    bombVerticalFrame: cc.SpriteFrame = null;

    @property([cc.SpriteFrame])
    tileFrames: cc.SpriteFrame[] = [];

    @property(cc.SpriteFrame)
    bombClearFieldFrame: cc.SpriteFrame = null;

    @property
    tileSize: number = 64;

    @property
    spacing: number = 4;

    @property({ tooltip: 'Секунд между повторениями idle-анимации бомб' })
    bombIdleInterval: number = 5;

    @property({ tooltip: 'Длительность одного пульса (сек)' })
    bombIdleAnimDuration: number = 0.35;

    @property({ tooltip: 'Длительность анимации взрыва/исчезновения тайла (сек)' })
    burnAnimDuration: number = 0.28;

    @property(cc.Prefab)
    explosionPrefab: cc.Prefab = null;

    @property({ tooltip: 'Длительность отображения эффекта взрыва (0 = из клипа)' })
    explosionDuration: number = 0;

    @property([cc.Prefab])
    disappearAnimPrefabs: cc.Prefab[] = [];

    @property({ tooltip: 'Длительность анимации исчезновения обычных тайлов (0 = 0.3 с)' })
    disappearAnimDuration: number = 0;

    private board: GameBoard = null;
    private tileNodes: cc.Node[][] = [];
    private tileViews: TileView[][] = [];
    private onClick: TileClickCallback = null;
    private lastGridSnapshot: number[][] | null = null;

    bind(board: GameBoard, onTileClick: TileClickCallback): void {
        this.board = board;
        this.onClick = onTileClick;
        this.lastGridSnapshot = this.board ? this.board.getGridSnapshot() : null;
        this.scheduleOnce(() => this.buildGrid(), 0);
    }

    syncSnapshotWithBoard(): void {
        this.lastGridSnapshot = this.board ? this.board.getGridSnapshot() : null;
    }

    private buildGrid(): void {
        this.clearGrid();
        this.populateGridNodes();
    }

    rebuildGridFromBoard(): void {
        this.clearGrid();
        this.populateGridNodes();
        this.lastGridSnapshot = this.board ? this.board.getGridSnapshot() : null;
    }

    private static readonly FX_Z_INDEX = 50;

    private getGridLayout(): { startX: number; startY: number; step: number; rows: number; cols: number } | null {
        if (!this.board) return null;
        const rows = this.board.getRows();
        const cols = this.board.getCols();
        const totalW = cols * this.tileSize + (cols - 1) * this.spacing;
        const totalH = rows * this.tileSize + (rows - 1) * this.spacing;
        const w = this.node.width || totalW;
        const h = this.node.height || totalH;
        const anchorX = this.node.anchorX != null ? this.node.anchorX : 0.5;
        const anchorY = this.node.anchorY != null ? this.node.anchorY : 0.5;
        const centerX = anchorX === 0.5 ? 0 : w / 2;
        const centerY = anchorY === 0.5 ? 0 : h / 2;
        const startX = centerX - totalW / 2 + this.tileSize / 2;
        const startY = centerY - totalH / 2 + this.tileSize / 2;
        const step = this.tileSize + this.spacing;
        return { startX, startY, step, rows, cols };
    }

    worldPointToCell(world: cc.Vec2): [number, number] | null {
        const L = this.getGridLayout();
        if (!L || !this.node || !this.node.isValid) return null;
        const local = this.node.convertToNodeSpaceAR(world);
        const half = this.tileSize / 2;

        for (let r = 0; r < L.rows; r++) {
            for (let c = 0; c < L.cols; c++) {
                const cx = L.startX + c * L.step;
                const cy = L.startY + r * L.step;
                if (Math.abs(local.x - cx) <= half && Math.abs(local.y - cy) <= half) {
                    return [r, c];
                }
            }
        }

        const minX = L.startX - half;
        const maxX = L.startX + (L.cols - 1) * L.step + half;
        const minY = L.startY - half;
        const maxY = L.startY + (L.rows - 1) * L.step + half;
        if (local.x < minX || local.x > maxX || local.y < minY || local.y > maxY) {
            return null;
        }

        let bestR = 0, bestC = 0;
        let bestD2 = Infinity;
        for (let r = 0; r < L.rows; r++) {
            for (let c = 0; c < L.cols; c++) {
                const cx = L.startX + c * L.step;
                const cy = L.startY + r * L.step;
                const dx = local.x - cx;
                const dy = local.y - cy;
                const d2 = dx * dx + dy * dy;
                if (d2 < bestD2) {
                    bestD2 = d2;
                    bestR = r;
                    bestC = c;
                }
            }
        }
        return [bestR, bestC];
    }

    isTouchInsideTileRect(world: cc.Vec2, row: number, col: number): boolean {
        const L = this.getGridLayout();
        if (!L || row < 0 || col < 0 || row >= L.rows || col >= L.cols) return false;
        const local = this.node.convertToNodeSpaceAR(world);
        const half = this.tileSize / 2;
        const cx = L.startX + col * L.step;
        const cy = L.startY + row * L.step;
        return Math.abs(local.x - cx) <= half && Math.abs(local.y - cy) <= half;
    }

    getCellsRankedByTouchDistance(world: cc.Vec2): [number, number][] {
        const L = this.getGridLayout();
        if (!L || !this.node || !this.node.isValid) return [];
        const local = this.node.convertToNodeSpaceAR(world);
        const arr: { r: number; c: number; d: number }[] = [];
        for (let r = 0; r < L.rows; r++) {
            for (let c = 0; c < L.cols; c++) {
                const cx = L.startX + c * L.step;
                const cy = L.startY + r * L.step;
                const d = (local.x - cx) * (local.x - cx) + (local.y - cy) * (local.y - cy);
                arr.push({ r, c, d });
            }
        }
        arr.sort((a, b) => a.d - b.d);
        return arr.map(x => [x.r, x.c] as [number, number]);
    }

    private populateGridNodes(): void {
        if (!this.board) return;
        const L = this.getGridLayout();
        if (!L) return;
        const { startX, startY, step, rows, cols } = L;

        for (let r = 0; r < rows; r++) {
            this.tileNodes[r] = [];
            this.tileViews[r] = [];
            for (let c = 0; c < cols; c++) {
                const node = this.createTileNode(r, c);
                const x = startX + c * step;
                const y = startY + r * step;
                node.setPosition(cc.v2(x, y));
                this.node.addChild(node);
                this.tileNodes[r][c] = node;
                const tv = node.getComponent(TileView);
                if (tv) this.tileViews[r][c] = tv;
            }
        }
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const value = this.board.getAt(r, c);
                if (isBombIdleType(value)) {
                    const view = this.tileViews[r] && this.tileViews[r][c];
                    if (view) view.setBombIdle(this.bombIdleInterval, this.bombIdleAnimDuration);
                }
            }
        }
    }

    private getAnyBombFrame(): cc.SpriteFrame | null {
        return this.bombFrame || this.bombHorizontalFrame || this.bombVerticalFrame
            || (this.tileFrames && (this.tileFrames[5] || this.tileFrames[6] || this.tileFrames[7] || this.tileFrames[8]))
            || null;
    }

    private getFrameForValue(value: number): cc.SpriteFrame | null {
        if (value < 0 || value >= TILE_FRAME_COUNT) return null;
        
        if (value >= 0 && value < GameConfig.COLORS) {
            return (this.tileFrames && this.tileFrames[value]) || null;
        }
        
        if (value === GameConfig.TILE_ROCKET_H) {
            return this.bombHorizontalFrame || (this.tileFrames && this.tileFrames[5]) || this.getAnyBombFrame();
        }
        
        if (value === GameConfig.TILE_ROCKET_V) {
            return this.bombVerticalFrame || (this.tileFrames && this.tileFrames[6]) || this.getAnyBombFrame();
        }
        
        if (value === GameConfig.TILE_BOMB) {
            return this.bombFrame || (this.tileFrames && this.tileFrames[7]) || this.getAnyBombFrame();
        }
        
        if (value === GameConfig.TILE_BOMB_MAX) {
            return this.bombFrame || (this.tileFrames && this.tileFrames[8]) || this.getAnyBombFrame();
        }

        if (value === GameConfig.TILE_BOMB_CLEAR_FIELD) {
            return this.bombClearFieldFrame || (this.tileFrames && this.tileFrames[11]) || this.getAnyBombFrame();
        }

        if (value >= GameConfig.TILE_ROCKET_H && value <= GameConfig.TILE_BOMB_MAX) {
            return (this.tileFrames && this.tileFrames[value]) || this.getAnyBombFrame();
        }
        
        return (this.tileFrames && this.tileFrames[value]) || null;
    }

    private getColorForValue(value: number): cc.Color {
        if (value >= 0 && value < TILE_COLORS.length) return TILE_COLORS[value];
        return cc.color(255, 255, 255);
    }

    private getAnyTileFrame(): cc.SpriteFrame | null {
        return (this.tileFrames && this.tileFrames[0])
            || (this.bombFrame || this.bombHorizontalFrame || this.bombVerticalFrame)
            || null;
    }

    private createTileNode(row: number, col: number): cc.Node {
        const value = this.board.getAt(row, col);
        const useBombPrefab = isClassicBombPrefabTile(value) && this.bombTilePrefab;
        let node: cc.Node;

        if (useBombPrefab) {
            node = cc.instantiate(this.bombTilePrefab);
            const prefabW = node.width || this.tileSize;
            const prefabH = node.height || this.tileSize;
            if (prefabW > 0 && prefabH > 0) {
                const s = Math.min(this.tileSize / prefabW, this.tileSize / prefabH);
                node.scaleX = s;
                node.scaleY = s;
            }
        } else {
            node = new cc.Node('Tile');
            node.setContentSize(this.tileSize, this.tileSize);
            const sprite = node.addComponent(cc.Sprite);
            let frame = this.getFrameForValue(value);
            if (!frame) {
                if (value >= GameConfig.TILE_ROCKET_H && value <= GameConfig.TILE_BOMB_MAX) frame = this.getAnyBombFrame();
                else if (value === GameConfig.TILE_BOMB_CLEAR_FIELD) frame = this.getAnyBombFrame();
                else frame = this.getAnyTileFrame();
            }
            if (frame) {
                sprite.spriteFrame = frame;
                sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            } else {
                const g = node.addComponent(cc.Graphics);
                g.rect(-this.tileSize / 2, -this.tileSize / 2, this.tileSize, this.tileSize);
                g.fillColor = this.getColorForValue(value);
                g.fill();
            }
            const tv = node.addComponent(TileView);
            (tv as any).sprite = sprite;
        }

        if (!useBombPrefab) node.setContentSize(this.tileSize, this.tileSize);

        const tv = node.getComponent(TileView) || node.addComponent(TileView);
        if (!tv.sprite && node.getComponent(cc.Sprite)) (tv as any).sprite = node.getComponent(cc.Sprite);
        const onClick = (r: number, c: number) => this.onClick && this.onClick(r, c);
        const worldToCell = (w: cc.Vec2) => this.worldPointToCell(w);
        let frame = this.getFrameForValue(value);
        if (!frame) {
            if (value >= GameConfig.TILE_ROCKET_H && value <= GameConfig.TILE_BOMB_MAX) frame = this.getAnyBombFrame();
            else if (value === GameConfig.TILE_BOMB_CLEAR_FIELD) frame = this.getAnyBombFrame();
            else frame = this.getAnyTileFrame();
        }
        const color = value >= 0 && value <= 4 ? cc.color(255, 255, 255) : undefined;

        tv.init(row, col, value, onClick, worldToCell);
        tv.setDisplay(value, frame, color);

        if (isBombIdleType(value)) tv.setBombIdle(this.bombIdleInterval, this.bombIdleAnimDuration);
        else tv.stopBombIdle();

        this.tileViews[row] = this.tileViews[row] || [];
        this.tileViews[row][col] = tv;
        return node;
    }

    private clearGrid(): void {
        for (let r = 0; r < this.tileNodes.length; r++) {
            for (let c = 0; c < (this.tileNodes[r] || []).length; c++) {
                const n = this.tileNodes[r][c];
                if (n && n.isValid) n.destroy();
            }
        }
        this.tileNodes = [];
        this.tileViews = [];
    }

    refresh(): void {
        if (!this.board) return;
        const snapshot = this.board.getGridSnapshot();
        const rows = this.board.getRows();
        const cols = this.board.getCols();
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const value = this.board.getAt(r, c);
                const node = this.tileNodes[r] && this.tileNodes[r][c];
                if (node && node.isValid) {
                    node.active = value >= 0;
                    if (value >= 0) {
                        node.stopAllActions();
                        node.scale = 1;
                        node.opacity = 255;
                    }
                }
                if (value < 0) continue;
                const view = this.tileViews[r] && this.tileViews[r][c];
                if (view) {
                    view.setGridCell(r, c);
                    let frame = this.getFrameForValue(value);
                    if (value >= GameConfig.TILE_ROCKET_H && value <= GameConfig.TILE_BOMB_MAX && !frame) {
                        frame = this.getAnyBombFrame();
                    }
                    const color = value >= 0 && value <= 4 ? cc.color(255, 255, 255) : undefined;
                    view.setDisplay(value, frame, color);
                    if (isBombIdleType(value)) view.setBombIdle(this.bombIdleInterval, this.bombIdleAnimDuration);
                    else view.stopBombIdle();

                    if (this.lastGridSnapshot && node && node.isValid) {
                        const prev = this.lastGridSnapshot[r][c];
                        if (prev !== value && value >= 0) {
                            node.stopAllActions();
                            node.scale = 0.7;
                            node.runAction(cc.scaleTo(0.12, 1).easing(cc.easeBackOut()));
                        }
                    }
                }
            }
        }
        this.lastGridSnapshot = snapshot;
    }

    playBurnAnimation(cells: Cell[], onComplete: () => void, playExplosion: boolean = false): void {
        if (!cells || cells.length === 0) {
            if (onComplete) onComplete();
            return;
        }
        const d = this.burnAnimDuration > 0 ? this.burnAnimDuration : 0.28;
        const t1 = d * 0.4;
        const t2 = d * 0.6;
        const disappearPrefab = !playExplosion ? this.pickDisappearPrefabForInteraction() : null;
        const key = (r: number, c: number) => `${r},${c}`;
        const seen = new Set<string>();
        for (const [r, c] of cells) {
            const k = key(r, c);
            if (seen.has(k)) continue;
            seen.add(k);
            const node = this.tileNodes[r] && this.tileNodes[r][c];
            const view = this.tileViews[r] && this.tileViews[r][c];
            if (!node || !node.isValid) continue;
            if (view && typeof view.stopBombIdle === 'function') view.stopBombIdle();
            if (playExplosion) {
                this.playExplosionAt(node.getPosition());
            } else {
                this.playDisappearAnimAt(node.getPosition(), disappearPrefab);
            }
            node.stopAllActions();
            node.opacity = 255;
            node.runAction(cc.sequence(
                cc.spawn(
                    cc.scaleTo(t1, 1.35).easing(cc.easeBackOut()),
                    cc.delayTime(t1)
                ),
                cc.spawn(
                    cc.scaleTo(t2, 1.75),
                    cc.fadeOut(t2)
                ),
                cc.callFunc(() => {
                    if (node && node.isValid) {
                        node.scale = 1;
                        node.opacity = 255;
                    }
                })
            ));
        }
        this.scheduleOnce(() => {
            if (onComplete) onComplete();
        }, d);
    }

    private playExplosionAt(position: cc.Vec2): void {
        if (!this.explosionPrefab || !this.node || !this.node.isValid) return;
        const explosionNode = cc.instantiate(this.explosionPrefab);
        explosionNode.setPosition(position);
        explosionNode.zIndex = BoardView.FX_Z_INDEX;
        this.node.addChild(explosionNode);
        const anim = explosionNode.getComponent(cc.Animation);
        if (anim) anim.play();
        const duration = this.explosionDuration > 0 ? this.explosionDuration : 0.37;
        this.scheduleOnce(() => {
            if (explosionNode && explosionNode.isValid) explosionNode.destroy();
        }, duration);
    }

    private pickDisappearPrefabForInteraction(): cc.Prefab | null {
        const prefabs = (this.disappearAnimPrefabs || []).filter((p): p is cc.Prefab => p != null);
        if (prefabs.length === 0) return null;
        return prefabs[Math.floor(Math.random() * prefabs.length)];
    }

    private playDisappearAnimAt(position: cc.Vec2, prefab: cc.Prefab | null): void {
        if (!prefab || !this.node || !this.node.isValid) return;
        const animNode = cc.instantiate(prefab);
        animNode.setPosition(position);
        animNode.zIndex = BoardView.FX_Z_INDEX;
        this.node.addChild(animNode);
        const anim = animNode.getComponent(cc.Animation);
        if (anim) anim.play();
        const duration = this.disappearAnimDuration > 0 ? this.disappearAnimDuration : 0.3;
        this.scheduleOnce(() => {
            if (animNode && animNode.isValid) animNode.destroy();
        }, duration);
    }

    highlightCells(cells: Cell[], highlight: boolean): void {
        if (!highlight) {
            for (let r = 0; r < this.tileViews.length; r++)
                for (let c = 0; c < (this.tileViews[r] || []).length; c++) {
                    const view = this.tileViews[r][c];
                    if (view && view.node) view.node.opacity = 255;
                }
            return;
        }
        for (const [r, c] of cells) {
            const view = this.tileViews[r] && this.tileViews[r][c];
            if (view && view.node) view.node.opacity = 180;
        }
    }

    pulseTile(row: number, col: number): void {
        const view = this.tileViews[row] && this.tileViews[row][col];
        if (!view || !view.node) return;
        view.node.stopAllActions();
        const scale = 1.15;
        view.node.runAction(cc.sequence(
            cc.scaleTo(0.08, scale),
            cc.scaleTo(0.08, 1)
        ));
    }
}