import type Phaser from "phaser";
import type { Theme } from "./stage";
import { makeBackgroundObjects } from "./BackgroundObjects";

/** Paint once into reusable textures; shading stays soft like the world artwork. */
export function makeSceneryTextures(scene: Phaser.Scene, theme: Theme) {
  makeBackgroundObjects(scene, theme);
  const canvas = (key: string, width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) => {
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, width, height);
    if (!texture) return;
    paint(texture.context); texture.refresh();
  };
  let seed = 731;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const grain = (ctx: CanvasRenderingContext2D, width: number, height: number, color: string, count: number) => {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) ctx.fillRect(random() * width, random() * height, 0.6 + random() * 2, 0.6 + random() * 3);
  };
  const polygon = (ctx: CanvasRenderingContext2D, points: number[][]) => {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  };

  canvas(`water-paint-${theme}`, 512, 144, ctx => {
    const desert = theme === "desert", ice = theme === "ice";
    const wash = ctx.createLinearGradient(0, 0, 0, 144);
    wash.addColorStop(0, desert ? "#9ddfd2" : ice ? "#b8dfe9" : "#a1d7ed");
    wash.addColorStop(0.45, desert ? "#43b6b4" : ice ? "#65adcc" : "#4ca8d7");
    wash.addColorStop(1, desert ? "#b9e8da" : "#c1e8f6");
    ctx.fillStyle = wash; ctx.fillRect(0, 0, 512, 144);
    // Periodic curves and wrapped cells avoid seams as the texture flows.
    for (let layer = 0; layer < 3; layer++) {
      ctx.lineWidth = layer === 0 ? 2.8 : 1;
      ctx.strokeStyle = layer === 0 ? "rgba(244,252,247,.26)" : "rgba(248,254,255,.43)";
      for (let row = 0; row < 8; row++) {
        ctx.beginPath();
        for (let x = 0; x <= 512; x += 4) {
          const y = 8 + row * 19 + Math.sin(x * Math.PI * 2 / 256 + row * 1.8 + layer) * (3 + layer * 2) + Math.sin(x * Math.PI * 2 / 128 + row) * 2;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
    for (let row = 0; row < 5; row++) for (let col = -1; col < 9; col++) {
      const cx = col * 64 + row % 2 * 32, cy = 25 + row * 28;
      ctx.strokeStyle = "rgba(247,255,250,.22)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cx - 35, cy);
      ctx.bezierCurveTo(cx - 15, cy - 12, cx + 19, cy - 6, cx + 33, cy);
      ctx.bezierCurveTo(cx + 19, cy + 11, cx - 17, cy + 8, cx - 35, cy); ctx.stroke();
    }
    grain(ctx, 512, 144, "rgba(255,255,255,.09)", 1600);
  });

  canvas("cactus", 116, 184, ctx => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(44,170); ctx.lineTo(43,111); ctx.lineTo(24,111);
    ctx.quadraticCurveTo(12,111,12,98); ctx.lineTo(12,63);
    ctx.bezierCurveTo(12,49,30,47,31,63); ctx.lineTo(31,90); ctx.lineTo(44,90);
    ctx.lineTo(44,34); ctx.bezierCurveTo(44,8,77,10,77,34);
    ctx.lineTo(77,74); ctx.lineTo(90,74); ctx.lineTo(90,46);
    ctx.bezierCurveTo(90,32,108,33,108,46); ctx.lineTo(108,83);
    ctx.quadraticCurveTo(108,94,95,94); ctx.lineTo(77,94); ctx.lineTo(78,170); ctx.closePath();
    ctx.clip();
    const shade = ctx.createLinearGradient(10,10,112,145);
    shade.addColorStop(0,"#bdd1a0"); shade.addColorStop(.27,"#87a77b"); shade.addColorStop(.52,"#567f68"); shade.addColorStop(.8,"#375f53"); shade.addColorStop(1,"#24483f");
    ctx.fillStyle = shade; ctx.fillRect(0,0,116,184);
    ctx.lineCap = "round";
    for (const [x,top,bottom] of [[19,57,101],[27,60,98],[51,28,169],[59,22,168],[68,28,169],[96,42,87],[103,45,82]]) {
      ctx.lineWidth = 2.2; ctx.strokeStyle = "rgba(223,231,171,.37)";
      ctx.beginPath(); ctx.moveTo(x,top); ctx.quadraticCurveTo(x-2,(top+bottom)/2,x+1,bottom); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(27,62,51,.25)";
      ctx.beginPath(); ctx.moveTo(x+3,top+4); ctx.lineTo(x+3,bottom); ctx.stroke();
    }
    grain(ctx,116,184,"rgba(241,234,190,.15)",1200);
    ctx.restore();
    ctx.strokeStyle = "rgba(244,226,174,.7)"; ctx.lineWidth = 1;
    for(let i=0;i<9;i++) {
      const y=42+i*13; ctx.beginPath(); ctx.moveTo(45,y);ctx.lineTo(40,y-3);ctx.moveTo(77,y+4);ctx.lineTo(81,y+1);ctx.stroke();
    }
    for(let i=0;i<6;i++) {
      ctx.fillStyle = i%2 ? "#e49a89" : "#b96f73";
      ctx.beginPath();ctx.ellipse(60+Math.cos(i*Math.PI/3)*7,20+Math.sin(i*Math.PI/3)*5,6,4,i*Math.PI/3,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle="#f2d9a3";ctx.beginPath();ctx.arc(60,20,3,0,Math.PI*2);ctx.fill();
  });

}
