import Phaser from "phaser";
import type { Course, Obstacle } from "./stage";
import { waterY } from "./Waterway";

type RaisedHazard = { spec: Obstacle; art: Phaser.GameObjects.Image; body: Phaser.Physics.Arcade.StaticBody; began: number | null; splashed: boolean };
type Icicle = { x: number; surfaceY: number; y: number; velocity: number; began: number | null; state: "waiting" | "warning" | "falling" | "spent"; art: Phaser.GameObjects.Image; hit: boolean };

export class CourseHazards {
  private raised: RaisedHazard[] = [];
  private icicles: Icicle[] = [];
  private readonly warnings: Phaser.GameObjects.Graphics;
  private readonly weather: Phaser.GameObjects.Graphics;
  cue = "";
  guidePoints() { return this.icicles.filter(spike=>spike.state==="falling").map(spike=>({x:spike.x,y:spike.y})); }

  constructor(private readonly scene: Phaser.Scene, private readonly course: Course, player: Phaser.Physics.Arcade.Sprite, private readonly onHit: () => void, private readonly onSplash: (x: number, y: number) => void) {
    this.makeTextures();
    this.warnings = scene.add.graphics().setDepth(7);
    this.weather = scene.add.graphics().setDepth(14).setScrollFactor(0);
    const zones = scene.physics.add.staticGroup();
    for (const spec of course.hazards) {
      const iceberg = spec.kind === "iceberg", cactus = spec.kind === "cactus";
      const zone = scene.add.rectangle(spec.x, spec.y - (cactus ? 46 : iceberg ? 44 : 20), cactus ? 30 : iceberg ? 48 : 22, cactus ? 92 : iceberg ? 88 : 32, 0xffffff, 0);
      scene.physics.add.existing(zone, true); zones.add(zone);
      const body = zone.body as Phaser.Physics.Arcade.StaticBody;
      body.enable = !iceberg;
      const art = scene.add.image(spec.x, spec.y, iceberg ? "iceberg" : cactus ? "cactus" : "storm").setDepth(6);
      if (iceberg) art.setOrigin(0.5, 1).setDisplaySize(124, 124).setVisible(false);
      if (cactus) art.setOrigin(0.5, 1).setDisplaySize(68, 116);
      this.raised.push({ spec, art, body, began: null, splashed: false });
    }
    scene.physics.add.overlap(player, zones, () => this.onHit());
    for (const point of course.icicles) this.icicles.push({ x: point.x, surfaceY: point.y, y: point.y - 500, velocity: 0, began: null, state: "waiting", art: scene.add.image(point.x, point.y - 500, "icicle").setDisplaySize(28, 85).setDepth(12).setVisible(false), hit: false });
  }

  update(anchorX: number, shipY: number, time: number, delta: number) {
    const pen = this.warnings.clear();
    this.cue = "";
    for (const row of this.raised) {
      const { spec, art } = row;
      if (spec.kind === "iceberg") {
        if (row.began === null && spec.x - anchorX < 360 && spec.x - anchorX > -100) row.began = time;
        if (row.began === null) continue;
        const rise = Phaser.Math.Clamp((time - row.began - 550) / 750, 0, 1);
        art.setVisible(rise > 0).setAlpha(Math.min(1, rise * 1.5)).setY(waterY(spec.x, spec.y + (1 - rise) * 116, anchorX));
        row.body.enable = rise > 0.6;
        if (rise < 1) {
          this.warning(pen, spec.x, waterY(spec.x, spec.y, anchorX), time, 0x6caff2);
          this.cue = "氷山がせり上がるよ！";
        }
        if (rise > 0.4 && !row.splashed) { row.splashed = true; this.onSplash(spec.x, spec.y); }
      } else {
        art.setY(waterY(spec.x, spec.y - (spec.kind === "whirl" ? 20 : 0), anchorX));
        if (spec.kind === "whirl") art.setRotation(Math.sin(time / 370) * 0.08);
        if (spec.kind === "cactus") {
          pen.fillStyle(0xe2b26e, 0.9).fillEllipse(spec.x, waterY(spec.x, spec.y + 7, anchorX), 87, 21);
          pen.lineStyle(1, 0xffedb8, 0.8).strokeEllipse(spec.x, waterY(spec.x, spec.y + 5, anchorX), 83, 18);
        }
      }
    }
    for (const spike of this.icicles) {
      if (spike.state === "waiting" && spike.x - anchorX < 320 && spike.x - anchorX > -35) { spike.state = "warning"; spike.began = time; }
      if (spike.state === "warning") {
        this.warning(pen, spike.x, waterY(spike.x, spike.surfaceY, anchorX), time, 0xff727e);
        this.cue = "上からツララ！ 風で抜けよう";
        if (time - spike.began! > 1000) { spike.state = "falling"; spike.art.setVisible(true); }
      }
      if (spike.state !== "falling") continue;
      spike.velocity = Math.min(920, spike.velocity + delta * 1.05);
      spike.y += spike.velocity * delta / 1000;
      spike.art.setPosition(spike.x, waterY(spike.x, spike.y, anchorX));
      // The falling tip also hits the sail/upper body, rather than passing through it.
      if (!spike.hit && Math.abs(spike.x - anchorX) < 47 && spike.y + 39 > shipY - 145 && spike.y - 39 < shipY + 13) {
        spike.hit = true; this.onHit();
      }
      if (spike.y > spike.surfaceY + 80) {
        spike.state = "spent"; spike.art.setVisible(false); this.onSplash(spike.x, spike.surfaceY);
      }
    }
    const snow = this.weather.clear();
    if (this.course.theme === "ice") {
      for (let i = 0; i < 28; i++) {
        const x = (i * 139 + time * (0.012 + i % 3 * 0.004)) % 740 - 10;
        const y = (i * 77 + time * (0.025 + i % 4 * 0.008)) % 510 - 20;
        snow.fillStyle(0xffffff, 0.55).fillCircle(x, y, i % 3 + 1);
      }
    }
  }

