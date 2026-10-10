import Phaser from "phaser";
import { VIEW } from "./stage";

export class WindEffect {
  private readonly pen: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) { this.pen = scene.add.graphics().setDepth(13).setScrollFactor(0); }
  draw(time: number, remaining: number) {
    const pen = this.pen.clear();
    if (remaining <= 0) return;
    const alpha = Math.min(0.55, remaining / 600);
    for (let i = 0; i < 7; i++) {
      const x = (time * 0.65 + i * 151) % (VIEW.width + 260) - 180;
      const y = 92 + i * 46 + Math.sin(time / 350 + i) * 10;
      pen.lineStyle(i % 2 ? 2.5 : 1.5, i % 2 ? 0xe4fff7 : 0xffffff, alpha);
      pen.beginPath().moveTo(x, y + 4).lineTo(x + 45, y - 2).lineTo(x + 115, y).lineTo(x + 146, y - 5).strokePath();
    }
  }
}
