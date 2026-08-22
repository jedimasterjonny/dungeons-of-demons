import Phaser from 'phaser';
import { WORLD } from '../systems/config';
import { storyAfterFloor, type Story } from '../systems/stories';

const FONT = 'system-ui, sans-serif';

/**
 * A chapter of the story, shown between floors. Full screen rather than modal: the
 * dungeon it came from has already shut down, and this scene starts the next one.
 */
export class StoryScene extends Phaser.Scene {
  private story!: Story;
  private page = 0;
  private next = 'Dungeon';
  private bodyText!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private pageDots!: Phaser.GameObjects.Graphics;
  /** Blocks the keypress that finished the floor from skipping the first page. */
  private ready = false;

  constructor() {
    super('Story');
  }

  init(data: { afterFloor?: number; next?: string }): void {
    this.story = storyAfterFloor(data.afterFloor ?? 0) ?? {
      afterFloor: 0,
      title: '',
      pages: [['']],
    };
    this.next = data.next ?? 'Dungeon';
    this.page = 0;
    this.ready = false;
  }

  create(): void {
    const W = WORLD.viewWidth;
    const H = WORLD.viewHeight;

    this.cameras.main.setBackgroundColor(0x07060d);
    this.cameras.main.fadeIn(600, 0, 0, 0);

    // Embers drifting up, the same ones the title screen uses.
    this.add.particles(0, H + 10, 'spark', {
      x: { min: 0, max: W },
      speedY: { min: -18, max: -46 },
      speedX: { min: -10, max: 10 },
      lifespan: 7000,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.35, end: 0 },
      tint: [0xff6b4a, 0xffc93c, 0x9b5de5],
      frequency: 240,
      blendMode: Phaser.BlendModes.ADD,
    });

    this.add
      .text(W / 2, 92, this.story.title, {
        fontFamily: FONT,
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffd15c',
      })
      .setOrigin(0.5);

    this.bodyText = this.add
      .text(W / 2, H / 2 + 6, '', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#ded9ec',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    this.pageDots = this.add.graphics();

    this.prompt = this.add
      .text(W / 2, H - 44, '', {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#7d7a8c',
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({
      targets: this.prompt,
      alpha: 1,
      duration: 700,
      delay: 500,
      yoyo: true,
      repeat: -1,
      hold: 900,
    });

    const kb = this.input.keyboard!;
    kb.on('keydown-ENTER', this.advance, this);
    kb.on('keydown-SPACE', this.advance, this);
    kb.on('keydown-E', this.advance, this);
    kb.on('keydown-ESC', this.finish, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
    });

    this.showPage();
    this.time.delayedCall(300, () => {
      this.ready = true;
    });
  }

  private showPage(): void {
    const lines = this.story.pages[this.page] ?? [''];
    this.bodyText.setText(lines.join('\n')).setAlpha(0);
    this.tweens.add({ targets: this.bodyText, alpha: 1, duration: 500 });

    const last = this.page === this.story.pages.length - 1;
    this.prompt.setText(last ? 'ENTER — onwards' : 'ENTER — keep reading');

    // A dot per page, so it is obvious how much story is left.
    const W = WORLD.viewWidth;
    const total = this.story.pages.length;
    this.pageDots.clear();
    if (total > 1) {
      for (let i = 0; i < total; i++) {
        const filled = i <= this.page;
        this.pageDots
          .fillStyle(filled ? 0xffd15c : 0xffffff, filled ? 1 : 0.18)
          .fillCircle(W / 2 - ((total - 1) * 14) / 2 + i * 14, WORLD.viewHeight - 72, 4);
      }
    }
  }

  private advance(): void {
    if (!this.ready) return;
    if (this.page < this.story.pages.length - 1) {
      this.page += 1;
      this.showPage();
      return;
    }
    this.finish();
  }

  private finish(): void {
    if (!this.ready) return;
    this.ready = false;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(this.next);
    });
  }
}
