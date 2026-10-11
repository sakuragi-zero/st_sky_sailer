import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

for (const course of ["1-1", "2-1", "3-1", "4-1"]) {
  for (const settings of [{ gravity: 0.5, jump: 1.5 }, { gravity: 1.8, jump: 0.7 }]) {
    test(`${course}: star flights land safely at gravity ${settings.gravity}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:5173/test-host.html?course=${course}&gravity=${settings.gravity}&jump=${settings.jump}`);
      await expect(page.locator("body")).toHaveAttribute("data-phase", "playing");
      const route = await page.evaluate(() => {
        const c = (window as any).voyageTest.course;
        return { length: c.goalX, crystals: c.crystals.length, rings: c.rings, validLandings: c.rings.every((r: any) => c.channels.some((p: any) => r.targetX > p.x + 90 && r.targetX < p.x + p.width - 90 && r.targetY === p.y - 18)) };
      });
      expect(route.length).toBeGreaterThan(20000);
      expect(route.crystals).toBeLessThanOrEqual(100);
      expect(route.validLandings).toBe(true);
      expect(route.rings).toHaveLength(3);

      for (let index = 0; index < route.rings.length; index++) {
        const ring = route.rings[index];
        await page.evaluate((index) => {
          const { scene: s, controls } = (window as any).voyageTest, r = s.course.rings[index];
          s.lift = null;
          controls.brake = false;
          s.player.body.setAllowGravity(true).reset(r.x - 65, r.y);
          s.checkpoint = { x: r.x - 65, y: r.y + 24 };
        }, index);
        await page.waitForFunction(() => !!(window as any).voyageTest.scene.flight);
        const start = await page.evaluate(() => {
          const s = (window as any).voyageTest.scene;
          return { x: s.flight.startX, y: s.flight.startY, hits: s.hits, collected: s.collected, duration: s.flight.duration };
        });
        await page.evaluate(() => { (window as any).voyageTest.controls.brake = true; });
        await page.waitForFunction(() => {
          const s = (window as any).voyageTest.scene;
          return s.flight && (s.elapsedMs - s.flight.began) / s.flight.duration >= 0.42;
        });
        const apex = await page.evaluate(() => {
          const s = (window as any).voyageTest.scene;
          return { x: s.player.x, y: s.player.y, scrollY: s.cameras.main.scrollY, hits: s.hits };
        });
        expect(apex.x - start.x).toBeGreaterThan(400);
        expect(start.y - apex.y).toBeGreaterThan(300);
        expect(apex.scrollY).toBeLessThan(0);
        expect(apex.hits).toBe(start.hits);

        if (index === 1) {
          await page.evaluate(() => (window as any).voyageTest.scene.pauseVoyage());
          const frozen = await page.evaluate(() => {
            const s = (window as any).voyageTest.scene;
            return [s.player.x, s.player.y, s.elapsedMs];
          });
          await page.waitForTimeout(300);
          expect(await page.evaluate(() => {
            const s = (window as any).voyageTest.scene;
            return [s.player.x, s.player.y, s.elapsedMs];
          })).toEqual(frozen);
          if (settings.gravity === 0.5) {
            await mkdir("../docs/screenshots", { recursive: true });
            await page.screenshot({ path: `../docs/screenshots/star-flight-${course}.png` });
          }
          await page.evaluate(() => (window as any).voyageTest.scene.resumeVoyage());
        }
        await expect.poll(() => page.evaluate(() => !!(window as any).voyageTest.scene.flight), { timeout: 7000 }).toBe(false);
        const landed = await page.evaluate(() => {
          const s = (window as any).voyageTest.scene;
          return { x: s.player.x, y: s.player.y, hits: s.hits, gravity: s.player.body.allowGravity, collected: s.collected };
        });
        expect(Math.abs(landed.x - ring.targetX)).toBeLessThan(65);
        expect(Math.abs(landed.y - ring.targetY)).toBeLessThan(30);
        expect(landed.hits).toBe(start.hits);
        expect(landed.gravity).toBe(true);
        if (index === 1) expect(landed.collected - start.collected).toBeGreaterThanOrEqual(3);
      }
      // Re-entering a used ring must not fire again; restarting resets its state.
      await page.evaluate(() => {
        const s = (window as any).voyageTest.scene, r = s.course.rings[2];
        s.player.body.reset(r.x - 20, r.y);
      });
      await page.waitForTimeout(200);
      expect(await page.evaluate(() => !!(window as any).voyageTest.scene.flight)).toBe(false);
      await page.evaluate(() => {
        const s = (window as any).voyageTest.scene;
        s.player.body.reset(s.course.goalX + 1, s.course.goalY - 18);
      });
      await expect.poll(() => page.evaluate(() => (window as any).voyageTest.results.length)).toBe(1);
      await page.evaluate(() => (window as any).voyageTest.scene.restartVoyage());
      await expect(page.locator("body")).toHaveAttribute("data-phase", "playing");
      await page.evaluate(() => {
        const s = (window as any).voyageTest.scene, r = s.course.rings[0];
        (window as any).voyageTest.controls.brake = false;
        s.player.body.reset(r.x - 20, r.y);
      });
      await expect.poll(() => page.evaluate(() => !!(window as any).voyageTest.scene.flight)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}