  private warning(pen: Phaser.GameObjects.Graphics, x: number, y: number, time: number, color: number) {
    const alpha = 0.4 + Math.sin(time / 105) * 0.15;
    pen.lineStyle(3, color, alpha + 0.3).strokeEllipse(x, y, 88, 26);
    pen.fillStyle(color, alpha).fillTriangle(x - 13, y - 69, x + 13, y - 69, x, y - 46);
    pen.lineStyle(2, 0xffffff, 1).lineBetween(x, y - 65, x, y - 56);
    pen.fillStyle(0xffffff).fillCircle(x, y - 52, 1.5);
  }

  private makeTextures() {
    if (this.scene.textures.exists("iceberg")) return;
    const pen = this.scene.add.graphics();
    pen.fillStyle(0x7cd9f0).fillPoints([{x:5,y:120},{x:28,y:69},{x:47,y:86},{x:71,y:9},{x:91,y:52},{x:106,y:37},{x:145,y:120}], true);
    pen.fillStyle(0xeafcff).fillTriangle(71,9,50,94,90,58).fillTriangle(106,37,83,111,123,76);
    pen.fillStyle(0x56afd9).fillTriangle(71,9,76,119,96,80).fillTriangle(106,37,120,120,145,120);
    pen.lineStyle(2,0xffffff,0.85).lineBetween(71,9,47,86).lineBetween(106,37,145,120);
    pen.fillStyle(0xcdf3ff,0.75).fillEllipse(76,119,143,21);
    pen.generateTexture("iceberg",150,150); pen.clear();
    pen.fillStyle(0x2e8974).fillRoundedRect(29,12,23,110,11).fillRoundedRect(7,37,15,40,7).fillRoundedRect(55,25,14,41,7).fillRoundedRect(13,61,26,15,6).fillRoundedRect(42,50,23,15,6);
    pen.lineStyle(2,0x95caa0,0.8).lineBetween(37,24,37,115).lineBetween(46,20,46,118).lineBetween(13,42,13,66).lineBetween(61,30,61,53);
    pen.lineStyle(1,0xf5efbc,0.9);
    for(let i=0;i<6;i++) { pen.lineBetween(29,30+i*14,24,27+i*14); pen.lineBetween(52,36+i*13,57,32+i*13); }
    pen.fillStyle(0xff777c).fillCircle(39,12,9).fillCircle(31,8,5).fillCircle(45,5,5); pen.fillStyle(0xffe8a7).fillCircle(39,8,4);
    pen.generateTexture("cactus",76,126); pen.clear();
    pen.fillStyle(0x8ed6f2).fillTriangle(3,2,28,2,17,86);
    pen.fillStyle(0xeafcff).fillTriangle(3,2,17,8,17,86);
    pen.lineStyle(2,0xffffff,0.9).lineBetween(3,2,17,86).lineBetween(3,2,28,2);
    pen.generateTexture("icicle",32,90); pen.destroy();
  }
}
