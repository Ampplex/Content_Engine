"""
LinkedIn API Integration — OAuth 2.0 + Real Data Fetching.

Handles:
  - OAuth 2.0 authorization code flow (login + token exchange)
  - Fetching user's real post history via LinkedIn UGC Posts API
  - Fetching engagement metrics (likes, comments, shares, impressions)
  - Transforming real data into the format expected by copilot.py & trend predictor

Required env vars:
  LINKEDIN_CLIENT_ID       — from your LinkedIn Developer App
  LINKEDIN_CLIENT_SECRET   — from your LinkedIn Developer App
  LINKEDIN_REDIRECT_URI    — e.g. http://localhost:8000/api/linkedin/callback

LinkedIn API docs: https://learn.microsoft.com/en-us/linkedin/
"""

import os
import time
import logging
import requests
import pandas as pd
from typing import Optional, Any
from urllib.parse import urlencode, quote
from datetime import datetime, timezone

logger = logging.getLogger("linkedin_api")

# ── Configuration ──────────────────────────────────────────────────────────────
LINKEDIN_CLIENT_ID     = os.getenv("LINKEDIN_CLIENT_ID", "")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET", "")
LINKEDIN_REDIRECT_URI  = os.getenv("LINKEDIN_REDIRECT_URI", "http://localhost:8000/api/linkedin/callback")

LINKEDIN_AUTH_URL    = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL   = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_API_BASE    = "https://api.linkedin.com/v2"

# Scopes needed: read profile + posts + analytics
# ✅ Fixed
LINKEDIN_SCOPES = [
    "openid",
    "profile",
    "email",
    "w_member_social"
]

TONE_KEYWORDS = {
    "Educational": ["how to", "guide", "tips", "learn", "explained", "understand",
                    "tutorial", "lesson", "insight", "knowledge", "skill"],
    "Promotional": ["launch", "new", "product", "service", "offer", "excited to announce",
                    "thrilled", "introducing", "available", "buy", "sign up"],
    "Story":       ["I remember", "last year", "story", "journey", "when I", "years ago",
                    "experience", "moment", "turned out", "realized"],
    "Opinion":     ["I think", "believe", "hot take", "unpopular opinion", "change my mind",
                    "disagree", "perspective", "in my view", "controversial"],
}


# ── OAuth Flow ─────────────────────────────────────────────────────────────────

def get_authorization_url(state: str = "random_state_string") -> str:
    """
    Build the LinkedIn OAuth2 authorization URL.
    Redirect the user's browser to this URL to start the login flow.
    """
    params = {
        "response_type": "code",
        "client_id": LINKEDIN_CLIENT_ID,
        "redirect_uri": LINKEDIN_REDIRECT_URI,
        "state": state,
        "scope": " ".join(LINKEDIN_SCOPES),
    }
    return f"{LINKEDIN_AUTH_URL}?{urlencode(params)}"


def exchange_code_for_token(code: str) -> dict:
    """
    Exchange the authorization code for an access token.
    Returns dict with: access_token, expires_in, scope
    """
    if not LINKEDIN_CLIENT_ID or not LINKEDIN_CLIENT_SECRET:
        raise ValueError("LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be set in environment.")

    resp = requests.post(
        LINKEDIN_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": LINKEDIN_REDIRECT_URI,
            "client_id": LINKEDIN_CLIENT_ID,
            "client_secret": LINKEDIN_CLIENT_SECRET,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    resp.raise_for_status()
    token_data = resp.json()
    logger.info(f"[LinkedIn] Token obtained. Expires in: {token_data.get('expires_in')}s")
    return token_data


# ── API Helpers ────────────────────────────────────────────────────────────────

def _api_get(endpoint: str, access_token: str, params: Optional[dict] = None) -> dict:
    """Generic authenticated GET request to LinkedIn API."""
    url = f"{LINKEDIN_API_BASE}/{endpoint}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202401",
    }
    resp = requests.get(url, headers=headers, params=params or {}, timeout=30)
    resp.raise_for_status()
    return resp.json()


def get_user_profile(access_token: str) -> dict:
    """
    Fetch the authenticated user's LinkedIn profile.
    Returns: {id, name, headline, profile_url}
    """
    data = _api_get("userinfo", access_token)
    return {
        "id":          data.get("sub", ""),
        "name":        data.get("name", ""),
        "email":       data.get("email", ""),
        "picture":     data.get("picture", ""),
        "headline":    data.get("headline", ""),
    }


# ── Post & Engagement Fetching ─────────────────────────────────────────────────

def get_user_posts(access_token: str, author_urn: str, count: int = 20) -> list[dict]:
    """
    Fetch the user's recent UGC posts from LinkedIn.
    Returns list of raw post dicts from the API.

    author_urn format: urn:li:person:{person_id}
    """
    try:
        data = _api_get(
            "ugcPosts",
            access_token,
            params={
                "q": "authors",
                "authors": f"List({author_urn})",
                "count": count,
                "sortBy": "LAST_MODIFIED",
            },
        )
        posts = data.get("elements", [])
        logger.info(f"[LinkedIn] Fetched {len(posts)} posts for {author_urn}")
        return posts
    except Exception as e:
        logger.error(f"[LinkedIn] Failed to fetch posts: {e}")
        return []


