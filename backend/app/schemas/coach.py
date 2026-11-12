from pydantic import BaseModel, Field


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: int | None = None


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    cards: list = []
    tools_used: list = []
    provider: str | None = None
    created_at: str

    @classmethod
    def from_orm_msg(cls, m):
        return cls(id=m.id, role=m.role, content=m.content, cards=m.cards or [], tools_used=m.tools_used or [],
                   provider=m.provider, created_at=m.created_at.isoformat() + "Z")


class SettingsIn(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    ai_provider_pref: str | None = Field(default=None, pattern="^(auto|gemini|groq|mock)$")
    unit_system: str | None = Field(default=None, pattern="^(metric|imperial)$")
