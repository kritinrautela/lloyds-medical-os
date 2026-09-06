#!/usr/bin/env bash
set -euo pipefail

# Rebuild final.mp4 from raw.webm, narration.aiff and subtitles.srt
FFMPEG="/Users/kritin/LLOYDS SERVER /demo/node_modules/ffmpeg-static/ffmpeg"
if [ ! -f "$FFMPEG" ]; then
  FFMPEG=$(which ffmpeg)
fi

echo "Rebuilding final.mp4 using $FFMPEG..."
"$FFMPEG" -y -i raw.webm -i narration.aiff -filter_complex "[0:v]setpts=PTS/1.3000,tpad=stop_mode=clone:stop_duration=3.501,subtitles='/Users/kritin/LLOYDS SERVER /demo-videos/05-patient-record/subtitles.srt':force_style='FontName=Helvetica,FontSize=9,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&HC0000000,BackColour=&H90000000,BorderStyle=4,Outline=1,Shadow=0,MarginV=14'[v]" -map "[v]" -map 1:a -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart final.mp4
"$FFMPEG" -y -ss 00:00:02.000 -i final.mp4 -vframes 1 -q:v 2 poster.png
echo "Build complete."
