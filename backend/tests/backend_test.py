"""
Heliora backend regression + new oracle consensus tests.
Targets the public REACT_APP_BACKEND_URL with /api prefix.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://predict-market-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def open_markets(client):
    r = client.get(f"{API}/markets", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "markets" in data and isinstance(data["markets"], list) and len(data["markets"]) > 0
    open_ms = [m for m in data["markets"] if m.get("status") == "open"]
    assert len(open_ms) >= 2, f"Need at least 2 open markets, got {len(open_ms)}"
    return open_ms


# ─── Markets / Portfolio / Orderbook regression ──────────────────────

class TestMarkets:
    def test_list_markets(self, client):
        r = client.get(f"{API}/markets", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["markets"], list) and len(data["markets"]) > 0
        m = data["markets"][0]
        for f in ("id", "question", "status", "yesPrice", "noPrice", "category"):
            assert f in m

    def test_create_market_persists(self, client):
        from datetime import datetime, timedelta
        ends = (datetime.utcnow() + timedelta(days=10)).isoformat()
        payload = {
            "question": "TEST_ Will pytest pass for Heliora?",
            "description": "Test market",
            "category": "Crypto",
            "resolution": "AIOracle",
            "resolutionDetail": "Resolves YES if all tests pass",
            "endsAt": ends,
            "liquiditySeed": 500,
            "isLive": False,
        }
        r = client.post(f"{API}/markets", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        mkt = r.json()["market"]
        assert mkt["question"] == payload["question"]
        assert mkt["status"] == "open"
        assert mkt["yesPrice"] == 0.5
        # Verify GET persists
        r2 = client.get(f"{API}/markets/{mkt['id']}", timeout=30)
        assert r2.status_code == 200
        assert r2.json()["market"]["id"] == mkt["id"]

    def test_orderbook(self, client, open_markets):
        mid = open_markets[0]["id"]
        r = client.get(f"{API}/markets/{mid}/orderbook", timeout=30)
        assert r.status_code == 200
        ob = r.json()
        assert "buyYes" in ob and "sellYes" in ob and "mid" in ob
        assert isinstance(ob["buyYes"], list) and len(ob["buyYes"]) > 0


class TestPortfolio:
    def test_portfolio_default(self, client):
        r = client.get(f"{API}/portfolio", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "summary" in data and "positions" in data and "trades" in data

    def test_portfolio_with_wallet(self, client):
        r = client.get(f"{API}/portfolio", headers={"x-wallet": "TEST_wallet_123"}, timeout=30)
        assert r.status_code == 200
        assert "summary" in r.json()


# ─── Oracle: 5-agent consensus ───────────────────────────────────────

class TestOracleResolve:
    def test_recent_resolutions(self, client):
        r = client.get(f"{API}/oracle/recent", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "resolutions" in data and isinstance(data["resolutions"], list)

    def test_resolve_returns_full_consensus_payload(self, client, open_markets):
        target = open_markets[0]
        t0 = time.time()
        r = client.post(f"{API}/oracle/resolve/{target['id']}", json={"context": ""}, timeout=60)
        elapsed = time.time() - t0
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        assert elapsed < 25, f"Resolution took {elapsed:.1f}s — parallel exec target <25s"

        body = r.json()
        assert "resolution" in body
        res = body["resolution"]

        # Required new-consensus fields
        for f in ("outcome", "consensus", "totalVotes", "tally", "weightedConfidence",
                  "averageConfidence", "consensusThreshold", "isDisputed", "votes", "reasoning"):
            assert f in res, f"Missing field: {f}"

        # Tally shape
        tally = res["tally"]
        assert set(tally.keys()) == {"YES", "NO", "INVALID"}
        assert sum(tally.values()) == 5

        # 5 votes, each with confidence + agent
        assert res["totalVotes"] == 5
        assert isinstance(res["votes"], list) and len(res["votes"]) == 5
        for v in res["votes"]:
            assert v["vote"] in ("YES", "NO", "INVALID")
            assert 0.0 <= float(v["confidence"]) <= 1.0
            assert "agent" in v and isinstance(v["agent"], dict)
            assert "_id" not in v["agent"]

        assert res["consensusThreshold"] == 3
        assert isinstance(res["isDisputed"], bool)
        assert 0.0 <= res["averageConfidence"] <= 1.0

        # Outcome semantics
        if res["isDisputed"]:
            assert res["outcome"] == "DISPUTED"
        else:
            assert res["outcome"] in ("YES", "NO", "INVALID")

    def test_resolve_already_resolved_returns_400(self, client, open_markets):
        target = open_markets[1]  # use a different market than the one above
        # First resolve
        r1 = client.post(f"{API}/oracle/resolve/{target['id']}", json={"context": ""}, timeout=60)
        assert r1.status_code == 200, r1.text
        first_status = r1.json()["resolution"]
        # If disputed, market.status is "disputed", not "resolved"; endpoint only blocks "resolved"
        # So we only assert 400-on-second-call when first call was NOT disputed
        if not first_status["isDisputed"]:
            r2 = client.post(f"{API}/oracle/resolve/{target['id']}", json={"context": ""}, timeout=60)
            assert r2.status_code == 400, f"Expected 400 already resolved, got {r2.status_code}: {r2.text}"
            assert "already resolved" in r2.text.lower()
        else:
            pytest.skip("First resolution was disputed — cannot test already-resolved 400 path on same market")

    def test_resolve_unknown_market_returns_404(self, client):
        r = client.post(f"{API}/oracle/resolve/does-not-exist-xyz", json={"context": ""}, timeout=30)
        assert r.status_code == 404

    def test_recent_resolutions_after_resolve(self, client):
        r = client.get(f"{API}/oracle/recent", timeout=30)
        assert r.status_code == 200
        resolutions = r.json()["resolutions"]
        assert len(resolutions) > 0
        # At least one should have the new fields (from the resolve we just did)
        has_new = any("isDisputed" in res or "tally" in res for res in resolutions)
        assert has_new, "No resolution carries new consensus fields"
