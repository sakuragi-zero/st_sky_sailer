import Phaser from "phaser";
import { VIEW, getCourse, type Course } from "./stage";
import { makeSceneryTextures } from "./SceneryTextures";

type Wake = { x: number; y: number; age: number; splash: boolean };

/** Shared projection keeps boat, obstacles and pickups on the same rolling sea. */
export const waveOffset = (x: number) => 25 * Math.sin(x / 220) + 7 * Math.sin(x / 83 + 0.7);
export const waveSlope = (x: number) => 25 / 220 * Math.cos(x / 220) + 7 / 83 * Math.cos(x / 83 + 0.7);
export const waterY = (x: number, y: number, anchorX: number) => y - (x - anchorX) * 0.13 + waveOffset(x);

export class Waterway {
  private readonly clouds: Phaser.GameObjects.Graphics;
  private readonly water: Phaser.GameObjects.Graphics;
  private readonly foam: Phaser.GameObjects.Graphics;
  private wakes: Wake[] = [];
  private lastWake = 0;
  private afloat = false;
  private cloudPuffs: Phaser.GameObjects.Image[] = [];
  private waterPaint: Phaser.GameObjects.TileSprite[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly onSplash: () => void, private readonly course: Course = getCourse()) {
    this.clouds = scene.add.graphics().setDepth(2);
    this.water = scene.add.graphics().setDepth(3);
    this.foam = scene.add.graphics().setDepth(11);
    if (course.theme !== "cloud") {
      makeSceneryTextures(scene, course.theme);
      this.waterPaint = Array.from({ length: 24 }, () => scene.add.tileSprite(0, 0, 64, 76, `water-paint-${course.theme}`).setOrigin(0, 0.5).setDepth(3.2).setAlpha(0.6).setVisible(false));
    }
    if (course.theme === "cloud") {
      if (!scene.textures.exists("cloud-bank")) {
        const texture=scene.textures.createCanvas("cloud-bank",192,112);
        if(texture) {
          const ctx=texture.context;
          const puff=(x:number,y:number,rx:number,ry:number,top:string,base:string)=>{
            ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);
            const gradient=ctx.createRadialGradient(-.2,-.38,.08,0,0,1);
            gradient.addColorStop(0,top);gradient.addColorStop(.52,top);gradient.addColorStop(.83,base);gradient.addColorStop(1,"rgba(213,227,250,0)");
            ctx.fillStyle=gradient;ctx.fillRect(-1,-1,2,2);ctx.restore();
          };
          puff(96,74,96,38,"#bbcce8","rgba(174,195,230,.7)");
          puff(37,57,40,33,"#edf4ff","rgba(212,227,248,.8)");
          puff(81,45,47,40,"#fffdf4","rgba(218,232,251,.9)");
          puff(128,51,44,36,"#fffef8","rgba(208,225,248,.85)");
          puff(165,62,30,28,"#f4f8ff","rgba(214,229,249,.7)");
          texture.refresh();
        }
      }
      for(let i=0;i<40;i++) this.cloudPuffs.push(scene.add.image(0,0,"cloud-bank").setOrigin(.5,.4).setDisplaySize(144,84).setDepth(3).setVisible(false));
    }
  }

  splash(x: number, y: number) { this.wakes.push({ x, y, age: 0, splash: true }); if (this.course.theme !== "cloud") this.onSplash(); }

  draw(anchorX: number, shipY: number, elapsed: number, delta: number, afloat: boolean, boosted: boolean, detail = 1) {
    const pen = this.water.clear();
    const scroll = this.scene.cameras.main.scrollX;
    const cloud = this.clouds.clear();
    const cameraY = this.scene.cameras.main.scrollY;
    const channels = this.course.channels, theme = this.course.theme;
    let puffIndex=0;
    let waterIndex=0;
    for(const surface of this.waterPaint) surface.setVisible(false);
    for(const puff of this.cloudPuffs) puff.setVisible(false);
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
        const first=Math.max(0,Math.floor((start-channel.x)/70));
        for(let j=first;channel.x+28+j*70<end;j++) {
          const x=channel.x+28+j*70,puff=this.cloudPuffs[puffIndex++];
          if(!puff) break;
          puff.setPosition(x,y(x,10)+Math.sin(j*2.1)*3).setVisible(true);
        }
        continue;
      }
      // Short reusable strips and sampled banks follow wave crests and troughs.
      const points: number[] = [start];
      for (let x=start+32;x<end;x+=32) points.push(x);
      points.push(end);
      const ribbon = (top:number,bottom:number) => [
        ...points.map(x=>({x,y:y(x,top)})),
        ...points.slice().reverse().map(x=>({x,y:y(x,bottom)})),
      ];
      pen.fillStyle(theme === "desert" ? 0x33b9b1 : 0x4caff4, 0.35).fillPoints(ribbon(32,84),true);
      pen.fillStyle(theme === "desert" ? 0x61bcb5 : theme === "ice" ? 0x86bdd3 : 0x68b6dc, 0.55).fillPoints(ribbon(-42,33),true);
      for (let x=start;x<end;x+=64) {
        const paint = this.waterPaint[waterIndex++];
        if (!paint) break;
        const right=Math.min(end,x+64),dy=y(right,-4)-y(x,-4),width=right-x;
        paint.setPosition(x,y(x,-4)).setRotation(Math.atan2(dy,width)).setSize(Math.hypot(width,dy)+1,74).setVisible(true);
        paint.tilePositionX=x-elapsed*.025;paint.tileScaleY=.52;
      }
      if (theme === "ice" || theme === "desert") {
        pen.lineStyle(theme === "ice" ? 7 : 10, theme === "ice" ? 0xf0fcff : 0xf2cb91, 0.9).beginPath().moveTo(start,y(start,-43));
        points.slice(1).forEach(x=>pen.lineTo(x,y(x,-43)));pen.strokePath();
      }
      pen.fillStyle(0x9deeff, 0.24).fillPoints(ribbon(-40,-8),true);
      // Current strokes travel through the water rather than sitting on its edge.
      for (let row = 0; row < (detail < 1 ? 2 : 3); row++) {
        for (let x = start - 100 + ((elapsed * 0.10 + row * 47) % 140); x < end; x += 140) {
          const left = Math.max(start, x), right = Math.min(end, x + 64 + row * 5);
          if (left >= right) continue;
          const offset = -32 + row * 15 + Math.sin(x / 80 + elapsed / 850) * 3;
          pen.lineStyle(row % 2 ? 1 : 1.5, 0xe9fcff, 0.22);
          pen.beginPath().moveTo(left, y(left, offset));
          for (let x = left + 14; x < right; x += 14) pen.lineTo(x, y(x, offset + Math.sin((x-left)/(right-left)*Math.PI*2)*2));
          pen.lineTo(right, y(right, offset)).strokePath();
        }
      }
      pen.lineStyle(1.5, 0xf0ffff, 0.4).beginPath().moveTo(start, y(start, 32));
      for(let x=start+10;x<end;x+=10) pen.lineTo(x,y(x,32+Math.sin(x/41+elapsed/1700)*1.8));
      pen.lineTo(end,y(end,32)).strokePath();
      // Small reflected highlights travel with the current, without a full-screen shader.
      for(let i=0;i<Math.ceil((end-start)/100)*detail;i++) {
        const x=start+((i*103+elapsed*.035)%(end-start));
        const glint=Math.max(0,Math.sin(elapsed/540+i*2.7));
        const gy=y(x,9+Math.sin(i*3)*20);
        pen.lineStyle(1.5,0xfff4d1,glint*.72).lineBetween(x-7,gy,x+7,gy);
        if(glint>.75) pen.lineStyle(1,0xffffff,glint*.65).lineBetween(x,gy-4,x,gy+4);
      }
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
    if (afloat && elapsed - this.lastWake > (boosted ? 85 : 110) / detail) {
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
        const drops = detail > 0.5 ? 7 : 4;
        for (let i = 0; i < drops; i++) {
          const spread = (i - (drops-1)/2) * (12 + p * 22);
          foam.fillStyle(0xf5ffff, Math.max(0, 1 - p));
          foam.fillEllipse(wake.x + spread, y - Math.sin(p * Math.PI) * (24 + i % 3 * 17), 3, 7);
        }
      }
    }
    if (afloat && theme !== "cloud") {
      // Foam at the keel and bow remains with the boat while its trail recedes.
      const bob = Math.sin(elapsed / 170) * 2;
      const hullY = waterY(anchorX,shipY,anchorX);
      foam.lineStyle(boosted ? 3.8 : 2.7, 0xf5ffff, 0.85);
      foam.beginPath().moveTo(anchorX - 120, hullY + 8 + bob);
      foam.lineTo(anchorX - 54, hullY + 22 + bob);
      foam.lineTo(anchorX + 40, hullY + 21 + bob);
      foam.lineTo(anchorX + 124, hullY + 4 + bob).strokePath();
      for (let i = 0; i < 7; i++) {
        const p = ((elapsed / (boosted ? 280 : 420)) + i / 7) % 1;
        foam.fillStyle(0xffffff, (1 - p) * 0.8);
        foam.fillEllipse(anchorX + 111 + p * 27, hullY + 5 - Math.sin(p * Math.PI) * 22, 3, 5);
      }
    }
  }
}
