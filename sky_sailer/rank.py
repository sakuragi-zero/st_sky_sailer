"""Server-side validation and clear rank calculation."""

from math import isfinite


def validate_result(result: object, run_id: str, course_id: str | None = None) -> bool:
    """Validate the browser event before using its fields or displaying it."""
    if not isinstance(result, dict) or result.get("run_id") != run_id:
        return False
    if course_id is not None and result.get("course_id") != course_id:
        return False
    attempt = result.get("attempt_id")
    if not isinstance(attempt, str) or len(attempt) > 80 or not attempt.startswith(f"{run_id}:"):
        return False
    status = result.get("status")
    if not attempt[len(run_id) + 1:].isdigit() or not isinstance(status, str) or status not in {"cleared", "failed"}:
        return False
    for key, maximum in (("elapsed_ms", 600000), ("hit_count", 3), ("crystals", 100), ("total_crystals", 100)):
        value = result.get(key)
        if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= maximum:
            return False
    if result["total_crystals"] < 1 or result["crystals"] > result["total_crystals"]:
        return False
    return result["status"] != "cleared" or result["hit_count"] < 3


def calculate_rank(result: dict, config: dict) -> tuple[str, int]:
    """Return (rank, score) from untrusted browser result data."""
    try:
        elapsed = float(result.get("elapsed_ms", 0)) / 1000
        hits = int(result.get("hit_count", 0))
        crystals = int(result.get("crystals", 0))
        total = int(result.get("total_crystals", 0))
        gravity = float(config.get("gravity", 1.0))
        jump = float(config.get("jump_power", 1.0))
    except (TypeError, ValueError, OverflowError):
        return "C", 0
    if not all(isfinite(v) for v in (elapsed, gravity, jump)):
        return "C", 0
    if not (0 <= elapsed <= 600 and 0 <= hits <= 100 and 0 <= crystals <= 100 and 0 <= total <= 100 and total >= crystals):
        return "C", 0
    if not (0.5 <= gravity <= 1.8 and 0.7 <= jump <= 1.5):
        return "C", 0
    score = max(0, min(100, round(100 - max(0, elapsed - 45) * 0.55 - hits * 14 - max(0, total - crystals) * 3)))
    rank = "S" if score >= 90 else "A" if score >= 75 else "B" if score >= 55 else "C"
    return rank, score
