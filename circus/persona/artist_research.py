"""LLM-powered artist research for detailed fan profile generation."""

from __future__ import annotations

import json
from typing import Optional


def _build_comments_block(scraped_comments: list[dict]) -> str:
    """Build a grounding block from real scraped comments."""
    # Deduplicate by text, sort by likes desc, limit to 150
    seen = set()
    unique = []
    for c in scraped_comments:
        text = c.get("text", "").strip()
        if text and text not in seen:
            seen.add(text)
            unique.append(c)

    unique.sort(key=lambda c: c.get("likes", 0), reverse=True)
    unique = unique[:150]

    if not unique:
        return ""

    yt_count = sum(1 for c in unique if c.get("source") == "youtube")
    ig_count = sum(1 for c in unique if c.get("source") == "instagram")
    source_desc = []
    if yt_count:
        source_desc.append(f"{yt_count} from YouTube")
    if ig_count:
        source_desc.append(f"{ig_count} from Instagram")

    lines = [
        f"\nREAL FAN COMMENTS scraped from this artist's posts ({len(unique)} comments, {', '.join(source_desc)}):"
    ]
    for c in unique[:100]:  # Show top 100 in prompt
        lines.append(f'- "{c["text"][:200]}"')

    lines.append(
        "\nIMPORTANT: Use these real comments to extract actual vocabulary, emoji patterns, "
        "slang, and sentiment. The fan_vocabulary, fan_slang, and common_comment_patterns "
        "fields MUST reflect patterns from the above data, not invented examples."
    )
    return "\n".join(lines)


def _build_api_data_block(api_data: dict) -> str:
    """Build a grounding block from API enrichment data."""
    if not api_data:
        return ""

    lines = ["\nVERIFIED ARTIST DATA:"]

    lastfm = api_data.get("lastfm", {})
    if lastfm.get("similar_artists"):
        similar = ", ".join(
            f"{a['name']} ({int(float(a.get('match', 0)) * 100)}% match)"
            for a in lastfm["similar_artists"][:10]
        )
        lines.append(f"- Similar artists (Last.fm): {similar}")
    if lastfm.get("tags"):
        lines.append(f"- Genre tags (Last.fm): {', '.join(lastfm['tags'][:15])}")
    if lastfm.get("top_tracks"):
        tracks = ", ".join(t["name"] for t in lastfm["top_tracks"][:10])
        lines.append(f"- Top tracks (Last.fm): {tracks}")

    spotify = api_data.get("spotify", {})
    if spotify.get("genres"):
        lines.append(f"- Spotify genres: {', '.join(spotify['genres'])}")
    if spotify.get("albums"):
        albums = ", ".join(
            f"{a['name']} ({a.get('release_date', '')[:4]})"
            for a in spotify["albums"][:10]
        )
        lines.append(f"- Recent albums/singles: {albums}")

    genius = api_data.get("genius", {})
    if genius.get("top_songs"):
        songs = ", ".join(s["title"] for s in genius["top_songs"][:10])
        lines.append(f"- Top songs (Genius): {songs}")
    if genius.get("annotations"):
        lines.append(f"- Genius annotations available: {len(genius['annotations'])} excerpts")

    if len(lines) <= 1:
        return ""

    lines.append(
        "\nUse this verified data for the similar_artists and recent_releases fields. "
        "Do NOT invent releases or similar artists — use only what's listed above."
    )
    return "\n".join(lines)


