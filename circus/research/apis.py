"""API enrichment for artist research: Last.fm, Spotify, Genius."""

from __future__ import annotations

import logging
import os
import re

import requests

logger = logging.getLogger(__name__)


# ---------- helpers ----------

def _get_key(env_var: str, provider: str = "") -> str:
    """Get API key from env var or ProviderAPIKey model."""
    key = os.environ.get(env_var, "")
    if not key and provider:
        try:
            from api.models import ProviderAPIKey
            obj = ProviderAPIKey.objects.filter(provider=provider).first()
            if obj:
                key = obj.api_key
        except Exception:
            pass
    return key


# ---------- Last.fm ----------

def fetch_lastfm_data(artist_name: str) -> dict:
    """Fetch artist info, similar artists, top tags, and top tracks from Last.fm."""
    api_key = _get_key("LASTFM_API_KEY", "lastfm")
    if not api_key:
        logger.warning("No Last.fm API key")
        return {}

    base = "https://ws.audioscrobbler.com/2.0/"
    params_base = {"api_key": api_key, "format": "json", "artist": artist_name}

    result = {}

    # artist.getInfo
    try:
        resp = requests.get(base, params={**params_base, "method": "artist.getInfo"}, timeout=10)
        resp.raise_for_status()
        info = resp.json().get("artist", {})
        result["bio"] = (info.get("bio", {}).get("summary", "") or "").split("<a href")[0].strip()
        result["listeners"] = info.get("stats", {}).get("listeners", "")
        result["playcount"] = info.get("stats", {}).get("playcount", "")
    except Exception as e:
        logger.warning(f"Last.fm getInfo failed: {e}")

    # artist.getSimilar
    try:
        resp = requests.get(base, params={**params_base, "method": "artist.getSimilar", "limit": 15}, timeout=10)
        resp.raise_for_status()
        similar = resp.json().get("similarartists", {}).get("artist", [])
        result["similar_artists"] = [
            {"name": a["name"], "match": float(a.get("match", 0))}
            for a in similar
        ]
    except Exception as e:
        logger.warning(f"Last.fm getSimilar failed: {e}")

    # artist.getTopTags
    try:
        resp = requests.get(base, params={**params_base, "method": "artist.getTopTags"}, timeout=10)
        resp.raise_for_status()
        tags = resp.json().get("toptags", {}).get("tag", [])
        result["tags"] = [t["name"] for t in tags[:20]]
    except Exception as e:
        logger.warning(f"Last.fm getTopTags failed: {e}")

    # artist.getTopTracks
    try:
        resp = requests.get(base, params={**params_base, "method": "artist.getTopTracks", "limit": 10}, timeout=10)
        resp.raise_for_status()
        tracks = resp.json().get("toptracks", {}).get("track", [])
        result["top_tracks"] = [
            {"name": t["name"], "playcount": t.get("playcount", "")}
            for t in tracks
        ]
    except Exception as e:
        logger.warning(f"Last.fm getTopTracks failed: {e}")

    return result


# ---------- Spotify ----------

