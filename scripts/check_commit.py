"""Scan the Git index before committing; --worktree scans commit candidates.

Standard-library only. Never prints matched secret values. Run in Dev Container.
"""
import argparse
import fnmatch
import re
import subprocess
import unicodedata
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
PRIVATE_PARTS = {".agents", ".agent", ".codex", ".claude", ".cursor", ".windsurf", ".gemini", ".skills", ".aws", ".azure", ".ssh", ".docker", ".pip", ".venv", "node_modules", "__pycache__", ".cache", ".npm", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".idea", ".vscode", ".security-audit", "test-results", "playwright-report"}
PRIVATE_PREFIXES = ("assets/", "docs/screenshots/", "docs/audio/", "docs/security/", ".github/agents/", ".github/instructions/")
PRIVATE_NAMES = ("AGENTS*.md", "CLAUDE*.md", "GEMINI.md", "SKILL.md", "CODEX*.md", "copilot-instructions.md", ".env", ".env.*", ".aider*", ".npmrc", ".pypirc", ".netrc", ".gitconfig", "secrets.toml", "credentials*.json", "service-account*.json", "*service_account*.json", "*.pem", "*.key", "*.p12", "*.pfx", "*.keystore", "id_rsa*", "id_ed25519*", "*.log", "*.tmp", "*.bak", "*.sqlite*", "*.db", "*.pyc", "*.map", ".preview-*", ".visual-*")
REFERENCE_NAMES = {"空翔るヨットの幻想世界.png", "浮遊島を望むStreamlit帆船.png", "魔法 sailor キャプテンの四面図.png", "Beyond_the_Far_Horizon.mp3", "Before_the_Morning_Thaw.mp3", "Where_the_Tide_Meets_Sky.mp3", "The_Well_of_Golden_Light.mp3"}
APPROVED_PUBLIC = {
    "assets/ruins-v1.webp", "assets/palms-v1.webp", "assets/rock-v2.webp",
    "assets/world-v2.webp", "assets/world-ice-v1.webp", "assets/world-desert-v1.webp", "assets/world-cloud-v1.webp", "assets/yacht-v2.webp", "assets/captain-v3.webp", "assets/streamlit-mark.svg", "licenses/Phaser-MIT.txt",
    *(f"assets/music/course-{course}-loop.{ext}" for course in ("1-1", "2-1", "3-1") for ext in ("mp3", "ogg")),
}
SECRET_RULES = [
    ("private key", re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----")),
    ("AWS access key", re.compile(rb"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("GitHub token", re.compile(rb"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b")),
    ("API token", re.compile(rb"\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}\b")),
    ("Slack token", re.compile(rb"\bxox[baprs]-[A-Za-z0-9-]{20,}\b")),
    ("npm token", re.compile(rb"\bnpm_[A-Za-z0-9]{30,}\b")),
    ("package registry authentication", re.compile(rb"(?im)(?:_authToken|_auth)\s*=\s*[A-Za-z0-9+/=_-]{16,}")),
    ("Google API key", re.compile(rb"\bAIza[A-Za-z0-9_-]{35}\b")),
    ("authenticated URL", re.compile(rb"https?://[^\s/:@]{2,}:[^\s/@]{4,}@")),
    ("credential assignment", re.compile(rb"(?i)[\"']?(?:api[_-]?key|access[_-]?token|client[_-]?secret|aws[_-]?secret[_-]?access[_-]?key|password)[\"']?\s*[:=]\s*[\"']([^\"'\r\n]{12,})[\"']")),
    ("local user path", re.compile(rb"/(?:Users|home)/[A-Za-z0-9_.-]+/(?:work|\.codex|\.ssh|\.aws)/")),
]


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def private_path(name):
    normalized = unicodedata.normalize("NFC", name)
    path = PurePosixPath(normalized)
    if any(part in PRIVATE_PARTS or "handoff" in part.lower() or part.endswith(".egg-info") for part in path.parts):
        return True
    if any(normalized.startswith(prefix) for prefix in PRIVATE_PREFIXES):
        return True
    if normalized.startswith(".streamlit/") and normalized != ".streamlit/config.toml":
        return True
    if len(path.parts) == 1 and normalized in REFERENCE_NAMES:
        return True
    return any(fnmatch.fnmatchcase(path.name, pattern) for pattern in PRIVATE_NAMES)


def public_asset(name):
    if name.startswith("frontend/public/"):
        return name[len("frontend/public/"):] in APPROVED_PUBLIC
    prefix = "sky_sailer/frontend/build/"
    if not name.startswith(prefix):
        return True
    relative = name[len(prefix):]
    return relative in APPROVED_PUBLIC or bool(re.fullmatch(r"index-[A-Za-z0-9_-]+\.(js|css)", relative))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--worktree", action="store_true")
    args = parser.parse_args()
    names = git("ls-files", "--cached", "--others", "--exclude-standard", "-z") if args.worktree else git("ls-files", "--cached", "-z")
    failures = []
    checked = 0
    for raw in sorted(set(names.split(b"\0")) - {b""}):
        name = raw.decode("utf-8", "surrogateescape")
        if private_path(name):
            failures.append((name, "private/cache/agent file")); continue
        if not public_asset(name):
            failures.append((name, "unapproved public build file")); continue
        if args.worktree:
            path = ROOT / name
            if not path.exists():
                continue
            if path.is_symlink():
                failures.append((name, "symlink")); continue
            data = path.read_bytes()
        else:
            entry = git("ls-files", "--stage", "--", name).split(b" ", 1)[0]
            if entry == b"120000":
                failures.append((name, "symlink")); continue
            if entry == b"160000":
                failures.append((name, "unreviewed submodule")); continue
            data = git("show", f":{name}")
        checked += 1
        # Binary media is path-checked but is not interpreted as credential text.
        if b"\0" in data[:8192]:
            continue
        for label, expression in SECRET_RULES:
            match = expression.search(data)
            if match:
                if label == "credential assignment" and match.group(1).lower().startswith((b"example", b"placeholder", b"your_", b"replace_", b"<")):
                    continue
                failures.append((name, label))
    if failures:
        print("Commit guard blocked the following files (values redacted):")
        for name, reason in failures:
            print(f"  {name}: {reason}")
        return 1
    print(f"Commit guard: {checked} files checked; no blocked paths or known secret patterns found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
