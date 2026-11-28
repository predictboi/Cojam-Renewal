#!/bin/sh
# Converts the Playwright recordings in captures/video from webm to mp4 (H.264, 30 fps, plays everywhere) when ffmpeg is installed.
cd "$(dirname "$0")/../captures/video" || exit 1
command -v ffmpeg >/dev/null || { echo "ffmpeg not found: the webm files stay as they are"; exit 0; }
for f in *.webm; do
  [ -f "$f" ] || continue
  ffmpeg -y -loglevel error -i "$f" -vf "fps=30,scale=390:844:flags=lanczos,pad=390:844" -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart "${f%.webm}.mp4" && echo "mp4 ${f%.webm}.mp4"
done
