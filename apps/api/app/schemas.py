from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ResearchRequest(BaseModel):
    question: str = Field(min_length=12, max_length=2000)
    depth: Literal["quick", "standard", "deep"] = "standard"

    @field_validator("question")
    @classmethod
    def question_must_not_be_blank(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 12:
            raise ValueError("Please provide a more detailed research question.")
        return normalized