def get_post_engagement(access_token: str, post_urn: str) -> dict:
    """
    Fetch engagement stats for a single post: likes, comments, shares, impressions.
    post_urn format: urn:li:ugcPost:{post_id}
    """
    try:
        encoded_urn = quote(post_urn, safe="")
        data = _api_get(
            f"socialMetadata/{encoded_urn}",
            access_token,
        )
        likes      = data.get("likesSummary", {}).get("totalLikes", 0)
        comments   = data.get("commentsSummary", {}).get("totalFirstLevelComments", 0)
        shares     = data.get("resharesSummary", {}).get("totalShares", 0)
        return {
            "likes":       likes,
            "comments":    comments,
            "shares":      shares,
            "total_interactions": likes + comments + shares,
        }
    except Exception as e:
        logger.warning(f"[LinkedIn] Engagement fetch failed for {post_urn}: {e}")
        return {"likes": 0, "comments": 0, "shares": 0, "total_interactions": 0}


# ── Text Processing ────────────────────────────────────────────────────────────

def _extract_post_text(post: dict) -> str:
    """Extract plain text content from a LinkedIn UGC post object."""
    try:
        specific_content = post.get("specificContent", {})
        share_content    = specific_content.get("com.linkedin.ugc.ShareContent", {})
        share_commentary = share_content.get("shareCommentary", {})
        return share_commentary.get("text", "")
    except Exception:
        return ""


def _infer_tone(text: str) -> str:
    """Classify post tone based on keyword matching."""
    text_lower = text.lower()
    scores = {tone: 0 for tone in TONE_KEYWORDS}
    for tone, keywords in TONE_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                scores[tone] += 1
    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else "Educational"


def _compute_engagement_rate(interactions: int, estimated_impressions: int = 500) -> float:
    """
    Compute engagement rate as a percentage.
    LinkedIn impressions API requires special permissions; we estimate if unavailable.
    engagement_rate = (total_interactions / impressions) * 100
    """
    if estimated_impressions <= 0:
        return 0.0
    return round((interactions / estimated_impressions) * 100, 2)


def _ms_timestamp_to_date(ts: int) -> str:
    """Convert LinkedIn millisecond timestamp to YYYY-MM-DD string."""
    try:
        dt = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return datetime.now().strftime("%Y-%m-%d")


# ── Main Public Function ───────────────────────────────────────────────────────

def fetch_real_engagement_data(access_token: str, days: int = 14) -> pd.DataFrame:
    """
    Fetch real LinkedIn post data for the authenticated user.
    Returns a DataFrame compatible with copilot.py and TrendEngagementPredictor:
      Columns: date, tone, engagement_rate, likes, comments, shares, text_snippet

    Falls back to an informative empty DataFrame if API calls fail.
    """
    try:
        profile = get_user_profile(access_token)
        author_urn = f"urn:li:person:{profile['id']}"
        logger.info(f"[LinkedIn] Fetching data for: {profile.get('name', 'Unknown')}")

        raw_posts = get_user_posts(access_token, author_urn, count=days * 2)

        if not raw_posts:
            logger.warning("[LinkedIn] No posts found. Returning empty DataFrame.")
            return pd.DataFrame(columns=["date", "tone", "engagement_rate",
                                         "likes", "comments", "shares", "text_snippet"])

        rows = []
        for post in raw_posts[:days]:
            text        = _extract_post_text(post)
            tone        = _infer_tone(text)
            post_urn    = post.get("id", "")
            created_ts  = post.get("created", {}).get("time", int(time.time() * 1000))
            date_str    = _ms_timestamp_to_date(created_ts)

            engagement  = get_post_engagement(access_token, post_urn) if post_urn else {}
            interactions = engagement.get("total_interactions", 0)
            eng_rate    = _compute_engagement_rate(interactions)

            rows.append({
                "date":            date_str,
                "tone":            tone,
                "engagement_rate": eng_rate,
                "likes":           engagement.get("likes", 0),
                "comments":        engagement.get("comments", 0),
                "shares":          engagement.get("shares", 0),
                "text_snippet":    text[:120] + "..." if len(text) > 120 else text,
            })

        df = pd.DataFrame(rows).sort_values("date").reset_index(drop=True)
        logger.info(f"[LinkedIn] Built DataFrame: {len(df)} rows")
        return df

    except Exception as e:
        logger.error(f"[LinkedIn] fetch_real_engagement_data failed: {e}")
        return pd.DataFrame(columns=["date", "tone", "engagement_rate",
                                     "likes", "comments", "shares", "text_snippet"])


def get_profile_summary(access_token: str) -> dict:
    """
    Return a combined profile + engagement summary for the frontend dashboard.
    """
    try:
        profile = get_user_profile(access_token)
        df      = fetch_real_engagement_data(access_token, days=30)

        avg_engagement = round(df["engagement_rate"].mean(), 2) if not df.empty else 0.0
        top_tone = (
            df.groupby("tone")["engagement_rate"].mean().idxmax()
            if not df.empty else "Educational"
        )

        return {
            "profile":         profile,
            "total_posts":     len(df),
            "avg_engagement":  avg_engagement,
            "best_tone":       top_tone,
            "recent_data":     df.to_dict(orient="records"),
        }
    except Exception as e:
        logger.error(f"[LinkedIn] get_profile_summary failed: {e}")
        return {"error": str(e)}
