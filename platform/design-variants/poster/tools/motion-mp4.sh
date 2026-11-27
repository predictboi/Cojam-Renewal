#!/bin/sh
# Converts the recorded webm videos in captures/video to mp4 (H.264, 30 fps) and removes the webm.
cd "$(dirname "$0")/../captures/video" || exit 1
for f in *.webm; do ffmpeg -y -loglevel error -i "$f" -c:v libx264 -pix_fmt yuv420p -r 30 -crf 20 "${f%.webm}.mp4" && rm "$f"; done; ls -la
