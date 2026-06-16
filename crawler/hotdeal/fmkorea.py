from __future__ import annotations

import re

from bs4 import BeautifulSoup

from .common import (
    clean_text,
    first_int,
    is_sold_or_expired,
    node_text,
    parse_post_id_from_query,
    parse_price,
    parse_shop_from_title,
    to_absolute_url,
)

BASE_URL = "https://www.fmkorea.com"
LIST_URL = f"{BASE_URL}/hotdeal"


def parse_list(html: str, limit: int) -> tuple[list[dict], int]:
    soup = BeautifulSoup(html, "lxml")
    deals = []
    failures = 0
    seen = set()

    for row in soup.select("tr"):
        if len(deals) >= limit:
            break
        try:
            classes = set(row.get("class") or [])
            if "notice_pop0" in classes or "show_folded_notice" in classes:
                continue
            title_link = row.select_one("td.title a[href*='document_srl']:not(.replyNum)")
            if not title_link:
                continue
            href = title_link.get("href", "")
            post_id = parse_post_id_from_query(href, "document_srl")
            if not post_id or post_id in seen:
                continue
            seen.add(post_id)

            title = clean_text(title_link.get_text(" ", strip=True))
            if not title or "공지" in node_text(row.select_one("td.no")):
                continue
            price_text, price_amount = parse_price(title)
            text = clean_text(row.get_text(" ", strip=True))
            sold_out, expired = is_sold_or_expired(text)
            reply = row.select_one("a.replyNum")
            comment_count = first_int(node_text(reply))
            category = node_text(row.select_one("td.author"))
            recommend_count = first_int(node_text(row.select_one("td.m_no")))

            deals.append(
                {
                    "source": "fmkorea",
                    "sourceBoard": "hotdeal",
                    "sourcePostId": post_id,
                    "title": title,
                    "priceText": price_text,
                    "priceAmount": price_amount,
                    "currency": "KRW",
                    "shop": parse_shop_from_title(title),
                    "category": category,
                    "recommendCount": recommend_count,
                    "commentCount": comment_count,
                    "url": to_absolute_url(BASE_URL, href),
                    "dealUrl": "",
                    "thumbnail": "",
                    "postedAt": "",
                    "isSoldOut": sold_out,
                    "isExpired": expired,
                }
            )
        except Exception:
            failures += 1

    return deals, failures
