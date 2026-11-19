from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field


class CallEvent(BaseModel):
    event_id: str = Field(min_length=1, max_length=100)
    event_type: Literal["call.started", "call.ended", "call.failed"]
    account_id: str = Field(pattern=r"^acct_\d{3}$")
    call_id: str = Field(min_length=1, max_length=100)
    timestamp: AwareDatetime
    duration_seconds: int = Field(ge=0)
    cost_cents: int = Field(ge=0)
    destination_country: str = Field(min_length=2, max_length=3)
