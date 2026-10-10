"""Registration wrapper for the browser game."""

import streamlit as st

_mount = st.components.v2.component(
    "sky-sailer.game",
    js="index-*.js",
    html='<div class="sky-sailer-root"></div>',
    css="index-*.css",
)


def game(*, gravity: float, jump_power: float, run_id: str, course_id: str = "1-1", evaluation: dict | None = None, key: str = "sky_sailer_game"):
    """Mount the game and return its low-frequency completion state."""
    return _mount(
        key=key,
        data={"gravity": gravity, "jump_power": jump_power, "run_id": run_id, "course_id": course_id, "evaluation": evaluation},
        default={"result": None},
        on_result_change=lambda: None,
    )


def home(*, course_id: str, on_selected_course_change, key: str = "sky_sailer_home"):
    """Swipe course cards and play the first course's BGM on the home screen."""
    return _mount(
        key=key,
        data={"mode": "home", "course_id": course_id},
        default={"selected_course": None},
        on_selected_course_change=on_selected_course_change,
    )
