const { ccclass, property } = cc._decorator;
import { GameBoard } from './Game/GameBoard';
import { GameState } from './Game/GameState';
import { GameConfig } from './Game/GameConfig';
import { GameSettings } from './Game/GameSettings';
import BoardView from './View/BoardView';
import GameUI from './View/GameUI';

@ccclass
export default class BlastGame extends cc.Component {
    @property(BoardView)
    boardView: BoardView = null;

    @property(GameUI)
    gameUI: GameUI = null;

    @property(cc.Node)
    boosterBombBtn: cc.Node = null;

    @property(cc.Node)
    boosterTeleportBtn: cc.Node = null;

    @property(cc.Node)
    winRestartBtn: cc.Node = null;

    @property(cc.Node)
    loseRestartBtn: cc.Node = null;

    @property(cc.Node)
    winMenuBtn: cc.Node = null;

    @property(cc.Node)
    loseMenuBtn: cc.Node = null;

    @property({ tooltip: 'Имя сцены меню для кнопок «В меню»' })
    menuSceneName: string = 'MenuScene';

    @property(cc.AudioClip)
    bgMusicClip: cc.AudioClip = null;

    @property({ range: [0, 1], step: 0.1, tooltip: 'Громкость фоновой музыки 0–1' })
    bgMusicVolume: number = 0.6;

    @property(cc.AudioClip)
    soundMatchClip: cc.AudioClip = null;

    @property(cc.AudioClip)
    soundExplosionClip: cc.AudioClip = null;

    @property(cc.AudioClip)
    soundTeleportClip: cc.AudioClip = null;

    @property(cc.AudioClip)
    soundWinClip: cc.AudioClip = null;

    @property(cc.AudioClip)
    soundLoseClip: cc.AudioClip = null;

    @property({ range: [0, 1], step: 0.1, tooltip: 'Громкость эффектов 0–1' })
    soundEffectsVolume: number = 1;

    @property({ tooltip: 'Длительность перехода масштаба (сек)' })
    boosterHoverPulseDuration: number = 0.15;

    private board: GameBoard = null;
    private state: GameState = null;
    private inputBlocked: boolean = false;
    private shuffleCount: number = 0;
    private selectedForSwap: [number, number] | null = null;
    private boosterMode: 'none' | 'bomb' | 'teleport' = 'none';
    private teleportSource: 'ui' | 'tile' | null = null;

    start(): void {
        this.startNewGame();
        this.registerBoosterButtons();
        this.registerRestartButtons();
        this.registerMenuButtons();
        this.playBackgroundMusic();
        this.scheduleOnce(() => {
            if (this.boardView && this.board) {
                this.boardView.refresh();
                this.inputBlocked = false;
            }
        }, 0.3);
    }

    onDestroy(): void {
        if (cc.audioEngine) cc.audioEngine.stopMusic();
    }

    private playBackgroundMusic(): void {
        if (!this.bgMusicClip || !cc.audioEngine) return;
        cc.audioEngine.playMusic(this.bgMusicClip, true);
        const vol = GameSettings.isMuted() ? 0 : Math.max(0, Math.min(1, GameSettings.getMusicVolume()));
        cc.audioEngine.setMusicVolume(vol);
    }

    private playSound(clip: cc.AudioClip | null): void {
        if (!clip || !cc.audioEngine) return;
        if (GameSettings.isMuted()) return;
        const vol = Math.max(0, Math.min(1, GameSettings.getSoundVolume() * this.soundEffectsVolume));
        cc.audioEngine.setEffectsVolume(vol);
        cc.audioEngine.playEffect(clip, false);
    }

    private runBoosterHoverEnter(node: cc.Node): void {
        if (!node || !node.isValid) return;
        node.stopAllActions();
        const t = this.boosterHoverPulseDuration > 0 ? this.boosterHoverPulseDuration : 0.15;
        node.runAction(cc.scaleTo(t, 1.5));
    }

    private runBoosterHoverLeave(node: cc.Node): void {
        if (!node || !node.isValid) return;
        node.stopAllActions();
        const t = this.boosterHoverPulseDuration > 0 ? this.boosterHoverPulseDuration : 0.15;
        node.runAction(cc.scaleTo(t, 1));
    }

