from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ManualTransactionCreate(BaseModel):
    account_id: str
    category_id: Optional[str] = None
    description: Optional[str] = None
    amount: float
    date: datetime

class DashboardResponse(BaseModel):
    total_balance: float
    expenses_by_category: List[dict]
    open_invoices: List[dict]
