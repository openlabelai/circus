"""YouTube API comment fetcher for artist research grounding."""

from __future__ import annotations

import logging
import os
import re

import requests

logger = logging.getLogger(__name__)


def _get_api_key() -> str:
    """Get YouTube API key from ProviderAPIKey model or env var."""
    key = os.environ.get("YOUTUBE_API_KEY", "")
    if not key:
        try:
            from api.models import ProviderAPIKey
            obj = ProviderAPIKey.objects.filter(provider="youtube").first()
            if obj:
                key = obj.api_key
        except Exception:
            pass
    if not key:
        raise ValueError("No YouTube API key found. Set YOUTUBE_API_KEY env var or add 'youtube' provider key.")
    return key


def fetch_channel_thumbnail(channel_id: str) -> str:
    """Fetch the channel profile thumbnail URL from the YouTube API."""
    api_key = _get_api_key()
    resp = requests.get(
        "https://www.googleapis.com/youtube/v3/channels",
        params={"id": channel_id, "part": "snippet", "key": api_key},
        timeout=10,
    )
    resp.raise_for_status()
    items = resp.json().get("items", [])
    if not items:
        return ""
    thumbnails = items[0].get("snippet", {}).get("thumbnails", {})
    for size in ("high", "medium", "default"):
        if size in thumbnails:
            return thumbnails[size].get("url", "")
    return ""


def find_channel_id(artist_name: str, youtube_url: str = "") -> str:
    """Find YouTube channel ID from URL or search.

    Supports URLs like:
    - youtube.com/@handle
    - youtube.com/channel/UC...
    - youtube.com/c/CustomName
    """
    api_key = _get_api_key()

    # Try to extract from URL first
    if youtube_url:
        # Handle /channel/UC... URLs — validate length (real IDs are 24 chars)
        channel_match = re.search(r"youtube\.com/channel/(UC[^/?]+)", youtube_url)
        if channel_match:
            cid = channel_match.group(1)
            if len(cid) == 24:
                return cid
            logger.warning(f"Ignoring truncated channel ID from URL: {cid}")

        # Handle @handle URLs
        handle_match = re.search(r"youtube\.com/@([^/?]+)", youtube_url)
        if handle_match:
            handle = handle_match.group(1).lower()
            # Try exact handle first
            resp = requests.get(
                "https://www.googleapis.com/youtube/v3/channels",
                params={"forHandle": handle, "part": "id", "key": api_key},
                timeout=10,
            )
            resp.raise_for_status()
            items = resp.json().get("items", [])
            if items:
                return items[0]["id"]

            # Handle not found — search and verify customUrl matches
            resp = requests.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={
                    "q": handle,
                    "type": "channel",
                    "part": "snippet",
                    "maxResults": 10,
                    "key": api_key,
                },
                timeout=10,
            )
            resp.raise_for_status()
            candidates = resp.json().get("items", [])
            # Filter out Topic channels
            candidates = [c for c in candidates if "- Topic" not in c["snippet"]["title"]]
            if candidates:
                # Fetch channel details to verify customUrl matches the handle
                candidate_ids = ",".join(c["id"]["channelId"] for c in candidates[:5])
                resp = requests.get(
                    "https://www.googleapis.com/youtube/v3/channels",
                    params={"id": candidate_ids, "part": "snippet", "key": api_key},
                    timeout=10,
                )
                resp.raise_for_status()
                for ch in resp.json().get("items", []):
                    custom_url = (ch.get("snippet", {}).get("customUrl") or "").lower().lstrip("@")
                    # Match if handle starts with customUrl or vice versa
                    # (catches typos like "nadiramusica" vs "nadiramusic")
                    if custom_url and (
                        handle.startswith(custom_url) or custom_url.startswith(handle)
                    ):
                        logger.info(f"Matched handle '{handle}' to channel @{custom_url} ({ch['id']})")
                        return ch["id"]
                # No customUrl match — use first non-Topic result
                logger.warning(f"No exact handle match for '{handle}', using best search result")
                return candidates[0]["id"]["channelId"]

    # Fall back to search — fetch multiple results and skip auto-generated "Topic" channels
    resp = requests.get(
        "https://www.googleapis.com/youtube/v3/search",
        params={
            "q": artist_name,
            "type": "channel",
            "part": "snippet",
            "maxResults": 5,
            "key": api_key,
        },
        timeout=10,
    )
    resp.raise_for_status()
    items = resp.json().get("items", [])
    # Prefer non-Topic channels
    for item in items:
        title = item["snippet"]["title"]
        if "- Topic" not in title:
            return item["id"]["channelId"]
    # All results are Topic channels — use first one
    if items:
        return items[0]["id"]["channelId"]
    raise ValueError(f"No YouTube channel found for '{artist_name}'")


