import pytest

from sky_sailer.rank import calculate_rank, validate_result


CONFIG = {"gravity": 1.0, "jump_power": 1.0}


def test_fast_clean_clear_is_s_rank():
    assert calculate_rank({"elapsed_ms": 30000, "hit_count": 0, "crystals": 13, "total_crystals": 13}, CONFIG) == ("S", 100)


def test_long_course_uses_its_server_defined_reference_time():
    event = {"elapsed_ms": 105000, "hit_count": 0, "crystals": 53, "total_crystals": 53}
    assert calculate_rank(event, CONFIG | {"par_seconds": 105}) == ("S", 100)


@pytest.mark.parametrize("par_seconds", [float("nan"), 0, 301, "invalid"])
def test_rank_rejects_invalid_reference_times(par_seconds):
    assert calculate_rank({"elapsed_ms": 105000}, CONFIG | {"par_seconds": par_seconds}) == ("C", 0)


def test_slow_clear_with_misses_lowers_rank():
    rank, score = calculate_rank({"elapsed_ms": 90000, "hit_count": 2, "crystals": 5, "total_crystals": 13}, CONFIG)
    assert rank == "B"
    assert score == 60


def test_invalid_browser_data_gets_zero():
    assert calculate_rank({"elapsed_ms": float("nan"), "hit_count": 0}, CONFIG) == ("C", 0)
    assert calculate_rank({"elapsed_ms": 5, "hit_count": -4}, CONFIG) == ("C", 0)


@pytest.mark.parametrize("score,rank", [(90, "S"), (89, "A"), (75, "A"), (74, "B"), (55, "B"), (54, "C"), (0, "C")])
def test_rank_boundaries(score, rank):
    elapsed_ms = round((45 + (100 - score) / 0.25) * 1000)
    assert calculate_rank({"elapsed_ms": elapsed_ms, "hit_count": 0, "crystals": 24, "total_crystals": 24}, CONFIG) == (rank, score)


def valid_event():
    return {"run_id": "run", "attempt_id": "run:1", "status": "cleared", "elapsed_ms": 58000, "hit_count": 1, "crystals": 17, "total_crystals": 24}


def test_result_validation_accepts_a_completed_attempt():
    assert validate_result(valid_event(), "run")


@pytest.mark.parametrize("changes", [
    {"run_id": "old-run"}, {"attempt_id": "foreign:1"}, {"status": ["cleared"]},
    {"crystals": "<img onerror=alert(1)>"}, {"crystals": 25}, {"hit_count": -1},
    {"hit_count": 3}, {"elapsed_ms": float("inf")}, {"total_crystals": True},
])
def test_result_validation_rejects_malformed_or_foreign_events(changes):
    assert not validate_result(valid_event() | changes, "run")
