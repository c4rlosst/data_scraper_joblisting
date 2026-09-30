from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Job:
    source: str
    external_id: str
    title: str
    company: str
    url: str
    location: str = ""
    remote: bool = False
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    posted_at: Optional[datetime] = None
    description: str = ""

    @property
    def key(self) -> str:
        return f"{self.source}:{self.external_id}"
