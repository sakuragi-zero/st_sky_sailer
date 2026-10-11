import Phaser from "phaser";
import type { Course } from "./stage";
import { waterY } from "./Waterway";
import { makeBackgroundObjects } from "./BackgroundObjects";

/** Painted shore and stone landing share the distant world's actual brushwork. */
export class Mooring {
  private readonly shore: Phaser.GameObjects.Image;
  private readonly pier: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Ellipse;
  private readonly label: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene, private readonly course: Course) {
    makeBackgroundObjects(scene, course.theme);
    const key = `harbor-pier-${course.theme}`;
    if (!scene.textures.exists(key)) {
      const texture = scene.textures.createCanvas(key, 340, 150)!;
      const ctx = texture.context;
      const ice = course.theme === "ice", desert = course.theme === "desert";
      const stone = ctx.createLinearGradient(0, 38, 0, 140);
      stone.addColorStop(0, ice ? "#e6f6fc" : desert ? "#f8d9a8" : "#eef0dc");
      stone.addColorStop(.45, ice ? "#a7d0e8" : desert ? "#c2956a" : "#abb8bd");
      stone.addColorStop(1, ice ? "#568fb9" : desert ? "#795d55" : "#576f92");
      ctx.fillStyle = stone;
      ctx.beginPath(); ctx.moveTo(15,69); ctx.lineTo(299,35); ctx.lineTo(328,59); ctx.lineTo(328,102); ctx.lineTo(42,137); ctx.lineTo(15,112); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.moveTo(15,69); ctx.lineTo(299,35); ctx.lineTo(328,59); ctx.lineTo(42,97); ctx.closePath(); ctx.clip();
      const source = scene.textures.get("world").getSourceImage() as HTMLImageElement;
      const sample = ice ? [786,377,180,35] : desert ? [1020,427,180,35] : course.theme === "cloud" ? [945,281,180,35] : [588,484,180,35];
      ctx.drawImage(source, ...sample as [number,number,number,number], 0, 32, 340, 70);
      ctx.fillStyle = ice ? "rgba(227,249,255,.3)" : "rgba(249,235,203,.25)"; ctx.fillRect(0,0,340,150);
      ctx.restore();
      ctx.lineWidth=1; ctx.strokeStyle="rgba(246,251,255,.48)";
      for(let i=0;i<10;i++) {
        const x=43+i*29;ctx.beginPath();ctx.moveTo(x,96-i*3.5);ctx.lineTo(x,128-i*3.5);ctx.stroke();
      }
      ctx.strokeStyle="rgba(45,67,95,.22)";
      ctx.beginPath();ctx.moveTo(42,116);ctx.lineTo(328,81);ctx.stroke();
      for(const [x,y] of [[62,70],[174,57],[282,44]]) {
        const shade=ctx.createLinearGradient(x-7,0,x+8,0);shade.addColorStop(0,"#e9e3d1");shade.addColorStop(.5,"#a3a6a2");shade.addColorStop(1,"#647587");
        ctx.fillStyle=shade;ctx.fillRect(x-6,y-25,12,26);ctx.beginPath();ctx.ellipse(x,y-25,9,4,0,0,Math.PI*2);ctx.fill();
      }
      texture.refresh();
    }
    this.shore=scene.add.image(course.goalX+280,0,`harbor-shore-${course.theme}`).setOrigin(.5,.92).setDepth(3).setDisplaySize(410,course.theme==="desert"?140:230);
    this.pier=scene.add.image(course.goalX+165,0,key).setOrigin(.5,.57).setDepth(5).setDisplaySize(295,130);
    this.glow=scene.add.ellipse(course.goalX+175,0,145,20,0xffedba,.14).setDepth(6);
    this.label=scene.add.text(course.goalX+195,0,course.goal_label,{fontFamily:"serif",fontSize:"20px",color:"#fff9e8",stroke:"#405977",strokeThickness:3}).setOrigin(.5,1).setDepth(7);
  }
  draw(anchorX:number,time:number) {
    const y=waterY(this.course.goalX+165,this.course.goalY,anchorX);
    const visible=Math.abs(anchorX-this.course.goalX)<1050;
    this.shore.setVisible(visible).setY(y+15);
    this.pier.setVisible(visible).setY(y+12);
    this.glow.setVisible(visible).setY(y-8).setAlpha(.12+Math.sin(time/700)*.035);
    this.label.setVisible(visible).setY(y-230);
  }
}
