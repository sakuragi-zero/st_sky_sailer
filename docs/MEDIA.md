# 素材の管理

原本と配信用ファイルを分けています。`assets/` 内の原本・履歴はローカル管理で、Gitと公開ビルドには含めません。原本は再編集・再変換のために残してください。

| フォルダ | 用途 |
| --- | --- |
| `assets/source/audio/music/` | 使用中のBGM原本 |
| `assets/source/audio/sfx/` | 使用中の効果音・ゴール曲の原本 |
| `assets/source/references/` | 提供された背景・キャラクターの参考画像 |
| `assets/source/` のPNG | 生成したイラストの編集用原本 |
| `assets/scenery-v2/` | 岩・遺跡・ヤシの原本と変換記録 |
| `assets/archive/music/` | 差し替え済みBGMの保存用原本 |
| `assets/archive/previews/` | 使用終了した画像の保存用ファイル |
| `frontend/public/assets/music/` | ブラウザ向けBGM。OggとMP3の両方が必要 |
| `frontend/public/assets/sfx/` | ブラウザ向け効果音・ゴール曲 |
| `sky_sailer/frontend/build/` | Streamlitが配信するビルド。Viteで生成する |
| `docs/audio/` | ローカルの音源解析レポート |

`frontend/public/` と `sky_sailer/frontend/build/` の素材は、開発用と配信用なので両方を保持します。ビルド側は直接編集せず、`npm run build` で更新します。

## 使用中の音源

| 用途 | 原本（`assets/source/audio/` 内） | 配信用ファイル（`frontend/public/assets/` 内） |
| --- | --- | --- |
| 1-1・ホームBGM | `music/Beyond_the_Far_Horizon.mp3` | `music/course-1-1-loop.ogg` / `.mp3` |
| 2-1 BGM | `music/Before_the_Morning_Thaw.mp3` | `music/course-2-1-loop.ogg` / `.mp3` |
| 3-1 BGM | `music/The_Well_of_Golden_Light.mp3` | `music/course-3-1-loop.ogg` / `.mp3` |
| 4-1 BGM | `music/Crown_of_the_Sky.mp3` | `music/course-4-1-loop.ogg` / `.mp3` |
| 雷鳴 | `sfx/thunder-original.mp3`（元の名前：雷鳴.mp3） | `sfx/thunder-v1.mp3` |
| ゴール曲 #2 | `sfx/victory-2-original.mp3`（元の名前：A_triumphant_10-seco_#2.mp3） | `sfx/goal-v1.mp3` |
| ゴール曲 #1 | `sfx/victory-1-original.mp3`（元の名前：A_triumphant_10-seco_#1.mp3） | `sfx/goal-alt-v1.mp3` |
| スターリング | `sfx/star-launch-original.mp3`（元の名前：A_massive,_thunderou_#1.mp3） | `sfx/star-launch-v1.mp3` |

旧3-1の `Where_the_Tide_Meets_Sky.mp3` は `assets/archive/music/` に保管しています。

## 音源の再生成

次のコマンドは開発Dockerの `/workspaces/st_sky_sailer` 内で実行します。必要な依存関係は `scripts/audio-requirements.txt` にあります。通常のビルドは原本や音源処理の依存関係を必要としません。

```sh
python scripts/prepare_bgm.py --course 3-1
python scripts/prepare_sfx.py --sound thunder
cd frontend
npm run build
```

コース・効果音の指定を省略すると、その種類の音源をすべて再生成します。新しい素材を追加する場合は、変換スクリプト、Viteの配信対象、`.gitignore` とコミットガードの許可リストも更新してください。
