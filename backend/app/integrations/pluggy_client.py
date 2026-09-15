import time
import requests
from typing import Dict, Any, List, Optional
from ..config import settings

class PluggyClient:
    def __init__(self, client_id: str, client_secret: str, base_url: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.base_url = base_url.rstrip("/")
        self._token: Optional[str] = None
        self._token_expiry: float = 0.0

    def _auth(self):
        if self._token and time.time() < self._token_expiry:
            return self._token
        url = f"{self.base_url}/auth"
        payload = {"client_id": self.client_id, "client_secret": self.client_secret}
        resp = requests.post(url, json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        # Ajuste conforme resposta real do Pluggy
        token = data.get("access_token") or data.get("apiKey") or data.get("token")
        expires_in = data.get("expires_in", settings.PLUGGY_TOKEN_TTL)
        self._token = token
        self._token_expiry = time.time() + expires_in - 10
        return self._token

    def _headers(self):
        token = self._auth()
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def fetch_transactions_for_account(self, pluggy_account_id: str) -> List[Dict[str, Any]]:
        """
        Exemplo: GET /accounts/{accountId}/transactions
        Ajuste o path conforme a API real do Pluggy.
        """
        url = f"{self.base_url}/accounts/{pluggy_account_id}/transactions"
        resp = requests.get(url, headers=self._headers(), timeout=20)
        resp.raise_for_status()
        return resp.json().get("transactions", resp.json())
