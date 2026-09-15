from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlmodel import SQLModel
from sqlalchemy import text
from ..db.session import engine
from ..models.orm_models import Transaction, Account, Category
from ..utils.categorizer import categorize_description
from uuid import UUID, uuid4
import json

def upsert_transactions(transactions: List[Dict[str, Any]]):
    """
    Insere ou atualiza transações evitando duplicidade via pluggy_transaction_id.
    """
    with engine.begin() as conn:
        for tx in transactions:
            pluggy_id = tx.get("pluggy_transaction_id")
            account_pluggy_id = tx.get("account_pluggy_id")
            description = tx.get("description")
            amount = tx.get("amount")
            date = tx.get("date")
            raw_payload = tx.get("raw_payload", {})

            # Busca a conta relacionada pelo ID do Pluggy
            account_row = conn.execute(
                text("SELECT id FROM accounts WHERE pluggy_account_id = :pid"),
                {"pid": account_pluggy_id}
            ).fetchone()

            if not account_row:
                # Cria conta padrao caso ainda nao exista
                res = conn.execute(
                    text("INSERT INTO accounts (id, name, type, balance, pluggy_account_id) VALUES (:id, :name, 'CHECKING', 0, :pid) RETURNING id"),
                    {"id": str(uuid4()), "name": f"Conta {account_pluggy_id}", "pid": account_pluggy_id}
                )
                account_id = res.fetchone()[0]
            else:
                account_id = account_row[0]

            # Categorizacao automatica por regras
            category_name = categorize_description(description or "")
            category_id = None
            if category_name:
                cat_row = conn.execute(
                    text("SELECT id FROM categories WHERE name = :name"),
                    {"name": category_name}
                ).fetchone()

                if not cat_row:
                    res = conn.execute(
                        text("INSERT INTO categories (id, name, type) VALUES (:id, :name, 'EXPENSE') RETURNING id"),
                        {"id": str(uuid4()), "name": category_name}
                    )
                    category_id = res.fetchone()[0]
                else:
                    category_id = cat_row[0]

            # Upsert com prevencao de duplicatas (ON CONFLICT)
            if pluggy_id:
                insert_sql = text("""
                INSERT INTO transactions (id, account_id, category_id, description, amount, date, is_manual, pluggy_transaction_id, raw_payload)
                VALUES (:id, :account_id, :category_id, :description, :amount, :date, false, :pluggy_id, :raw_payload::jsonb)
                ON CONFLICT (pluggy_transaction_id) DO UPDATE
                  SET description = EXCLUDED.description,
                      amount = EXCLUDED.amount,
                      date = EXCLUDED.date,
                      category_id = COALESCE(EXCLUDED.category_id, transactions.category_id),
                      raw_payload = transactions.raw_payload || EXCLUDED.raw_payload
                """)
                params = {
                    "id": str(uuid4()),
                    "account_id": str(account_id),
                    "category_id": str(category_id) if category_id else None,
                    "description": description,
                    "amount": amount,
                    "date": date,
                    "pluggy_id": pluggy_id,
                    "raw_payload": json.dumps(raw_payload)
                }
                conn.execute(insert_sql, params)
            else:
                conn.execute(
                    text("""
                    INSERT INTO transactions (id, account_id, category_id, description, amount, date, is_manual, raw_payload)
                    VALUES (:id, :account_id, :category_id, :description, :amount, :date, false, :raw_payload::jsonb)
                    """),
                    {
                        "id": str(uuid4()),
                        "account_id": str(account_id),
                        "category_id": str(category_id) if category_id else None,
                        "description": description,
                        "amount": amount,
                        "date": date,
                        "raw_payload": json.dumps(raw_payload)
                    }
                )

def fetch_and_upsert_for_account(pluggy_client, pluggy_account_id: str):
    txs = pluggy_client.fetch_transactions_for_account(pluggy_account_id)
    normalized = []
    for t in txs:
        normalized.append({
            "pluggy_transaction_id": t.get("id") or t.get("transactionId"),
            "account_pluggy_id": pluggy_account_id,
            "description": t.get("description") or t.get("narration"),
            "amount": float(t.get("amount") or 0),
            "date": t.get("date") or t.get("createdAt"),
            "raw_payload": t
        })
    upsert_transactions(normalized)