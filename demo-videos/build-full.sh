#!/usr/bin/env bash
# Stitches the six clips into one video with a title card before each part.
set -euo pipefail
cd "$(dirname "$0")"
FFMPEG="$PWD/../demo/node_modules/ffmpeg-static/ffmpeg"
[ -f "$FFMPEG" ] || FFMPEG="$(which ffmpeg)"
FONT="/System/Library/Fonts/HelveticaNeue.ttc"
W="$PWD/_full"; mkdir -p "$W"

CLIPS=(
  "01-sign-in-and-board|Part 1|Sign in and the clinical board"
  "02-register-a-patient|Part 2|Register a patient and print the card"
  "03-check-in-and-queue|Part 3|Check in and the outpatient queue"
  "04-dispense-with-allergy-check|Part 4|Dispensing with the allergy check"
  "05-patient-record|Part 5|The patient record"
  "06-export-backup-offsite|Part 6|Protected export, backup and off-site copy"
)

card() {  # file, small line, big line, seconds
  "$FFMPEG" -y -v error -f lavfi -i "color=c=0x0b2545:s=1440x900:d=$4:r=25" \
    -f lavfi -i "anullsrc=r=22050:cl=mono" -t "$4" \
    -vf "drawtext=fontfile=$FONT:text='$2':fontcolor=0xb89230:fontsize=30:x=(w-text_w)/2:y=(h/2)-90, \
         drawtext=fontfile=$FONT:text='$3':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=(h/2)-30, \
         fade=t=in:st=0:d=0.4,fade=t=out:st=$(echo "$4-0.5" | bc):d=0.5" \
    -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 128k -ar 22050 -ac 1 "$1"
}

card "$W/00-title.mp4" "Lloyds Metals \& Energy Ltd  ·  Papua New Guinea" "Lloyds Medical OS" 3.5
: > "$W/list.txt"
echo "file '$W/00-title.mp4'" >> "$W/list.txt"
for entry in "${CLIPS[@]}"; do
  IFS='|' read -r dir small big <<< "$entry"
  card "$W/$dir-card.mp4" "$small" "$big" 2.5
  echo "file '$W/$dir-card.mp4'" >> "$W/list.txt"
  echo "file '$PWD/$dir/final.mp4'" >> "$W/list.txt"
done
card "$W/99-end.mp4" "Records stay on the clinic machine. Off-site copies are encrypted." "Lloyds Medical OS" 3.5
echo "file '$W/99-end.mp4'" >> "$W/list.txt"

"$FFMPEG" -y -v error -f concat -safe 0 -i "$W/list.txt" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 25 -c:a aac -b:a 128k -ar 22050 -ac 1 \
  -movflags +faststart "lloyds-medical-os-demo.mp4"
echo "wrote lloyds-medical-os-demo.mp4"
