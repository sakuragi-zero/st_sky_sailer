"""Sky Sailer: a short, illustrated voyage through the clouds."""

import base64
import importlib
import json
from pathlib import Path
from uuid import uuid4

import streamlit as st

from sky_sailer import component
from sky_sailer.rank import calculate_rank, validate_result

# Streamlit reruns app.py after a deployment, but imported modules can still
# contain the previous release's functions. Refresh before binding the wrappers.
component = importlib.reload(component)
game, home = component.game, component.home

st.set_page_config(page_title="Sky Sailer", page_icon="⛵", layout="centered", initial_sidebar_state="collapsed")

if "mode" not in st.session_state:
    st.session_state.mode = "ready"
    st.session_state.run_id = str(uuid4())

COURSES = {course["id"]: course for course in json.loads((Path(__file__).parent / "sky_sailer/courses.json").read_text())}
st.session_state.setdefault("course_id", "1-1")
st.session_state.setdefault("course_setting", "1-1")
playing = st.session_state.mode == "playing"
course_id = st.session_state.course_id if playing else st.session_state.course_setting
course = COURSES.get(course_id, COURSES["1-1"])


def select_course():
    selected = st.session_state.get("sky_sailer_home", {}).get("selected_course")
    if isinstance(selected, str) and selected in COURSES:
        st.session_state.course_setting = selected


def start_voyage(selected: str, gravity: float, jump_power: float):
    st.session_state.gravity, st.session_state.jump_power = gravity, jump_power
    st.session_state.course_id = selected
    if st.session_state.get("course_setting") != selected:
        st.session_state.course_setting = selected
    st.session_state.run_id = str(uuid4())
    st.session_state.pop("evaluation", None)
    st.session_state.mode = "playing"
    st.rerun()


def navigate_voyage():
    state = st.session_state.get("sky_sailer_game", {})
    navigation = state.get("navigation")
    if not isinstance(navigation, dict) or navigation.get("run_id") != st.session_state.run_id:
        return
    if navigation.get("action") == "home":
        st.session_state.mode = "ready"
        st.session_state.pop("evaluation", None)
    elif navigation.get("action") == "next":
        event = state.get("result")
        current = st.session_state.course_id
        ids = list(COURSES)
        index = ids.index(current) + 1
        if not validate_result(event, st.session_state.run_id, current) or event["status"] != "cleared" or index >= len(ids):
            return
        st.session_state.course_id = st.session_state.course_setting = ids[index]
        st.session_state.run_id = str(uuid4())
        st.session_state.pop("evaluation", None)


@st.cache_data
def asset_uri(filename: str) -> str:
    path = Path(__file__).parent / "sky_sailer/frontend/build/assets" / filename
    mime = "image/svg+xml" if path.suffix == ".svg" else "image/webp"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


world = asset_uri(course["world"])
page_background = asset_uri("temple-mural-v1.webp")
yacht = asset_uri("yacht-v2.webp")
captain = asset_uri("captain-v3.webp")
mark = asset_uri("streamlit-mark.svg")

