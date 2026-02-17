"""LLM-powered artist research for detailed fan profile generation."""

from __future__ import annotations

import json
from typing import Optional


def research_artist(
    artist_name: str,
    genre: str = "",
    platform: str = "",
    social_handles: Optional[dict] = None,
) -> dict:
    """Research an artist and generate a detailed fanbase profile.

    Returns dict with keys: profile_data, raw_text, success, error.
    """
    from circus.llm.providers import call_llm

    handles_lines = []
    if social_handles:
        for plat, handle in social_handles.items():
            if handle:
                handles_lines.append("  - %s: %s" % (plat, handle))

    parts = [
        "You are a music industry analyst specializing in fan communities and social media culture. Research the following artist and their fanbase in detail.",
        "",
        "Artist: %s" % artist_name,
    ]
    if genre:
        parts.append("Genre: %s" % genre)
    if platform:
        parts.append("Primary Platform: %s" % platform)
    if handles_lines:
        parts.append("Social Handles:")
        parts.extend(handles_lines)

    parts.append("")
    parts.append("""Generate a comprehensive JSON profile of this artist's fanbase. Be specific and authentic — use real slang, real references, real similar artists. Do NOT be generic.

Return a JSON object with exactly these fields:
- "fanbase_characteristics": A paragraph describing the overall personality, vibe, and culture of this artist's fanbase.
- "fan_demographics": An object with "age_range" (string like "18-35"), "gender_split" (string like "60% male, 35% female, 5% non-binary"), "top_locations" (list of 5 cities/regions).
- "fan_vocabulary": A list of 20-30 words and phrases fans commonly use in comments and posts. Include genre slang, reaction words, and community-specific terms.
- "fan_slang": A list of 10-15 terms specific to THIS artist's fanbase — nicknames for the artist, album references, inside terms.
- "common_comment_patterns": A list of 10 realistic example comments fans would leave on this artist's posts. Vary length, emoji usage, and style. Make them sound like real social media comments.
- "similar_artists": A list of 8-12 artists with overlapping fanbases. Mix mainstream and underground. Order by relevance.
- "artist_style_aesthetic": A paragraph describing the artist's visual and musical aesthetic, fashion influence, and brand identity.
- "recent_releases": A list of 3-5 notable recent works (albums, singles, features).
- "key_hashtags": A list of 10-15 hashtags fans use on posts about this artist.
- "fanbase_culture": A paragraph about the fan community — traditions, online spaces, rivalries, collective behaviors, fan accounts.
- "inside_jokes_references": A list of 8-10 inside jokes, memes, viral moments, or cultural references that fans would understand.
- "engagement_patterns": An object with "peak_activity" (when fans are most active), "typical_behavior" (how fans engage), "comment_length" (short/medium/long tendency).

Return ONLY the JSON object. No markdown, no explanation, no code fences.""")

    prompt = "\n".join(parts)

    try:
        text = call_llm("artist_research", prompt, max_tokens=2000)
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
            "error": f"Failed to parse LLM response as JSON: {e}",
        }
    except Exception as e:
        return {
            "profile_data": {},
            "raw_text": "",
            "success": False,
            "error": str(e),
        }
