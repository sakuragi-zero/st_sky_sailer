import Phaser from "phaser";
import { getCourse, VIEW, type Course, type Controls, type GameData, type Hud, type Phase, type Result } from "./stage";
import type { VoyageAudio } from "./audio";
import { Waterway, waterY } from "./Waterway";
import { CourseHazards } from "./CourseHazards";
import { WindEffect } from "./WindEffect";
import { SpiritGuide } from "./SpiritGuide";
import { Mooring } from "./Mooring";
import type { Cascade } from "./stage";
import { VoyageWeather } from "./Weather";
import { Atmosphere } from "./Atmosphere";
import { StarRings, flightPoint, type StarFlight } from "./StarRings";

type Hooks = { phase: (phase: Phase, result?: Result) => void; hud: (hud: Hud) => void; result: (result: Result) => void };
const assetUrl = (file: string) => new URL((import.meta.env.DEV ? "/assets/" : "assets/") + file, import.meta.url).href;

export class VoyageScene extends Phaser.Scene {
  phase: Phase = "loading";
  private player!: Phaser.Physics.Arcade.Sprite;
  private yacht!: Phaser.GameObjects.Container;
  private captain!: Phaser.GameObjects.Container;
  private waterway!: Waterway;
  private hazards!: CourseHazards;
  private windEffect!: WindEffect;
  private guide!: SpiritGuide;
  private mooring!: Mooring;
  private weather!: VoyageWeather;
  private atmosphere!: Atmosphere;
  private reflection!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private liftSpeed = 300;
  private guideEnabled = false;
  private lift: Cascade | null = null;
  private rings!: StarRings;
  private flight: StarFlight | null = null;
  private readonly course: Course;
  private projected: { image: Phaser.GameObjects.Image | Phaser.GameObjects.Text; x: number; y: number; bob?: number }[] = [];
  private backdrop!: Phaser.GameObjects.Image;
  private backdropTwin!: Phaser.GameObjects.Image;
  private sparkles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private attempt = 0;
  private elapsedMs = 0;
  private hits = 0;
  private collected = 0;
  private checkpoint = { x: 200, y: 406 };
  private lastGrounded = -1000;
  private jumpBuffer = -1000;
  private boostUntil = 0;
  private boostReadyAt = 0;
  private windUntil = 0;
  private windStacks = 0;
  private immuneUntil = 0;
  private previousJump = false;
  private previousBoost = false;
  private boostQueued = false;
  private lastHud = -1000;
  private lastTrail = -1000;
  private message = "いっしょに、雲海へ！";
  private messageUntil = 5000;

  constructor(private readonly configData: GameData, private readonly controls: Controls, private readonly audio: VoyageAudio, private readonly hooks: Hooks) {
    super({ key: "voyage" });
    this.course = getCourse(configData.course_id);
  }

  preload() {
    const assets: Record<string,string> = { world: this.course.world, yacht: "yacht-v2.webp", captain: "captain-v3.webp", mark: "streamlit-mark.svg" };
    if (this.course.theme === "sea") { assets["shore-sea"] = "ruins-v1.webp"; assets.rock = "rock-v2.webp"; }
    if (this.course.theme === "desert") assets["shore-desert"] = "palms-v1.webp";
    for (const [key, file] of Object.entries(assets)) if (!this.textures.exists(key)) this.load.image(key, assetUrl(file));
  }