st.markdown("""
<style>
.stApp{background:radial-gradient(ellipse at 12% 12%,#ffffff 0%,transparent 48%),linear-gradient(160deg,#eaf6ff,#d6ecf9 75%,#f9fbff)}
.block-container{max-width:790px;padding-top:1.1rem;padding-bottom:2rem}
h1,h2,h3{color:#17346b}
.hero{text-align:center;padding:6px 0 20px}.hero-mark{color:#6b87a6;font:600 9px system-ui,sans-serif;letter-spacing:.28em}.hero h1{font-family:Georgia,'Yu Mincho',serif;font-size:clamp(42px,9vw,64px);font-weight:400;letter-spacing:-.045em;line-height:1.1;margin:8px 0;color:#153773}.hero h1 span{color:#ff4b4b;display:inline-block;font-size:.53em;vertical-align:13%;margin-right:9px}.hero p{color:#68819c;font-size:12px;margin:9px 0 0;letter-spacing:.035em}
.hero.is-playing{padding:0 0 15px}.hero.is-playing h1{font-size:35px;margin:5px 0}.hero.is-playing p{font-size:10px;margin-top:5px}
.voyage-cover{position:relative;aspect-ratio:16/7;border-radius:22px;overflow:hidden;border:2px solid #fff;box-shadow:0 12px 35px #1c527b26;margin:0 0 23px}.cover-world{width:100%;height:100%;object-fit:cover;object-position:center 54%;filter:saturate(1.04)}.cover-yacht{position:absolute;left:4%;bottom:6%;width:43%;filter:drop-shadow(0 5px 8px #163b6d45);animation:float-yacht 4s ease-in-out infinite}.cover-copy{position:absolute;right:5%;top:14%;text-align:right;padding:14px 17px;background:#ffffffc4;backdrop-filter:blur(6px);border:1px solid #ffffffb3;border-radius:12px}.cover-copy small{font-size:9px;letter-spacing:.16em;color:#6384a2}.cover-copy h2{font-family:Georgia,'Yu Mincho',serif;font-size:clamp(20px,4vw,31px);font-weight:500;margin:6px 0 5px}.cover-copy p{font-size:11px;line-height:1.6;color:#456485;margin:0}.cover-note{position:absolute;bottom:9px;right:15px;color:#fff;font-size:8px;letter-spacing:.2em;text-shadow:0 1px 3px #17346b}
.settings-label{display:flex;align-items:center;gap:10px;color:#17346b;margin:0 0 5px;font-weight:600;font-size:16px}.settings-label span{color:#c3a25a;font-size:23px}.settings-note{font-size:11px;color:#6b86a0;margin:0 0 8px}.voyage-help{display:flex;justify-content:space-around;gap:12px;border-top:1px solid #a3c5df80;padding-top:15px;margin:8px 0 15px;text-align:center}.voyage-help div{flex:1}.voyage-help b{display:block;font-family:Georgia,serif;color:#183c72;font-size:13px;letter-spacing:.015em}.voyage-help small{display:block;color:#6c84a0;font-size:10px;line-height:1.7;margin-top:4px}.voyage-footer{text-align:center;margin:17px 0 0;color:#8ba1b7;font-size:9px;letter-spacing:.14em}.voyage-footer span{color:#ff6c75}
[data-testid="stBaseButton-primary"]{border-radius:99px;min-height:46px;box-shadow:0 4px 0 #c34053,0 9px 21px #ff4b4b20;font-weight:600;letter-spacing:.05em}
@keyframes float-yacht{50%{transform:translateY(-5px) rotate(-1deg)}}
@media(max-width:500px){.block-container{padding-left:13px;padding-right:13px;padding-top:.8rem}.hero{padding-bottom:16px}.hero h1{font-size:43px}.hero.is-playing{padding-bottom:12px}.hero.is-playing h1{font-size:31px}.hero.is-playing .hero-mark{font-size:8px}.voyage-cover{border-radius:16px;margin-bottom:20px;aspect-ratio:3/2}.cover-yacht{width:64%;left:-3%;bottom:4%}.cover-copy{right:4%;top:7%;padding:10px 12px}.cover-copy h2{font-size:23px}.cover-copy p{font-size:10px}.voyage-help{gap:8px}.voyage-help b{font-size:12px}}
@media(prefers-reduced-motion:reduce){.cover-yacht{animation:none}}
.stMarkdown .settings-note{font-size:11px;line-height:1.6}
@media(max-width:500px){[data-testid="stHorizontalBlock"]{flex-wrap:nowrap}[data-testid="stColumn"]{width:calc(50% - 8px)!important;flex:1 1 calc(50% - 8px)!important;min-width:0!important}.voyage-cover{aspect-ratio:16/9}.cover-copy h2{font-size:21px}.cover-copy{top:6%;padding:8px 10px}.cover-copy p{font-size:9px}}
</style>
""", unsafe_allow_html=True)

st.markdown(f"""
<style>
.stApp{{background:linear-gradient(180deg,#101a2422 0%,#101a240d 42%,#101a2444 100%),url('{page_background}') center center/cover fixed}}
[data-testid="stHeader"]{{background:#17222c66;backdrop-filter:blur(8px)}}
.hero-mark{{display:none}}.hero h1{{color:#fff0c4;text-shadow:0 2px 5px #101a24,0 3px 18px #101a24bb}}.hero p{{color:#fff0ce;text-shadow:0 1px 3px #101a24;background:#15212cc4;border-radius:99px;width:fit-content;padding:2px 10px;margin-left:auto;margin-right:auto}}
.hero-logo{{width:48px;height:auto;vertical-align:middle;margin-right:10px}}.hero.is-playing .hero-logo{{width:29px}}
.voyage-cover{{background:#c8e9fc;aspect-ratio:16/8;border:2px solid #fffc;box-shadow:0 14px 34px #1e6e9b33}}
.cover-world{{object-position:center 57%;filter:none}}
.cover-ship{{position:absolute;left:-1%;bottom:-3%;width:65%;aspect-ratio:3/2;animation:float-yacht 4s ease-in-out infinite;filter:drop-shadow(0 7px 6px #164e7640)}}
.cover-ship .cover-yacht{{position:absolute;inset:0;width:100%;height:100%;animation:none;filter:none}}
.cover-sail-mark{{position:absolute;left:51.5%;top:36%;width:17.5%;height:auto}}
.cover-captain{{position:absolute;left:12%;bottom:25%;width:35%;aspect-ratio:2/3;transform:rotate(-3deg)}}
.cover-captain-art{{width:100%;height:auto}}.cover-cap-mark{{position:absolute;left:55%;top:13%;width:21%;height:auto}}
.cover-copy{{right:4%;top:12%;background:#f4fbffdd;box-shadow:0 5px 20px #548db92b}}
.cover-copy p{{color:#3f6d92}}.cover-note{{font-size:9px}}
.st-key-voyage_settings{{background:#f8fcfff0;border-radius:22px;padding:15px 17px;box-shadow:0 9px 30px #285c7c26;backdrop-filter:blur(10px)}}
.voyage-footer{{color:#466f91;text-shadow:0 1px 3px #fff;background:#eff9ffd9;border-radius:99px;padding:5px 12px;width:fit-content;margin:14px auto 0}}
.stCaptionContainer{{background:#f5fbffe6;border-radius:8px;padding:3px 8px}}
@media(max-width:500px){{.hero-logo{{width:36px}}.voyage-cover{{aspect-ratio:16/10}}.cover-ship{{width:83%;left:-6%;bottom:-3%}}.cover-copy{{padding:8px 10px;top:7%;right:3%}}.cover-copy h2{{font-size:18px}}.cover-copy p{{font-size:9px}}.cover-copy small{{font-size:7px}}.st-key-voyage_settings{{padding:12px 13px;border-radius:18px}}.hero.is-playing .hero-logo{{width:26px}}}}
@media(prefers-reduced-motion:reduce){{.cover-ship{{animation:none}}}}
</style>
""", unsafe_allow_html=True)

