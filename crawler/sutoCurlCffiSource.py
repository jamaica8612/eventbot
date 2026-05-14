from __future__ import annotations

import html
import json
import os
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

from bs4 import BeautifulSoup
from curl_cffi import requests as cc
try:
    from youtube_transcript_api import YouTubeTranscriptApi
except Exception:  # pragma: no cover - optional at runtime
    YouTubeTranscriptApi = None
try:
    from yt_dlp import YoutubeDL
except Exception:  # pragma: no cover - optional at runtime
    YoutubeDL = None

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE = "https://suto.co.kr"
LIST_URL = f"{BASE}/cpevent?isActive=1"
IMPERSONATE = "chrome124"
TIMEOUT = 20
DETAIL_LIMIT = int(os.environ.get("SUTO_DETAIL_LIMIT", "80"))
LIST_PAGE_LIMIT = int(os.environ.get("SUTO_LIST_PAGE_LIMIT", "20"))
DETAIL_DELAY_SECONDS = float(os.environ.get("SUTO_DETAIL_DELAY_SECONDS", "1.1"))
RATE_LIMIT_BACKOFF_SECONDS = [4, 9, 16]
YOUTUBE_TRANSCRIPT_LIMIT = int(os.environ.get("SUTO_YOUTUBE_TRANSCRIPT_LIMIT", "0"))
YOUTUBE_TRANSCRIPT_LINE_LIMIT = int(os.environ.get("SUTO_YOUTUBE_TRANSCRIPT_LINE_LIMIT", "64"))
YOUTUBE_TRANSCRIPT_TEXT_LIMIT = int(os.environ.get("SUTO_YOUTUBE_TRANSCRIPT_TEXT_LIMIT", "6000"))
YOUTUBE_TRANSCRIPT_DELAY_SECONDS = float(os.environ.get("SUTO_YOUTUBE_TRANSCRIPT_DELAY_SECONDS", "3"))
YOUTUBE_TRANSCRIPT_BLOCKED = False
MOBILE_UA = (
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
)
ALLOWED_PLATFORMS = {
    "유튜브 이벤트",
    "홈페이지 이벤트",
    "네이버 블로그 이벤트",
    "앱 전용 이벤트",
}


def main() -> None:
    events = fetch_list()
    payload = []
    with session() as s:
        for index, event in enumerate(events[:DETAIL_LIMIT]):
            if index > 0:
                time.sleep(DETAIL_DELAY_SECONDS)
            detail = fetch_detail_with_fallbacks(event["originalUrl"])
            hydrated_event = {**event, **detail}
            if is_instagram_event(hydrated_event):
                continue
            payload.append(hydrated_event)
    print(json.dumps(payload, ensure_ascii=False))


def session():
    s = cc.Session(impersonate=IMPERSONATE, timeout=TIMEOUT)
    s.headers.update(
        {
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
            "Referer": BASE,
        }
    )
    return s


def fetch_list() -> list[dict]:
    with session() as s:
        last_error = None
        for attempt in range(4):
            try:
                events = []
                seen_ids: set[str] = set()
                for page in range(1, LIST_PAGE_LIMIT + 1):
                    url = LIST_URL if page == 1 else f"{LIST_URL}&page={page}&seek=1"
                    response = s.get(url)
                    if response.status_code == 403:
                        raise RuntimeError("suto.co.kr returned HTTP 403")
                    response.raise_for_status()
                    page_events = parse_list(response.text, seen_ids, len(events))
                    events.extend(page_events)
                    time.sleep(0.25)
                return select_detail_targets(events)
            except Exception as exc:
                last_error = exc
                if attempt < 3:
                    time.sleep(2**attempt * 3)
        raise RuntimeError(f"failed to fetch suto list: {last_error}")


