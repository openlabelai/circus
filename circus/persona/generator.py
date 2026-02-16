from __future__ import annotations

import random

from faker import Faker

from circus.persona.models import BehavioralProfile, Persona, ServiceCredentials

_SERVICES = ["instagram", "tiktok", "spotify", "twitter", "youtube"]

_INTERESTS_POOL = [
    "photography", "cooking", "travel", "fitness", "gaming", "music",
    "fashion", "tech", "art", "reading", "hiking", "yoga", "dance",
    "skateboarding", "surfing", "cycling", "meditation", "film",
]

_NICHE_POOL = [
    "fitness", "cooking", "travel", "tech", "beauty", "fashion",
    "parenting", "finance", "gaming", "music", "art", "wellness",
    "photography", "food", "pets", "sports", "education", "comedy",
]

_TONE_POOL = [
    "casual", "professional", "enthusiastic", "sarcastic", "warm",
    "Gen-Z", "motivational", "educational", "humorous", "chill",
]

# Map niches to related interests for coherent personas
_NICHE_INTERESTS = {
    "fitness": ["fitness", "hiking", "yoga", "cycling"],
    "cooking": ["cooking", "travel", "reading"],
    "travel": ["travel", "photography", "hiking", "surfing"],
    "tech": ["tech", "gaming", "reading"],
    "beauty": ["fashion", "art", "dance"],
    "fashion": ["fashion", "photography", "art"],
    "parenting": ["cooking", "reading", "yoga"],
    "finance": ["tech", "reading"],
    "gaming": ["gaming", "tech", "film"],
    "music": ["music", "dance", "film"],
    "art": ["art", "photography", "film"],
    "wellness": ["yoga", "meditation", "fitness", "hiking"],
    "photography": ["photography", "travel", "art"],
    "food": ["cooking", "travel", "photography"],
    "pets": ["hiking", "photography"],
    "sports": ["fitness", "cycling", "surfing", "skateboarding"],
    "education": ["reading", "tech"],
    "comedy": ["film", "music", "dance"],
}

_ENGAGEMENT_STYLES = ["passive", "active", "moderate"]
_POSTING_FREQUENCIES = ["hourly", "daily", "weekly", "rarely"]
_SCROLL_SPEEDS = ["slow", "medium", "fast"]


_GENRE_POOL = [
    "hip-hop", "indie-rock", "edm", "r&b", "latin", "k-pop", "pop", "country",
]

_ARCHETYPE_POOL = ["day_one_stan", "casual_viber", "content_creator_fan", "genre_head"]

_GENRE_NICHES = {
    "hip-hop": "music", "indie-rock": "music", "edm": "music",
    "r&b": "music", "latin": "music", "k-pop": "music",
    "pop": "music", "country": "music",
}

_ARCHETYPE_DEFAULTS = {
    "day_one_stan": {
        "engagement_style": "active",
        "posting_frequency": "daily",
        "artist_knowledge_depth": "deep",
    },
    "casual_viber": {
        "engagement_style": "passive",
        "posting_frequency": "weekly",
        "artist_knowledge_depth": "surface",
    },
    "content_creator_fan": {
        "engagement_style": "active",
        "posting_frequency": "daily",
        "artist_knowledge_depth": "deep",
    },
    "genre_head": {
        "engagement_style": "moderate",
        "posting_frequency": "daily",
        "artist_knowledge_depth": "deep",
    },
}


def generate_persona(
    fake: Faker | None = None,
    services: list[str] | None = None,
    niche: str | None = None,
    tone: str | None = None,
    age_min: int | None = None,
    age_max: int | None = None,
    genre: str | None = None,
    archetype: str | None = None,
) -> Persona:
    """Generate a single synthetic persona."""
    if fake is None:
        fake = Faker()
    if services is None:
        services = random.sample(_SERVICES, k=random.randint(1, 3))

    chosen_genre = genre or ""
    chosen_archetype = archetype or ""

    # If genre is set, default niche to "music"
    if chosen_genre and not niche:
        chosen_niche = "music"
    else:
        chosen_niche = niche or random.choice(_NICHE_POOL)
    chosen_tone = tone or random.choice(_TONE_POOL)

    # Apply archetype behavioral defaults
    arch_defaults = _ARCHETYPE_DEFAULTS.get(chosen_archetype, {})

    gender = random.choice(["male", "female", "non-binary"])
    if gender == "male":
        first = fake.first_name_male()
    elif gender == "female":
        first = fake.first_name_female()
    else:
        first = fake.first_name()
    last = fake.last_name()
    name = f"{first} {last}"
    base_username = f"{first.lower()}{last.lower()}{random.randint(1, 999)}"

    credentials: dict[str, ServiceCredentials] = {}
    for svc in services:
        suffix = random.choice(["", str(random.randint(1, 99)), fake.lexify("???")])
        credentials[svc] = ServiceCredentials(
            username=f"{base_username}{suffix}",
            password=fake.password(length=14),
            email=fake.email(),
        )

    # Pick interests aligned with niche + some random
    niche_related = _NICHE_INTERESTS.get(chosen_niche, [])
    related_picks = random.sample(niche_related, k=min(random.randint(2, 3), len(niche_related)))
    remaining = [i for i in _INTERESTS_POOL if i not in related_picks]
    random_picks = random.sample(remaining, k=random.randint(1, 2))
    interests = list(dict.fromkeys(related_picks + random_picks))  # dedupe, preserve order

    lo = age_min or 18
    hi = age_max or 55
    start_hour = random.randint(6, 14)

    persona = Persona(
        name=name,
        age=random.randint(lo, hi),
        gender=gender,
        email=fake.email(),
        phone=fake.phone_number(),
        city=fake.city(),
        state=fake.state(),
        country=fake.country(),
        username=base_username,
        bio=fake.sentence(nb_words=10),
        interests=interests,
        niche=chosen_niche,
        tone=chosen_tone,
        genre=chosen_genre,
        archetype=chosen_archetype,
        artist_knowledge_depth=arch_defaults.get("artist_knowledge_depth", ""),
        behavior=BehavioralProfile(
            engagement_style=arch_defaults.get("engagement_style", random.choice(_ENGAGEMENT_STYLES)),
            session_duration_min=random.randint(3, 10),
            session_duration_max=random.randint(15, 60),
            posting_frequency=arch_defaults.get("posting_frequency", random.choice(_POSTING_FREQUENCIES)),
            active_hours_start=start_hour,
            active_hours_end=min(start_hour + random.randint(6, 14), 23),
            scroll_speed=random.choice(_SCROLL_SPEEDS),
        ),
        credentials=credentials,
    )

    # Enrich with LLM (generates background_story, content_style, rewrites bio)
    from circus.persona.enrichment import enrich_persona
    persona = enrich_persona(persona)

    return persona


def generate_personas(
    count: int,
    services: list[str] | None = None,
    niche: str | None = None,
    tone: str | None = None,
    age_min: int | None = None,
    age_max: int | None = None,
    genre: str | None = None,
    archetype: str | None = None,
) -> list[Persona]:
    """Generate multiple personas with a shared Faker instance."""
    fake = Faker()
    return [
        generate_persona(
            fake=fake, services=services,
            niche=niche, tone=tone,
            age_min=age_min, age_max=age_max,
            genre=genre, archetype=archetype,
        )
        for _ in range(count)
    ]
