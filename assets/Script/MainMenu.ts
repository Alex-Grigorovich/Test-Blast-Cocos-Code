const { ccclass, property } = cc._decorator;
import { GameSettings } from './Game/GameSettings';

@ccclass
export default class MainMenu extends cc.Component {
    @property(cc.AudioClip)
    menuMusicClip: cc.AudioClip = null;

    @property(cc.Node)
    playBtn: cc.Node = null;

    @property(cc.Node)
    optionsBtn: cc.Node = null;

    @property(cc.Node)
    quitBtn: cc.Node = null;

    @property({ tooltip: 'Имя сцены игры для перехода по PLAY' })
    gameSceneName: string = 'GameScene';

    @property({ tooltip: 'Имя сцены настроек для перехода по OPTIONS' })
    optionSceneName: string = 'Option';

    onLoad(): void {
        this.registerButton(this.playBtn, this.onPlay);
        this.registerButton(this.optionsBtn, this.onOptions);
        this.registerButton(this.quitBtn, this.onQuit);
        this.playMenuMusic();
    }

    onDestroy(): void {
        if (cc.audioEngine) cc.audioEngine.stopMusic();
    }

    private playMenuMusic(): void {
        if (!this.menuMusicClip || !cc.audioEngine) return;
        cc.audioEngine.playMusic(this.menuMusicClip, true);
        const vol = GameSettings.isMuted() ? 0 : Math.max(0, Math.min(1, GameSettings.getMusicVolume()));
        cc.audioEngine.setMusicVolume(vol);
    }

    private registerButton(node: cc.Node, handler: () => void): void {
        if (!node || !handler) return;
        if (!node.getComponent(cc.Button)) node.addComponent(cc.Button);
        node.on(cc.Node.EventType.TOUCH_END, handler, this);
    }

    private onPlay(): void {
        if (!this.gameSceneName) return;
        cc.director.loadScene(this.gameSceneName);
    }

    private onOptions(): void {
        if (this.optionSceneName) cc.director.loadScene(this.optionSceneName);
    }

    private onQuit(): void {
        if (cc.sys.isBrowser) {
            (window as any).close ? (window as any).close() : cc.log('Quit (в браузере закрытие недоступно)');
        } else {
            cc.game.end();
        }
    }
}