    private registerBoosterButtons(): void {
        const setup = (node: cc.Node, handler: Function) => {
            if (!node) return;
            node.zIndex = 100;
            const size = node.getContentSize();
            if (size.width < 10 || size.height < 10) node.setContentSize(80, 80);
            if (!node.getComponent(cc.Button)) node.addComponent(cc.Button);
            node.on(cc.Node.EventType.TOUCH_END, handler, this);
            node.on(cc.Node.EventType.MOUSE_ENTER, () => this.runBoosterHoverEnter(node), this);
            node.on(cc.Node.EventType.MOUSE_LEAVE, () => this.runBoosterHoverLeave(node), this);
        };
        setup(this.boosterBombBtn, this.onBoosterBombClick);
        setup(this.boosterTeleportBtn, this.onBoosterTeleportClick);
    }

    private registerRestartButtons(): void {
        const onRestart = (): void => {
            this.startNewGame();
        };
        const setup = (node: cc.Node): void => {
            if (!node || !node.isValid) return;
            if (node.getComponent(cc.Button) == null) node.addComponent(cc.Button);
            node.off(cc.Node.EventType.TOUCH_END, onRestart, this);
            node.on(cc.Node.EventType.TOUCH_END, onRestart, this);
        };
        setup(this.winRestartBtn);
        setup(this.loseRestartBtn);
    }

    private registerMenuButtons(): void {
        const goToMenu = (): void => {
            if (this.menuSceneName) cc.director.loadScene(this.menuSceneName);
        };
        const setup = (node: cc.Node): void => {
            if (!node || !node.isValid) return;
            if (node.getComponent(cc.Button) == null) node.addComponent(cc.Button);
            node.off(cc.Node.EventType.TOUCH_END, goToMenu, this);
            node.on(cc.Node.EventType.TOUCH_END, goToMenu, this);
        };
        setup(this.winMenuBtn);
        setup(this.loseMenuBtn);
    }

    startNewGame(): void {
        this.board = new GameBoard(GameConfig.ROWS, GameConfig.COLS, GameConfig.COLORS);
        this.state = new GameState(GameConfig.MAX_MOVES);
        this.inputBlocked = false;
        this.shuffleCount = 0;
        this.selectedForSwap = null;
        this.boosterMode = 'none';
        this.teleportSource = null;
        if (this.gameUI) {
            this.gameUI.hideResult();
            this.gameUI.updateScore(0, GameConfig.TARGET_SCORE);
            this.gameUI.setMoves(this.state.movesLeft);
            this.gameUI.setBombBoosterCount(this.state.bombBoosterCount);
            this.gameUI.setTeleportBoosterCount(this.state.teleportBoosterCount);
        }
        if (this.boardView) {
            this.boardView.bind(this.board, (row, col, w) => this.onTileClick(row, col, w));
            this.boardView.syncSnapshotWithBoard();
        }
        this.checkLoseIfNoMoves();
    }

    private onBoosterBombClick(): void {
        if (!this.state.isPlaying) return;
        if (this.boosterMode === 'bomb') {
            this.boosterMode = 'none';
            return;
        }
        if (this.state.bombBoosterCount > 0) {
            this.state.useBombBooster();
            this.boosterMode = 'bomb';
            if (this.gameUI) this.gameUI.setBombBoosterCount(this.state.bombBoosterCount);
        }
    }

    private onBoosterTeleportClick(): void {
        if (!this.state.isPlaying) return;
        if (this.boosterMode === 'teleport') {
            this.boosterMode = 'none';
            this.teleportSource = null;
            this.selectedForSwap = null;
            if (this.boardView) this.boardView.highlightCells([], false);
            this.boardView.refresh();
            return;
        }
        if (this.state.teleportBoosterCount > 0) {
            this.state.useTeleportBooster();
            this.boosterMode = 'teleport';
            this.teleportSource = 'ui';
            if (this.gameUI) this.gameUI.setTeleportBoosterCount(this.state.teleportBoosterCount);
        }
    }

    private onTileClick(row: number, col: number, touchWorld?: cc.Vec2): void {
        if (this.inputBlocked || !this.state.isPlaying) return;

        const value = this.board.getAt(row, col);
        if (value < 0) return;

        if (this.tryHandleBombBooster(row, col)) return;
        if (this.tryHandlePendingTeleportSwap(row, col, value)) return;
        if (this.tryStartTeleportMode(row, col, value)) return;
        if (this.tryHandleSpecialTile(row, col, value)) return;
        this.handleNormalGroupClick(row, col, touchWorld);
    }

    private tryHandleBombBooster(row: number, col: number): boolean {
        if (this.boosterMode !== 'bomb') return false;
        this.resolveBurn(this.board.getBombEffectCells(row, col, GameConfig.BOMB_RADIUS), {
            consumeMove: false,
            useExplosionFx: true,
            playExplosionSound: true,
        });
        this.boosterMode = 'none';
        return true;
    }

