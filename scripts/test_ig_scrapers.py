#!/usr/bin/env python3
"""
Instagram Scraper Library Evaluation Script.

Tests alternative approaches to Instagram comment scraping, comparing them
against our current on-device uiautomator2 approach.

Usage (run inside circus-django container):
    docker exec circus-django python /app/scripts/test_ig_scrapers.py [test_num]

    test_num: 1 = instagrapi, 2 = instagram_private_api, 4 = instatouch
              omit to run all available tests
"""

from __future__ import annotations

import json
import os
import sys
import time
import traceback

# Django setup — needed to read credentials from DB
sys.path.insert(0, "/app/web")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "circus_web.settings")

import django
django.setup()

from api.models import Persona
from django.apps import apps

ServiceCredential = apps.get_model("api", "ServiceCredential")

# ── Config ──────────────────────────────────────────────────────────────

TARGET_ARTISTS = ["jbalvin", "gonzamp3"]
COMMENTS_PER_POST = 50
NUM_POSTS = 3


def get_ig_credentials() -> tuple[str, str]:
    """Get Instagram credentials from env vars or DB.

    Set IG_USERNAME and IG_PASSWORD env vars to override DB lookup.
    """
    username = os.environ.get("IG_USERNAME", "")
    password = os.environ.get("IG_PASSWORD", "")
    if username and password:
        print(f"  Using credential from env: {username}")
        return username, password

    cred = ServiceCredential.objects.filter(service_name="instagram").first()
    if not cred:
        raise RuntimeError(
            "No Instagram credentials found. Set IG_USERNAME/IG_PASSWORD env vars "
            "or add an instagram ServiceCredential."
        )
    print(f"  Using credential from DB: {cred.username} (persona: {cred.persona.name})")
    return cred.username, cred.password


# ── Test 1: instagrapi ──────────────────────────────────────────────────

def test_instagrapi():
    """Test the instagrapi library (private API, Python-native)."""
    print("\n" + "=" * 70)
    print("TEST 1: instagrapi")
    print("=" * 70)

    try:
        from instagrapi import Client
    except ImportError:
        print("  ERROR: instagrapi not installed. Run: pip install instagrapi")
        return None

    username, password = get_ig_credentials()
    results = {"library": "instagrapi", "artists": {}, "errors": []}

    cl = Client()

    # Optional proxy support (residential proxy needed for datacenter environments)
    proxy = os.environ.get("IG_PROXY", "")
    if proxy:
        cl.set_proxy(proxy)
        print(f"  Using proxy: {proxy[:30]}...")

    # Attempt login
    print(f"\n  Logging in as {username}...")
    t0 = time.time()
    try:
        cl.login(username, password)
        login_time = time.time() - t0
        print(f"  Login successful ({login_time:.1f}s)")
        results["login_time"] = login_time
    except Exception as e:
        error_msg = f"Login failed: {e}"
        print(f"  ERROR: {error_msg}")
        results["errors"].append(error_msg)
        traceback.print_exc()
        return results

    # Test each artist
    for artist in TARGET_ARTISTS:
        print(f"\n  --- Scraping @{artist} ---")
        artist_results = {"posts": [], "total_comments": 0, "errors": []}

        try:
            # Step A: Resolve username → user_id
            t0 = time.time()
            user_id = cl.user_id_from_username(artist)
            print(f"  User ID: {user_id} ({time.time() - t0:.1f}s)")

            # Step B: Get recent posts
            t0 = time.time()
            medias = cl.user_medias(user_id, NUM_POSTS)
            print(f"  Got {len(medias)} posts ({time.time() - t0:.1f}s)")

            # Step C: Fetch comments from each post
            for i, media in enumerate(medias):
                post_data = {
                    "media_id": str(media.id),
                    "media_pk": str(media.pk),
                    "caption": (media.caption_text or "")[:100],
                    "like_count": media.like_count,
                    "comment_count": media.comment_count,
                    "comments": [],
                }

                try:
                    t0 = time.time()
                    comments = cl.media_comments(media.pk, amount=COMMENTS_PER_POST)
                    fetch_time = time.time() - t0

                    for c in comments:
                        post_data["comments"].append({
                            "text": c.text,
                            "username": c.user.username,
                            "likes": c.like_count,
                            "created_at": str(c.created_at_utc),
                        })

                    artist_results["total_comments"] += len(comments)
                    print(f"  Post {i+1}: {len(comments)} comments ({fetch_time:.1f}s) "
                          f"[reported: {media.comment_count}]")

                    # Show a sample comment
                    if comments:
                        sample = comments[0]
                        print(f"    Sample: @{sample.user.username}: "
                              f"{sample.text[:80]}... ({sample.like_count} likes)")

                except Exception as e:
                    error_msg = f"Post {i+1} comments failed: {e}"
                    print(f"  ERROR: {error_msg}")
                    artist_results["errors"].append(error_msg)

                post_data["fetch_time"] = fetch_time if "fetch_time" in dir() else 0
                artist_results["posts"].append(post_data)

                # Small delay between posts to avoid rate limiting
                time.sleep(1)

        except Exception as e:
            error_msg = f"Artist @{artist} failed: {e}"
            print(f"  ERROR: {error_msg}")
            artist_results["errors"].append(error_msg)
            traceback.print_exc()

        results["artists"][artist] = artist_results

    # Summary
    print(f"\n  === instagrapi Summary ===")
    for artist, data in results["artists"].items():
        print(f"  @{artist}: {data['total_comments']} comments from "
              f"{len(data['posts'])} posts, {len(data['errors'])} errors")
    if results["errors"]:
        print(f"  Global errors: {results['errors']}")

    return results


