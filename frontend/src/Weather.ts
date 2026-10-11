import Phaser from "phaser";
import type { Theme } from "./stage";
import { VIEW } from "./stage";

const smooth=(a:number,b:number,x:number)=>{const t=Phaser.Math.Clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
/** Distance-based weather, so waiting never skips the middle storm. */
export class VoyageWeather {
  intensity=0;
  label="晴れ";
  private readonly sky:Phaser.GameObjects.Graphics;
  private readonly rain:Phaser.GameObjects.Graphics;
  private readonly veil: Phaser.GameObjects.Image[] = [];
  private lastDraw = -1000;
  private thunderCycle = -1;
  private thunderAt: number | null = null;
  constructor(scene:Phaser.Scene,private readonly theme:Theme,private readonly onThunder:(strength:number)=>void = () => {}) {
    this.sky=scene.add.graphics().setScrollFactor(0).setDepth(1);
    this.rain=scene.add.graphics().setScrollFactor(0).setDepth(14);
    if (theme === "ice" || theme === "desert") {
      const key = `storm-veil-${theme}`;
      if (!scene.textures.exists(key)) {
        // One soft, irregular wash is reused by a fixed pool. Transparent
        // valleys between the banks reveal fragments of the voyage below.
        const texture = scene.textures.createCanvas(key,512,256)!;
        const ctx = texture.context;
        const color = theme === "ice" ? "228,241,248" : "206,167,113";
        for (let i=0;i<7;i++) {
          const x=70+i*62, y=110+Math.sin(i*1.8)*37;
          ctx.save();ctx.translate(x,y);ctx.scale(1,.68);
          const wash = ctx.createRadialGradient(0,0,12,0,0,113);
          wash.addColorStop(0,`rgba(${color},.95)`);wash.addColorStop(.52,`rgba(${color},.72)`);wash.addColorStop(1,`rgba(${color},0)`);
          ctx.fillStyle=wash;ctx.fillRect(-113,-113,226,226);ctx.restore();
        }
        texture.refresh();
      }
      for (let i=0;i<8;i++) this.veil.push(scene.add.image(0,0,key).setScrollFactor(0).setDepth(15).setFlipX(i%2===1).setVisible(false));
    }
  }
  draw(progress:number,time:number,delta:number,detail=1,reducedMotion=false) {
    const target=smooth(.24,.38,progress)*(1-smooth(.64,.83,progress));
    this.intensity=Phaser.Math.Linear(this.intensity,target,1-Math.exp(-delta/650));
    const strength=this.intensity;
    const opacity = smooth(.25,.8,strength);
    const drift = reducedMotion ? 0 : time;
    this.veil.forEach((bank,i) => {
      bank.setVisible(opacity > .01);
      if (opacity <= .01) return;
      const layer = Math.floor(i/4), column = i%4;
      const x=((column*340+drift*(layer ? -.055 : .075)+layer*170)%1360+1360)%1360-300;
      const y=110+layer*235+Math.sin(drift/2100+i*1.7)*48;
      // Opposing banks drift apart periodically, leaving moving windows.
      const gust=.68+Math.sin(drift/2900+i*2.3)*.22;
      bank.setPosition(x,y).setDisplaySize(660,330).setAlpha(opacity*gust);
    });
    // Schedule one distant rumble per lightning cycle, including the storm's
    // arrival. Simulation time freezes this delay while the voyage is paused.
    const cycle = Math.floor(time/9400);
    if (strength > .8 && cycle !== this.thunderCycle && this.thunderAt === null) {
      this.thunderCycle = cycle; this.thunderAt = time+700;
    }
    if (strength <= .55) this.thunderAt = null;
    if (this.thunderAt !== null && time >= this.thunderAt) {
      this.thunderAt = null; this.onThunder(strength);
    }
    this.label=strength>.55 ? this.theme==="ice" ? "吹雪" : this.theme==="desert" ? "砂嵐" : "嵐" : strength>.12 ? progress>.64 ? "晴れ間へ" : "雲行きが変わる…" : "晴れ";
    if(time-this.lastDraw < 1000/30) return;
    this.lastDraw=time;
    const sky=this.sky.clear(),rain=this.rain.clear();
    if(strength>.015) {
      sky.fillStyle(this.theme==="desert" ? 0x8a603d : 0x293758,.42*strength).fillRect(0,0,VIEW.width,VIEW.height);
      for(let i=0;i<8;i++) {
        const x=(i*173+time*(.018+i%3*.004))%1080-180;
        sky.fillStyle(this.theme==="desert" ? 0xb89366 : 0x42516a,.27*strength).fillEllipse(x,30+i%3*36,330,105);
      }
      for(let i=0;i<Math.round(64*detail);i++) {
        const x=(i*137-time*(this.theme==="desert" ? .65 : .19))%880;
        const px=(x+880)%880-80;
        const y=(i*83+time*(this.theme==="desert" ? .055 : .48+i%3*.04))%540-30;
        if(this.theme==="ice") rain.fillStyle(0xf0f9ff,strength*.8).fillCircle(px,y,1.5+i%3);
        else if(this.theme==="desert") {
          rain.lineStyle(1.5,0xffd79b,strength*.52).lineBetween(px,y,px+13+i%4*5,y-3);
        } else rain.lineStyle(1.2,0xddeaff,strength*.57).lineBetween(px,y,px-9,y+24);
      }
      if(!reducedMotion && this.theme!=="desert" && strength>.8) {
        const flash=(time%9400);
        if(flash<95 || flash>180 && flash<230) sky.fillStyle(0xf1f6ff,.21*strength).fillRect(0,0,VIEW.width,VIEW.height);
      }
    }
    const sunshine=1-strength;
    sky.fillStyle(0xfff3c2,.07*sunshine).fillCircle(600,75,76);
    sky.fillStyle(0xfff6d6,.12*sunshine).fillCircle(600,75,41);
    // Warm shafts appear again after the storm, celebrating the approaching mooring.
    if(progress>.7) {
      const glow=smooth(.7,.88,progress)*sunshine;
      sky.fillStyle(0xffedb5,.11*glow).fillTriangle(610,-20,405,480,510,480);
      sky.fillStyle(0xffffff,.07*glow).fillTriangle(680,-20,590,480,660,480);
    }
  }
  get tint() {
    const s=this.intensity;
    return Phaser.Display.Color.GetColor(Math.round(255-66*s),Math.round(255-78*s),Math.round(255-(this.theme==="desert" ? 106 : 45)*s));
  }
}
