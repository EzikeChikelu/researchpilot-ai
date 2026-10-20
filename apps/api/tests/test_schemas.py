import pytest
from pydantic import ValidationError

from app.schemas import ResearchRequest


def test_research_request_trims_question_and_sets_default_depth() -> None:
    request = ResearchRequest(question="  Explain AI research agents  ")

    assert request.question == "Explain AI research agents"
    assert request.depth == "standard"


@pytest.mark.parametrize("depth", ["quick", "standard", "deep"])
def test_research_request_accepts_supported_depths(depth: str) -> None:
    request = ResearchRequest(question="Explain how AI research agents work", depth=depth)

    assert request.depth == depth


def test_research_request_rejects_short_question() -> None:
    with pytest.raises(ValidationError):
        ResearchRequest(question="Too short")


def test_research_request_rejects_unknown_depth() -> None:
    with pytest.raises(ValidationError):
        ResearchRequest(question="Explain how AI research agents work", depth="massive")
