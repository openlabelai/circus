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

_VIBE_WORDS = [
    "vibe", "soul", "moon", "luna", "nova", "echo", "wave", "drift",
    "haze", "glow", "bloom", "aura", "daze", "muse", "tone", "beat",
    "melody", "rhythm", "lyric", "sound",
]

_USERNAME_STYLES = ["dotted", "aesthetic", "underscore", "simple", "handle"]


def _generate_username(first: str, last: str) -> str:
    """Generate a realistic social media username using varied patterns."""
    first_l = first.lower()
    last_l = last.lower()
    vibe = random.choice(_VIBE_WORDS)
    num = random.randint(0, 99)
    style = random.choice(_USERNAME_STYLES)

    patterns = {
        "dotted": [
            f"{vibe}.with.{first_l}",
            f"{first_l}.{vibe}",
            f"{first_l}.{last_l}.{vibe}",
        ],
        "aesthetic": [
            f"{first_l}x{vibe}",
            f"{vibe}x{first_l}",
            f"{first_l}x{last_l}",
        ],
        "underscore": [
            f"{vibe}_{first_l}",
            f"{first_l}_{vibe}_{num:02d}",
            f"{vibe}_n_{first_l}",
        ],
        "simple": [
            f"{first_l}{vibe}{num}",
            f"{vibe}{first_l}{num:02d}",
            f"{first_l}{num}{vibe}",
        ],
        "handle": [
            f"its{first_l}{vibe}",
            f"the{first_l}{vibe}",
            f"just{first_l}{num:02d}",
        ],
    }
    return random.choice(patterns[style])


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
    target_artist: str | None = None,
) -> Persona:
    """Generate a single synthetic persona."""
    if fake is None:
        fake = Faker()
    if services is None:
        services = random.sample(_SERVICES, k=random.randint(1, 3))

    chosen_genre = genre or ""
    chosen_archetype = archetype or ""
    chosen_target_artist = target_artist or ""

    # If genre or target_artist is set, default niche to "music"
    if (chosen_genre or chosen_target_artist) and not niche:
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
    base_username = _generate_username(first, last)

    credentials: dict[str, ServiceCredentials] = {}
    for svc in services:
        # Each service gets a fresh username variation
        credentials[svc] = ServiceCredentials(
            username=_generate_username(first, last),
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
        target_artist=chosen_target_artist,
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
    persona = enrich_persona(persona, target_artist=chosen_target_artist)

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
    target_artist: str | None = None,
) -> list[Persona]:
    """Generate multiple personas with a shared Faker instance."""
    fake = Faker()
    return [
        generate_persona(
            fake=fake, services=services,
            niche=niche, tone=tone,
            age_min=age_min, age_max=age_max,
            genre=genre, archetype=archetype,
            target_artist=target_artist,
        )
        for _ in range(count)
    ]
