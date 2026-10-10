import type { FrontendRenderer } from "@streamlit/component-v2-lib";
import manifest from "../../sky_sailer/courses.json";
import { VoyageMusic } from "./music";

export type HomeState = { selected_course: string | null };
type HomeRoot=HTMLElement & {__home?:{update:(id:string)=>void;cleanup:()=>void}};
const asset=(file:string)=>new URL((import.meta.env.DEV ? "/assets/" : "assets/")+file,import.meta.url).href;

export const renderHome:FrontendRenderer<HomeState>=({parentElement,data,setStateValue})=>{
  const root=parentElement.querySelector<HomeRoot>(".sky-sailer-root");
  if(!root) return;
  const id=(data as {course_id:string}).course_id;
  if(root.__home) {root.__home.update(id);return root.__home.cleanup;}
  root.classList.add("ss-home");
  root.innerHTML=`<section class="ss-course-picker" aria-label="コース選択">
    <div class="ss-picker-heading"><div><small>CHOOSE YOUR VOYAGE</small><h2>次は、どの世界へ？</h2></div><span>左右にスワイプ ↔</span></div>
    <div class="ss-carousel-controls"><button data-prev aria-label="前のコース">‹</button><div class="ss-course-carousel" role="region" aria-label="コースのカード" tabindex="0">
    ${manifest.map(c=>`<button class="ss-course-card" data-course-card="${c.id}" aria-label="${c.id} ${c.title}" aria-pressed="false"><img src="${asset(c.world)}" width="1536" height="1024" loading="${c.id===id ? "eager" : "lazy"}" decoding="async" alt=""><span class="ss-card-shade"></span><span class="ss-card-number">${c.id}</span><span class="ss-card-copy"><span class="ss-world-caption">${({sea:"THE SUNLIT SEA",ice:"AURORA & ICE",desert:"THE GOLDEN OASIS",cloud:"ABOVE THE CLOUDS"})[c.theme as "sea" | "ice" | "desert" | "cloud"]}</span><strong>${c.title}</strong><small>${c.description}</small></span><span class="ss-card-selected">✦ 選択中</span></button>`).join("")}
    </div><button data-next aria-label="次のコース">›</button></div>
    <div class="ss-course-dots">${manifest.map(c=>`<button data-course-dot="${c.id}" aria-label="${c.id}を選択">${c.id}</button>`).join("")}</div>
    <div class="ss-home-music"><button class="ss-system" data-home-music aria-pressed="false" aria-label="ホームBGMを有効にする">♫ BGM OFF</button><label>ホームBGM<input data-home-volume type="range" min="0" max="100" value="50" aria-label="ホームBGM音量"></label><small>Beyond the Far Horizon</small></div><p data-home-music-message role="status" hidden></p>
  </section>`;
  const carousel=root.querySelector<HTMLElement>(".ss-course-carousel")!;
  const cards=Array.from(root.querySelectorAll<HTMLButtonElement>("[data-course-card]"));
  const previous=root.querySelector<HTMLButtonElement>("[data-prev]")!;
  const next=root.querySelector<HTMLButtonElement>("[data-next]")!;
  const musicButton=root.querySelector<HTMLButtonElement>("[data-home-music]")!;
  const volume=root.querySelector<HTMLInputElement>("[data-home-volume]")!;
  const message=root.querySelector<HTMLElement>("[data-home-music-message]")!;
  const music=new VoyageMusic([asset("music/course-1-1-loop.ogg"),asset("music/course-1-1-loop.mp3")]);
  music.setPlaying(!document.hidden);
  let selected=manifest.findIndex(c=>c.id===id); if(selected<0) selected=0;
  let disposed=false,scrollTimer:ReturnType<typeof setTimeout>|undefined;
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const paint=()=>{
    root.dataset.selectedCourse=manifest[selected].id;
    cards.forEach((card,i)=>card.setAttribute("aria-pressed",String(i===selected)));
    root.querySelectorAll<HTMLElement>("[data-course-dot]").forEach(dot=>dot.setAttribute("aria-pressed",String(dot.dataset.courseDot===manifest[selected].id)));
    previous.disabled=selected===0;next.disabled=selected===cards.length-1;
  };
  const center=(behavior:ScrollBehavior="auto")=>carousel.scrollTo({left:cards[selected].offsetLeft-(carousel.clientWidth-cards[selected].clientWidth)/2,behavior});
  const choose=(index:number,scroll=true)=>{
    index=Math.max(0,Math.min(cards.length-1,index));
    const changed=selected!==index; selected=index;paint();
    if(scroll) center(reduced ? "auto" : "smooth");
    if(changed) setStateValue("selected_course",manifest[selected].id);
  };
  const click=(event:MouseEvent)=>{
    const target=event.target as HTMLElement;
    const card=target.closest<HTMLElement>("[data-course-card],[data-course-dot]");
    if(card) choose(manifest.findIndex(c=>c.id===(card.dataset.courseCard??card.dataset.courseDot)));
    if(target.closest("[data-prev]")) choose(selected-1);
    if(target.closest("[data-next]")) choose(selected+1);
    if(target.closest("[data-home-music]")) {
      musicButton.disabled=true;message.hidden=true;
      void music.toggle().then(enabled=>{
        if(disposed)return;
        musicButton.textContent=enabled ? "♫ BGM ON" : "♫ BGM OFF";
        musicButton.setAttribute("aria-pressed",String(enabled));
        musicButton.setAttribute("aria-label",enabled ? "ホームBGMを無効にする" : "ホームBGMを有効にする");
      }).catch(error=>{if(!disposed){message.textContent=error.message;message.hidden=false;}}).finally(()=>{if(!disposed)musicButton.disabled=false;});
    }
  };
  const scroll=()=>{
    clearTimeout(scrollTimer);
    scrollTimer=setTimeout(()=>{
      const midpoint=carousel.scrollLeft+carousel.clientWidth/2;
      let closest=0,distance=Infinity;
      cards.forEach((card,i)=>{const d=Math.abs(card.offsetLeft+card.clientWidth/2-midpoint);if(d<distance){distance=d;closest=i;}});
      choose(closest,false);
    },170);
  };
  const keyboard=(event:KeyboardEvent)=>{if(event.key==="ArrowRight"||event.key==="ArrowLeft"){event.preventDefault();choose(selected+(event.key==="ArrowRight"?1:-1));}};
  const volumeChange=()=>music.setVolume(Number(volume.value)/100);
  const visibility=()=>music.setPlaying(!document.hidden);
  root.addEventListener("click",click);carousel.addEventListener("scroll",scroll,{passive:true});carousel.addEventListener("keydown",keyboard);
  volume.addEventListener("input",volumeChange);document.addEventListener("visibilitychange",visibility);
  const observer=new ResizeObserver(()=>center());observer.observe(carousel);
  paint();requestAnimationFrame(()=>{if(!disposed)center();});
  const cleanup=()=>{
    if(disposed)return;disposed=true;clearTimeout(scrollTimer);observer.disconnect();music.dispose();
    root.removeEventListener("click",click);carousel.removeEventListener("scroll",scroll);carousel.removeEventListener("keydown",keyboard);
    volume.removeEventListener("input",volumeChange);document.removeEventListener("visibilitychange",visibility);
    root.replaceChildren();root.classList.remove("ss-home");delete root.__home;
  };
  root.__home={cleanup,update:nextId=>{const index=manifest.findIndex(c=>c.id===nextId);if(index>=0&&index!==selected){selected=index;paint();center();}}};
  return cleanup;
};
