import Phaser from "phaser";
import type { Course, Obstacle } from "./stage";
import { waterY } from "./Waterway";
import { makeSceneryTextures } from "./SceneryTextures";

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
    makeSceneryTextures(scene, course.theme);
    this.warnings = scene.add.graphics().setDepth(7);
    this.weather = scene.add.graphics().setDepth(14).setScrollFactor(0);
    const zones = scene.physics.add.staticGroup();
    for (const spec of course.hazards) {
      const iceberg = spec.kind === "iceberg", cactus = spec.kind === "cactus";
      const zone = scene.add.rectangle(spec.x, spec.y - (cactus ? 46 : iceberg ? 44 : 24), cactus ? 30 : iceberg ? 48 : 50, cactus ? 92 : iceberg ? 88 : 48, 0xffffff, 0);
      scene.physics.add.existing(zone, true); zones.add(zone);
      const body = zone.body as Phaser.Physics.Arcade.StaticBody;
      body.enable = !iceberg;
      const art = scene.add.image(spec.x, spec.y, spec.kind).setDepth(6);
      if (iceberg) art.setOrigin(0.5, 0.91).setDisplaySize(142, 134).setVisible(false);
      if (cactus) art.setOrigin(0.5, 0.93).setDisplaySize(78, 124);
      if (spec.kind === "rock") art.setOrigin(0.5, 0.86).setDisplaySize(104, 104 * 2 / 3);
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
      const camera=this.scene.cameras.main;
      if(spec.x<camera.scrollX-160 || spec.x>camera.scrollX+camera.width+360) { art.setVisible(false); continue; }
      art.setVisible(true);
      if (spec.kind === "iceberg") {
        if (row.began === null && spec.x - anchorX < 360 && spec.x - anchorX > -100) row.began = time;
        if (row.began === null) { art.setVisible(false); continue; }
        const rise = Phaser.Math.Clamp((time - row.began - 550) / 750, 0, 1);
        art.setVisible(rise > 0).setAlpha(Math.min(1, rise * 1.5)).setY(waterY(spec.x, spec.y + (1 - rise) * 116, anchorX));
        row.body.enable = rise > 0.6;
        if (rise < 1) {
          this.warning(pen, spec.x, waterY(spec.x, spec.y, anchorX), time, 0x6caff2);
          this.cue = "氷山がせり上がるよ！";
        }
        if (rise > 0.4 && !row.splashed) { row.splashed = true; this.onSplash(spec.x, spec.y); }
      } else {
        art.setY(waterY(spec.x, spec.y, anchorX));
        if (spec.kind === "rock") {
          const surface = waterY(spec.x, spec.y, anchorX);
          pen.lineStyle(1.3, 0xe0faff, 0.45).strokeEllipse(spec.x, surface + 1, 96 + Math.sin(time / 380) * 5, 13);
          pen.lineStyle(1, 0xffffff, 0.25).strokeEllipse(spec.x, surface + 3, 112, 18);
        }
        if (spec.kind === "cactus") {
          for (let layer = 3; layer >= 0; layer--) pen.fillStyle(layer % 2 ? 0xe5c18c : 0xc39e6e, 0.17).fillEllipse(spec.x, waterY(spec.x, spec.y + 7, anchorX), 72 + layer * 9, 13 + layer * 4);
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
      for (let i = 0; i < 14; i++) {
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

}
