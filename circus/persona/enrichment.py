"""LLM-powered persona enrichment."""

import json

from circus.persona.models import Persona


def enrich_persona(persona: Persona, target_artist: str = "") -> Persona:
    """Use an LLM to generate coherent character fields for a persona.

    Fills background_story, content_style, and rewrites bio to be coherent
    with the persona's demographics, niche, and tone.

    Falls back gracefully if no config or API error — returns persona unchanged.
    """
    from circus.llm.providers import call_llm

    music_context = ""
    music_fields = ""
    artist_targeting = ""

    if target_artist:
        artist_targeting = f"""
- Target Artist: {target_artist}
Generate this persona as a believable fan of {target_artist}.
favorite_artists MUST include {target_artist} plus 4-7 similar artists in the same scene/genre.
Comment vocabulary should match what real fans of this artist use — inside jokes, song references, slang from that fanbase."""

    if persona.genre or target_artist:
        music_context = f"""
- Genre: {persona.genre or 'inferred from artist'}
- Archetype: {persona.archetype or 'general fan'}
- Artist Knowledge Depth: {persona.artist_knowledge_depth or 'surface'}{artist_targeting}"""
        music_fields = """
- "favorite_artists": A list of 5-8 real artist names this fan would follow, matching their genre. Mix mainstream and underground.
- "comment_style": An object with "avg_length" (short/medium/long), "emoji_freq" (none/low/medium/high), and "vocabulary" (list of 15-20 slang words/phrases this fan would use in comments — include stan language, genre slang, and reaction phrases).
- "typical_comments": A list of 5 example comments this fan would actually leave on the target artist's posts. Make them sound like real Instagram/TikTok comments — varied length, some with emoji, some short hype, some longer appreciation.
- "engagement_pattern": An object with "saves" (0.0-1.0 weight), "shares" (0.0-1.0 weight), "comments" (0.0-1.0 weight), "time_bias" (one of: "morning", "afternoon", "evening", "night", "late_night").
- "content_behavior": An object with "posts_music" (boolean), "uses_sounds" (boolean), "reaction_style" (one of: "emoji_only", "short_text", "long_text", "mixed").
- "bio_template": A short bio format pattern this fan would use (e.g. "artist1 + artist2 | genre | city").
- "music_discovery_style": How they find music (one of: "algorithmic", "soundcloud_digger", "blog_reader", "dj_friend", "playlist_curator", "radio_listener").
- "profile_aesthetic": Visual style (one of: "dark_minimal", "colorful", "aesthetic", "no_theme")."""

    bio_instructions = """- "bio": A short social media bio (under 150 characters). Use fragmented social media style — lowercase, emoji, abbreviations, pipe separators. NOT complete sentences. Examples of the style: "nyc | music + coffee ☕", "just vibing 🌙", "la | hip-hop head | 22", "beats n dreams 🎵✨". Make it match the persona's niche, city, and vibe."""

    prompt = f"""Generate a character profile for a synthetic social media persona.

Demographics:
- Name: {persona.name}
- Age: {persona.age}
- Gender: {persona.gender}
- City: {persona.city}, {persona.state}, {persona.country}
- Niche: {persona.niche}
- Tone: {persona.tone}
- Interests: {', '.join(persona.interests)}{music_context}

Return a JSON object with these fields:
{bio_instructions}
- "background_story": A 2-3 sentence backstory explaining who this person is and why they're into their niche. Be specific and human.
- "content_style": A brief description of how this persona posts on social media (format preferences, caption style, emoji usage, hashtag habits). 1-2 sentences.{music_fields}

Return ONLY the JSON object, no markdown or explanation."""

    is_music = bool(persona.genre or target_artist)
    max_tokens = 800 if is_music else 300

    try:
        text = call_llm("persona_enrichment", prompt, max_tokens=max_tokens)
        if text is None:
            return persona

        # Handle potential markdown wrapping
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        data = json.loads(text)

        persona.bio = data.get("bio", persona.bio)
        persona.background_story = data.get("background_story", "")
        persona.content_style = data.get("content_style", "")

        # Music-specific fields
        if is_music:
            persona.favorite_artists = data.get("favorite_artists", [])
            persona.comment_style = data.get("comment_style", {})
            # Merge typical_comments into comment_style
            if "typical_comments" in data:
                persona.comment_style["typical_comments"] = data["typical_comments"]
            persona.engagement_pattern = data.get("engagement_pattern", {})
            persona.content_behavior = data.get("content_behavior", {})
            persona.bio_template = data.get("bio_template", "")
            persona.music_discovery_style = data.get("music_discovery_style", "")
            persona.profile_aesthetic = data.get("profile_aesthetic", "")
    except Exception:
        pass

    return persona