def parse_list(html: str, seen_ids: set[str] | None = None, start_rank: int = 0) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    events = []
    seen_ids = seen_ids if seen_ids is not None else set()

    for tr in soup.select("tr"):
        link = tr.find("a", href=re.compile(r"^/cpevent/\d+"))
        if not link:
            continue
        match = re.search(r"/cpevent/(\d+)", link["href"])
        if not match:
            continue
        event_id = match.group(1)
        if event_id in seen_ids:
            continue
        seen_ids.add(event_id)

        title = first_text(tr.select("td.td_subject a[href^='/cpevent/']"))
        platform = extract_platform_from_icons(tr)
        if is_instagram_event({"title": title, "platform": platform}):
            continue
        deadline_cells = tr.select("td.td_datetime")
        deadline_date_text = deadline_cells[0].get_text(strip=True) if len(deadline_cells) >= 1 else ""
        deadline_time_text = deadline_cells[1].get_text(strip=True) if len(deadline_cells) >= 2 else ""
        deadline_text = " ".join(part for part in [deadline_date_text, deadline_time_text] if part)

        prize_tags = unique_texts(tr.select("td.td_gift #event_tag_org a.event_tag_key"))
        if not prize_tags:
            prize_tags = unique_texts(tr.select("td.td_gift a.event_tag_key"))

        rank = start_rank + len(events) + 1
        entries = first_number([cell.get_text(strip=True) for cell in tr.select("td.td_num")])

        events.append(
            {
                "id": f"suto-{event_id}",
                "eventId": event_id,
                "title": title,
                "originalTitle": title,
                "originalUrl": f"{BASE}/cpevent/{event_id}",
                "applyUrl": f"{BASE}/bbs/link.php?bo_table=cpevent&wr_id={event_id}&no=1",
                "platform": platform or "이벤트",
                "rank": rank,
                "bookmarkCount": entries,
                "deadlineText": deadline_text,
                "deadlineDate": normalize_deadline_date(deadline_date_text),
                "prizeText": ", ".join(prize_tags),
                "source": f"슈퍼투데이 · {platform or '이벤트'}",
                "url": f"{BASE}/cpevent/{event_id}",
                "crawledFrom": "슈퍼투데이",
            }
        )

    return events


def select_detail_targets(events: list[dict]) -> list[dict]:
    quotas = {
        "유튜브 이벤트": 50,
        "네이버 블로그 이벤트": 10,
        "앱 전용 이벤트": 5,
    }
    sorted_events = sorted(events, key=lambda event: int(event.get("rank") or 9999))
    selected = []
    selected_ids = set()

    for platform, quota in quotas.items():
        for event in [event for event in sorted_events if event.get("platform") == platform][:quota]:
            selected.append(event)
            selected_ids.add(event["id"])

    for event in sorted_events:
        if len(selected) >= DETAIL_LIMIT:
            break
        if event["id"] in selected_ids:
            continue
        selected.append(event)
        selected_ids.add(event["id"])

    return selected[:DETAIL_LIMIT]


def extract_platform_from_icons(row) -> str:
    subject = row.select_one("td.td_subject") or row
    for icon in subject.find_all("img"):
        value = (icon.get("title") or icon.get("alt") or "").strip()
        if value:
            return normalize_platform_label(value)
    return ""