def _spotify_access_token() -> str:
    """Get Spotify access token via client credentials flow."""
    client_id = _get_key("SPOTIFY_CLIENT_ID", "spotify_client_id")
    client_secret = _get_key("SPOTIFY_CLIENT_SECRET", "spotify_client_secret")

    # Also try the combined "spotify" provider key in format "client_id:client_secret"
    if not client_id or not client_secret:
        combined = _get_key("", "spotify")
        if combined and ":" in combined:
            client_id, client_secret = combined.split(":", 1)

    if not client_id or not client_secret:
        raise ValueError("No Spotify credentials found")

    resp = requests.post(
        "https://accounts.spotify.com/api/token",
        data={"grant_type": "client_credentials"},
        auth=(client_id, client_secret),
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def fetch_spotify_data(spotify_url: str) -> dict:
    """Fetch artist genres and albums from Spotify API."""
    if not spotify_url:
        return {}

    # Extract artist ID from URL or URI
    # Handles: open.spotify.com/artist/ID, spotify:artist:ID
    match = re.search(r"artist[/:]([a-zA-Z0-9]+)", spotify_url)
    if not match:
        logger.warning(f"Cannot extract artist ID from: {spotify_url}")
        return {}

    artist_id = match.group(1)

    try:
        token = _spotify_access_token()
    except Exception as e:
        logger.warning(f"Spotify auth failed: {e}")
        return {}

    headers = {"Authorization": f"Bearer {token}"}
    result = {}

    # Get artist info
    try:
        resp = requests.get(
            f"https://api.spotify.com/v1/artists/{artist_id}",
            headers=headers, timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        result["genres"] = data.get("genres", [])
        result["name"] = data.get("name", "")
        result["popularity"] = data.get("popularity", 0)
        result["followers"] = data.get("followers", {}).get("total", 0)
    except Exception as e:
        logger.warning(f"Spotify artist fetch failed: {e}")

    # Get albums
    try:
        resp = requests.get(
            f"https://api.spotify.com/v1/artists/{artist_id}/albums",
            headers=headers,
            params={"include_groups": "album,single", "limit": 20},
            timeout=10,
        )
        resp.raise_for_status()
        albums = resp.json().get("items", [])
        result["albums"] = [
            {
                "name": a["name"],
                "release_date": a.get("release_date", ""),
                "type": a.get("album_type", ""),
                "total_tracks": a.get("total_tracks", 0),
            }
            for a in albums
        ]
    except Exception as e:
        logger.warning(f"Spotify albums fetch failed: {e}")

    return result


# ---------- Genius ----------

def fetch_genius_data(artist_name: str) -> dict:
    """Fetch top songs and annotations from Genius."""
    api_key = _get_key("GENIUS_API_KEY", "genius")
    if not api_key:
        logger.warning("No Genius API key")
        return {}

    headers = {"Authorization": f"Bearer {api_key}"}
    result = {"top_songs": [], "annotations": []}

    # Search for songs
    try:
        resp = requests.get(
            "https://api.genius.com/search",
            params={"q": artist_name, "per_page": 10},
            headers=headers, timeout=10,
        )
        resp.raise_for_status()
        hits = resp.json().get("response", {}).get("hits", [])

        songs = []
        for hit in hits:
            song = hit.get("result", {})
            if artist_name.lower() in song.get("primary_artist", {}).get("name", "").lower():
                songs.append({
                    "id": song["id"],
                    "title": song["title"],
                    "url": song.get("url", ""),
                })

        result["top_songs"] = [{"title": s["title"], "url": s["url"]} for s in songs]

        # Get referents (annotations) for top 5 songs
        for song in songs[:5]:
            try:
                resp = requests.get(
                    "https://api.genius.com/referents",
                    params={"song_id": song["id"], "per_page": 5, "text_format": "plain"},
                    headers=headers, timeout=10,
                )
                resp.raise_for_status()
                referents = resp.json().get("response", {}).get("referents", [])
                for ref in referents:
                    for ann in ref.get("annotations", []):
                        body = ann.get("body", {}).get("plain", "")
                        if body:
                            result["annotations"].append({
                                "song": song["title"],
                                "text": body[:500],
                            })
            except Exception as e:
                logger.warning(f"Genius annotations failed for song {song['id']}: {e}")

    except Exception as e:
        logger.warning(f"Genius search failed: {e}")

    return result


# ---------- Orchestrator ----------

def fetch_all_api_data(profile) -> dict:
    """Fetch all available API data for an artist profile.

    Accepts a Django ArtistProfile model instance.
    Returns combined dict with keys: lastfm, spotify, genius.
    """
    result = {}

    # Last.fm
    try:
        lastfm = fetch_lastfm_data(profile.artist_name)
        if lastfm:
            result["lastfm"] = lastfm
    except Exception as e:
        logger.warning(f"Last.fm enrichment failed: {e}")

    # Spotify
    try:
        spotify = fetch_spotify_data(profile.spotify_url)
        if spotify:
            result["spotify"] = spotify
    except Exception as e:
        logger.warning(f"Spotify enrichment failed: {e}")

    # Genius
    try:
        genius = fetch_genius_data(profile.artist_name)
        if genius and (genius.get("top_songs") or genius.get("annotations")):
            result["genius"] = genius
    except Exception as e:
        logger.warning(f"Genius enrichment failed: {e}")

    return result