    private tryHandlePendingTeleportSwap(row: number, col: number, value: number): boolean {
        if (this.selectedForSwap === null) return false;
        if (row === this.selectedForSwap[0] && col === this.selectedForSwap[1]) {
            this.resetTeleportSelection();
            return true;
        }
        if (this.isBlockedTeleportTarget(row, col, value)) {
            this.resetTeleportSelection();
            return false;
        }
        this.board.swap(this.selectedForSwap[0], this.selectedForSwap[1], row, col);
        if (this.teleportSource === 'ui') this.playSound(this.soundTeleportClip);
        if (this.teleportSource === 'tile') this.state.useMove();
        this.selectedForSwap = null;
        this.boosterMode = 'none';
        this.teleportSource = null;
        this.boardView.highlightCells([], false);
        this.boardView.rebuildGridFromBoard();
        this.boardView.syncSnapshotWithBoard();
        this.syncUiCounters();
        return true;
    }

    private tryStartTeleportMode(row: number, col: number, value: number): boolean {
        if (this.boosterMode === 'teleport' && this.teleportSource === 'ui') {
            this.selectedForSwap = [row, col];
            this.boardView.highlightCells([[row, col]], true);
            return true;
        }
        if (this.board.isTeleport(value) && this.boosterMode === 'none') {
            this.boosterMode = 'teleport';
            this.teleportSource = 'tile';
            this.selectedForSwap = [row, col];
            this.boardView.highlightCells([[row, col]], true);
            return true;
        }
        return false;
    }

    private tryHandleSpecialTile(row: number, col: number, value: number): boolean {
        if (value === GameConfig.TILE_ROCKET_H || value === GameConfig.TILE_ROCKET_V || value === GameConfig.TILE_BOMB_CLEAR_FIELD) {
            this.resolveBurn(this.board.getSpecialEffectCells(row, col), {
                consumeMove: true,
                useExplosionFx: true,
                playExplosionSound: true,
            });
            return true;
        }
        if (value === GameConfig.TILE_BOMB) {
            const bombGroup = this.board.getConnectedBombGroup(row, col);
            const initial = bombGroup.length >= 2
                ? this.board.getUnionEffectCellsForBombGroup(bombGroup)
                : this.board.getBombEffectCells(row, col, GameConfig.BOMB_RADIUS);
            this.resolveBurn(initial, {
                consumeMove: true,
                useExplosionFx: true,
                playExplosionSound: true,
            });
            return true;
        }
        if (value === GameConfig.TILE_BOMB_MAX) {
            const bombGroup = this.board.getConnectedBombGroup(row, col);
            const initial = bombGroup.length >= 2
                ? this.board.getUnionEffectCellsForBombGroup(bombGroup)
                : this.board.getBombEffectCells(row, col, GameConfig.BOMB_MAX_RADIUS);
            this.resolveBurn(initial, {
                consumeMove: true,
                useExplosionFx: true,
                playExplosionSound: true,
            });
            return true;
        }
        if (value === GameConfig.TILE_CLEAR_ALL) {
            this.resolveBurn(this.board.getSpecialEffectCells(row, col), {
                consumeMove: true,
                useExplosionFx: false,
                playExplosionSound: false,
            });
            return true;
        }
        return false;
    }

    private handleNormalGroupClick(row: number, col: number, touchWorld?: cc.Vec2): void {
        this.inputBlocked = true;
        const resolved = this.resolveGroupForTouch(row, col, touchWorld);
        if (resolved.group.length < GameConfig.MIN_GROUP_SIZE) {
            if (this.boardView && resolved.group.length === 1) this.boardView.pulseTile(resolved.burnRow, resolved.burnCol);
            this.inputBlocked = false;
            return;
        }
        const count = this.board.burnCells(resolved.group);
        const spawnType = this.getSpawnTypeForGroup(resolved.group.length);
        if (spawnType !== null) this.board.setAt(resolved.burnRow, resolved.burnCol, spawnType);
        this.state.addScore(count * GameConfig.scorePerTile);
        this.state.useMove();
        this.syncUiCounters();
        this.playSound(this.soundMatchClip);
        this.boardView.playBurnAnimation(resolved.group, () => this.applyGravityAndRefill());
    }