def get_recent_video_ids(channel_id: str, limit: int = 10) -> list[dict]:
    """Get recent video IDs from a channel's uploads playlist."""
    api_key = _get_api_key()

    # Uploads playlist ID is the channel ID with "UU" prefix instead of "UC"
    uploads_playlist = "UU" + channel_id[2:]

    videos = []
    page_token = None

    while len(videos) < limit:
        params = {
            "playlistId": uploads_playlist,
            "part": "snippet",
            "maxResults": min(limit - len(videos), 50),
            "key": api_key,
        }
        if page_token:
            params["pageToken"] = page_token

        resp = requests.get(
            "https://www.googleapis.com/youtube/v3/playlistItems",
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        for item in data.get("items", []):
            videos.append({
                "video_id": item["snippet"]["resourceId"]["videoId"],
                "title": item["snippet"]["title"],
                "published_at": item["snippet"]["publishedAt"],
            })

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    return videos[:limit]


def fetch_video_comments(video_id: str, video_title: str = "", max_comments: int = 500) -> list[dict]:
    """Fetch top-level comments from a YouTube video."""
    api_key = _get_api_key()
    comments = []
    page_token = None

    while len(comments) < max_comments:
        params = {
            "videoId": video_id,
            "part": "snippet",
            "maxResults": min(max_comments - len(comments), 100),
            "order": "relevance",
            "textFormat": "plainText",
            "key": api_key,
        }
        if page_token:
            params["pageToken"] = page_token

        try:
            resp = requests.get(
                "https://www.googleapis.com/youtube/v3/commentThreads",
                params=params,
                timeout=15,
            )
            resp.raise_for_status()
        except requests.HTTPError as e:
            # Comments may be disabled on some videos
            if resp.status_code == 403:
                logger.warning(f"Comments disabled for video {video_id}")
                break
            raise

        data = resp.json()

        for item in data.get("items", []):
            snippet = item["snippet"]["topLevelComment"]["snippet"]
            comments.append({
                "text": snippet["textDisplay"],
                "likes": snippet.get("likeCount", 0),
                "published_at": snippet["publishedAt"],
                "source": "youtube",
                "video_title": video_title,
            })

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    return comments[:max_comments]


def fetch_artist_comments(
    artist_name: str,
    youtube_url: str = "",
    num_videos: int = 10,
    comments_per_video: int = 500,
) -> dict:
    """Orchestrator: find channel, get videos, fetch comments from each.

    Returns: {"comments": [...], "videos_scraped": N, "total_comments": N, "channel_id": str}
    """
    channel_id = find_channel_id(artist_name, youtube_url)
    videos = get_recent_video_ids(channel_id, limit=num_videos)

    all_comments = []
    videos_scraped = 0

    for video in videos:
        try:
            comments = fetch_video_comments(
                video["video_id"],
                video_title=video["title"],
                max_comments=comments_per_video,
            )
            all_comments.extend(comments)
            videos_scraped += 1
            logger.info(
                f"Fetched {len(comments)} comments from '{video['title']}'"
            )
        except Exception as e:
            logger.warning(f"Failed to fetch comments for video {video['video_id']}: {e}")

    return {
        "comments": all_comments,
        "videos_scraped": videos_scraped,
        "total_comments": len(all_comments),
        "channel_id": channel_id,
        "videos": videos,
    }