st.markdown(f"""
<div class="hero {'is-playing' if playing else ''}"><div class="hero-mark">A LITTLE VOYAGE ABOVE THE CLOUDS</div><h1><img class="hero-logo" src="{mark}" alt="Streamlit">Sky Sailer</h1><p>船長といっしょに、{course['goal_label']}へ。</p></div>
""", unsafe_allow_html=True)


if not playing:
    taglines = {"sea":"きらめく波と、小さな船長。<br>いっしょに、空の海へ。", "ice":"氷山とツララの海へ。<br>予告を見て、風で抜けよう。", "desert":"砂丘に囲まれた水路へ。<br>サボテンをひとっとび。", "cloud":"ふわふわの雲をつないで。<br>風といっしょに、空の上へ。"}
    st.markdown(f"""
    <div class="voyage-cover"><img class="cover-world" src="{world}" alt="{course['title']}の風景"><div class="cover-ship"><img class="cover-yacht" src="{yacht}" alt="斜めから見た魔法のヨット"><img class="cover-sail-mark" src="{mark}" alt="Streamlit"><div class="cover-captain"><img class="cover-captain-art" src="{captain}" alt="水色の髪と大きな帽子の小さな船長"><img class="cover-cap-mark" src="{mark}" alt=""></div></div><div class="cover-copy"><small>COURSE {course['id']}</small><h2>{course['title']}</h2><p>{taglines[course['theme']]}</p></div><span class="cover-note">SAIL · WIND · DISCOVER</span></div>
    """, unsafe_allow_html=True)
    home(course_id=course["id"], on_selected_course_change=select_course)
    with st.container(border=True, key="voyage_settings"):
        st.markdown(f'<div class="settings-label"><span>✧</span> 航海の設定</div><p class="settings-note">{course["description"]}</p>', unsafe_allow_html=True)
        columns = st.columns(2)
        with columns[0]:
            gravity = st.slider("重力", 0.5, 1.8, 1.0, 0.1, key="gravity_setting", help="大きいほど落下が速くなります。")
        with columns[1]:
            jump_power = st.slider("ジャンプ力", 0.7, 1.5, 1.0, 0.1, key="jump_setting", help="大きいほど高く跳びます。")
        st.markdown("""<div class="voyage-help"><div><b>01 · Sail</b><small>A でジャンプ<br>B でブースト</small></div><div><b>02 · Wind</b><small>クリスタルで追い風<br>波と雲の切れ目を越えよう</small></div><div><b>03 · Guide</b><small>GUIDEで精霊の光<br>PAUSEからホームへ</small></div></div>""", unsafe_allow_html=True)
        if st.button("出航する  →", type="primary", use_container_width=True):
            start_voyage(course["id"], gravity, jump_power)
else:
    # The completion callback reruns this script; session state already holds the event.
    event = st.session_state.get("sky_sailer_game", {}).get("result")
    evaluation = None
    if validate_result(event, st.session_state.run_id, course["id"]) and event["status"] == "cleared":
        stored = st.session_state.get("evaluation")
        if not stored or stored["attempt_id"] != event["attempt_id"]:
            rank, score = calculate_rank(event, {"gravity": st.session_state.gravity, "jump_power": st.session_state.jump_power, "par_seconds": course["par_seconds"]})
            comments = {"S": "風と心がひとつになった、見事な航海。", "A": "美しい航跡を残して、船着場へ。", "B": "雲を越えて、無事にたどり着いた。", "C": "次の風に乗れば、もっと遠くへ。"}
            st.session_state.evaluation = {"attempt_id": event["attempt_id"], "rank": rank, "score": score, "comment": comments[rank]}
        evaluation = st.session_state.evaluation
    ids = list(COURSES)
    next_index = ids.index(course["id"]) + 1
    game(gravity=st.session_state.gravity, jump_power=st.session_state.jump_power, run_id=st.session_state.run_id, course_id=course["id"], evaluation=evaluation, next_course_id=ids[next_index] if next_index < len(ids) else None, on_navigation_change=navigate_voyage, key="sky_sailer_game")

st.markdown('<div class="voyage-footer"><span>✦</span> SKY SAILER · A STREAMLIT VOYAGE</div>', unsafe_allow_html=True)
