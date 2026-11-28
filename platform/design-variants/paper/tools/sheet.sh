#!/bin/sh
# sh tools/sheet.sh <out.png> <height> "<page?query> <w> <h> [waitMs] [js]" ... : several captures side by side at one height, for a quick look
out=$1; hh=$2; shift 2; i=0; ins=""; f=""; lab=""
for spec in "$@"; do set -- $spec; node "$(dirname "$0")/shot.js" "$1" "${out%.png}-$i.png" $2 $3 ${4:-1200} >/dev/null; ins="$ins -i ${out%.png}-$i.png"; f="$f[$i]scale=-1:$hh[v$i];"; lab="$lab[v$i]"; i=$((i+1)); done
ffmpeg -y -loglevel error $ins -filter_complex "${f}${lab}hstack=$i" "$out"; j=0; while [ $j -lt $i ]; do rm -f "${out%.png}-$j.png"; j=$((j+1)); done
