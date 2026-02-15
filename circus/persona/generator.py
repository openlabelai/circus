import random

from faker import Faker

from circus.persona.models import BehavioralProfile, Persona, ServiceCredentials

_SERVICES = ["instagram", "tiktok", "spotify", "twitter", "youtube"]

_INTERESTS_POOL = [
    "photography", "cooking", "travel", "fitness", "gaming", "music",
    "fashion", "tech", "art", "reading", "hiking", "yoga", "dance",
    "skateboarding", "surfing", "cycling", "meditation", "film",
]

_ENGAGEMENT_STYLES = ["passive", "active", "moderate"]
_POSTING_FREQUENCIES = ["hourly", "daily", "weekly", "rarely"]
_SCROLL_SPEEDS = ["slow", "medium", "fast"]


def generate_persona(
    fake: Faker | None = None,
    services: list[str] | None = None,
) -> Persona:
    """Generate a single synthetic persona."""
    if fake is None:
        fake = Faker()
    if services is None:
        services = random.sample(_SERVICES, k=random.randint(1, 3))

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

    interests = random.sample(_INTERESTS_POOL, k=random.randint(2, 6))
    start_hour = random.randint(6, 14)

    return Persona(
        name=name,
        age=random.randint(18, 55),
        gender=gender,
        email=fake.email(),
        phone=fake.phone_number(),
        city=fake.city(),
        state=fake.state(),
        country=fake.country(),
        username=base_username,
        bio=fake.sentence(nb_words=10),
        interests=interests,
        behavior=BehavioralProfile(
            engagement_style=random.choice(_ENGAGEMENT_STYLES),
            session_duration_min=random.randint(3, 10),
            session_duration_max=random.randint(15, 60),
            posting_frequency=random.choice(_POSTING_FREQUENCIES),
            active_hours_start=start_hour,
            active_hours_end=min(start_hour + random.randint(6, 14), 23),
            scroll_speed=random.choice(_SCROLL_SPEEDS),
        ),
        credentials=credentials,
    )


def generate_personas(
    count: int, services: list[str] | None = None
) -> list[Persona]:
    """Generate multiple personas with a shared Faker instance."""
    fake = Faker()
    return [generate_persona(fake=fake, services=services) for _ in range(count)]
