#!/bin/sh
# sh tools/run-all.sh : the whole delivery loop: captures, stills, videos, mp4, flow test, language switch check, audits.
cd "$(dirname "$0")/.." || exit 1
node tools/capture-all.js
node tools/motion-run.js
sh tools/motion-mp4.sh
node tools/flow-test.js
node tools/lang-switch-check.js
sh tools/audit-all.sh en 390 844 > tools/audit-en.txt 2>&1
sh tools/audit-all.sh ko 390 844 > tools/audit-ko.txt 2>&1
sh tools/audit-all.sh ja 360 780 > tools/audit-ja-360.txt 2>&1
echo ALLDONE
