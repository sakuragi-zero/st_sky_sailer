# Dev Container

Open this repository in VS Code and choose **Reopen in Container**. The container uses Python 3.12 and Node.js 22. On first creation it installs the Python and npm dependencies, builds the Streamlit component assets, then starts Streamlit on port 8501. The app log is at `/tmp/sky-sailer-streamlit.log` inside the container.

Rebuild the component after frontend changes with `cd frontend && npm run build`. The resulting files in `sky_sailer/frontend/build/` are part of the Community Cloud deployment path.

Install languages, frameworks and dependencies only inside this container. Do not install them on the host. The npm dependencies use a named Docker volume; the creation command sets its owner before `npm ci`.

For optional browser checks, run `bash .devcontainer/setup-browser.sh` inside the container, then `cd frontend && npm run test:browser`. The setup script installs Chromium and Japanese fonts inside the container. Python tests run with `python -m pytest -q`.
