"""Media, social, and popularity intelligence API."""
from fastapi import APIRouter
from server.data.mock_data import _media_sentiment, PLAYERS

router = APIRouter(prefix="/media", tags=["media"])

# Fallback mock news when scraping fails
def _mock_news():
    from datetime import datetime, timedelta
    base = datetime.now()
    return [
        {"headline": "Deco confirms: Nico Williams talks ongoing", "sentiment": "positive", "source": "fcbarcelona.com",
         "date": (base - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M"), "url": "https://fcbarcelona.com/",
         "excerpt": "Director of Football talks strategy and squad alignment ahead of the run-in."},
        {"headline": "Flick: How Pedri and Yamal lead the press", "sentiment": "positive", "source": "fcbarcelona.com",
         "date": (base - timedelta(hours=5)).strftime("%Y-%m-%dT%H:%M"), "url": "https://fcbarcelona.com/",
         "excerpt": "New signing Yoro reveals the teammates who made him feel at home."},
        {"headline": "Yamal record-breaking La Liga season milestones", "sentiment": "positive", "source": "fcbarcelona.com",
         "date": (base - timedelta(hours=8)).strftime("%Y-%m-%dT%H:%M"), "url": "https://fcbarcelona.com/",
         "excerpt": "Everyone's talking about our skipper's amazing milestone."},
    ]


@router.get("/sentiment")
async def media_sentiment():
    """Player media sentiment and popularity."""
    return _media_sentiment()


@router.get("/trending")
async def trending_players():
    """Players with rising media attention."""
    sentiment = _media_sentiment()
    return sorted(sentiment, key=lambda x: x["media_mentions_7d"], reverse=True)[:5]


@router.get("/news-summary")
async def news_summary():
    """News scraped from fcbarcelona.com RSS. Falls back to mock data if scrape fails."""
    try:
        from server.scraper.manutd_news import fetch_fcb_news
        articles = await fetch_fcb_news(limit=20)
        if articles:
            return [
                {
                    "headline": a["headline"],
                    "sentiment": "positive",
                    "source": a.get("source", "fcbarcelona.com"),
                    "date": a.get("date", ""),
                    "url": a.get("url", "https://fcbarcelona.com/"),
                    "excerpt": a.get("excerpt", ""),
                }
                for a in articles
            ]
    except Exception:
        pass
    return _mock_news()


@router.get("/transfer-news")
async def transfer_news():
    """Latest transfer news from FC Barcelona's official channels (fcbarcelona.com)."""
    try:
        from server.scraper.fcb_news import fetch_transfer_news
        articles = await fetch_transfer_news(limit=15)
        if articles:
            return {"articles": articles, "source": "fcbarcelona.com"}
    except Exception:
        pass
    return {"articles": [], "source": "fcbarcelona.com"}


@router.get("/match-reports")
async def match_reports():
    """Recent match reports from fcbarcelona.com."""
    try:
        from server.scraper.fcb_news import fetch_match_reports
        articles = await fetch_match_reports(limit=15)
        if articles:
            return {"articles": articles, "source": "fcbarcelona.com"}
    except Exception:
        pass
    return {"articles": [], "source": "fcbarcelona.com"}


@router.get("/news-insights")
async def news_insights():
    """
    GPT-analyzed insights from scraped news: injuries, transfers in, transfers out.
    Uses OpenAI GPT to extract structured info. Requires OPENAI_API_KEY.
    """
    try:
        from server.scraper.manutd_news import fetch_fcb_news
        from server.scraper.news_analyzer import analyze_news_with_gpt
        articles = await fetch_fcb_news(limit=25)
        if not articles:
            return {"injuries": [], "transfers_in": [], "transfers_out": [], "summary": "", "source": "fcbarcelona.com"}
        insights = await analyze_news_with_gpt(articles)
        return {
            "injuries": insights.get("injuries", []),
            "transfers_in": insights.get("transfers_in", []),
            "transfers_out": insights.get("transfers_out", []),
            "summary": insights.get("summary", ""),
            "source": "fcbarcelona.com",
            "analyzed_by": "openai-gpt",
        }
    except Exception:
        return {"injuries": [], "transfers_in": [], "transfers_out": [], "summary": "", "source": "fcbarcelona.com"}
