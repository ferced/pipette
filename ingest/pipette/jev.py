"""Minimal TypeSafe (Jev) client: POST /v1/systemone with retries and backoff."""
import json
import os
import random
import time
import urllib.error
import urllib.request

API = "https://api.typesafe.ai/v1/systemone"
MODEL = os.environ.get("JEV_MODEL", "jev-latest")


def key():
    k = os.environ.get("JEV_API_KEY") or os.environ.get("TYPESAFE_API_KEY")
    if not k:
        raise RuntimeError("JEV_API_KEY is not set")
    return k


def ask(state, questions, tries=7, timeout=60):
    body = json.dumps({"model": MODEL, "state": state, "questions": questions}).encode()
    last = None
    for i in range(tries):
        req = urllib.request.Request(API, data=body, headers={
            "Authorization": "Bearer " + key(), "Content-Type": "application/json",
        })
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}: {e.read()[:300]!r}"
            if e.code in (400, 401, 403, 404, 422):
                raise RuntimeError(last)
            wait = float(e.headers.get("retry-after") or 0) or min(30, 1.5 * 2 ** i)
            time.sleep(wait + random.random())
        except Exception as e:
            last = str(e)
            time.sleep(min(30, 1.5 * 2 ** i) + random.random())
    raise RuntimeError(f"Jev failed after {tries} tries: {last}")
