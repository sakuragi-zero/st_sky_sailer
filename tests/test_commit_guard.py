"""Commit guard checks using temporary repositories and synthetic credentials."""
import os
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

from scripts.check_commit import private_path, public_asset


def test_private_paths_and_unicode():
    for name in ("SkySailer_Codex_Handoff/SPEC.md", ".codex/config.toml", "docs/security/report.json", ".streamlit/secrets.toml", "nested/.env.prod", "AGENTS.md", "frontend/node_modules/lib/index.js", unicodedata.normalize("NFD", "魔法 sailor キャプテンの四面図.png")):
        assert private_path(name)
    for name in ("app.py", ".streamlit/config.toml", ".githooks/pre-commit", "scripts/check_commit.py"):
        assert not private_path(name)


def test_public_allowlist():
    assert public_asset("sky_sailer/frontend/build/index-valid.js")
    assert public_asset("sky_sailer/frontend/build/assets/captain-v3.webp")
    assert public_asset("frontend/public/assets/music/course-1-1-loop.ogg")
    assert not public_asset("sky_sailer/frontend/build/notes.txt")
    assert not public_asset("frontend/public/assets/credentials.json")
    assert not public_asset("sky_sailer/frontend/build/assets/captain-v2.webp")


def test_guard_reads_index_not_cleaned_worktree():
    with tempfile.TemporaryDirectory(prefix="sky-guard-") as temp:
        repo = Path(temp)
        (repo / "scripts").mkdir()
        shutil.copy(Path(__file__).parents[1] / "scripts/check_commit.py", repo / "scripts/check_commit.py")
        subprocess.run(["git", "init", "-q", str(repo)], check=True)
        synthetic = "A" + "KIA" + "B" * 16
        target = repo / "settings.py"
        target.write_text(f'value = "{synthetic}"\n')
        subprocess.run(["git", "add", "settings.py"], cwd=repo, check=True)
        target.write_text('value = "placeholder"\n')
        result = subprocess.run([sys.executable, "scripts/check_commit.py"], cwd=repo, capture_output=True, text=True)
        assert result.returncode == 1
        assert "AWS access key" in result.stdout
        assert synthetic not in result.stdout


def test_forced_private_file_and_symlink():
    with tempfile.TemporaryDirectory(prefix="sky-guard-") as temp:
        repo = Path(temp)
        (repo / "scripts").mkdir()
        shutil.copy(Path(__file__).parents[1] / "scripts/check_commit.py", repo / "scripts/check_commit.py")
        subprocess.run(["git", "init", "-q", str(repo)], check=True)
        (repo / ".env").write_text("example local data\n")
        os.symlink("missing.txt", repo / "link.txt")
        subprocess.run(["git", "add", ".env", "link.txt"], cwd=repo, check=True)
        result = subprocess.run([sys.executable, "scripts/check_commit.py"], cwd=repo, capture_output=True, text=True)
        assert result.returncode == 1
        assert "private/cache/agent file" in result.stdout
        assert "symlink" in result.stdout
