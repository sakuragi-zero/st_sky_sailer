import Phaser from "phaser";
import { waterY } from "./Waterway";

/** Warm circular lights are centered on the actual collision bodies. */
export class SpiritGuide {
  enabled = false;
  private readonly pen: Phaser.GameObjects.Graphics;
  constructor(private readonly scene: Phaser.Scene) { this.pen = scene.add.graphics().setDepth(16); }
  draw(anchorX: number, time: number, player: Phaser.Physics.Arcade.Body, falling: {x:number;y:number}[]) {
    const pen = this.pen.clear();
    if (!this.enabled) return;
    const camera = this.scene.cameras.main;
    const light = (x:number,y:number,radius=17) => {
      if(x<camera.scrollX-40 || x>camera.scrollX+760 || y<camera.scrollY-40 || y>camera.scrollY+520) return;
      const pulse = 1 + Math.sin(time/430+x*.03)*.12;
      for(let ring=5;ring>0;ring--) pen.fillStyle(0xffce7a,.03+(5-ring)*.012).fillCircle(x,y,(radius+ring*5)*pulse);
      pen.fillStyle(0xffd582,.18).fillCircle(x,y,radius*.58*pulse);
      pen.fillStyle(0xffedb6,.45).fillCircle(x,y,radius*.24*pulse);
      pen.lineStyle(1,0xffe0a3,.4).strokeCircle(x,y,radius*pulse);
      pen.fillStyle(0xfff5d8,.55).fillCircle(x,y,3.5);
      pen.fillStyle(0xfff8df,.65).fillCircle(x+Math.sin(time/650+x)*radius,y+Math.cos(time/700+x)*radius,2);
    };
    for (const body of this.scene.physics.world.staticBodies.entries) {
      if(!body.enable) continue;
      if(body.width>200) {
        for(let x=body.x+12;x<body.right;x+=92) light(x,waterY(x,body.y,anchorX),13);
        light(body.right,waterY(body.right,body.y,anchorX),13);
      } else light(body.center.x,waterY(body.center.x,body.center.y,anchorX),Math.max(17,Math.min(32,body.height/2)));
    }
    light(player.center.x,player.center.y,22);
    falling.forEach(point=>light(point.x,waterY(point.x,point.y,anchorX),24));
  }
}
