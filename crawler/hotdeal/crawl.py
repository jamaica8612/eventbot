from __future__ import annotations

import argparse
import json
import os
import sys
import time

from . import clien, fmkorea, ppomppu
from .common import fetch_html, session

DEFAULT_LIMIT = int(os.environ.get("HOTDEAL_LIMIT_PER_SOURCE", "30"))
SOURCE_DELAY_SECONDS = float(os.environ.get("HOTDEAL_SOURCE_DELAY_SECONDS", "1.5"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl community hotdeals.")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    parser.add_argument(
        "--sources",
        default=os.environ.get("HOTDEAL_SOURCES", "ppomppu,fmkorea,clien"),
        help="Comma-separated sources: ppomppu,fmkorea,clien",
    )
    args = parser.parse_args()

    selected = {source.strip() for source in args.sources.split(",") if source.strip()}
    all_deals = []
    stats = []

    with session("https://www.google.com") as s:
        if "ppomppu" in selected:
            for board in ppomppu.BOARDS:
                url = ppomppu.build_url(board["board_id"])
                deals, failures = crawl_one(s, "ppomppu", board["board_id"], url, lambda html: ppomppu.parse_list(html, board["board_id"], args.limit))
                all_deals.extend(deals)
                stats.append(build_stat("ppomppu", board["board_id"], len(deals), failures))
                time.sleep(SOURCE_DELAY_SECONDS)

        if "fmkorea" in selected:
            deals, failures = crawl_one(s, "fmkorea", "hotdeal", fmkorea.LIST_URL, lambda html: fmkorea.parse_list(html, args.limit))
            all_deals.extend(deals)
            stats.append(build_stat("fmkorea", "hotdeal", len(deals), failures))
            time.sleep(SOURCE_DELAY_SECONDS)

        if "clien" in selected:
            deals, failures = crawl_one(s, "clien", "jirum", clien.LIST_URL, lambda html: clien.parse_list(html, args.limit))
            all_deals.extend(deals)
            stats.append(build_stat("clien", "jirum", len(deals), failures))

    for stat in stats:
        print(
            f"hotdeal quality: {stat['source']}/{stat['board']} collected {stat['count']} parse_failures {stat['parseFailures']}",
            file=sys.stderr,
        )

    print(json.dumps({"deals": all_deals, "stats": stats}, ensure_ascii=False))


def crawl_one(s, source: str, board: str, url: str, parser):
    try:
        html = fetch_html(s, url)
        return parser(html)
    except Exception as exc:
        print(f"hotdeal crawl failed: {source}/{board}: {exc}", file=sys.stderr)
        return [], 1


def build_stat(source: str, board: str, count: int, failures: int) -> dict:
    total = count + failures
    return {
        "source": source,
        "board": board,
        "count": count,
        "parseFailures": failures,
        "parseFailureRate": failures / total if total else 0,
    }


if __name__ == "__main__":
    main()