def research_artist(
    artist_name: str,
    spotify_url: str = "",
    country: str = "",
    city: str = "",
    genre: str = "",
    instagram_handle: str = "",
    youtube_url: str = "",
    tiktok_handle: str = "",
    twitter_handle: str = "",
    description: str = "",
    scraped_comments: list | None = None,
    api_data: dict | None = None,
) -> dict:
    """Research an artist and generate a detailed fanbase profile.

    Uses all identity fields to anchor the LLM to the correct artist.
    When scraped_comments and/or api_data are provided, they are injected
    into the prompt as grounding data for more authentic results.

    Returns dict with keys: profile_data, raw_text, success, error.
    """
    from circus.llm.providers import call_llm

    # Build identity block — everything we know about this specific artist
    identity_lines = ["- Stage Name: %s" % artist_name]

    if spotify_url:
        identity_lines.append("- Spotify: %s" % spotify_url)
    if country and city:
        identity_lines.append("- Based in: %s, %s" % (city, country))
    elif country:
        identity_lines.append("- Based in: %s" % country)
    if genre:
        identity_lines.append("- Genre: %s" % genre)
    if instagram_handle:
        identity_lines.append("- Instagram: %s" % instagram_handle)
    if youtube_url:
        identity_lines.append("- YouTube: %s" % youtube_url)
    if tiktok_handle:
        identity_lines.append("- TikTok: %s" % tiktok_handle)
    if twitter_handle:
        identity_lines.append("- Twitter/X: %s" % twitter_handle)
    if description:
        identity_lines.append("- Description: %s" % description)

    identity_block = "\n".join(identity_lines)

    location_str = ""
    if city and country:
        location_str = "%s, %s" % (city, country)
    elif country:
        location_str = country

    # Build grounding sections from real data
    comments_block = _build_comments_block(scraped_comments) if scraped_comments else ""
    api_block = _build_api_data_block(api_data) if api_data else ""
    has_real_data = bool(comments_block or api_block)

    prompt = (
        "You are a music industry analyst specializing in fan communities and social media culture.\n"
        "Research the following SPECIFIC artist. Use ONLY information about THIS EXACT artist.\n"
        "\n"
        "ARTIST IDENTITY (use ALL of these to identify the correct person):\n"
        "%s\n"
        "\n"
        "CRITICAL: Do NOT confuse this artist with any other artist who shares the same or a similar name.\n"
        "The Spotify URL above uniquely identifies this artist. Only include releases, collaborations,\n"
        "similar artists, and cultural facts that belong to THIS specific person.\n"
        "If you are unsure whether a fact belongs to this artist, DO NOT include it.\n"
    ) % identity_block

    # Inject grounding data
    if comments_block:
        prompt += comments_block + "\n"
    if api_block:
        prompt += api_block + "\n"

    prompt += (
        "\n"
        "Generate a comprehensive JSON profile of this artist's fanbase. Be specific and authentic.\n"
        "\n"
        "Return a JSON object with exactly these fields:\n"
        '- "fanbase_characteristics": A paragraph describing the overall personality, vibe, and culture of this artist\'s fanbase.\n'
        '- "fan_demographics": An object with "age_range" (string like "18-35"), "gender_split" (string like "60%% male, 35%% female, 5%% non-binary"), "top_locations" (list of 5 cities/regions where fans are concentrated).\n'
        '- "fan_vocabulary": A list of 20-30 words and phrases fans commonly use in comments and posts. Include genre slang, reaction words, and community-specific terms.\n'
        '- "fan_slang": A list of 10-15 terms specific to THIS artist\'s fanbase — nicknames for the artist, album references, inside terms.\n'
        '- "common_comment_patterns": A list of 10 realistic example comments fans would leave on this artist\'s posts. Vary length, emoji usage, and style. Make them sound like real social media comments.\n'
        '- "similar_artists": A list of 8-12 artists with overlapping fanbases, specifically artists in the %s scene from %s and internationally. Mix mainstream and underground. Order by relevance.\n'
        '- "artist_style_aesthetic": A paragraph describing the artist\'s visual and musical aesthetic, fashion influence, and brand identity.\n'
        '- "recent_releases": A list of 3-5 notable recent works (albums, singles, features) by THIS SPECIFIC artist only.\n'
        '- "key_hashtags": A list of 10-15 hashtags fans use on posts about this artist.\n'
        '- "fanbase_culture": A paragraph about the fan community — traditions, online spaces, rivalries, collective behaviors, fan accounts.\n'
        '- "inside_jokes_references": A list of 8-10 inside jokes, memes, viral moments, or cultural references that fans of THIS artist would understand.\n'
        '- "engagement_patterns": An object with "peak_activity" (when fans are most active), "typical_behavior" (how fans engage), "comment_length" (short/medium/long tendency).\n'
        "\n"
        "Return ONLY the JSON object. No markdown, no explanation, no code fences."
    ) % (genre or "music", location_str or "their region")

    # Use more tokens when real data is present (more to analyze = longer output)
    max_tokens = 3000 if has_real_data else 2000

    try:
        text = call_llm("artist_research", prompt, max_tokens=max_tokens)
        if text is None:
            return {
                "profile_data": {},
                "raw_text": "",
                "success": False,
                "error": "No LLM config for artist_research purpose, or no API key set.",
            }

        raw_text = text

        # Handle potential markdown wrapping
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        profile_data = json.loads(text)

        return {
            "profile_data": profile_data,
            "raw_text": raw_text,
            "success": True,
            "error": None,
        }
    except json.JSONDecodeError as e:
        return {
            "profile_data": {},
            "raw_text": text if "text" in dir() else "",
            "success": False,
            "error": "Failed to parse LLM response as JSON: %s" % e,
        }
    except Exception as e:
        return {
            "profile_data": {},
            "raw_text": "",
            "success": False,
            "error": str(e),
        }
