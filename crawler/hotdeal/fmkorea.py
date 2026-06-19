from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from bs4 import BeautifulSoup

from .common import (
    clean_text,
    first_int,
    is_sold_or_expired,
    node_text,
    parse_post_id_from_path,
    parse_post_id_from_query,
    parse_price,
    parse_price_amount,
    parse_shop_from_title,
    to_absolute_url,
)

BASE_URL = "https://www.fmkorea.com"
LIST_URL = "https://m.fmkorea.com/index.php?mid=hotdeal&page=1"


def parse_list(html: str, limit: int) -> tuple[list[dict], int]:
    soup = BeautifulSoup(html, "lxml")
    deals = []
    failures = 0
    seen = set()

    for row in soup.select("li.li"):
        if len(deals) >= limit:
            break
        try:
            deal = parse_webzine_row(row)
            post_id = deal.get("sourcePostId")
            if not post_id or post_id in seen:
                continue
            seen.add(post_id)
            deals.append(deal)
        except Exception:
            failures += 1

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


def parse_webzine_row(row) -> dict:
    title_link = row.select_one("h3.title a.hotdeal_var8[href]")
    if not title_link:
        raise ValueError("missing title link")
    href = title_link.get("href", "")
    post_id = parse_post_id_from_path(href) or parse_post_id_from_query(href, "document_srl")
    if not post_id:
        raise ValueError("missing post id")

    product_title = node_text(title_link.select_one(".ellipsis-target")) or clean_text(title_link.get_text(" ", strip=True))
    shop = node_text(row.select_one(".hotdeal_info span:nth-of-type(1) a.strong"))
    price_text = node_text(row.select_one(".hotdeal_info span:nth-of-type(2) a.strong"))
    delivery = node_text(row.select_one(".hotdeal_info span:nth-of-type(3) a.strong"))
    price_amount = parse_price_amount(price_text) if price_text else None
    if price_amount is None:
        fallback_price_text, price_amount = parse_price(product_title)
        price_text = price_text or fallback_price_text

    title_parts = []
    if shop:
        title_parts.append(f"[{shop}]")
    title_parts.append(product_title)
    if price_text:
        title_parts.append(f"({price_text})")
    if delivery:
        title_parts.append(f"({delivery})")
    title = clean_text(" ".join(title_parts))

    comment_count = first_int(node_text(title_link.select_one(".comment_count")))
    recommend_count = first_int(node_text(row.select_one(".pc_voted_count .count")))
    category = node_text(row.select_one(".category a"))
    thumb = row.select_one("img.thumb")
    thumbnail = ""
    if thumb:
        thumbnail = to_absolute_url(BASE_URL, thumb.get("data-original") or thumb.get("src") or "")
        if "transparent.gif" in thumbnail:
            thumbnail = ""

    text = clean_text(row.get_text(" ", strip=True))
    sold_out, expired = is_sold_or_expired(text)

    return {
        "source": "fmkorea",
        "sourceBoard": "hotdeal",
        "sourcePostId": post_id,
        "title": title,
        "priceText": price_text,
        "priceAmount": price_amount,
        "currency": "KRW",
        "shop": shop or parse_shop_from_title(title),
        "category": category,
        "recommendCount": recommend_count,
        "commentCount": comment_count,
        "url": to_absolute_url(BASE_URL, href),
        "dealUrl": "",
        "thumbnail": thumbnail,
        "postedAt": parse_fmkorea_regdate(node_text(row.select_one(".regdate"))),
        "isSoldOut": sold_out,
        "isExpired": expired,
    }


def parse_fmkorea_regdate(value: str) -> str:
    text = clean_text(value)
    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)
    match = re.search(r"\b(\d{1,2}):(\d{2})\b", text)
    if match:
        parsed = now.replace(hour=int(match.group(1)), minute=int(match.group(2)), second=0, microsecond=0)
        if parsed > now + timedelta(hours=1):
            parsed -= timedelta(days=1)
        return parsed.isoformat()
    for fmt in ("%Y.%m.%d", "%Y-%m-%d", "%y.%m.%d"):
        try:
            parsed = datetime.strptime(text, fmt).replace(tzinfo=kst)
            return parsed.isoformat()
        except ValueError:
            pass
    return ""
