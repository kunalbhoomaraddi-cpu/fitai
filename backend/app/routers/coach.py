from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.agent import HISTORY_TURNS, run_coach
from app.ai.provider import ai_status
from app.database import get_db
from app.models import Conversation, Message, SavedRecommendation, User
from app.schemas.coach import ChatIn, MessageOut
from app.services.auth_service import require_profile
from app.utils.ratelimit import ai_rate_limit

router = APIRouter(prefix="/coach", tags=["coach"])

SUGGESTIONS = [
    "How many calories should I consume?", "How much protein do I need?", "How can I lose 5 kg?",
    "What should I eat before working out?", "What workout should I do today?", "Why has my weight stopped decreasing?",
    "How can I improve my strength?", "How should I adjust my diet?", "Am I making progress?",
    "What should my next week's fitness plan look like?",
]
SUGGESTIONS_BY_LANGUAGE = {
    "hi": ["मुझे रोज़ कितनी कैलोरी खानी चाहिए?", "मुझे कितना प्रोटीन चाहिए?", "5 किलो वज़न कैसे कम करूँ?",
           "वर्कआउट से पहले क्या खाऊँ?", "आज कौन सा वर्कआउट करूँ?", "मेरा वज़न कम होना क्यों रुक गया है?",
           "क्या मेरी प्रोग्रेस ठीक चल रही है?", "अगले हफ़्ते का फ़िटनेस प्लान कैसा हो?"],
    "kn": ["ನಾನು ದಿನಕ್ಕೆ ಎಷ್ಟು ಕ್ಯಾಲೊರಿ ತಿನ್ನಬೇಕು?", "ನನಗೆ ಎಷ್ಟು ಪ್ರೋಟೀನ್ ಬೇಕು?", "5 ಕೆಜಿ ತೂಕ ಹೇಗೆ ಇಳಿಸುವುದು?",
           "ವರ್ಕೌಟ್‌ಗೆ ಮುಂಚೆ ಏನು ತಿನ್ನಬೇಕು?", "ಇವತ್ತು ಯಾವ ವರ್ಕೌಟ್ ಮಾಡಲಿ?", "ನನ್ನ ತೂಕ ಇಳಿಯುವುದು ಯಾಕೆ ನಿಂತಿದೆ?",
           "ನನ್ನ ಪ್ರಗತಿ ಸರಿಯಾಗಿದೆಯಾ?", "ಮುಂದಿನ ವಾರದ ಫಿಟ್‌ನೆಸ್ ಪ್ಲಾನ್ ಹೇಗಿರಬೇಕು?"],
}


def _own(db, user, cid) -> Conversation:
    c = db.get(Conversation, cid)
    if not c or c.user_id != user.id:
        raise HTTPException(404, "Conversation not found")
    return c


@router.get("/status")
def status(user: User = Depends(require_profile)):
    return ai_status(user.ai_provider_pref)


@router.get("/suggestions")
def suggestions(user: User = Depends(require_profile)):
    """Starter questions, in the language the coach replies in."""
    return SUGGESTIONS_BY_LANGUAGE.get(user.coach_language, SUGGESTIONS)


@router.get("/conversations")
def conversations(user: User = Depends(require_profile), db: Session = Depends(get_db)):
    rows = db.scalars(select(Conversation).where(Conversation.user_id == user.id).order_by(Conversation.updated_at.desc()).limit(50))
    return [{"id": c.id, "title": c.title, "updated_at": c.updated_at.isoformat() + "Z", "message_count": len(c.messages)} for c in rows]


@router.get("/conversations/{cid}")
def conversation(cid: int, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    c = _own(db, user, cid)
    return {"id": c.id, "title": c.title, "messages": [MessageOut.from_orm_msg(m) for m in c.messages]}


@router.delete("/conversations/{cid}", status_code=204)
def delete_conversation(cid: int, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    db.delete(_own(db, user, cid))
    db.commit()


@router.post("/chat")
def chat(body: ChatIn, user: User = Depends(ai_rate_limit), db: Session = Depends(get_db)):
    if user.profile is None:
        raise HTTPException(409, "Complete onboarding first")
    if body.conversation_id:
        conv = _own(db, user, body.conversation_id)
    else:
        title = body.message.strip().split("\n")[0][:60]
        conv = Conversation(user_id=user.id, title=title or "New conversation")
        db.add(conv)
        db.flush()
    history = [(m.role, m.content) for m in conv.messages[-HISTORY_TURNS:]]
    user_msg = Message(conversation_id=conv.id, role="user", content=body.message.strip())
    db.add(user_msg)
    db.flush()
    result = run_coach(db, user, history, body.message.strip())
    reply = Message(conversation_id=conv.id, role="assistant", content=result["content"], cards=result["cards"],
                    tools_used=result["tools_used"], provider=(result["provider"] or "")[:100])
    db.add(reply)
    conv.updated_at = reply.created_at if reply.created_at else conv.updated_at
    db.commit()
    db.refresh(conv)
    return {"conversation_id": conv.id, "title": conv.title, "user_message": MessageOut.from_orm_msg(user_msg),
            "message": MessageOut.from_orm_msg(reply), "is_real_llm": result["is_real_llm"], "notice": result["notice"]}


class SaveIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1, max_length=4000)
    category: str = Field(default="general", pattern="^(nutrition|workout|recovery|general)$")


@router.post("/save", status_code=201)
def save_recommendation(body: SaveIn, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    rec = SavedRecommendation(user_id=user.id, title=body.title, content=body.content, category=body.category, source="coach")
    db.add(rec)
    db.commit()
    return {"id": rec.id, "title": rec.title}


@router.get("/saved")
def saved(user: User = Depends(require_profile), db: Session = Depends(get_db)):
    rows = db.scalars(select(SavedRecommendation).where(SavedRecommendation.user_id == user.id,
                                                        SavedRecommendation.category != "daily")
                      .order_by(SavedRecommendation.id.desc()).limit(50))
    return [{"id": r.id, "title": r.title, "content": r.content, "category": r.category,
             "created_at": r.created_at.isoformat() + "Z"} for r in rows]
