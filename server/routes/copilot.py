"""AI Copilot / Ask the Club Assistant API - RAG-augmented with live API-Football data."""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/copilot", tags=["copilot"])


def _get_chat_completion():
    try:
        from server.llm import chat_completion
        return chat_completion
    except Exception:
        return None


def _get_rag_context():
    try:
        from server.rag import build_rag_context
        return build_rag_context
    except Exception:
        return None


class CopilotRequest(BaseModel):
    message: str


SYSTEM_PROMPT = """You are the FC Barcelona Football Intelligence Assistant (Genie). You help sporting directors, 
analysts, medical staff, marketing teams, and commercial leadership with data-driven insights.

You have access to:
1. LIVE data from API-Football (squad, fixtures, standings, injuries, transfers, predictions).
2. Scraped news from fcbarcelona.com: latest transfer news, match reports, and general club news.
3. COMMERCIAL / PROJECTED REVENUE blocks: internal matchday model (per-fixture EUR M, rationale lines, ML growth strategies,
   elasticity note). When users ask why revenue is projected, what drives numbers, pricing simulation, or how to grow revenue,
   quote this section and explain in plain language (attendance forecast, ticket/hospitality/F&B split, opponent draw tier,
   demand tier). If they ask about a specific fixture's revenue, cite the rationale bullets for that fixture from context.
4. LIVE TACTICAL / ML: the app has a live match planning board with a match clock, drag-and-drop subs, and ML tactical
   recommendations (press, overloads, fatigue-driven subs). If asked about in-game tactics, subs timing, or live planning,
   describe that workflow and typical recommendation types (substitution, attacking, defensive) in general terms.

Use the provided context to answer questions accurately. When asked about transfer news, match reports, 
or what's happening at the club, use the scraped fcbarcelona.com news. For squad, fixtures, injuries, etc., use API-Football.
Be concise, professional, and cite specific numbers or headlines when available."""


@router.post("/ask")
async def ask_copilot(req: CopilotRequest):
    """Natural language query - RAG-augmented with fresh API-Football data."""
    build_rag = _get_rag_context()
    chat_completion = _get_chat_completion()
    if not build_rag or not chat_completion:
        return {"answer": "Genie is temporarily unavailable. Please try again later.", "query": req.message}
    try:
        rag_context = await build_rag(req.message)
        system_content = f"{SYSTEM_PROMPT}\n\n{rag_context}"
        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": req.message},
        ]
        response = await chat_completion(messages)
        return {"answer": response, "query": req.message}
    except Exception as e:
        return {"answer": f"Sorry, an error occurred: {str(e)}", "query": req.message}
