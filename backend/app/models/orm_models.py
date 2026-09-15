from typing import Optional
from uuid import uuid4, UUID
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship, Column, JSON
from sqlalchemy import DECIMAL, String, CheckConstraint, UniqueConstraint, TIMESTAMP

class Account(SQLModel, table=True):
    __tablename__ = "accounts"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    type: str = Field(sa_column=Column(String, nullable=False))
    balance: float = Field(default=0.0, sa_column=Column(DECIMAL(12,2), nullable=False))
    pluggy_account_id: Optional[str] = Field(default=None, sa_column=Column(String, unique=True))

    # constraints
    __table_args__ = (
        CheckConstraint("type IN ('CHECKING','CREDIT_CARD','CASH')", name="account_type_check"),
    )

class Category(SQLModel, table=True):
    __tablename__ = "categories"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    icon: Optional[str] = None
    color_hex: Optional[str] = None
    type: str = Field(sa_column=Column(String, nullable=False))
    __table_args__ = (
        CheckConstraint("type IN ('INCOME','EXPENSE')", name="category_type_check"),
    )

class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    account_id: UUID = Field(foreign_key="accounts.id", nullable=False)
    category_id: Optional[UUID] = Field(default=None, foreign_key="categories.id")
    description: Optional[str] = Field(default=None, sa_column=Column(String))
    amount: float = Field(sa_column=Column(DECIMAL(12,2), nullable=False))
    date: datetime = Field(sa_column=Column(TIMESTAMP(timezone=True), nullable=False))
    is_manual: bool = Field(default=False)
    pluggy_transaction_id: Optional[str] = Field(default=None, sa_column=Column(String(255), unique=True))
    raw_payload: Optional[dict] = Field(default=None, sa_column=Column(JSON))

    __table_args__ = (
        UniqueConstraint("pluggy_transaction_id", name="uq_transactions_pluggy_id"),
    )