    private resolveGroupForTouch(row: number, col: number, touchWorld?: cc.Vec2): { group: [number, number][], burnRow: number, burnCol: number } {
        let group = this.board.getConnectedGroup(row, col);
        let burnRow = row;
        let burnCol = col;
        const fingerOutsidePrimaryTile =
            touchWorld &&
            this.boardView &&
            !this.boardView.isTouchInsideTileRect(touchWorld, row, col);
        if (group.length >= GameConfig.MIN_GROUP_SIZE || !fingerOutsidePrimaryTile || !this.boardView) {
            return { group, burnRow, burnCol };
        }
        for (const [rr, cc] of this.boardView.getCellsRankedByTouchDistance(touchWorld).slice(0, 16)) {
            if (!this.board.isNormal(this.board.getAt(rr, cc))) continue;
            const candidate = this.board.getConnectedGroup(rr, cc);
            if (candidate.length < GameConfig.MIN_GROUP_SIZE) continue;
            group = candidate;
            burnRow = rr;
            burnCol = cc;
            break;
        }
        return { group, burnRow, burnCol };
    }

    private getSpawnTypeForGroup(groupSize: number): number | null {
        if (groupSize >= GameConfig.POWER_BOOSTER_GROUP_MIN) {
            this.state.addMoves(GameConfig.BONUS_MOVES_POWER);
            return GameConfig.TILE_BOMB_MAX;
        }
        if (groupSize < GameConfig.BOOSTER_GROUP_MIN || groupSize > GameConfig.BOOSTER_GROUP_MAX) return null;
        if (groupSize === 5) return GameConfig.TILE_BOMB;
        if (groupSize === 6) return GameConfig.TILE_ROCKET_H;
        if (groupSize === 7) return GameConfig.TILE_ROCKET_V;
        return GameConfig.TILE_BOMB_CLEAR_FIELD;
    }

    private resolveBurn(
        initialCells: [number, number][],
        options: { consumeMove: boolean; useExplosionFx: boolean; playExplosionSound: boolean }
    ): void {
        this.inputBlocked = true;
        const cells = this.board.getCellsWithChainReaction(initialCells);
        const count = this.board.burnCells(cells);
        this.state.addScore(count * GameConfig.scorePerTile);
        if (options.consumeMove) this.state.useMove();
        this.syncUiCounters();
        if (options.playExplosionSound) this.playSound(this.soundExplosionClip);
        this.boardView.playBurnAnimation(cells, () => this.applyGravityAndRefill(), options.useExplosionFx);
    }

    private resetTeleportSelection(): void {
        this.selectedForSwap = null;
        this.boosterMode = 'none';
        this.teleportSource = null;
        this.boardView.highlightCells([], false);
        this.boardView.refresh();
    }

    private isBlockedTeleportTarget(row: number, col: number, value: number): boolean {
        const actionTile =
            (value >= GameConfig.TILE_ROCKET_H && value <= GameConfig.TILE_CLEAR_ALL) ||
            value === GameConfig.TILE_BOMB_CLEAR_FIELD;
        if (actionTile) return true;
        if (value < 0 || value > 4) return false;
        return this.board.getConnectedGroup(row, col).length >= GameConfig.MIN_GROUP_SIZE;
    }

    private syncUiCounters(): void {
        if (!this.gameUI) return;
        this.gameUI.updateScore(this.state.score, GameConfig.TARGET_SCORE);
        this.gameUI.setMoves(this.state.movesLeft);
    }

    private applyGravityAndRefill(): void {
        this.board.applyGravity();
        this.board.refill();
        this.boardView.rebuildGridFromBoard();
        this.boardView.syncSnapshotWithBoard();

        this.selectedForSwap = null;
        this.boosterMode = 'none';
        this.teleportSource = null;
        this.checkWinLose();

        this.scheduleOnce(() => {
            this.inputBlocked = false;
        }, 0.6);
    }

    private checkWinLose(): void {
        if (this.state.result === 'win') {
            this.playSound(this.soundWinClip);
            if (this.gameUI) this.gameUI.showWin();
            return;
        }
        if (this.state.result === 'lose') {
            this.playSound(this.soundLoseClip);
            if (this.gameUI) this.gameUI.showLose();
            return;
        }
        this.checkLoseIfNoMoves();
    }

    private checkLoseIfNoMoves(): void {
        if (!this.state.isPlaying || !this.board) return;
        if (this.board.hasValidMove()) return;
        if (this.shuffleCount >= GameConfig.MAX_SHUFFLES) {
            this.state.setLose();
            this.playSound(this.soundLoseClip);
            if (this.gameUI) this.gameUI.showLose();
            return;
        }
        this.shuffleCount++;
        this.board.shuffleUntilValid();
        if (this.boardView) {
            this.boardView.rebuildGridFromBoard();
            this.boardView.syncSnapshotWithBoard();
        }
        this.inputBlocked = false;
        if (!this.board.hasValidMove()) {
            this.state.setLose();
            this.playSound(this.soundLoseClip);
            if (this.gameUI) this.gameUI.showLose();
        }
    }
}