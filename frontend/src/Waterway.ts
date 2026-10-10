import Phaser from "phaser";
import { VIEW, getCourse, type Course } from "./stage";

type Wake = { x: number; y: number; age: number; splash: boolean };

/** Visual projection only. Collisions remain in the route's simple world space. */
export const waterY = (x: number, y: number, anchorX: number) => y - (x - anchorX) * 0.13;

export class Waterway {
  private readonly clouds: Phaser.GameObjects.Graphics;
  private readonly water: Phaser.GameObjects.Graphics;
  private readonly foam: Phaser.GameObjects.Graphics;
  private wakes: Wake[] = [];
  private lastWake = 0;
  private afloat = false;

  constructor(private readonly scene: Phaser.Scene, private readonly onSplash: () => void, private readonly course: Course = getCourse()) {
    this.clouds = scene.add.graphics().setDepth(2);
    this.water = scene.add.graphics().setDepth(3);
    this.foam = scene.add.graphics().setDepth(11);
  }

  splash(x: number, y: number) { this.wakes.push({ x, y, age: 0, splash: true }); if (this.course.theme !== "cloud") this.onSplash(); }

  draw(anchorX: number, shipY: number, elapsed: number, delta: number, afloat: boolean, boosted: boolean) {
    const pen = this.water.clear();
    const scroll = this.scene.cameras.main.scrollX;
    const cloud = this.clouds.clear();
    const cameraY = this.scene.cameras.main.scrollY;
    const channels = this.course.channels, theme = this.course.theme;
    const fogColor = theme === "desert" ? 0xffefd5 : 0xe8f8ff;
    // The routes float above cloud depth, so their gaps cannot resemble open sea.
    for (let band = 0; band < (theme === "cloud" ? 0 : 18); band++) {
      cloud.fillStyle(fogColor, band / 22);
      cloud.fillRect(scroll - 180, cameraY + 325 + band * 9, VIEW.width + 360, 10);
    }
    if (theme !== "cloud") cloud.fillStyle(fogColor, 0.85).fillRect(scroll - 180, cameraY + 485, VIEW.width + 360, 400);
    for (let i = 0; i < (theme === "cloud" ? 0 : 7); i++) {
      cloud.fillStyle(0xffffff, 0.32);
      cloud.fillEllipse(scroll - 80 + i * 160, cameraY + 470 + Math.sin(elapsed / 1500 + i) * 12, 260, 70);
    }
    channels.slice(0, theme === "cloud" ? 0 : -1).forEach((channel, i) => {
      const lip = channel.x + channel.width, next = channels[i + 1];
      if (lip > scroll + VIEW.width + 120 || next.x < scroll - 120) return;
      const left = waterY(lip, channel.y - 43, anchorX), right = waterY(next.x, next.y - 43, anchorX);
      cloud.fillStyle(theme === "desert" ? 0xfff2dc : 0xe7f7ff, 0.95).fillPoints([
        { x: lip, y: left }, { x: next.x, y: right },
        { x: next.x + 30, y: right + 270 }, { x: lip - 30, y: left + 270 },
      ], true);
      cloud.fillStyle(0xffffff, 0.85).fillEllipse((lip + next.x) / 2, Math.max(left, right) + 160, next.x - lip + 55, 60);
    });
    for (const channel of channels) {
      if (channel.x > scroll + VIEW.width + 180 || channel.x + channel.width < scroll - 200) continue;
      const start = Math.max(channel.x, scroll - 160);
      const end = Math.min(channel.x + channel.width, scroll + VIEW.width + 180);
      const y = (x: number, offset = 0) => waterY(x, channel.y + offset, anchorX);
      if (theme === "cloud") {
        pen.fillStyle(0xa9c5e8, 0.9).fillPoints([{x:start,y:y(start,8)},{x:end,y:y(end,8)},{x:end-10,y:y(end,62)},{x:start+10,y:y(start,62)}],true);
        for (let x = start + 18; x < end; x += 56) {
          pen.fillStyle(0xe0eafb,0.95).fillEllipse(x,y(x,35),96,57);
          pen.fillStyle(0xffffff,0.96).fillEllipse(x,y(x,-3)+Math.sin(x/67)*3,92,42);
          pen.fillStyle(0xfff3df,0.42).fillEllipse(x-4,y(x,-11),62,18);
        }
        continue;
      }
      // Translucent water has a visible near edge and a slanted, broad upper face.
      pen.fillStyle(theme === "desert" ? 0x33b9b1 : 0x4caff4, 0.35).fillPoints([
        { x: start, y: y(start, 32) }, { x: end, y: y(end, 32) },
        { x: end, y: y(end, 84) }, { x: start, y: y(start, 84) },
      ], true);
      pen.fillStyle(theme === "desert" ? 0x19aca9 : theme === "ice" ? 0x60b3df : 0x1b9de7, 0.68).fillPoints([
        { x: start, y: y(start, -42) }, { x: end, y: y(end, -42) },
        { x: end, y: y(end, 33) }, { x: start, y: y(start, 33) },
      ], true);
      if (theme === "ice" || theme === "desert") {
        pen.lineStyle(theme === "ice" ? 7 : 10, theme === "ice" ? 0xf0fcff : 0xf2cb91, 0.9).lineBetween(start,y(start,-43),end,y(end,-43));
      }
      pen.fillStyle(0x9deeff, 0.24).fillPoints([
        { x: start, y: y(start, -40) }, { x: end, y: y(end, -40) },
        { x: end, y: y(end, -8) }, { x: start, y: y(start, -8) },
      ], true);
      // Current strokes travel through the water rather than sitting on its edge.
      for (let row = 0; row < 5; row++) {
        for (let x = start - 100 + ((elapsed * 0.10 + row * 47) % 140); x < end; x += 140) {
          const left = Math.max(start, x), right = Math.min(end, x + 64 + row * 5);
          if (left >= right) continue;
          const offset = -32 + row * 15 + Math.sin(x / 80 + elapsed / 850) * 3;
          pen.lineStyle(row % 2 ? 1.6 : 2.4, 0xe9fcff, 0.48);
          pen.beginPath().moveTo(left, y(left, offset));
          pen.lineTo((left + right) / 2, y((left + right) / 2, offset - 3));
          pen.lineTo(right, y(right, offset)).strokePath();
        }
      }
      pen.lineStyle(3, 0xf0ffff, 0.6).lineBetween(start, y(start, 32), end, y(end, 32));
      const lip = channel.x + channel.width;
      if (lip < scroll - 140 || lip > scroll + VIEW.width + 160 || channel === channels.at(-1)) continue;
      const lipY = y(lip);
      // A falling curtain under each break makes the absent water explicit.
      pen.fillStyle(0xaeeeff, 0.57).fillPoints([
        { x: lip - 9, y: lipY - 42 }, { x: lip + 12, y: lipY + 33 },
        { x: lip + 34, y: lipY + 245 }, { x: lip - 42, y: lipY + 215 },
      ], true);
      for (let strand = 0; strand < 12; strand++) {
        const top = lipY - 39 + strand * 6;
        const x = lip - 6 + strand * 1.1;
        const fall = (elapsed * 0.33 + strand * 31) % 210;
        pen.lineStyle(2 + strand % 3, 0xffffff, 0.34);
        pen.lineBetween(x, top + fall, x + (strand - 5) * 1.4, top + fall + 46);
      }
      pen.lineStyle(5, 0xffffff, 0.82).lineBetween(lip - 9, lipY - 41, lip + 12, lipY + 33);
      pen.fillStyle(0xedfaff, 0.21).fillEllipse(lip - 5, lipY + 210, 120, 35);
    }

    // Large drops have a full-height curtain. Ascending falls carry the boat upward.
    for(const cascade of this.course.cascades) {
      if(cascade.nextX<scroll-120 || cascade.x>scroll+VIEW.width+100) continue;
      const center=(cascade.x+cascade.nextX)/2;
      const upper=Math.min(cascade.fromY,cascade.toY),lower=Math.max(cascade.fromY,cascade.toY);
      const top=waterY(center,upper-30,anchorX),bottom=waterY(center,lower+45,anchorX);
      pen.fillStyle(theme==="cloud" ? 0xffe4a1 : 0x9ee9fa,theme==="cloud" ? .12 : .6).fillRoundedRect(center-42,top,84,bottom-top,20);
      for(let i=0;i<10;i++) {
        const progress=(elapsed*(cascade.ascent ? -.0006 : .0007)+i*.1)%1;
        const p=(progress+1)%1, x=center-37+i*8;
        pen.lineStyle(2, cascade.ascent ? 0xffefb3 : 0xffffff,.6);
        pen.lineBetween(x,top+p*(bottom-top),x,Math.min(bottom,top+p*(bottom-top)+33));
      }
      pen.fillStyle(0xffffff,.55).fillEllipse(center,bottom,110,27);
      if(cascade.ascent) {
        for(let i=0;i<3;i++) {
          const y=top+35+i*60;
          pen.lineStyle(3,0xffe6a2,.85).beginPath().moveTo(center-10,y+9).lineTo(center,y).lineTo(center+10,y+9).strokePath();
        }
      }
    }

    if (afloat && !this.afloat) this.splash(anchorX, shipY + 13);
    this.afloat = afloat;
    if (afloat && elapsed - this.lastWake > (boosted ? 55 : 95)) {
      this.wakes.push({ x: anchorX - 108, y: shipY + 13, age: 0, splash: false });
      this.lastWake = elapsed;
    }
    const foam = this.foam.clear();
    this.wakes = this.wakes.filter(wake => wake.age < (wake.splash ? 750 : 1300));
    for (const wake of this.wakes) {
      wake.age += delta;
      const p = wake.age / (wake.splash ? 750 : 1300);
      const width = (wake.splash ? 160 : 100) + p * 150;
      const y = waterY(wake.x, wake.y, anchorX);
      if (theme === "cloud") {
        foam.fillStyle(0xffffff,Math.max(0,(1-p)*0.65)).fillEllipse(wake.x-p*30,y,width*0.65,18+p*22);
        continue;
      }
      foam.lineStyle(2.5 * (1 - p) + 0.5, 0xffffff, Math.max(0, (1 - p) * 0.65));
      foam.strokeEllipse(wake.x - p * 25, y, width, 14 + p * 30);
      if (wake.splash) {
        for (let i = 0; i < 9; i++) {
          const spread = (i - 4) * (12 + p * 22);
          foam.fillStyle(0xf5ffff, Math.max(0, 1 - p));
          foam.fillEllipse(wake.x + spread, y - Math.sin(p * Math.PI) * (24 + i % 3 * 17), 3, 7);
        }
      }
    }
    if (afloat && theme !== "cloud") {
      // Foam at the keel and bow remains with the boat while its trail recedes.
      const bob = Math.sin(elapsed / 170) * 2;
      foam.lineStyle(boosted ? 3.8 : 2.7, 0xf5ffff, 0.85);
      foam.beginPath().moveTo(anchorX - 120, shipY + 8 + bob);
      foam.lineTo(anchorX - 54, shipY + 22 + bob);
      foam.lineTo(anchorX + 40, shipY + 21 + bob);
      foam.lineTo(anchorX + 124, shipY + 4 + bob).strokePath();
      for (let i = 0; i < 7; i++) {
        const p = ((elapsed / (boosted ? 280 : 420)) + i / 7) % 1;
        foam.fillStyle(0xffffff, (1 - p) * 0.8);
        foam.fillEllipse(anchorX + 111 + p * 27, shipY + 5 - Math.sin(p * Math.PI) * 22, 3, 5);
      }
    }
  }
}
