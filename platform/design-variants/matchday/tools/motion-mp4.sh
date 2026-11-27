#!/bin/sh
# sh tools/motion-mp4.sh : converts the recorded webm videos in captures/video to mp4 (H.264, 30 fps); the webm sources stay next to them.
cd "$(dirname "$0")/../captures/video" || exit 1
for f in *.webm; do
  [ -f "$f" ] || continue
  ffmpeg -y -loglevel error -i "$f" -r 30 -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart "${f%.webm}.mp4" && echo "mp4 ${f%.webm}"
done
