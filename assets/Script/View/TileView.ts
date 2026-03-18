const { ccclass, property } = cc._decorator;

export const TILE_COLORS: cc.Color[] = [
    cc.color(255, 100, 100),
    cc.color(100, 200, 100),
    cc.color(100, 150, 255),
    cc.color(255, 220, 100),
    cc.color(200, 150, 255),
];

export type TileClickCallback = (row: number, col: number, touchWorld?: cc.Vec2) => void;

export const BOMB_IDLE_VALUES = [5, 6, 7, 8];

@ccclass
export default class TileView extends cc.Component {
    @property(cc.Sprite)
    sprite: cc.Sprite = null;

    private _row: number = 0;
    private _col: number = 0;
    private _tileValue: number = -1;
    private _onClick: TileClickCallback = null;
    private _worldToCell: ((world: cc.Vec2) => [number, number] | null) | null = null;
    private _idleScheduled: boolean = false;
    private _idleAnimDuration: number = 0.35;
    private _idleIntervalSec: number = 5;
    private _idleBaseScaleX: number = 1;
    private _idleBaseScaleY: number = 1;

    private _idleTick = (): void => {
        if (!this.node || !this.node.isValid) return;
        const half = this._idleAnimDuration / 2;
        const bx = this._idleBaseScaleX;
        const by = this._idleBaseScaleY;
        this.node.runAction(cc.sequence(
            cc.scaleTo(half, bx * 1.5, by * 1.5),
            cc.scaleTo(half, bx, by)
        ));
    };

    init(
        row: number,
        col: number,
        tileValue: number,
        onClick: TileClickCallback,
        worldToCell?: (world: cc.Vec2) => [number, number] | null
    ): void {
        this._row = row;
        this._col = col;
        this._onClick = onClick;
        this._tileValue = tileValue;
        this._worldToCell = worldToCell || null;
    }

    setGridCell(row: number, col: number): void {
        this._row = row;
        this._col = col;
    }

    setDisplay(value: number, frame: cc.SpriteFrame | null, color?: cc.Color): void {
        this._tileValue = value;
        if (!this.sprite || !this.sprite.node) return;
        if (value < 0) {
            this.sprite.node.active = false;
            return;
        }
        this.sprite.node.active = true;
        if (frame) {
            this.sprite.spriteFrame = frame;
            this.sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        }
        if (color) this.sprite.node.color = color.clone();
    }

    setColorIndex(index: number): void {
        this._tileValue = index;
        if (this.sprite && this.sprite.node) {
            if (index >= 0 && index < TILE_COLORS.length) {
                this.sprite.node.color = TILE_COLORS[index].clone();
                this.sprite.node.active = true;
            } else {
                this.sprite.node.active = false;
            }
        }
    }

    getRow(): number { return this._row; }
    getCol(): number { return this._col; }
    getTileValue(): number { return this._tileValue; }

    setBombIdle(intervalSec: number, animDurationSec: number): void {
        this.stopBombIdle();
        if (!this.node || !this.node.isValid || intervalSec <= 0 || animDurationSec <= 0) return;
        this._idleBaseScaleX = Math.max(0.01, this.node.scaleX);
        this._idleBaseScaleY = Math.max(0.01, this.node.scaleY);
        this._idleAnimDuration = animDurationSec;
        this._idleIntervalSec = intervalSec;
        this._idleScheduled = true;
        this.schedule(this._idleTick, intervalSec, cc.macro.REPEAT_FOREVER, 0);
        this._idleTick();
    }

    stopBombIdle(): void {
        const hadIdle = this._idleScheduled;
        if (hadIdle) {
            this.unschedule(this._idleTick);
            this._idleScheduled = false;
        }
        if (!this.node || !this.node.isValid) return;
        if (hadIdle) {
            this.node.scaleX = this._idleBaseScaleX;
            this.node.scaleY = this._idleBaseScaleY;
        } else if (this._tileValue < 5 || this._tileValue > 8) {
            this.node.scale = 1;
        }
    }

    onLoad(): void {
        this.node.on(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    onDestroy(): void {
        this.stopBombIdle();
        if (this.node && this.node.isValid) {
            this.node.off(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
        }
    }

    private onTouchEnd(e: cc.Event.EventTouch): void {
        if (!this._onClick) return;
        let r = this._row;
        let c = this._col;
        if (this._worldToCell && e) {
            const cell = this._worldToCell(e.getLocation());
            if (cell) {
                r = cell[0];
                c = cell[1];
            }
        }
        this._onClick(r, c, e ? e.getLocation() : undefined);
    }
}