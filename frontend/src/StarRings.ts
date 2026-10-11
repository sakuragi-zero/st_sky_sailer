import Phaser from "phaser";
import type { Course, StarRing } from "./stage";
import { waterY } from "./Waterway";

export type StarFlight = { ring: StarRing; startX: number; startY: number; began: number; duration: number };

/** A ballistic arc with a guaranteed landing, independent of jump/gravity settings. */
export function flightPoint(flight: StarFlight, time: number) {
  const p = Phaser.Math.Clamp((time - flight.began) / flight.duration, 0, 1);
  const { ring, startX, startY } = flight;
  return {
    x: startX + (ring.targetX - startX) * p,
    y: startY + (ring.targetY - startY) * p - 4 * ring.height * p * (1 - p),
    angle: Math.atan2(ring.targetY - startY - 4 * ring.height * (1 - 2 * p), ring.targetX - startX),
    done: p >= 1,
  };
}

export class StarRings {
  private readonly pen: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[];
  private readonly used = new Set<StarRing>();
  private previousX: number | null = null;
  private previousY = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly course: Course) {
    this.pen = scene.add.graphics().setDepth(8);
    this.labels = course.rings.map(() => scene.add.text(0, 0, "STAR RING", {
      fontFamily: "Georgia, serif", fontSize: "11px", color: "#fff4cf",
      stroke: "#8e6b39", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(8));
  }

  crossed(x: number, y: number): StarRing | undefined {
    const previousX = this.previousX ?? x, previousY = this.previousY;
    this.previousX = x; this.previousY = y;
    for (const ring of this.course.rings) {
      if (this.used.has(ring) || x < previousX) continue;
      const p = x === previousX ? 1 : Phaser.Math.Clamp((ring.x - previousX) / (x - previousX), 0, 1);
      const crossingY = previousY + (y - previousY) * p;
      // Include the ship's tall sail, so a normal jump can also enter the ring.
      if (previousX <= ring.x + 40 && x >= ring.x - 40 && Math.abs(crossingY - ring.y) < 164) {
        this.used.add(ring);
        return ring;
      }
    }
    return undefined;
  }

  upcoming(x: number) { return this.course.rings.find(ring => !this.used.has(ring) && ring.x - x > -40 && ring.x - x < 650); }

  draw(anchorX: number, time: number, flight: StarFlight | null, reducedMotion: boolean) {
    const pen = this.pen.clear(), camera = this.scene.cameras.main;
    this.course.rings.forEach((ring, i) => {
      const y = waterY(ring.x, ring.y - 65, anchorX);
      const visible = ring.x > camera.scrollX - 160 && ring.x < camera.scrollX + camera.width + 160 && y > camera.scrollY - 160 && y < camera.scrollY + camera.height + 160;
      this.labels[i].setVisible(visible).setPosition(ring.x, y - 151).setAlpha(this.used.has(ring) ? 0.35 : 1);
      if (!visible) return;
      const pulse = reducedMotion ? 1 : 1 + Math.sin(time / 420) * 0.035;
      const alpha = this.used.has(ring) ? 0.25 : 1;
      pen.lineStyle(20, 0xffd584, 0.06 * alpha).strokeEllipse(ring.x, y, 117 * pulse, 259 * pulse);
      pen.lineStyle(11, 0xffe7a4, 0.16 * alpha).strokeEllipse(ring.x, y, 106 * pulse, 244 * pulse);
      pen.lineStyle(5, 0xb88c43, alpha).strokeEllipse(ring.x, y, 96 * pulse, 234 * pulse);
      pen.lineStyle(3, 0xffe5a0, alpha).strokeEllipse(ring.x - 1, y - 1, 96 * pulse, 234 * pulse);
      pen.lineStyle(1, 0xfffbe8, 0.9 * alpha).strokeEllipse(ring.x - 3, y - 1, 90 * pulse, 229 * pulse);
      for (let j = 0; j < 7; j++) {
        const angle = j * Math.PI * 2 / 7 - Math.PI / 2;
        this.star(ring.x + Math.cos(angle) * 50 * pulse, y + Math.sin(angle) * 119 * pulse, j === 0 ? 13 : 7, alpha);
      }
      // A few dotted lights suggest the launch direction, without obscuring hazards.
      if (!this.used.has(ring)) for (let j = 1; j < 6; j++) {
        pen.fillStyle(0xffefba, (0.5 - j * 0.06) * alpha).fillCircle(ring.x + j * 23, y - j * 13, 2);
      }
    });
    if (flight) {
      const point = flightPoint(flight, time);
      pen.lineStyle(14, 0xffdd88, 0.08).lineBetween(point.x - 110, point.y + 14, point.x - 35, point.y + 5);
      for (let i = 0; i < 6; i++) this.star(point.x - 55 - i * 22, point.y + 7 + Math.sin(time / 120 + i) * 10, 6 - i * 0.6, 0.7 - i * 0.1);
    }
  }

  private star(x: number, y: number, radius: number, alpha: number) {
    const points = Array.from({ length: 10 }, (_, i) => {
      const angle = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? radius * 0.44 : radius;
      return { x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r };
    });
    this.pen.fillStyle(0xffedb1, alpha).fillPoints(points, true);
    this.pen.lineStyle(1, 0xfff9df, alpha).strokePoints(points, true);
  }
}