  create() {
    const required = ["world", "yacht", "captain", "mark", ...(this.course.theme === "sea" ? ["shore-sea", "rock"] : this.course.theme === "desert" ? ["shore-desert"] : [])];
    if (!required.every(key => this.textures.exists(key))) {
      this.phase = "error"; this.hooks.phase("error"); return;
    }
    this.attempt++;
    this.elapsedMs = this.hits = this.collected = 0;
    this.lastGrounded = this.jumpBuffer = this.lastHud = this.lastTrail = -1000;
    this.boostUntil = this.boostReadyAt = this.immuneUntil = this.windUntil = 0;
    this.windStacks = 0;
    this.previousJump = this.previousBoost = false;
    this.boostQueued = false;
    this.lift = null;
    this.flight = null;
    this.projected = [];
    this.message = this.course.intro; this.messageUntil = 5000;
    this.checkpoint = { x: 200, y: this.course.channels[0].y };
    this.physics.world.setBounds(0, this.course.minY - 400, this.course.goalX + 750, 1900 - this.course.minY);
    const camera = this.cameras.main;
    camera.setBounds(0, this.course.minY, this.course.goalX + 600, VIEW.height - this.course.minY + Math.max(0,...this.course.channels.map(channel=>channel.y-406)));
    // Alternating mirrored panels meet at matching pixels, avoiding a hard seam.
    this.backdrop = this.add.image(0, 0, "world").setOrigin(0).setDisplaySize(VIEW.width, VIEW.height).setScrollFactor(0);
    this.backdropTwin = this.add.image(VIEW.width, 0, "world").setOrigin(0).setDisplaySize(VIEW.width, VIEW.height).setFlipX(true).setScrollFactor(0);

    this.atmosphere = new Atmosphere(this, this.course);
    this.waterway = new Waterway(this, () => this.audio.splash(), this.course);
    this.windEffect = new WindEffect(this);
    this.guide = new SpiritGuide(this); this.guide.enabled = this.guideEnabled;
    this.mooring = new Mooring(this,this.course);
    this.weather = new VoyageWeather(this,this.course.theme,strength => this.audio.thunder(strength));
    this.rings = new StarRings(this, this.course);
    const waterSurfaces = this.physics.add.staticGroup();
    for (const channel of this.course.channels) {
      const surface = this.add.rectangle(channel.x + channel.width / 2, channel.y + 8, channel.width - 8, 16, 0xffffff, 0);
      this.physics.add.existing(surface, true); waterSurfaces.add(surface);
    }

    this.makeTextures();
    this.player = this.physics.add.sprite(200, this.course.channels[0].y - 28, "hull").setVisible(false);
    this.player.setSize(92, 24);
    this.shadow = this.add.ellipse(0, 0, 265, 21, 0x164b73, 0.13).setDepth(4);
    this.reflection = this.add.image(0, 0, "yacht").setOrigin(0.5, 0).setFlipY(true).setDisplaySize(350, 58).setAlpha(0.13).setTint(0xa4deed).setDepth(4);
    const vessel = this.add.image(0, 0, "yacht").setOrigin(0.5, 0.97).setDisplaySize(355, 236.67);
    const sailMark = this.add.image(37, -135, "mark").setDisplaySize(62, 62 * 165 / 301);
    const captainArt = this.add.image(0, 0, "captain").setOrigin(0.5, 1).setDisplaySize(124, 186);
    const capMark = this.add.image(15, -157, "mark").setDisplaySize(26, 26 * 165 / 301);
    this.captain = this.add.container(-72, -51, [captainArt, capMark]);
    this.yacht = this.add.container(154, 398, [vessel, sailMark, this.captain]).setDepth(10);
    this.physics.add.collider(this.player, waterSurfaces, undefined, () => !this.lift && !this.flight);
    camera.startFollow(this.player, false, 0.09, 0.22, -140, 95);

    const gems = this.physics.add.staticGroup();
    this.course.crystals.forEach((point, i) => {
      const gem = this.add.image(point.x, point.y, point.red ? "ruby" : "crystal").setDepth(6);
      this.physics.add.existing(gem, true); gems.add(gem);
      (gem.body as Phaser.Physics.Arcade.StaticBody).setSize(25, 38);
      this.projected.push({ image: gem, x: point.x, y: point.y, bob: i });
    });
    this.physics.add.overlap(this.player, gems, (_player, object) => {
      const gem = object as Phaser.GameObjects.Image;
      if (this.phase !== "playing" || !gem.active) return;
      this.sparkles.explode(12, gem.x, gem.y);
      this.tweens.killTweensOf(gem); gem.destroy();
      this.collected++; this.audio.play("collect");
      // Each pickup increases speed as well as renewing the chain's duration.
      if (this.elapsedMs >= this.windUntil) this.windStacks = 0;
      this.windStacks = Math.min(6, this.windStacks + 1);
      this.windUntil = Math.min(this.elapsedMs + 4500, Math.max(this.windUntil, this.elapsedMs) + 2800);
      this.message = `クリスタルの風 ×${this.windStacks}！ スピードアップ♪`; this.messageUntil = this.elapsedMs + 2200;
      if (this.collected % 4 === 0 || this.collected === 1) {
        this.tweens.add({ targets: this.captain, y: -59, duration: 180, yoyo: true, ease: "Sine.easeOut" });
      }
    });

    this.hazards = new CourseHazards(this, this.course, this.player, () => this.damage(), (x,y) => this.waterway.splash(x,y));
    this.sparkles = this.add.particles(0, 0, "spark", { emitting: false, maxParticles: 64, lifespan: 650, speed: { min: 30, max: 105 }, angle: { min: 0, max: 360 }, scale: { start: 0.9, end: 0 }, alpha: { start: 0.9, end: 0 }, blendMode: Phaser.BlendModes.ADD }).setDepth(12);

    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys({ left: "LEFT", right: "RIGHT", a: "A", d: "D", space: "SPACE", up: "UP", w: "W", shift: "SHIFT", down: "DOWN" }) as typeof this.keys;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.repeat) return;
        if (["Space", "ArrowUp", "KeyW"].includes(event.code)) this.requestJump();
        if (["ShiftLeft", "ShiftRight"].includes(event.code)) this.requestBoost();
      };
      this.input.keyboard.on("keydown", onKeyDown);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.input.keyboard?.off("keydown", onKeyDown);
        this.input.keyboard?.removeAllKeys(true);
      });
    }
    this.phase = "playing";
    this.hooks.phase("playing");
    this.publishHud();
  }

  private makeTextures() {
    if (this.textures.exists("hull")) return;
    const pen = this.add.graphics();
    pen.fillStyle(0xffffff).fillRect(0, 0, 96, 24); pen.generateTexture("hull", 96, 24); pen.clear();
    for (const [name, color] of [["ruby", 0xff4b4b], ["crystal", 0x42d5f5]] as const) {
      pen.lineStyle(1.6, 0xffffff, 1).fillStyle(color);
      pen.fillPoints([{ x: 17, y: 1 }, { x: 30, y: 23 }, { x: 17, y: 44 }, { x: 4, y: 23 }], true);
      pen.strokePoints([{ x: 17, y: 1 }, { x: 30, y: 23 }, { x: 17, y: 44 }, { x: 4, y: 23 }], true);
      pen.fillStyle(0xffffff, 0.58).fillTriangle(17, 2, 17, 23, 5, 23);
      pen.lineStyle(1, 0xffffff, 0.8).lineBetween(17, 2, 17, 42).lineBetween(5, 23, 29, 23);
      pen.generateTexture(name, 34, 46); pen.clear();
    }
    pen.fillStyle(0xffffff).fillTriangle(8, 0, 10, 8, 8, 16).fillTriangle(0, 8, 8, 6, 16, 8).fillTriangle(0, 8, 8, 10, 16, 8);
    pen.generateTexture("spark", 16, 16); pen.destroy();
  }

  update(_time: number, delta: number) {
    if (!this.backdrop) return;
    const drift = this.cameras.main.scrollX * 0.18 % (VIEW.width * 2);
    this.backdrop.setX(-drift + (drift > VIEW.width ? VIEW.width * 2 : 0));
    this.backdropTwin.setX(VIEW.width - drift);
    if (this.phase !== "playing") return;
    this.elapsedMs += Math.min(delta, 100);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    let afloat = !this.flight && (body.blocked.down || body.touching.down);
    if (!this.flight) {
      const ring = this.rings.crossed(this.player.x, this.player.y);
      if (ring) {
        this.flight = { ring, startX: this.player.x, startY: this.player.y, began: this.elapsedMs, duration: Math.max(2200, (ring.targetX - this.player.x) / 820 * 1000) };
        this.lift = null;
        this.jumpBuffer = this.lastGrounded = -1000;
        this.boostQueued = false;
        body.setVelocity(0, 0).setAllowGravity(false);
        this.sparkles.explode(35, this.player.x, this.player.y - 65);
        this.audio.play("launch");
        this.message = "スターリング！ 遠くの航路へ、ひとっ飛び！";
        this.messageUntil = this.elapsedMs + this.flight.duration + 1400;
        this.cameras.main.setLerp(0.28, 0.3);
        afloat = false;
      }
    }
    const key = (name: string) => this.keys?.[name]?.isDown ?? false;
    const left = this.controls.left || key("left") || key("a");
    const right = this.controls.right || key("right") || key("d");
    const brake = this.controls.brake || key("down");
    const jump = this.controls.jump || key("space") || key("up") || key("w");
    const boost = this.controls.boost || key("shift");
    if (jump && !this.previousJump) this.jumpBuffer = this.elapsedMs + 150;
    if (afloat && !this.flight) {
      this.lastGrounded = this.elapsedMs;
      const channel = this.course.channels.find(p => this.player.x > p.x + 30 && this.player.x < p.x + p.width - 45);
      if (channel) this.checkpoint = { x: Math.max(channel.x + 100, this.player.x - 65), y: channel.y };
    }
    if (!this.flight && this.jumpBuffer >= this.elapsedMs && this.elapsedMs - this.lastGrounded < 115) {
      body.setVelocityY(-510 * this.configData.jump_power);
      this.jumpBuffer = this.lastGrounded = -1000;
      this.sparkles.explode(8, this.player.x - 40, this.player.y + 10);
      this.audio.play("jump");
      this.waterway.splash(this.player.x, this.player.y + 14);
    }
    if (!this.flight && (this.boostQueued || boost && !this.previousBoost) && this.elapsedMs >= this.boostReadyAt) {
      this.boostUntil = this.elapsedMs + 1150; this.boostReadyAt = this.elapsedMs + 3400; this.audio.play("boost");
      this.message = "風をつかまえて！"; this.messageUntil = this.elapsedMs + 1600;
    }
    this.boostQueued = false;
    const boosted = this.elapsedMs < this.boostUntil;
    const windy = this.elapsedMs < this.windUntil;
    if (!windy) this.windStacks = 0;
    const stopped = brake;
    const target = (right ? 170 : 132) - (left ? 103 : 0) + (boosted ? 122 : 0) + (windy ? 125 + (this.windStacks - 1) * 45 : 0);
    // Stopping takes priority over both kinds of boost; gravity and hazards keep moving.
    if (!this.flight) body.setVelocityX(stopped ? 0 : Phaser.Math.Linear(body.velocity.x, Math.max(0, target), 1 - Math.exp(-delta / 180)));
    if(!this.flight && !this.lift && !stopped) {
      this.lift = this.course.cascades.find(c=>c.ascent && this.player.x>=c.x-48 && this.player.x<c.nextX+60 && this.player.y>c.toY-32 && this.player.y<c.fromY+55) ?? null;
      if(this.lift) this.liftSpeed=Math.max(300,body.velocity.x,target);
    }
    if(this.lift) {
      const lift=this.lift;
      body.setAllowGravity(false);
      if(this.player.y<=lift.toY-32) {
        if(this.player.x>=lift.nextX+60) { this.lift=null; body.setVelocityY(0).setAllowGravity(true); }
        else body.setVelocityY(stopped ? 0 : -18);
      } else {
        // Reach the upper surface before entering it, without slowing to a crawl.
        const remainingX=Math.max(14,lift.nextX-38-this.player.x);
        const remainingY=Math.max(0,this.player.y-(lift.toY-32));
        const climb=Math.max(620,remainingY/remainingX*this.liftSpeed);
        body.setVelocityY(stopped ? 0 : -Math.min(1350,climb));
      }
      if(!stopped) body.setVelocityX(this.liftSpeed);
      this.message=this.course.theme==="cloud" ? "上昇気流で、雲の上へ！" : "滝の流れに乗って、上へ！";
      this.messageUntil=this.elapsedMs+400;
    }
    this.previousJump = jump; this.previousBoost = boost;
    let flightAngle: number | null = null;
    if (this.flight) {
      const point = flightPoint(this.flight, this.elapsedMs);
      body.reset(point.x, point.y);
      flightAngle = point.angle * 0.48;
      if (point.done) {
        this.checkpoint = { x: point.x, y: this.flight.ring.targetY + 18 };
        this.flight = null;
        body.setAllowGravity(true).setVelocity(170, 0);
        this.immuneUntil = Math.max(this.immuneUntil, this.elapsedMs + 700);
        this.cameras.main.setLerp(0.09, 0.22);
        this.waterway.splash(point.x, point.y + 18);
        this.sparkles.explode(16, point.x, point.y);
        this.message = "着地！ 次の風に乗って進もう"; this.messageUntil = this.elapsedMs + 1800;
      }
    }
    if (!this.flight && this.player.y > this.checkpoint.y + 250) this.damage(true);
    const bob = afloat ? Math.sin(this.elapsedMs / 270) * 2.4 : 0;
    this.yacht.setPosition(this.player.x - 6, this.player.y + 15 + bob).setRotation(flightAngle ?? Phaser.Math.Clamp(body.velocity.y / 4800, -0.11, 0.10) + (afloat ? Math.sin(this.elapsedMs / 430) * 0.009 : 0));
    this.captain.setRotation(-this.yacht.rotation * 0.6 + Math.sin(this.elapsedMs / 600) * 0.018);
    this.shadow.setPosition(this.player.x - 8, this.player.y + 29).setVisible(afloat);
    this.reflection.setPosition(this.player.x - 6, this.player.y + 33).setVisible(afloat && this.course.theme !== "cloud");
    for (const object of this.projected) {
      if (!object.image.active) continue;
      const bob = object.bob === undefined ? 0 : Math.sin(this.elapsedMs / 330 + object.bob) * 5;
      const visible = object.x > this.cameras.main.scrollX - 60 && object.x < this.cameras.main.scrollX + VIEW.width + 60;
      object.image.setVisible(visible);
      if (visible) object.image.setY(waterY(object.x, object.y, this.player.x) + bob);
    }
    this.waterway.draw(this.player.x, this.player.y, this.elapsedMs, Math.min(delta, 100), afloat && body.velocity.y >= 0, boosted || windy, this.atmosphere.detail);
    this.hazards.update(this.player.x, this.player.y, this.elapsedMs, Math.min(delta,100));
    this.windEffect.draw(this.elapsedMs, Math.max(0,this.windUntil-this.elapsedMs), this.windStacks, this.atmosphere.detail);
    this.weather.draw(this.player.x/this.course.goalX,this.elapsedMs,Math.min(delta,100),this.atmosphere.detail,this.atmosphere.reducedMotion);
    this.atmosphere.update(this.player.x,this.elapsedMs,delta,this.weather.intensity);
    this.backdrop.setTint(this.weather.tint); this.backdropTwin.setTint(this.weather.tint);
    this.mooring.draw(this.player.x,this.elapsedMs);
    this.rings.draw(this.player.x, this.elapsedMs, this.flight, this.atmosphere.reducedMotion);
    this.guide.draw(this.player.x,this.elapsedMs,body,this.hazards.guidePoints());
    this.yacht.setAlpha(!this.flight && this.elapsedMs < this.immuneUntil ? (Math.floor(this.elapsedMs / 100) % 2 ? 0.55 : 1) : 1);
    if (this.elapsedMs - this.lastTrail > (this.flight || boosted || windy ? 65 : 140) / this.atmosphere.detail) {
      this.sparkles.emitParticleAt(this.player.x - 88, this.player.y + 1, this.flight ? 3 : boosted || windy ? 2 : 1); this.lastTrail = this.elapsedMs;
    }
    if (this.player.x >= this.course.goalX) this.finish("cleared");
    else if (this.elapsedMs > this.course.timeLimitMs) this.finish("failed");
    if (this.elapsedMs - this.lastHud > 100) this.publishHud();
  }

  private damage(fell=false) {
    if (this.phase !== "playing" || this.flight || this.elapsedMs < this.immuneUntil) return;
    this.hits++; this.audio.play("hit"); this.cameras.main.shake(150, 0.003);
    this.message = "だいじょうぶ、もう一度！"; this.messageUntil = this.elapsedMs + 2600;
    this.windUntil = this.boostUntil = 0;
    this.windStacks = 0;
    if (this.hits >= 3) { this.finish("failed"); return; }
    this.immuneUntil = this.elapsedMs + 1300;
    if(fell) {
      this.lift=null;
      const x=this.player.x;
      // Recover on the current or next supported stretch, never behind the hit.
      const landing=this.course.channels.find(channel=>channel.x+channel.width-52>=x) ?? this.course.channels.at(-1)!;
      const forwardX=Math.max(x,landing.x+60);
      const body=this.player.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(true).reset(forwardX,landing.y-36);
      this.checkpoint={x:forwardX,y:landing.y};
      this.previousJump=false;
    }
    this.publishHud();
  }

  private finish(status: "cleared" | "failed") {
    if (this.phase !== "playing") return;
    this.phase = status;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0).setAllowGravity(false);
    const result: Result = { run_id: this.configData.run_id, attempt_id: `${this.configData.run_id}:${this.attempt}`, course_id: this.course.id, status, elapsed_ms: Math.round(this.elapsedMs), hit_count: this.hits, crystals: this.collected, total_crystals: this.course.crystals.length };
    this.publishHud();
    if (status === "cleared") {
      this.audio.play("clear"); this.sparkles.explode(65, this.player.x, this.player.y - 65);
      this.tweens.add({ targets: this.yacht, y: this.yacht.y - 12, duration: 1000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    this.time.delayedCall(status === "cleared" ? 900 : 300, () => { this.hooks.phase(status, result); this.hooks.result(result); });
  }

  private publishHud() {
    this.lastHud = this.elapsedMs;
    const next = this.course.channels.find(channel => channel.x + channel.width > this.player.x && channel.x + channel.width - this.player.x < 320 && channel !== this.course.channels.at(-1));
    const hazard = this.course.hazards.find(hazard => hazard.x - this.player.x > 60 && hazard.x - this.player.x < 290);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const afloat = (body.blocked.down || body.touching.down) && body.velocity.y >= 0;
    const obstacleCue = hazard?.kind === "cactus" ? "サボテン！ Aでジャンプ" : hazard?.kind === "iceberg" ? "氷山！ Aで越えよう" : "岩があるよ！ Aでジャンプ";
    const cascade=this.course.cascades.find(c=>c.x-this.player.x>-60 && c.x-this.player.x<320);
    const ring = this.rings.upcoming(this.player.x);
    const cue = this.flight ? this.message : ring ? "金色のスターリングを通って、遠くへ！" : this.hazards.cue || (this.lift ? this.message : cascade ? cascade.ascent ? this.course.theme==="cloud" ? "金色の上昇気流に乗ろう" : "光る滝で、滝登り！" : "大きな落差！ 下の航路へ" : !afloat ? "" : next ? this.course.theme === "cloud" ? "雲の切れ目！ 次の段へジャンプ" : "滝の切れ目！ Aでひとっとび" : hazard ? obstacleCue : this.elapsedMs < this.messageUntil ? this.message : "");
    this.hooks.hud({ elapsedMs: this.elapsedMs, hits: this.hits, crystals: this.collected, progress: Math.min(1, this.player.x / this.course.goalX), boostReady: Phaser.Math.Clamp(1 - (this.boostReadyAt - this.elapsedMs) / 3400, 0, 1), windMs: Math.max(0,this.windUntil-this.elapsedMs), windStacks: this.elapsedMs < this.windUntil ? this.windStacks : 0, cue, weather:this.weather.label, storm:this.weather.intensity });
  }

  pauseVoyage() {
    if (this.phase !== "playing") return;
    this.input.keyboard?.resetKeys();
    this.phase = "paused"; this.scene.pause(); this.hooks.phase("paused");
  }
  resumeVoyage() {
    if (this.phase !== "paused") return;
    this.previousJump = this.previousBoost = false;
    this.phase = "playing"; this.scene.resume(); this.hooks.phase("playing");
  }
  restartVoyage() {
    if (this.phase !== "cleared" && this.phase !== "failed") return;
    this.phase = "loading"; this.hooks.phase("loading"); this.scene.restart();
  }
  requestJump() { if (this.phase === "playing") this.jumpBuffer = this.elapsedMs + 150; }
  setGuide(enabled:boolean) { this.guideEnabled=enabled; if(this.guide) this.guide.enabled=enabled; }
  requestBoost() { if (this.phase === "playing") this.boostQueued = true; }
}
