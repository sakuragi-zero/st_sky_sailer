import Phaser from "phaser";
import { VIEW, type Course } from "./stage";
import { waterY } from "./Waterway";

/** Reusable textures and a fixed sprite pool keep the scenery independent of course length. */
export class Atmosphere {
  readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  detail = 1;
  private slowMs = 0;
  private readonly light: Phaser.GameObjects.Image;
  private readonly aurora?: Phaser.GameObjects.Image;
  private readonly rainbow?: Phaser.GameObjects.Image;
  private readonly mist: Phaser.GameObjects.Image[] = [];
  private readonly motes: Phaser.GameObjects.Image[] = [];
  private readonly shores: { art: Phaser.GameObjects.Image; x: number; y: number }[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly course: Course) {
    this.detail = this.reducedMotion || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) ? 0.6 : 1;
    this.makeTextures();
    this.light = scene.add.image(0, 0, `light-${course.theme}`).setOrigin(0).setScrollFactor(0).setDepth(1);
    if (course.theme === "ice") this.aurora = scene.add.image(360, 98, "aurora").setScrollFactor(0).setDepth(1);
    if (course.theme === "sea" || course.theme === "cloud") this.rainbow = scene.add.image(485, 175, "sky-rainbow").setScrollFactor(0).setDepth(1).setAlpha(0);
    for (let i = 0; i < 6; i++) {
      this.mist.push(scene.add.image(0, 0, "soft-mist").setScrollFactor(0).setDepth(i < 3 ? 2 : 12).setTint(course.theme === "desert" ? 0xffe8cc : 0xeafaff));
    }
    for (let i = 0; i < 14; i++) {
      this.motes.push(scene.add.image(0, 0, "soft-light").setScrollFactor(0).setDepth(12).setTint(course.theme === "ice" ? 0xd5ffff : course.theme === "desert" ? 0xffdc9e : 0xfff5ce));
    }
    // Large landmarks sit well behind the far bank, separated from the hazard lane.
    if (course.theme !== "cloud") course.channels.forEach((channel, i) => {
      const landmark = course.theme === "sea" || course.theme === "desert";
      if (landmark && i % 3 !== 0) return;
      const x = channel.x + channel.width * (landmark ? i % 2 ? 0.48 : 0.62 : i % 2 ? 0.73 : 0.27);
      const art = scene.add.image(x, 0, `shore-${course.theme}`).setOrigin(0.5, landmark ? 0.97 : 1).setDepth(landmark ? 1.8 : 2.8);
      if (landmark) {
        const width = course.theme === "sea" ? 320 : 340;
        art.setDisplaySize(width,width*2/3).setTint(course.theme === "sea" ? 0xe4f2ff : 0xffefd9).setAlpha(.94);
      } else art.setScale(0.6).setFlipX(i % 2 === 1);
      this.shores.push({ art, x, y: channel.y - (landmark ? 52 : 46) });
    });
  }

  update(anchorX: number, time: number, delta: number, storm: number) {
    // Reduce optional decoration after sustained slow frames, never the physics rate.
    const slow = delta > 22 || (time > 2500 && this.scene.game.loop.actualFps < 50);
    this.slowMs = slow ? this.slowMs + Math.min(delta, 100) : Math.max(0, this.slowMs - delta * 0.4);
    if (this.slowMs > 1400) this.detail = 0.5;
    const camera = this.scene.cameras.main, t = this.reducedMotion ? 0 : time;
    this.light.setAlpha(1 - storm * 0.8);
    this.aurora?.setAlpha(0.44 * (1 - storm * 0.65)).setY(94 + Math.sin(t / 8000) * 8);
    this.rainbow?.setAlpha(Phaser.Math.Clamp((anchorX / this.course.goalX - 0.68) / 0.2, 0, 1) * (1-storm) * 0.28);
    for (let i = 0; i < this.mist.length; i++) {
      const near = i >= 3, sprite = this.mist[i];
      sprite.setVisible(this.detail > 0.5 || i % 3 === 0);
      const speed = near ? 0.36 : 0.065;
      const x = ((i * 317 - camera.scrollX * speed - t * 0.004) % 1180 + 1180) % 1180 - 230;
      sprite.setPosition(x, (near ? 462 : 263) + Math.sin(t / 2400 + i) * 9);
      sprite.setDisplaySize(near ? 440 : 330, near ? 82 : 44).setAlpha(near ? 0.26 : 0.2);
    }
    for (let i = 0; i < this.motes.length; i++) {
      const sprite = this.motes[i];
      sprite.setVisible(i < 14 * this.detail);
      const x = ((i * 157 - camera.scrollX * (0.11 + i % 3 * 0.05) - t * 0.012) % 820 + 820) % 820 - 50;
      const y = 95 + (i * 73 % 350) + Math.sin(t / 1800 + i) * 17;
      sprite.setPosition(x, y).setScale(0.13 + i % 3 * 0.07).setAlpha((0.12 + Math.sin(t / 950 + i) * 0.09) * (1 - storm * 0.6));
    }
    for (const shore of this.shores) {
      const y = waterY(shore.x, shore.y, anchorX);
      const margin=shore.art.displayWidth/2+30;
      const visible = shore.x > camera.scrollX - margin && shore.x < camera.scrollX + VIEW.width + margin && y > camera.scrollY - 40 && y < camera.scrollY + VIEW.height + shore.art.displayHeight;
      shore.art.setVisible(visible);
      if (visible) {
        shore.art.setY(y);
        if(this.course.theme !== "ice") {
          const sea=this.course.theme === "sea";
          shore.art.setTint(Phaser.Display.Color.GetColor(Math.round((sea?228:255)-45*storm),Math.round((sea?242:239)-53*storm),Math.round((sea?255:217)-30*storm)));
        }
      }
    }
  }

  private canvas(key: string, width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
    if (this.scene.textures.exists(key)) return;
    const texture = this.scene.textures.createCanvas(key, width, height);
    if (!texture) return;
    paint(texture.context); texture.refresh();
  }

  private makeTextures() {
    this.canvas("soft-mist", 256, 96, ctx => {
      ctx.scale(1, 0.375);
      const glow = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      glow.addColorStop(0, "rgba(255,255,255,.85)"); glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, 256, 256);
    });
    this.canvas("soft-light", 64, 64, ctx => {
      const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      glow.addColorStop(0, "rgba(255,255,255,1)"); glow.addColorStop(0.16, "rgba(255,255,255,.8)"); glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, 64, 64);
    });
    if (this.course.theme === "sea" || this.course.theme === "cloud") this.canvas("sky-rainbow", 460, 260, ctx => {
      ["#ffd1cf", "#ffe5b7", "#fff4cc", "#bfeede", "#c5e6ff", "#d9d0ff"].forEach((color,i) => {
        ctx.strokeStyle=color;ctx.lineWidth=5;ctx.beginPath();ctx.arc(230,235,207-i*5,Math.PI,Math.PI*2);ctx.stroke();
      });
    });
    this.canvas(`light-${this.course.theme}`, VIEW.width, VIEW.height, ctx => {
      const desert = this.course.theme === "desert", ice = this.course.theme === "ice";
      const glow = ctx.createRadialGradient(570, 15, 4, 570, 15, 510);
      glow.addColorStop(0, desert ? "rgba(255,213,138,.38)" : ice ? "rgba(183,255,246,.2)" : "rgba(255,242,192,.3)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      const ray = ctx.createLinearGradient(0, 0, 0, 460);
      ray.addColorStop(0, "rgba(255,249,220,.13)"); ray.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = ray;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(480 + i * 76, 0); ctx.lineTo(120 + i * 175, 480); ctx.lineTo(175 + i * 180, 480); ctx.closePath(); ctx.fill(); }
    });
    if (this.course.theme === "ice") this.canvas("aurora", 720, 200, ctx => {
      for (let i = 0; i < 180; i++) {
        const x = i * 4, y = 28 + Math.sin(i / 31) * 23 + Math.sin(i / 13) * 11;
        const glow = ctx.createLinearGradient(x, y, x, y + 112);
        glow.addColorStop(0, "rgba(145,255,225,0)"); glow.addColorStop(.35, "rgba(159,255,232,.5)"); glow.addColorStop(.7, "rgba(185,181,255,.22)"); glow.addColorStop(1, "rgba(170,200,255,0)");
        ctx.fillStyle = glow; ctx.fillRect(x, y, 4, 112);
      }
    });
    const key = `shore-${this.course.theme}`;
    if (this.scene.textures.exists(key) || this.course.theme !== "ice") return;
    const pen = this.scene.add.graphics();
    pen.fillStyle(0x91bdd5,.6).fillEllipse(90,140,163,24);
    for(let i=0;i<5;i++) { const x=27+i*29,h=42+(i*23%59);pen.fillStyle(0x94d8e9).fillTriangle(x-16,139,x,139-h,x+21,139);pen.fillStyle(0xebffff).fillTriangle(x-16,139,x,139-h,x+2,139);pen.lineStyle(1,0xffffff,.9).lineBetween(x,139-h,x+21,139); }
    pen.fillStyle(0xf4fcff).fillEllipse(91,142,158,14);
    pen.generateTexture(key, 190, 164); pen.destroy();
  }
}
