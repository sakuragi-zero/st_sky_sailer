import Phaser from "phaser";
import { VIEW } from "./stage";

export class WindEffect {
  private readonly streaks: Phaser.GameObjects.Image[];
  constructor(scene: Phaser.Scene) {
    // Paint once and move a small sprite pool instead of rebuilding vector
    // paths and their triangles every frame during maximum acceleration.
    if (!scene.textures.exists("wind-streak")) {
      const texture = scene.textures.createCanvas("wind-streak",160,24)!;
      const ctx = texture.context;
      const fade = ctx.createLinearGradient(0,0,160,0);
      fade.addColorStop(0,"rgba(255,255,255,0)");fade.addColorStop(.45,"rgba(255,255,255,.85)");fade.addColorStop(1,"rgba(255,255,255,0)");
      ctx.strokeStyle=fade;ctx.lineWidth=2;ctx.lineCap="round";
      ctx.beginPath();ctx.moveTo(4,16);ctx.bezierCurveTo(55,7,90,18,156,8);ctx.stroke();
      texture.refresh();
    }
    this.streaks = Array.from({length:8},(_,i)=>scene.add.image(0,0,"wind-streak").setOrigin(0,.5).setDepth(13).setScrollFactor(0).setTint(i%2 ? 0xe4fff7 : 0xffffff).setVisible(false));
  }
  draw(time: number, remaining: number, stacks = 1, detail = 1) {
    const alpha = Math.min(0.55, remaining / 600);
    const count = remaining > 0 ? Math.ceil((5+Math.min(stacks,3))*detail) : 0;
    this.streaks.forEach((streak,i) => {
      streak.setVisible(i<count);
      if(i>=count) return;
      const x = (time * (0.55 + stacks * 0.1) + i * 151) % (VIEW.width + 260) - 180;
      const y = 75 + i * 46 + Math.sin(time / 350 + i) * 10;
      streak.setPosition(x,y).setAlpha(alpha);
    });
  }
}
