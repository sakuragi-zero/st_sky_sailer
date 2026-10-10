import Phaser from "phaser";
import type { Course } from "./stage";
import { waterY } from "./Waterway";

/** A small landing pier, not a palace, with materials matching each course. */
export class Mooring {
  private readonly pen: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  constructor(private readonly scene:Phaser.Scene,private readonly course:Course) {
    this.pen=scene.add.graphics().setDepth(5);
    this.label=scene.add.text(course.goalX+55,course.goalY-185,course.goal_label,{fontFamily:"serif",fontSize:"20px",color:"#ffffff",stroke:"#244675",strokeThickness:3}).setDepth(7);
  }
  draw(anchorX:number,time:number) {
    const c=this.course, pen=this.pen.clear(), x=c.goalX+90, y=waterY(x,c.goalY,anchorX);
    const camera=this.scene.cameras.main;
    const visible=x+250>camera.scrollX && x-70<camera.scrollX+camera.width;
    this.label.setVisible(visible);
    if(!visible) return;
    const ice=c.theme==="ice", desert=c.theme==="desert", cloud=c.theme==="cloud";
    const top=ice?0xd4f5ff:desert?0xf7d7a0:cloud?0xf4f2ff:0xe7c799;
    const edge=ice?0x73bad7:desert?0xb27b4e:cloud?0x8b9fcd:0x8a654e;
    this.label.setY(y-180);
    if(cloud) for(let i=0;i<5;i++) pen.fillStyle(0xffffff,.9).fillEllipse(x+i*43,y+49,100,52);
    for(let i=0;i<5;i++) {
      const px=x+i*48;
      pen.fillStyle(edge).fillRoundedRect(px,y-15,9,cloud?68:108,3);
      pen.fillStyle(top).fillEllipse(px+4,y-15,16,9);
    }
    pen.fillStyle(edge).fillRoundedRect(x-22,y+8,256,23,5);
    pen.fillStyle(top).fillPoints([{x:x-22,y:y+8},{x:x+217,y:y-21},{x:x+235,y:y+7},{x:x-8,y:y+36}],true);
    pen.lineStyle(1,edge,.45);
    for(let i=0;i<13;i++) pen.lineBetween(x-13+i*19,y+10-i*2.3,x+i*19,y+29-i*2.3);
    // Posts, rope rails and a welcoming lantern provide a readable docking silhouette.
    pen.lineStyle(3,0xe7dbb6,.9);
    pen.beginPath().moveTo(x+6,y-31).lineTo(x+57,y-21).lineTo(x+109,y-44).lineTo(x+159,y-37).lineTo(x+208,y-59).strokePath();
    for(let i=0;i<5;i++) pen.fillStyle(edge).fillRoundedRect(x+i*50,y-47-i*6,7,60,3);
    pen.fillStyle(edge).fillRoundedRect(x+172,y-150,7,143,3);
    pen.lineStyle(5,edge).lineBetween(x+175,y-148,x+143,y-148);
    for(let r=4;r>0;r--) pen.fillStyle(0xffd78d,.045).fillCircle(x+144,y-126,14+r*8+Math.sin(time/600)*2);
    pen.fillStyle(0xffefd0).fillRoundedRect(x+134,y-142,21,33,4);
    pen.lineStyle(2,edge).strokeRoundedRect(x+134,y-142,21,33,4);
    pen.fillStyle(0xff4b4b).fillTriangle(x+178,y-146,x+222,y-137,x+178,y-126);
    if(ice) { pen.fillStyle(0xffffff,.9).fillEllipse(x+63,y+3,71,12); pen.fillStyle(0x9bdcf2).fillTriangle(x+215,y-10,x+224,y-55,x+235,y-11); }
    if(desert) { pen.fillStyle(0xd2a47a).fillRoundedRect(x+73,y-81,45,48,7); pen.fillStyle(0xf4e1bb).fillTriangle(x+60,y-78,x+94,y-111,x+129,y-86); pen.fillStyle(0x398a71).fillRoundedRect(x+205,y-85,12,54,5).fillRoundedRect(x+192,y-68,15,9,4); }
    if(cloud) { pen.fillStyle(0xd5b66a).fillCircle(x+100,y-54,9); pen.fillStyle(0xfff8da).fillCircle(x+100,y-54,4); }
    if(!ice&&!desert&&!cloud) { pen.fillStyle(0x657fa5).fillRoundedRect(x+57,y-42,31,27,3); pen.lineStyle(2,0xe7d4a7).strokeCircle(x+35,y-38,11); }
  }
}
