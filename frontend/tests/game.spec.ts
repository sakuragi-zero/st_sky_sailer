import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { GOAL_X, HAZARDS, ISLANDS } from "../src/stage";

const screenshotDir = "../docs/screenshots";

for (const viewport of [{ width:390, height:844 }, { width:375, height:667 }, { width:430, height:932 }, { width:1280, height:900 }]) {
  test(`Streamlit layout ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const page = await browser.newPage({ viewport, hasTouch: viewport.width < 500, isMobile: viewport.width < 500 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/");
    const start = page.getByRole("button", { name: "出航する  →" });
    await expect(start).toBeVisible({ timeout:30000 });
    await mkdir(screenshotDir, { recursive:true });
    if (viewport.width === 390) await page.screenshot({ path:`${screenshotDir}/title-390.png`, fullPage:true });
    await start.click();
    const root = page.locator(".sky-sailer-root");
    await expect(root).toHaveAttribute("data-phase", "playing", { timeout:30000 });
    await page.keyboard.press("Space");
    await page.waitForTimeout(250);
    const canvas = await page.locator(".ss-game canvas").boundingBox();
    const pad = await page.locator(".ss-pad").boundingBox();
    expect(canvas!.width / canvas!.height).toBeCloseTo(1.5, 2);
    expect(pad!.y).toBeGreaterThanOrEqual(canvas!.y + canvas!.height);
    for(const button of await page.locator("[data-act]").all()) {
      const bounds=(await button.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(44); expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    if (viewport.width < 500) expect(pad!.y + pad!.height).toBeLessThan(viewport.height);
    await page.screenshot({ path:`${screenshotDir}/play-${viewport.width}.png`, fullPage:true });
    await page.getByRole("button", { name:"航海を一時停止" }).click();
    await expect(root).toHaveAttribute("data-phase", "paused");
    const frozen = await page.locator(".ss-clock").textContent();
    await page.waitForTimeout(1200);
    expect(await page.locator(".ss-clock").textContent()).toBe(frozen);
    await page.getByRole("button", { name:"航海を再開" }).click();
    await expect(root).toHaveAttribute("data-phase", "playing");
    expect(errors).toEqual([]);
    await page.close();
  });
}

test("mobile can steer and jump with two fingers", async ({ browser }) => {
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  await page.goto("/");
  await page.getByRole("button",{name:"出航する  →"}).click();
  await expect(page.locator(".sky-sailer-root")).toHaveAttribute("data-phase","playing",{timeout:30000});
  const right=page.getByRole("button",{name:"右・加速"});
  const jump=page.getByRole("button",{name:"A ジャンプ"});
  const r=(await right.boundingBox())!, j=(await jump.boundingBox())!;
  const session=await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2,id:1},{x:j.x+j.width/2,y:j.y+j.height/2,id:2}]});
  await expect(right).toHaveClass(/is-pressed/); await expect(jump).toHaveClass(/is-pressed/);
  await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await expect(right).not.toHaveClass(/is-pressed/); await expect(jump).not.toHaveClass(/is-pressed/);
  await page.close();
});

test("completion emits once and three restarts reset the voyage", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/test-host.html");
  await expect(page.locator("body")).toHaveAttribute("data-phase","playing");
  for (let attempt=1;attempt<=3;attempt++) {
    await page.evaluate(()=>{const t=(window as any).voyageTest;t.scene.hits=2;t.scene.collected=7;t.scene.player.body.reset(t.goal+1,365);});
    await expect.poll(()=>page.evaluate(()=>(window as any).voyageTest.results.length)).toBe(attempt);
    const result=await page.evaluate(()=>(window as any).voyageTest.results.at(-1));
    expect(result.status).toBe("cleared"); expect(result.attempt_id).toBe(`scene-test:${attempt}`); expect(result.hit_count).toBe(2); expect(result.crystals).toBe(7);
    await page.waitForTimeout(300);
    expect(await page.evaluate(()=>(window as any).voyageTest.results.length)).toBe(attempt);
    await page.evaluate(()=>(window as any).voyageTest.scene.restartVoyage());
    await expect(page.locator("body")).toHaveAttribute("data-phase","playing");
    expect(await page.evaluate(()=>[(window as any).voyageTest.scene.hits,(window as any).voyageTest.scene.collected])).toEqual([0,0]);
    expect(await page.locator("canvas").count()).toBe(1);
  }
});

test("default stage can be sailed from start to goal", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/test-host.html");
  await expect(page.locator("body")).toHaveAttribute("data-phase","playing");
  const started=Date.now();
  while (Date.now()-started<75000) {
    const done=await page.evaluate(()=>{
      const t=(window as any).voyageTest, s=t.scene, p=s.player;
      if (t.results.length) return true;
      t.controls.right=true;
      const grounded=p.body.blocked.down||p.body.touching.down;
      const island=t.islands.find((i:any)=>p.x>=i.x-45&&p.x<i.x+i.width+45);
      const nearEdge=island && island.x+island.width-p.x<65 && island.x+island.width-p.x>-40;
      const obstacle=t.hazards.some((h:any)=>h.x-p.x>25&&h.x-p.x<115);
      const gem=t.crystals.some((g:any)=>g.x-p.x>25&&g.x-p.x<80);
      t.controls.jump=grounded && (nearEdge||obstacle||gem);
      return false;
    });
    if(done)break;
    await page.waitForTimeout(45);
  }
  const result=await page.evaluate(()=>(window as any).voyageTest.results.at(-1));
  expect(result?.status).toBe("cleared");
  expect(result.elapsed_ms).toBeGreaterThan(45000);
  expect(result.crystals).toBeGreaterThan(12);
});

test("Streamlit completion receives Python rank without restarting the game", async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.getByRole("button",{name:"出航する  →"}).click();
  const root=page.locator(".sky-sailer-root");
  await expect(root).toHaveAttribute("data-phase","playing",{timeout:30000});
  await page.keyboard.down("ArrowRight");
  let lastJump=0;
  const started=Date.now();
  while(Date.now()-started<75000) {
    const phase=await root.getAttribute("data-phase");
    if(phase==="cleared"||phase==="failed")break;
    const percentage=await page.locator("[data-progress]").evaluate(el=>parseFloat((el as HTMLElement).style.width));
    const x=percentage*GOAL_X/100;
    const island=ISLANDS.find(i=>x>=i.x-45 && x<i.x+i.width+45);
    const edge=island && island.x+island.width-x<80 && island.x+island.width-x>-20;
    const hazard=HAZARDS.some(h=>h.x-x<120&&h.x-x>25);
    if((edge||hazard)&&Date.now()-lastJump>1150){await page.keyboard.press("Space");lastJump=Date.now();}
    await page.waitForTimeout(45);
  }
  await page.keyboard.up("ArrowRight");
  await expect(root).toHaveAttribute("data-phase","cleared");
  await expect(page.locator(".ss-result-rank")).toHaveAttribute("data-rank",/[SABC]/,{timeout:15000});
  await expect(page.getByText("航海ランクは今回の設定での自己記録です。")).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(root).toHaveAttribute("data-phase","cleared");
  await page.screenshot({path:`${screenshotDir}/result-390.png`,fullPage:true});
  await page.getByRole("button",{name:"もう一度出航する"}).click();
  await expect(root).toHaveAttribute("data-phase","playing");
  await expect(page.locator(".ss-clock")).toHaveText("00:00");
  await expect(page.locator(".ss-result-rank")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(1);
});
