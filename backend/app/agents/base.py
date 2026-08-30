"""Agent base class."""
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    def __init__(self, name: str):
        self.name = name
        self.thinking_steps: list[str] = []

    def think(self, step: str) -> None:
        self.thinking_steps.append(step)
        logger.info(f"[{self.name}] {step}")

    def reset(self) -> None:
        self.thinking_steps = []

    @abstractmethod
    def process(self, user_input: str, project_id: str = None, **kwargs) -> dict:
        ...
