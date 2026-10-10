import Phaser from "phaser";
import type { FrontendRenderer } from "@streamlit/component-v2-lib";
import { VoyageScene } from "./VoyageScene";
import { VoyageAudio } from "./audio";
import { VoyageMusic } from "./music";
import { renderHome, type HomeState } from "./home";
import { getCourse, VIEW, type Controls, type GameData, type Hud, type Phase, type Result } from "./stage";
import "./index.css";

type Evaluation = { attempt_id: string; rank: "S" | "A" | "B" | "C"; score: number; comment: string };
type ComponentData = GameData & { evaluation?: Evaluation | null; next_course_id?: string | null };
type GameState = { result: Result | null; navigation: { action: "home" | "next"; run_id: string } | null } & HomeState;
type ManagedRoot = HTMLElement & { __skySailer?: { runId: string; cleanup: () => void; evaluate: (evaluation?: Evaluation | null) => void } };
const timeLabel = (ms: number) => `${Math.floor(ms / 60000).toString().padStart(2, "0")}:${Math.floor(ms / 1000 % 60).toString().padStart(2, "0")}`;
const assetUrl = (file: string) => new URL((import.meta.env.DEV ? "/assets/" : "assets/") + file, import.meta.url).href;

const renderer: FrontendRenderer<GameState> = ({ parentElement, data: rawData, setStateValue }) => {
  if((rawData as {mode?:string}).mode==="home") return renderHome({parentElement,data:rawData,setStateValue} as Parameters<typeof renderHome>[0]);
  const data = rawData as ComponentData;
  const course = getCourse(data.course_id);
  const root = parentElement.querySelector<ManagedRoot>(".sky-sailer-root");
  if (!root) return;
  if (root.__skySailer?.runId === data.run_id) {
    root.__skySailer.evaluate(data.evaluation);
    return root.__skySailer.cleanup;
  }
  root.__skySailer?.cleanup();
  root.dataset.course = course.id;
  root.innerHTML = `
    <section class="ss-shell" aria-label="Sky Sailer ゲームコンソール">
      <div class="ss-brand"><img class="ss-brand-mark" src="${assetUrl("streamlit-mark.svg")}" alt="Streamlit"><span>SKY SAILER</span><span class="ss-brand-right">${course.id} · ${course.title}</span></div>
      <div class="ss-bezel"><div class="ss-game">
        <div class="ss-mount"></div>
        <div class="ss-hud" aria-label="航海状況">
          <div class="ss-hud-left"><span class="ss-captain-avatar"><img src="${assetUrl("captain-v3.webp")}" alt="船長"><img class="ss-avatar-mark" src="${assetUrl("streamlit-mark.svg")}" alt=""></span><span class="ss-lives" aria-label="残りライフ">♥ ♥ ♥</span><span class="ss-clock">00:00</span></div>
          <span class="ss-gems"><b>◆</b> <span data-crystals>0</span><small> / ${course.crystals.length}</small></span>
        </div>
        <div class="ss-captain-chat" data-cue hidden></div>
        <div class="ss-wind" data-wind hidden><span data-wind-time></span><i></i></div>
        <span class="ss-weather" data-weather>☀ 晴れ</span>
        <div class="ss-route"><span data-progress></span></div>
        <div class="ss-overlay" role="status"><span class="ss-overline">COURSE ${course.id}</span><h2>${course.title}へ</h2><p>帆に風を集めています…</p><span class="ss-loading">✦</span></div>
      </div></div>
      <div class="ss-pad">
        <div class="ss-actions">
          <div class="ss-action ss-action-a"><button class="ss-control ss-a" data-act="jump" aria-label="A ジャンプ">A</button><span>JUMP</span></div>
          <div class="ss-console-mark"><span>✦</span><small>BEYOND<br>THE BLUE</small></div>
          <div class="ss-action ss-action-b"><button class="ss-control ss-b" data-act="boost" aria-label="B ブースト">B</button><span>BOOST</span><div class="ss-boost-meter"><i></i></div></div>
        </div>
      </div>
      <div class="ss-system-row"><button class="ss-system" data-pause aria-label="航海を一時停止">Ⅱ PAUSE</button><button class="ss-system" data-guide aria-label="精霊ガイドを切り替える" aria-pressed="false">✧ GUIDE OFF</button><button class="ss-system" data-sound aria-label="効果音を有効にする" aria-pressed="false">♪ SOUND OFF</button></div>
      <div class="ss-music-row"><button class="ss-system" data-music aria-label="${course.id==="4-1" ? "BGM未設定" : "BGMを無効にする"}" aria-pressed="${course.id!=="4-1"}" ${course.id==="4-1" ? "disabled" : ""}>♫ ${course.id==="4-1" ? "BGM 未設定" : "BGM ON"}</button><label>BGM音量<input data-music-volume type="range" min="0" max="100" value="50" aria-label="BGM音量"></label></div><p class="ss-music-message" data-music-message role="status" hidden></p>
      <p class="ss-hint">A / Space ジャンプ　B / Shift ブースト</p>
    </section>`;
  const mount = root.querySelector<HTMLElement>(".ss-mount")!;
  const overlay = root.querySelector<HTMLElement>(".ss-overlay")!;
  const lives = root.querySelector<HTMLElement>(".ss-lives")!;
  const clock = root.querySelector<HTMLElement>(".ss-clock")!;
  const crystalCount = root.querySelector<HTMLElement>("[data-crystals]")!;
  const progress = root.querySelector<HTMLElement>("[data-progress]")!;
  const boostMeter = root.querySelector<HTMLElement>(".ss-boost-meter i")!;
  const pauseButton = root.querySelector<HTMLButtonElement>("[data-pause]")!;
  const soundButton = root.querySelector<HTMLButtonElement>("[data-sound]")!;
  const guideButton = root.querySelector<HTMLButtonElement>("[data-guide]")!;
  const musicButton = root.querySelector<HTMLButtonElement>("[data-music]")!;
  const musicVolume = root.querySelector<HTMLInputElement>("[data-music-volume]")!;
  const musicMessage = root.querySelector<HTMLElement>("[data-music-message]")!;
  const weatherBadge = root.querySelector<HTMLElement>("[data-weather]")!;
  let guideEnabled=false;
  const captainCue = root.querySelector<HTMLElement>("[data-cue]")!;
  const windBadge = root.querySelector<HTMLElement>("[data-wind]")!;
  const windTime = root.querySelector<HTMLElement>("[data-wind-time]")!;
  const windMeter = windBadge.querySelector<HTMLElement>("i")!;
  const controls: Controls = { left: false, right: false, jump: false, boost: false, brake: false };
  const pointers = new Map<number, keyof Controls>();
  const audio = new VoyageAudio();
  const music = new VoyageMusic(course.id==="4-1" ? [] : [assetUrl(`music/course-${course.id}-loop.ogg`),assetUrl(`music/course-${course.id}-loop.mp3`)],true);
  musicVolume.disabled=!music.available;
  let lastPhase:Phase="loading";
  let currentResult: Result | undefined;
  let latestEvaluation = data.evaluation;
  let disposed = false;

  const evaluate = (evaluation?: Evaluation | null) => {
    latestEvaluation = evaluation;
    if (!evaluation || evaluation.attempt_id !== currentResult?.attempt_id || !["S", "A", "B", "C"].includes(evaluation.rank)) return;
    const rank = root.querySelector<HTMLElement>(".ss-result-rank");
    const comment = root.querySelector<HTMLElement>(".ss-result-comment");
    if (rank) { rank.textContent = evaluation.rank; rank.dataset.rank = evaluation.rank; }
    if (comment) comment.textContent = evaluation.comment;
  };
  const syncPointers = () => {
    for (const action of Object.keys(controls) as (keyof Controls)[]) controls[action] = [...pointers.values()].includes(action);
    root.querySelectorAll<HTMLElement>("[data-act]").forEach(button => button.classList.toggle("is-pressed", controls[button.dataset.act as keyof Controls]));
  };
  const releaseAll = () => { pointers.clear(); syncPointers(); };
  const onHud = (hud: Hud) => {
    clock.textContent = timeLabel(hud.elapsedMs);
    crystalCount.textContent = String(hud.crystals);
    lives.innerHTML = Array.from({ length: 3 }, (_, i) => `<span class="${i < 3 - hud.hits ? "" : "is-lost"}">♥</span>`).join(" ");
    lives.setAttribute("aria-label", `残りライフ ${Math.max(0, 3 - hud.hits)}`);
    progress.style.width = `${hud.progress * 100}%`;
    boostMeter.style.width = `${hud.boostReady * 100}%`;
    boostMeter.parentElement!.classList.toggle("is-ready", hud.boostReady === 1);
    captainCue.textContent = hud.cue;
    captainCue.hidden = !hud.cue;
    windBadge.hidden = hud.windMs <= 0;
    windTime.textContent = `追い風 ${(hud.windMs / 1000).toFixed(1)}s`;
    windMeter.style.width = `${Math.min(100,hud.windMs/4500*100)}%`;
    root.dataset.wind = hud.windMs > 0 ? "active" : "idle";
    weatherBadge.textContent=`${hud.storm>.55 ? "☁" : "☀"} ${hud.weather}`;
    root.dataset.weather=hud.storm>.55 ? "storm" : "sunny";
    music.setWeather(hud.storm);
  };
  const onPhase = (phase: Phase, result?: Result) => {
    if (disposed) return;
    root.dataset.phase = phase;
    music.setPlaying(phase==="playing",phase==="playing" && lastPhase==="loading");
    lastPhase=phase;
    overlay.hidden = phase === "playing";
    pauseButton.disabled = phase !== "playing" && phase !== "paused";
    pauseButton.textContent = phase === "paused" ? "▶ RESUME" : "Ⅱ PAUSE";
    if (phase === "paused") {
      releaseAll();
      overlay.innerHTML = `<span class="ss-overline">TAKE A BREATH</span><h2>風待ちのひととき</h2><p>準備ができたら、航海を続けよう。</p><div class="ss-overlay-actions"><button class="ss-button" data-resume>航海を再開</button><button class="ss-button ss-button-secondary" data-home>ホームに戻る</button></div>`;
    } else if (phase === "loading") {
      overlay.innerHTML = `<span class="ss-overline">COURSE ${course.id}</span><h2>${course.title}へ</h2><p>帆に風を集めています…</p><span class="ss-loading">✦</span>`;
    } else if (phase === "error") {
      overlay.innerHTML = `<span class="ss-overline">WAITING FOR THE WIND</span><h2>航路を読み込めませんでした。</h2><p>通信を確認して、もう一度出航しよう。</p><button class="ss-button" data-reload>再読み込み</button>`;
    } else if (result) {
      releaseAll(); currentResult = result;
      overlay.innerHTML = result.status === "cleared"
        ? `<span class="ss-overline">${course.id} · VOYAGE COMPLETE</span><div class="ss-result-rank">✦</div><h2>${course.goal_label}へ、到着。</h2><p class="ss-result-comment">航海を評価しています…</p><div class="ss-result-stats">${timeLabel(result.elapsed_ms)}<span>◆ ${result.crystals} / ${result.total_crystals}</span><span>ミス ${result.hit_count}</span></div><div class="ss-overlay-actions">${data.next_course_id ? '<button class="ss-button" data-next-stage>次のステージへ</button>' : ''}<button class="ss-button ss-button-secondary" data-home>ホームに戻る</button><button class="ss-text-button" data-retry>もう一度出航する</button></div>`
        : `<span class="ss-overline">${course.id} · THE SKY IS WAITING</span><h2>次の風に、乗ろう。</h2><p>${course.description}</p><div class="ss-result-stats">${timeLabel(result.elapsed_ms)}<span>◆ ${result.crystals} / ${result.total_crystals}</span></div><div class="ss-overlay-actions"><button class="ss-button" data-retry>もう一度出航する</button><button class="ss-button ss-button-secondary" data-home>ホームに戻る</button></div>`;
      evaluate(latestEvaluation);
    }
  };
  const scene = new VoyageScene(data, controls, audio, { phase: onPhase, hud: onHud, result: result => { if (!disposed) setStateValue("result", result); } });
  const game = new Phaser.Game({
    type: Phaser.AUTO, width: VIEW.width, height: VIEW.height, parent: mount, banner: false,
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: 900 * data.gravity }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene], render: { antialias: true, roundPixels: false }, fps: { target: 60 },
  });

  const onPointerDown = (event: PointerEvent) => {
    music.unlock();
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!button || scene.phase !== "playing") return;
    pointers.set(event.pointerId, button.dataset.act as keyof Controls);
    if (button.dataset.act === "jump") scene.requestJump();
    if (button.dataset.act === "boost") scene.requestBoost();
    button.setPointerCapture(event.pointerId); syncPointers(); event.preventDefault();
  };
  const onPointerEnd = (event: PointerEvent) => { if (pointers.delete(event.pointerId)) { syncPointers(); event.preventDefault(); } };
  const onClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if(target.closest("[data-guide]")) {
      guideEnabled=!guideEnabled; scene.setGuide(guideEnabled);
      guideButton.textContent=guideEnabled ? "✧ GUIDE ON" : "✧ GUIDE OFF";
      guideButton.setAttribute("aria-pressed",String(guideEnabled));
    }
    if(target.closest("[data-music]")) {
      musicButton.disabled=true; musicMessage.hidden=true;
      void music.toggle().then(enabled=>{
        if(disposed) return;
        musicButton.textContent=enabled ? "♫ BGM ON" : "♫ BGM OFF";
        musicButton.setAttribute("aria-pressed",String(enabled));
        musicButton.setAttribute("aria-label",enabled ? "BGMを無効にする" : "BGMを有効にする");
      }).catch(error=>{
        if(disposed) return;
        musicButton.textContent="♫ BGM OFF"; musicButton.setAttribute("aria-pressed","false");
        musicMessage.textContent=error.message; musicMessage.hidden=false;
      }).finally(()=>{if(!disposed) musicButton.disabled=false;});
    }
    if (target.closest("[data-pause]")) { releaseAll(); if (scene.phase === "paused") scene.resumeVoyage(); else scene.pauseVoyage(); }
    if (target.closest("[data-resume]")) scene.resumeVoyage();
    if (target.closest("[data-home]") || target.closest("[data-next-stage]")) {
      const action = target.closest("[data-home]") ? "home" : "next";
      if (action === "next" && (scene.phase !== "cleared" || !data.next_course_id)) return;
      releaseAll(); scene.pauseVoyage(); music.setPlaying(false);
      overlay.querySelectorAll<HTMLButtonElement>("button").forEach(button => button.disabled = true);
      setStateValue("navigation", { action, run_id: data.run_id });
    }
    if (target.closest("[data-reload]")) window.location.reload();
    if (target.closest("[data-retry]")) {
      currentResult = undefined; releaseAll(); setStateValue("result", null); scene.restartVoyage();
    }
    if (target.closest("[data-sound]")) void audio.toggle().then(enabled => {
      if (disposed) return;
      soundButton.textContent = enabled ? "♪ SOUND ON" : "♪ SOUND OFF";
      soundButton.setAttribute("aria-pressed", String(enabled));
      soundButton.setAttribute("aria-label", enabled ? "効果音を無効にする" : "効果音を有効にする");
    });
  };
  const onVisibility = () => { if (document.hidden) { releaseAll(); scene.pauseVoyage(); } };
  const onMusicVolume=()=>music.setVolume(Number(musicVolume.value)/100);
  const onBlur = () => { releaseAll(); scene.pauseVoyage(); };
  const onKey = (event: KeyboardEvent) => {
    music.unlock();
    if (event.code === "Escape") { if (scene.phase === "paused") scene.resumeVoyage(); else scene.pauseVoyage(); }
  };
  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointerup", onPointerEnd);
  root.addEventListener("pointercancel", onPointerEnd);
  root.addEventListener("lostpointercapture", onPointerEnd);
  root.addEventListener("click", onClick);
  musicVolume.addEventListener("input",onMusicVolume);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("blur", onBlur);
  window.addEventListener("keydown", onKey);
  const observer = new ResizeObserver(() => { if (!disposed && game.isBooted) game.scale.refresh(); });
  observer.observe(mount);

  const cleanup = () => {
    if (disposed) return; disposed = true;
    observer.disconnect(); audio.dispose(); music.dispose(); game.destroy(true);
    root.removeEventListener("pointerdown", onPointerDown);
    root.removeEventListener("pointerup", onPointerEnd);
    root.removeEventListener("pointercancel", onPointerEnd);
    root.removeEventListener("lostpointercapture", onPointerEnd);
    root.removeEventListener("click", onClick);
    musicVolume.removeEventListener("input",onMusicVolume);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("keydown", onKey);
    root.replaceChildren(); delete root.__skySailer;
  };
  root.__skySailer = { runId: data.run_id, cleanup, evaluate };
  if(music.available) void music.enable().catch(error=>{
    if(disposed) return;
    musicButton.textContent="♫ BGM OFF";musicButton.setAttribute("aria-pressed","false");
    musicButton.setAttribute("aria-label","BGMを有効にする");
    musicMessage.textContent=error.message;musicMessage.hidden=false;
  });
  return cleanup;
};

export default renderer;
