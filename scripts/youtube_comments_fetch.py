from __future__ import annotations

import json
import subprocess
import sys


def main() -> None:
    video_id = sys.argv[1]
    max_count = int(sys.argv[2]) if len(sys.argv) > 2 else 50
    video_url = f"https://www.youtube.com/watch?v={video_id}"

    extractor_args = (
        f"youtube:max_comments={max_count},all,0,0;comment_sort=top"
    )

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "yt_dlp",
            "--skip-download",
            "--no-playlist",
            "--write-comments",
            "--extractor-args",
            extractor_args,
            "--dump-single-json",
            video_url,
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    info = json.loads(result.stdout)
    raw_comments = info.get("comments") or []

    cleaned = []
    for comment in raw_comments:
        text = (comment.get("text") or "").strip()
        if not text:
            continue
        cleaned.append(
            {
                "author": comment.get("author") or "",
                "text": text,
                "likes": comment.get("like_count") or 0,
                "pinned": bool(comment.get("is_pinned")),
                "byUploader": bool(comment.get("author_is_uploader")),
            }
        )

    cleaned.sort(key=lambda c: c["likes"], reverse=True)
    cleaned = cleaned[:max_count]

    print(
        json.dumps(
            {
                "videoId": video_id,
                "totalCount": info.get("comment_count") or len(raw_comments),
                "comments": cleaned,
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
