import json
import os

import pytest

from circus.persona.generator import generate_persona, generate_personas
from circus.persona.models import (
    BehavioralProfile,
    Persona,
    ServiceCredentials,
)
from circus.persona.storage import PersonaStore
from circus.persona.templates import substitute_persona_vars


class TestServiceCredentials:
    def test_round_trip(self):
        cred = ServiceCredentials(username="user1", password="pass1", email="a@b.com")
        data = cred.to_dict()
        restored = ServiceCredentials.from_dict(data)
        assert restored.username == "user1"
        assert restored.password == "pass1"
        assert restored.email == "a@b.com"


class TestBehavioralProfile:
    def test_defaults(self):
        bp = BehavioralProfile()
        assert bp.engagement_style == "passive"
        assert bp.scroll_speed == "medium"

    def test_round_trip(self):
        bp = BehavioralProfile(engagement_style="active", scroll_speed="fast")
        restored = BehavioralProfile.from_dict(bp.to_dict())
        assert restored.engagement_style == "active"
        assert restored.scroll_speed == "fast"


class TestPersona:
    def test_to_dict_from_dict(self):
        p = Persona(
            id="test123",
            name="Jane Doe",
            age=30,
            username="janedoe",
            credentials={
                "instagram": ServiceCredentials(
                    username="jane_ig", password="secret", email="j@ig.com"
                )
            },
        )
        data = p.to_dict()
        restored = Persona.from_dict(data)
        assert restored.id == "test123"
        assert restored.name == "Jane Doe"
        assert restored.credentials["instagram"].username == "jane_ig"

    def test_yaml_round_trip(self, tmp_path):
        p = Persona(
            id="yaml01",
            name="Test User",
            age=22,
            credentials={
                "tiktok": ServiceCredentials(
                    username="testuser_tt", password="pw123", email="t@t.com"
                )
            },
        )
        path = str(tmp_path / "yaml01.yaml")
        p.to_yaml(path)
        restored = Persona.from_yaml(path)
        assert restored.id == "yaml01"
        assert restored.name == "Test User"
        assert restored.credentials["tiktok"].username == "testuser_tt"

    def test_resolve_simple(self):
        p = Persona(id="r1", name="Alice", age=25, username="alice99")
        assert p.resolve("name") == "Alice"
        assert p.resolve("age") == "25"
        assert p.resolve("username") == "alice99"

    def test_resolve_nested(self):
        p = Persona(
            id="r2",
            credentials={
                "instagram": ServiceCredentials(
                    username="alice_ig", password="pw", email="a@ig.com"
                )
            },
        )
        assert p.resolve("credentials.instagram.username") == "alice_ig"
        assert p.resolve("credentials.instagram.password") == "pw"

    def test_resolve_missing(self):
        p = Persona(id="r3")
        assert p.resolve("credentials.nonexistent.username") == ""
        assert p.resolve("doesnotexist") == ""


class TestGenerator:
    def test_generate_single(self):
        p = generate_persona()
        assert p.name
        assert p.age >= 18
        assert p.username
        assert len(p.credentials) >= 1
        assert len(p.interests) >= 2

    def test_generate_with_services(self):
        p = generate_persona(services=["instagram", "spotify"])
        assert "instagram" in p.credentials
        assert "spotify" in p.credentials
        assert len(p.credentials) == 2

    def test_generate_multiple(self):
        personas = generate_personas(5)
        assert len(personas) == 5
        ids = [p.id for p in personas]
        assert len(set(ids)) == 5  # all unique IDs


class TestPersonaStore:
    @pytest.fixture
    def store(self, tmp_path):
        return PersonaStore(str(tmp_path))

    @pytest.fixture
    def sample_persona(self):
        return Persona(
            id="store01",
            name="Store Test",
            age=28,
            credentials={
                "instagram": ServiceCredentials(
                    username="storetest", password="pw", email="s@t.com"
                )
            },
        )

    def test_save_and_load(self, store, sample_persona):
        store.save(sample_persona)
        loaded = store.load("store01")
        assert loaded.name == "Store Test"
        assert loaded.credentials["instagram"].username == "storetest"

    def test_list_all(self, store):
        p1 = Persona(id="list01", name="A")
        p2 = Persona(id="list02", name="B")
        store.save(p1)
        store.save(p2)
        all_personas = store.list_all()
        assert len(all_personas) == 2

    def test_delete(self, store, sample_persona):
        store.save(sample_persona)
        store.delete("store01")
        with pytest.raises(FileNotFoundError):
            store.load("store01")

    def test_assign_and_get(self, store, sample_persona):
        store.save(sample_persona)
        store.assign("store01", "DEVICE001")
        assert store.get_device_for_persona("store01") == "DEVICE001"
        assert store.get_persona_for_device("DEVICE001").id == "store01"

    def test_unassign(self, store, sample_persona):
        store.save(sample_persona)
        store.assign("store01", "DEVICE001")
        store.unassign("store01")
        assert store.get_device_for_persona("store01") is None
        assert store.get_persona_for_device("DEVICE001") is None

    def test_one_persona_per_device(self, store):
        p1 = Persona(id="dup01", name="A")
        p2 = Persona(id="dup02", name="B")
        store.save(p1)
        store.save(p2)
        store.assign("dup01", "DEVICE001")
        with pytest.raises(ValueError, match="already assigned"):
            store.assign("dup02", "DEVICE001")

    def test_assign_nonexistent_persona(self, store):
        with pytest.raises(FileNotFoundError):
            store.assign("doesnotexist", "DEVICE001")

    def test_unassign_not_assigned(self, store, sample_persona):
        store.save(sample_persona)
        with pytest.raises(KeyError):
            store.unassign("store01")

    def test_get_assignments(self, store, sample_persona):
        store.save(sample_persona)
        store.assign("store01", "DEV1")
        assignments = store.get_assignments()
        assert assignments == {"store01": "DEV1"}


class TestTemplateSubstitution:
    @pytest.fixture
    def persona(self):
        return Persona(
            id="tmpl01",
            name="Template User",
            username="tmpluser",
            credentials={
                "instagram": ServiceCredentials(
                    username="tmpl_ig", password="secret123", email="t@ig.com"
                )
            },
        )

    def test_substitute_string(self, persona):
        result = substitute_persona_vars("{persona.name}", persona)
        assert result == "Template User"

    def test_substitute_nested(self, persona):
        result = substitute_persona_vars(
            "{persona.credentials.instagram.username}", persona
        )
        assert result == "tmpl_ig"

    def test_substitute_in_dict(self, persona):
        action = {
            "action": "type",
            "text": "{persona.credentials.instagram.password}",
            "into": "Password",
        }
        result = substitute_persona_vars(action, persona)
        assert result["text"] == "secret123"
        assert result["into"] == "Password"  # unchanged
        assert result["action"] == "type"  # unchanged

    def test_substitute_in_list(self, persona):
        data = ["{persona.name}", "{persona.username}", "literal"]
        result = substitute_persona_vars(data, persona)
        assert result == ["Template User", "tmpluser", "literal"]

    def test_no_substitution_without_pattern(self, persona):
        result = substitute_persona_vars("plain text", persona)
        assert result == "plain text"

    def test_non_string_passthrough(self, persona):
        assert substitute_persona_vars(42, persona) == 42
        assert substitute_persona_vars(3.14, persona) == 3.14
        assert substitute_persona_vars(True, persona) is True

    def test_mixed_template(self, persona):
        result = substitute_persona_vars(
            "Hello {persona.name}, your username is {persona.username}", persona
        )
        assert result == "Hello Template User, your username is tmpluser"
