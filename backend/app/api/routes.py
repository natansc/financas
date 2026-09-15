from fastapi import APIRouter, Depends, HTTPException
from ..schemas.pydantic_schemas import ManualTransactionCreate, DashboardResponse
from ..integrations.pluggy_client import PluggyClient
from ..config import settings
from ..services.transactions_service import fetch_and_upsert_for_account, upsert_transactions
from ..db.session import engine
from sqlalchemy import text
from typing import List
from datetime import datetime

router = APIRouter()

pluggy_client = PluggyClient(settings.PLUGGY_CLIENT_ID, settings.PLUGGY_CLIENT_SECRET, settings.PLUGGY_BASE_URL)

@router.post("/sync")
def sync_all():
    """
    Força sincronização: busca todas as contas com pluggy_account_id e sincroniza.
    """
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT pluggy_account_id FROM accounts WHERE pluggy_account_id IS NOT NULL")).fetchall()
        for r in rows:
            pluggy_account_id = r[0]
            try:
                fetch_and_upsert_for_account(pluggy_client, pluggy_account_id)
            except Exception as e:
                # Log e continue
                print("Erro sync account", pluggy_account_id, e)
    return {"status": "ok"}

@router.get("/dashboard", response_model=DashboardResponse)
def dashboard():
    """
    Retorna resumo: saldo total, despesas por categoria e faturas do mês.
    """
    with engine.begin() as conn:
        # total balance: sum of account balances + pending credit card installments (simplified)
        total_balance_row = conn.execute(text("SELECT COALESCE(SUM(balance),0) FROM accounts")).fetchone()
        total_balance = float(total_balance_row[0] or 0)

        # expenses by category (last 30 days)
        expenses = conn.execute(text("""
            SELECT c.name, COALESCE(SUM(t.amount),0) as total
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.amount < 0 AND t.date >= now() - interval '30 days'
            GROUP BY c.name
            ORDER BY total DESC
        """)).fetchall()
        expenses_by_category = [{"category": r[0] or "Sem categoria", "total": float(r[1])} for r in expenses]

        # open invoices: for credit card accounts, sum of negative amounts in current month
        invoices = conn.execute(text("""
            SELECT a.name as account_name, COALESCE(SUM(t.amount),0) as total
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.type = 'CREDIT_CARD' AND date_trunc('month', t.date) = date_trunc('month', now())
            GROUP BY a.name
        """)).fetchall()
        open_invoices = [{"account": r[0], "total": float(r[1])} for r in invoices]

    return {
        "total_balance": total_balance,
        "expenses_by_category": expenses_by_category,
        "open_invoices": open_invoices
    }

@router.post("/transactions/manual")
def create_manual_transaction(payload: ManualTransactionCreate):
    """
    Cria transação manual. Gera internal UUID e marca is_manual = true.
    """
    with engine.begin() as conn:
        # Insert transaction
        res = conn.execute(text("""
            INSERT INTO transactions (id, account_id, category_id, description, amount, date, is_manual, raw_payload)
            VALUES (uuid_generate_v4(), :account_id, :category_id, :description, :amount, :date, true, :raw_payload::jsonb)
            RETURNING id
        """), {
            "account_id": payload.account_id,
            "category_id": payload.category_id,
            "description": payload.description,
            "amount": payload.amount,
            "date": payload.date.isoformat(),
            "raw_payload": "{}"
        })
        tx_id = res.fetchone()[0]
    return {"id": str(tx_id)}