# ── Test 2: instagram_private_api ───────────────────────────────────────

def test_instagram_private_api():
    """Test the instagram_private_api library (older private API)."""
    print("\n" + "=" * 70)
    print("TEST 2: instagram_private_api")
    print("=" * 70)

    try:
        from instagram_private_api import Client
    except ImportError:
        print("  ERROR: instagram_private_api not installed. Run: pip install instagram_private_api")
        return None

    username, password = get_ig_credentials()
    results = {"library": "instagram_private_api", "artists": {}, "errors": []}

    # Attempt login
    print(f"\n  Logging in as {username}...")
    t0 = time.time()
    try:
        api = Client(username, password)
        login_time = time.time() - t0
        print(f"  Login successful ({login_time:.1f}s)")
        results["login_time"] = login_time
    except Exception as e:
        error_msg = f"Login failed: {e}"
        print(f"  ERROR: {error_msg}")
        results["errors"].append(error_msg)
        traceback.print_exc()
        return results

    # Test each artist
    for artist in TARGET_ARTISTS:
        print(f"\n  --- Scraping @{artist} ---")
        artist_results = {"posts": [], "total_comments": 0, "errors": []}

        try:
            # Step A: Get user info
            t0 = time.time()
            user_info = api.username_info(artist)
            user = user_info["user"]
            user_pk = user["pk"]
            print(f"  User PK: {user_pk} ({time.time() - t0:.1f}s)")

            # Step B: Get user feed
            t0 = time.time()
            feed = api.user_feed(user_pk)
            items = feed.get("items", [])[:NUM_POSTS]
            print(f"  Got {len(items)} posts ({time.time() - t0:.1f}s)")

            # Step C: Fetch comments
            for i, item in enumerate(items):
                media_pk = item["pk"]
                post_data = {
                    "media_pk": str(media_pk),
                    "caption": (item.get("caption", {}) or {}).get("text", "")[:100],
                    "like_count": item.get("like_count", 0),
                    "comment_count": item.get("comment_count", 0),
                    "comments": [],
                }

                try:
                    t0 = time.time()
                    comments_resp = api.media_comments(media_pk)
                    fetch_time = time.time() - t0
                    comments = comments_resp.get("comments", [])

                    for c in comments[:COMMENTS_PER_POST]:
                        post_data["comments"].append({
                            "text": c.get("text", ""),
                            "username": c.get("user", {}).get("username", ""),
                            "likes": c.get("comment_like_count", 0),
                            "created_at": str(c.get("created_at", "")),
                        })

                    artist_results["total_comments"] += len(post_data["comments"])
                    print(f"  Post {i+1}: {len(post_data['comments'])} comments ({fetch_time:.1f}s)")

                    if post_data["comments"]:
                        s = post_data["comments"][0]
                        print(f"    Sample: @{s['username']}: {s['text'][:80]}... ({s['likes']} likes)")

                except Exception as e:
                    error_msg = f"Post {i+1} comments failed: {e}"
                    print(f"  ERROR: {error_msg}")
                    artist_results["errors"].append(error_msg)

                post_data["fetch_time"] = fetch_time if "fetch_time" in dir() else 0
                artist_results["posts"].append(post_data)
                time.sleep(1)

        except Exception as e:
            error_msg = f"Artist @{artist} failed: {e}"
            print(f"  ERROR: {error_msg}")
            artist_results["errors"].append(error_msg)
            traceback.print_exc()

        results["artists"][artist] = artist_results

    # Summary
    print(f"\n  === instagram_private_api Summary ===")
    for artist, data in results["artists"].items():
        print(f"  @{artist}: {data['total_comments']} comments from "
              f"{len(data['posts'])} posts, {len(data['errors'])} errors")

    return results


# ── Main ────────────────────────────────────────────────────────────────

def main():
    test_num = int(sys.argv[1]) if len(sys.argv) > 1 else 0

    all_results = {}

    if test_num in (0, 1):
        all_results["instagrapi"] = test_instagrapi()

    if test_num in (0, 2):
        all_results["instagram_private_api"] = test_instagram_private_api()

    # Save results to JSON
    output_path = "/app/scripts/ig_scraper_results.json"
    with open(output_path, "w") as f:
        json.dump(all_results, f, indent=2, default=str)
    print(f"\n{'=' * 70}")
    print(f"Results saved to {output_path}")

    # Final comparison
    print(f"\n{'=' * 70}")
    print("COMPARISON SUMMARY")
    print(f"{'=' * 70}")
    for lib_name, result in all_results.items():
        if result is None:
            print(f"  {lib_name}: NOT INSTALLED")
            continue
        if result.get("errors"):
            print(f"  {lib_name}: FAILED — {result['errors']}")
            continue
        total = sum(a["total_comments"] for a in result.get("artists", {}).values())
        errors = sum(len(a["errors"]) for a in result.get("artists", {}).values())
        print(f"  {lib_name}: {total} total comments, {errors} errors, "
              f"login={result.get('login_time', '?')}s")


if __name__ == "__main__":
    main()
