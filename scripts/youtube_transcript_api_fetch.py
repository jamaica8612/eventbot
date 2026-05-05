from __future__ import annotations

import json
import re
import sys

from youtube_transcript_api import YouTubeTranscriptApi


def main() -> None:
    video_id = sys.argv[1]
    api = YouTubeTranscriptApi()
    transcript = choose_transcript(api.list(video_id))
    fetched = transcript.fetch()
    snippets = [item.text for item in fetched]
    lines = compact_lines(snippets)

    print(
        json.dumps(
            {
                "source": "youtube-transcript-api",
                "videoId": video_id,
                "language": getattr(fetched, "language_code", ""),
                "languageName": getattr(fetched, "language", "") or transcript.language,
                "isGenerated": bool(getattr(fetched, "is_generated", transcript.is_generated)),
                "lines": lines,
                "text": "\n".join(lines),
            },
            ensure_ascii=False,
        )
    )


def choose_transcript(transcript_list):
    transcripts = list(transcript_list)
    priorities = [
        lambda item: item.language_code == "ko" and not item.is_generated,
        lambda item: item.language_code in {"ko", "ko-orig"} and item.is_generated,
        lambda item: item.language_code == "ko",
        lambda item: item.language_code == "en" and not item.is_generated,
        lambda item: item.language_code == "en" and item.is_generated,
        lambda item: item.language_code.startswith("ko"),
        lambda item: item.language_code.startswith("en"),
    ]

    for predicate in priorities:
        for transcript in transcripts:
            if predicate(transcript):
                return transcript

    if transcripts:
        return transcripts[0]
    raise RuntimeError("사용 가능한 유튜브 자막이 없습니다.")


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
