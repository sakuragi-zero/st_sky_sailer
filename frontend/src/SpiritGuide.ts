import Phaser from "phaser";
import { waterY } from "./Waterway";

/** A fixed pool of soft lights marks real collision bodies without rebuilding circles each frame. */
export class SpiritGuide {
  enabled = false;
  private readonly lights: Phaser.GameObjects.Image[] = [];
  constructor(private readonly scene: Phaser.Scene) {
    if (!scene.textures.exists("spirit-light")) {
      const texture=scene.textures.createCanvas("spirit-light",128,128);
      if(texture) {
        const ctx=texture.context;
        const glow=ctx.createRadialGradient(64,64,0,64,64,64);
        glow.addColorStop(0,"rgba(255,250,222,.96)");
        glow.addColorStop(.08,"rgba(255,238,181,.78)");
        glow.addColorStop(.23,"rgba(255,214,139,.32)");
        glow.addColorStop(.56,"rgba(255,202,119,.13)");
        glow.addColorStop(1,"rgba(255,202,119,0)");
        ctx.fillStyle=glow;ctx.fillRect(0,0,128,128);
        ctx.strokeStyle="rgba(255,223,164,.4)";ctx.lineWidth=1.3;
        ctx.beginPath();ctx.arc(64,64,26,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle="rgba(255,248,224,.8)";ctx.beginPath();ctx.arc(83,47,2.3,0,Math.PI*2);ctx.fill();
        texture.refresh();
      }
    }
    for(let i=0;i<32;i++) this.lights.push(scene.add.image(0,0,"spirit-light").setDepth(16).setVisible(false));
  }
  draw(anchorX: number, time: number, player: Phaser.Physics.Arcade.Body, falling: {x:number;y:number}[]) {
    for(const light of this.lights) light.setVisible(false);
    if (!this.enabled) return;
    const camera = this.scene.cameras.main;
    let used=0;
    const light = (x:number,y:number,radius=17) => {
      if(x<camera.scrollX-40 || x>camera.scrollX+760 || y<camera.scrollY-40 || y>camera.scrollY+520) return;
      const sprite=this.lights[used++];if(!sprite)return;
      const pulse=1+Math.sin(time/430+x*.03)*.1,size=(radius+27)*2*pulse;
      sprite.setPosition(x,y).setDisplaySize(size,size).setVisible(true);
    };
    // Reserve the first sprite for the captain even on densely packed cloud steps.
    light(player.center.x,player.center.y,22);
    for (const body of this.scene.physics.world.staticBodies.entries) {
      if(!body.enable || body.right<camera.scrollX-60 || body.x>camera.scrollX+780) continue;
      if(body.width>200) {
        const first=Math.max(0,Math.ceil((camera.scrollX-40-body.x-12)/92));
        for(let x=body.x+12+first*92;x<Math.min(body.right,camera.scrollX+760);x+=92) light(x,waterY(x,body.y,anchorX),13);
        light(body.right,waterY(body.right,body.y,anchorX),13);
      } else light(body.center.x,waterY(body.center.x,body.center.y,anchorX),Math.max(17,Math.min(32,body.height/2)));
    }
    falling.forEach(point=>light(point.x,waterY(point.x,point.y,anchorX),24));
  }
}
