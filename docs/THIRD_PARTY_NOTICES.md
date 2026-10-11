# Third-party notices

The frontend uses Phaser 3 (MIT), Streamlit component-v2-lib (Apache-2.0), and build tooling recorded in `frontend/package-lock.json`. Python dependencies are recorded in `requirements.txt` and `pyproject.toml`.

Phaser's MIT copyright and permission notice is distributed with the component at `frontend/public/licenses/Phaser-MIT.txt` and copied into `sky_sailer/frontend/build/licenses/Phaser-MIT.txt` by Vite. The minified bundle retains legal comments from its dependencies.

The application uses system fonts, generated illustrations, user-supplied reference artwork, original SVG/code graphics, synthesized Web Audio effects, and user-supplied recorded audio. Production records and original reference files are kept locally and are not shipped.

Recorded music was supplied by the user: Beyond the Far Horizon for 1-1, Before the Morning Thaw for 2-1, The Well of Golden Light for 3-1, and Crown of the Sky for 4-1. The user also supplied thunder, two victory tracks and a star-ring launch recording. Local originals are preserved under `assets/source/audio/` and ignored by Git; the replaced Where the Tide Meets Sky track is archived locally. Only prepared derivatives under `frontend/public/assets/music/` and `frontend/public/assets/sfx/` are shipped and copied into the Streamlit build. See [media management](MEDIA.md) for the source-to-runtime mapping.

The Streamlit color mark is the unmodified SVG from [Streamlit's official brand assets](https://streamlit.io/brand): `https://streamlit.io/images/brand/streamlit-mark-color.svg`, saved as `frontend/public/assets/streamlit-mark.svg`. Its use identifies software made with Streamlit. The mark remains a trademark of its owner; it is not licensed as our game's original art. The logo's shape and aspect ratio are preserved when composed onto the sail, captain hat and UI.