def normalize_platform_label(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def is_instagram_event(event: dict) -> bool:
    text_parts = [
        event.get("title"),
        event.get("originalTitle"),
        event.get("platform"),
        event.get("source"),
        event.get("originalText"),
        event.get("url"),
        event.get("originalUrl"),
        event.get("applyUrl"),
        *(event.get("externalLinks") or []),
        *(event.get("originalLines") or []),
    ]
    text = " ".join(str(part) for part in text_parts if part).lower()
    return bool(re.search(r"instagram|insta|인스타|인스타그램", text))


def fetch_detail(s, url: str) -> dict:
    try:
        response = None
        for attempt, backoff in enumerate([0, *RATE_LIMIT_BACKOFF_SECONDS]):
            if backoff:
                time.sleep(backoff)
            response = s.get(url)
            if response.status_code != 429:
                break
            if attempt >= len(RATE_LIMIT_BACKOFF_SECONDS):
                break
        if response is None:
            raise RuntimeError("No response returned.")
        response.raise_for_status()
        body, links, metadata_lines, metadata = parse_detail(response.text)
        lines = normalize_lines(body.splitlines())
        youtube_transcripts = fetch_youtube_transcripts(links)
        return {
            "originalText": "\n".join(lines),
            "originalLines": lines,
            "detailMetaLines": metadata_lines,
            **metadata,
            "externalLinks": links,
            "youtubeTranscripts": youtube_transcripts,
            "detailCrawlStatus": "ok" if lines else "empty",
            "detailCrawlMessage": "Fetched with curl_cffi chrome impersonation.",
        }
    except Exception as exc:
        return {
            "originalText": "",
            "originalLines": [],
            "detailMetaLines": [],
            "externalLinks": [],
            "youtubeTranscripts": [],
            "detailCrawlStatus": "failed",
            "detailCrawlMessage": str(exc),
        }


def fetch_detail_with_fallbacks(url: str) -> dict:
    attempts = [
        ("desktop", {}),
        (
            "mobile",
            {
                "User-Agent": MOBILE_UA,
                "Sec-CH-UA-Mobile": "?1",
                "Sec-CH-UA-Platform": '"Android"',
                "Viewport-Width": "390",
            },
        ),
    ]

    results = []
    for label, headers in attempts:
        with session() as s:
            s.headers.update(headers)
            result = fetch_detail(s, url)
            result["detailCrawlMode"] = label
            results.append(result)
            if result["detailCrawlStatus"] == "ok" and len(result["originalLines"]) >= 2:
                return result
            time.sleep(0.35)

    return max(results, key=lambda item: len(item["originalLines"]))


def parse_detail(html: str) -> tuple[str, list[str], list[str], dict]:
    soup = BeautifulSoup(html, "lxml")
    body_scopes = unique_nodes(
        soup.select("#bo_v_con")
        + soup.select(".bo_v_con")
        + soup.select(".view_content")
    )
    body_lines = []
    for scope in body_scopes:
        body_lines.extend(normalize_lines(scope.get_text("\n", strip=True).splitlines()))
    body_text = "\n".join(body_lines)
    metadata_lines = []
    for scope in unique_nodes(soup.select(".item-box")):
        metadata_lines.extend(normalize_lines(scope.get_text("\n", strip=True).splitlines()))
    metadata = extract_detail_metadata(soup)

    link_pattern = re.compile(
        "|".join(
            [
                r"youtube\.com/watch",
                r"youtube\.com/shorts/",
                r"youtube\.com/post/",
                r"youtube\.com/embed/",
                r"youtu\.be/",
                r"instagram\.com/",
                r"naver\.me/",
                r"forms\.gle/",
                r"docs\.google\.com/forms",
                r"form\.naver\.com",
            ]
        )
    )
    links = []
    seen = set()
    apply_links = []
    apply_seen = set()
    scopes = []
    for selector in ["#bo_v_con", ".bo_v_con", ".item-box", ".view_content", "#bo_v_link"]:
        scopes.extend(soup.select(selector))
    if not scopes:
        scopes = [soup]

    for scope in scopes:
        for a in scope.find_all("a", href=True):
            add_link(links, seen, a["href"].strip(), link_pattern)
        for iframe in scope.find_all("iframe", src=True):
            add_link(links, seen, iframe["src"].strip(), link_pattern)

    for scope in soup.select("#bo_v_link"):
        for a in scope.find_all("a", href=True):
            add_link(apply_links, apply_seen, a["href"].strip(), link_pattern)
        for iframe in scope.find_all("iframe", src=True):
            add_link(apply_links, apply_seen, iframe["src"].strip(), link_pattern)

    for el in soup.find_all(["input", "textarea"]):
        for attr in ("value", "data-original", "data-url", "placeholder"):
            add_link(links, seen, (el.get(attr) or "").strip(), link_pattern)

    for match in re.finditer(r"https?://[^\s\"'<>)]+", body_text):
        add_link(links, seen, match.group(0), link_pattern)

    if apply_links:
        metadata["applyTargetUrl"] = apply_links[0]

    return body_text, links, metadata_lines, metadata


def extract_detail_metadata(soup: BeautifulSoup) -> dict:
    metadata = {
        "resultAnnouncementDate": "",
        "resultAnnouncementText": "",
        "prizeText": "",
        "totalWinnerCount": "",
    }

    for item in soup.select(".item-box li"):
        label_node = item.select_one(".item_option")
        if not label_node:
            continue
        label = label_node.get_text(" ", strip=True)
        value = item.get_text(" ", strip=True).replace(label, "", 1).strip()
        if not label or not value:
            continue

        if is_announcement_label(label):
            metadata["resultAnnouncementDate"] = normalize_detail_date(value)
            metadata["resultAnnouncementText"] = f"{label} {value}".strip()[:100]
        elif is_total_winner_label(label):
            metadata["totalWinnerCount"] = parse_first_number(value) or ""
        elif "경품태그" in label:
            prize_tags = unique_texts(item.select("a"))
            metadata["prizeText"] = ", ".join(prize_tags) or value[:50]

    return {key: value for key, value in metadata.items() if value}


def is_announcement_label(label: str) -> bool:
    return "발표" in label and ("일" in label or "예정" in label)




def is_total_winner_label(label: str) -> bool:
    text = re.sub(r"\s+", "", label)
    return "\uCD1D\uB2F9\uCCA8\uC790\uC218" in text or "\uB2F9\uCCA8\uC790\uC218" in text or "\uB2F9\uCCA8\uC778\uC6D0" in text


def parse_first_number(value: str) -> int | None:
    match = re.search(r"\d[\d,]*", value or "")
    if not match:
        return None
    return int(match.group(0).replace(",", ""))
def normalize_detail_date(value: str) -> str:
    today = datetime.now()
    text = re.sub(r"\s+", " ", value).strip()

    full = re.search(r"(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})", text)
    if full:
        return format_date_parts(int(full.group(1)), int(full.group(2)), int(full.group(3)))

    short_year = re.search(r"(?<!\d)(\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})", text)
    if short_year:
        return format_date_parts(2000 + int(short_year.group(1)), int(short_year.group(2)), int(short_year.group(3)))

    month_day = re.search(r"(\d{1,2})\s*[.\-/월]\s*(\d{1,2})", text)
    if month_day:
        month = int(month_day.group(1))
        day = int(month_day.group(2))
        year = today.year + (1 if today.month >= 11 and month <= 2 else 0)
        return format_date_parts(year, month, day)

    return ""


def format_date_parts(year: int, month: int, day: int) -> str:
    try:
        date = datetime(year, month, day)
    except ValueError:
        return ""
    return date.strftime("%Y-%m-%d")


def unique_nodes(nodes) -> list:
    values = []
    seen = set()
    for node in nodes:
        key = id(node)
        if key in seen:
            continue
        seen.add(key)
        values.append(node)
    return values


def add_link(links: list[str], seen: set[str], value: str, pattern: re.Pattern) -> None:
    if value and pattern.search(value) and value not in seen:
        seen.add(value)
        links.append(value)


def fetch_youtube_transcripts(links: list[str]) -> list[dict]:
    global YOUTUBE_TRANSCRIPT_BLOCKED
    if YOUTUBE_TRANSCRIPT_LIMIT <= 0:
        return []

    video_refs = unique_youtube_video_refs(links)
    if not video_refs:
        return []

    api = YouTubeTranscriptApi() if YouTubeTranscriptApi is not None and not YOUTUBE_TRANSCRIPT_BLOCKED else None
    transcripts = []
    for ref in video_refs[:YOUTUBE_TRANSCRIPT_LIMIT]:
        if transcripts:
            time.sleep(YOUTUBE_TRANSCRIPT_DELAY_SECONDS)

        transcript = fetch_transcript_with_api(None if YOUTUBE_TRANSCRIPT_BLOCKED else api, ref)
        if transcript.get("status") != "ok":
            fallback = fetch_transcript_with_ytdlp(ref)
            if fallback.get("status") == "ok":
                transcript = fallback
            elif transcript.get("status") in {"unavailable", "failed", "empty"}:
                transcript["fallbackMessage"] = fallback.get("message", "")
                transcript["fallbackStatus"] = fallback.get("status", "unavailable")

        transcripts.append(transcript)
    return transcripts


def fetch_transcript_with_api(api, ref: dict) -> dict:
    global YOUTUBE_TRANSCRIPT_BLOCKED
    if api is None:
        return {
            "videoId": ref["videoId"],
            "url": ref["url"],
            "status": "unavailable",
            "source": "youtube-transcript-api",
            "message": "youtube-transcript-api is not available or is blocked.",
            "lines": [],
            "text": "",
        }

    try:
        fetched = api.fetch(ref["videoId"], languages=["ko", "en"])
        snippets = list(fetched)
        lines = compact_transcript_lines([snippet.text for snippet in snippets])
        text = "\n".join(lines)[:YOUTUBE_TRANSCRIPT_TEXT_LIMIT].strip()
        return {
            "videoId": ref["videoId"],
            "url": ref["url"],
            "status": "ok" if text else "empty",
            "source": "youtube-transcript-api",
            "language": getattr(fetched, "language_code", ""),
            "isGenerated": bool(getattr(fetched, "is_generated", False)),
            "lineCount": len(lines),
            "text": text,
            "lines": lines,
        }
    except Exception as exc:
        message = first_error_line(str(exc))
        if "IpBlocked" in type(exc).__name__ or "blocking requests from your IP" in str(exc):
            YOUTUBE_TRANSCRIPT_BLOCKED = True
            message = "YouTube transcript requests are blocked by the current IP."
        return {
            "videoId": ref["videoId"],
            "url": ref["url"],
            "status": "failed",
            "source": "youtube-transcript-api",
            "message": message,
            "lines": [],
            "text": "",
        }


def fetch_transcript_with_ytdlp(ref: dict) -> dict:
    if YoutubeDL is None:
        return {
            "videoId": ref["videoId"],
            "url": ref["url"],
            "status": "unavailable",
            "source": "yt-dlp",
            "message": "yt-dlp is not installed.",
            "lines": [],
            "text": "",
        }

    try:
        with YoutubeDL(
            {
                "quiet": True,
                "no_warnings": True,
                "skip_download": True,
                "extract_flat": False,
                "noplaylist": True,
            }
        ) as ydl:
            info = ydl.extract_info(ref["url"], download=False)
        track = pick_ytdlp_caption_track(info)
        if not track:
            return {
                "videoId": ref["videoId"],
                "url": ref["url"],
                "status": "unavailable",
                "source": "yt-dlp",
                "message": "No YouTube subtitles or automatic captions were found.",
                "lines": [],
                "text": "",
            }

        raw_caption = download_caption_track(track["url"])
        lines = compact_transcript_lines(parse_caption_text(raw_caption, track.get("ext", "")))
        text = "\n".join(lines)[:YOUTUBE_TRANSCRIPT_TEXT_LIMIT].strip()
        return {
            "videoId": ref["videoId"],
            "url": ref["url"],
            "status": "ok" if text else "empty",
            "source": "yt-dlp",
            "language": track.get("language", ""),
            "isGenerated": bool(track.get("isGenerated")),
            "lineCount": len(lines),
            "text": text,
            "lines": lines,
        }
    except Exception as exc:
        return {
            "videoId": ref["videoId"],
            "url": ref["url"],
            "status": "failed",
            "source": "yt-dlp",
            "message": first_error_line(str(exc)),
            "lines": [],
            "text": "",
        }


def pick_ytdlp_caption_track(info: dict | None) -> dict | None:
    if not info:
        return None

    preferred_languages = ["ko", "ko-orig", "en", "en-orig"]
    groups = [
        (info.get("subtitles") or {}, False),
        (info.get("automatic_captions") or {}, True),
    ]
    for captions, is_generated in groups:
        for language in [*preferred_languages, *captions.keys()]:
            tracks = captions.get(language)
            if not tracks:
                continue
            track = pick_best_caption_format(tracks)
            if track and track.get("url"):
                return {**track, "language": language, "isGenerated": is_generated}
    return None


def pick_best_caption_format(tracks: list[dict]) -> dict | None:
    preferred_exts = ["json3", "srv3", "ttml", "vtt"]
    for ext in preferred_exts:
        for track in tracks:
            if track.get("ext") == ext and track.get("url"):
                return track
    for track in tracks:
        if track.get("url"):
            return track
    return None


def download_caption_track(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": MOBILE_UA})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_caption_text(value: str, ext: str) -> list[str]:
    if not value:
        return []
    if ext == "json3" or value.lstrip().startswith("{"):
        return parse_json3_caption(value)
    if ext in {"srv3", "ttml"} or value.lstrip().startswith("<"):
        return parse_xml_caption(value)
    return parse_vtt_caption(value)


def parse_json3_caption(value: str) -> list[str]:
    payload = json.loads(value)
    lines = []
    for event in payload.get("events", []):
        text = "".join(segment.get("utf8", "") for segment in event.get("segs", []))
        if text.strip():
            lines.append(text)
    return lines


def parse_xml_caption(value: str) -> list[str]:
    root = ET.fromstring(value)
    lines = []
    for element in root.iter():
        if element.text and element.text.strip():
            lines.append(html.unescape(element.text))
    return lines


def parse_vtt_caption(value: str) -> list[str]:
    lines = []
    for line in value.splitlines():
        stripped = line.strip()
        if (
            not stripped
            or stripped == "WEBVTT"
            or stripped.startswith(("Kind:", "Language:", "NOTE"))
            or "-->" in stripped
            or re.fullmatch(r"\d+", stripped)
        ):
            continue
        lines.append(re.sub(r"<[^>]+>", "", html.unescape(stripped)))
    return lines


def unique_youtube_video_refs(links: list[str]) -> list[dict]:
    refs = []
    seen = set()
    for link in links:
        video_id = extract_youtube_video_id(link)
        if not video_id or video_id in seen:
            continue
        seen.add(video_id)
        refs.append({"videoId": video_id, "url": link})
    return refs


def first_error_line(value: str) -> str:
    for line in value.splitlines():
        line = line.strip()
        if line:
            return line[:240]
    return ""


def extract_youtube_video_id(url: str) -> str:
    value = str(url or "")
    patterns = [
        r"youtu\.be/([A-Za-z0-9_-]{6,})",
        r"youtube\.com/(?:watch\?[^#]*v=|embed/|shorts/)([A-Za-z0-9_-]{6,})",
    ]
    for pattern in patterns:
        match = re.search(pattern, value)
        if match:
            return match.group(1).split("&")[0].split("?")[0]
    return ""


def compact_transcript_lines(snippets: list[str]) -> list[str]:
    lines = []
    current = ""
    seen = set()
    for snippet in snippets:
        value = re.sub(r"\s+", " ", str(snippet)).strip()
        if not value:
            continue
        if current and len(current) + len(value) > 180:
            add_transcript_line(lines, seen, current)
            current = value
        else:
            current = f"{current} {value}".strip()
    if current:
        add_transcript_line(lines, seen, current)
    return lines[:YOUTUBE_TRANSCRIPT_LINE_LIMIT]


def add_transcript_line(lines: list[str], seen: set[str], value: str) -> None:
    line = value.strip()
    if not line or line in seen:
        return
    seen.add(line)
    lines.append(line)


def normalize_deadline_date(value: str) -> str:
    today = datetime.now()
    if value == "오늘":
        return today.strftime("%Y-%m-%d")
    if value == "내일":
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")
    if value == "모레":
        return (today + timedelta(days=2)).strftime("%Y-%m-%d")
    match = re.search(r"(\d{1,2})-(\d{1,2})", value)
    if not match:
        return ""
    month = int(match.group(1))
    day = int(match.group(2))
    year = today.year
    if today.month >= 11 and month <= 2:
        year += 1
    return f"{year:04d}-{month:02d}-{day:02d}"


def first_text(nodes) -> str:
    for node in nodes:
        text = node.get_text(" ", strip=True)
        if text:
            return text
    return ""


def unique_texts(nodes) -> list[str]:
    values = []
    for node in nodes:
        text = node.get_text(" ", strip=True)
        if text and text not in values:
            values.append(text)
    return values


def first_number(values: list[str]) -> int | None:
    for value in values:
        if value.isdigit():
            return int(value)
    return None


def normalize_lines(lines) -> list[str]:
    out = []
    seen = set()
    for line in lines:
        value = re.sub(r"\s+", " ", str(line)).strip()
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
        if len(out) >= 32:
            break
    return out


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
