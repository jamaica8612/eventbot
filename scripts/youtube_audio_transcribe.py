from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from faster_whisper import WhisperModel


def main() -> None:
    video_url = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "base"

    with tempfile.TemporaryDirectory() as temp_dir:
        output = str(Path(temp_dir) / "%(id)s.%(ext)s")
        subprocess.run(
            [
                sys.executable,
                "-m",
                "yt_dlp",
                "--no-playlist",
                "--format",
                "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
                "--max-filesize",
                "30M",
                "--output",
                output,
                video_url,
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
        )

        audio_path = next(Path(temp_dir).glob("*"))
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
        segments, info = model.transcribe(
            str(audio_path),
            language="ko",
            beam_size=1,
            vad_filter=True,
        )

        lines = []
        for segment in segments:
            text = re.sub(r"\s+", " ", segment.text).strip()
            if text:
                lines.append(text)
            if len(lines) >= 80:
                break

    print(
        json.dumps(
            {
                "source": "audio-whisper",
                "model": model_name,
                "language": info.language,
                "languageProbability": info.language_probability,
                "lines": lines,
                "text": "\n".join(lines),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.exit(1)
