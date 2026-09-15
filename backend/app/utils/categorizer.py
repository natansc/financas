import re
from typing import Optional

CATEGORY_RULES = [
    (re.compile(r"ifood", re.I), "Alimentação"),
    (re.compile(r"uber", re.I), "Transporte"),
    (re.compile(r"outback", re.I), "Restaurante"),
    (re.compile(r"mercado|supermercado|carrefour|extra", re.I), "Supermercado"),
    (re.compile(r"petrobras|posto", re.I), "Combustível"),
]

def categorize_description(description: str) -> Optional[str]:
    if not description:
        return None
    for regex, category in CATEGORY_RULES:
        if regex.search(description):
            return category
    return None
