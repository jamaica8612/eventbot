from __future__ import annotations

import json
import re
import sys

from youtube_transcript_api import YouTubeTranscriptApi


def main() -> None:
    video_id = sys.argv[1]
    api = YouTubeTranscriptApi()
    fetched = api.fetch(video_id, languages=["ko", "ko-orig", "en"])
    snippets = [item.text for item in fetched]
    lines = compact_lines(snippets)

    print(
        json.dumps(
            {
                "source": "youtube-transcript-api",
                "videoId": video_id,
                "language": getattr(fetched, "language_code", ""),
                "languageName": getattr(fetched, "language", ""),
                "isGenerated": bool(getattr(fetched, "is_generated", False)),
                "lines": lines,
                "text": "\n".join(lines),
            },
            ensure_ascii=False,
        )
    )


def compact_lines(snippets: list[str]) -> list[str]:
    lines = []
    current = ""
    for snippet in snippets:
        value = re.sub(r"\s+", " ", str(snippet)).strip()
        if not value:
            continue
        if current and len(current) + len(value) > 180:
            lines.append(current)
            current = value
        else:
            current = f"{current} {value}".strip()
    if current:
        lines.append(current)
    return lines[:80]


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc).splitlines()[0] or type(exc).__name__}, ensure_ascii=False))
        sys.exit(1)
