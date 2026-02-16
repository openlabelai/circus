"""LLM-powered persona enrichment using Claude API."""

import json
import os

from circus.persona.models import Persona


def enrich_persona(persona: Persona) -> Persona:
    """Use Claude to generate coherent character fields for a persona.

    Fills background_story, content_style, and rewrites bio to be coherent
    with the persona's demographics, niche, and tone.

    Falls back gracefully if no API key or API error — returns persona unchanged
    except bio stays as-is and story/style remain empty.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return persona

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)

        prompt = f"""Generate a character profile for a synthetic social media persona.

Demographics:
- Name: {persona.name}
- Age: {persona.age}
- Gender: {persona.gender}
- City: {persona.city}, {persona.state}, {persona.country}
- Niche: {persona.niche}
- Tone: {persona.tone}
- Interests: {', '.join(persona.interests)}

Return a JSON object with exactly these 3 fields:
- "bio": A short Instagram-style bio (1-2 sentences, under 150 characters). Should reflect the niche and tone naturally.
- "background_story": A 2-3 sentence backstory explaining who this person is and why they're into their niche. Be specific and human.
- "content_style": A brief description of how this persona posts on social media (format preferences, caption style, emoji usage, hashtag habits). 1-2 sentences.

Return ONLY the JSON object, no markdown or explanation."""

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )

        text = message.content[0].text.strip()
        # Handle potential markdown wrapping
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        data = json.loads(text)

        persona.bio = data.get("bio", persona.bio)
        persona.background_story = data.get("background_story", "")
        persona.content_style = data.get("content_style", "")

    except Exception:
        # Any failure (missing package, API error, JSON parse error) — keep going
        pass

    return persona
