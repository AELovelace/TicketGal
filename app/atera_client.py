import re
from typing import Any, Dict, Optional
from urllib.parse import quote

import httpx

from .config import settings


class AteraApiError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class AteraClient:
    def __init__(self) -> None:
        self.base_url = settings.atera_base_url
        self.api_key = settings.atera_api_key
        # Explicit allowlist: only operations TicketGal requires.
        self._allowed_patterns = [
            ("GET", re.compile(r"^/api/v3/tickets$")),
            ("POST", re.compile(r"^/api/v3/tickets$")),
            ("GET", re.compile(r"^/api/v3/tickets/\d+$")),
            ("PUT", re.compile(r"^/api/v3/tickets/\d+$")),
            ("POST", re.compile(r"^/api/v3/tickets/\d+/comments$")),
            ("GET", re.compile(r"^/api/v3/tickets/\d+/comments$")),
            ("GET", re.compile(r"^/api/v3/customers$")),
            ("GET", re.compile(r"^/api/v3/alerts$")),
            ("POST", re.compile(r"^/api/v3/alerts/[^/]+/dismiss$")),
            ("POST", re.compile(r"^/api/v3/alerts/[^/]+/resolve$")),
            ("PUT", re.compile(r"^/api/v3/alerts/[^/]+$")),
            ("DELETE", re.compile(r"^/api/v3/alerts/[^/]+$")),
        ]

    def _is_request_allowed(self, method: str, path: str) -> bool:
        method_upper = method.upper()
        normalized_path = path.split("?", 1)[0].strip()
        return any(
            allowed_method == method_upper and allowed_path.fullmatch(normalized_path)
            for allowed_method, allowed_path in self._allowed_patterns
        )

    def _headers(self) -> Dict[str, str]:
        if not self.api_key:
            raise AteraApiError(500, "ATERA_API_KEY is not configured on the server.")
        return {
            "X-API-KEY": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
    ) -> Any:
        if not self._is_request_allowed(method, path):
            raise AteraApiError(
                403,
                f"Blocked by safety policy: '{method.upper()} {path}' is not an allowed Atera operation.",
            )

        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.request(
                method=method,
                url=url,
                headers=self._headers(),
                params=params,
                json=json,
            )

        if response.status_code >= 400:
            raise AteraApiError(response.status_code, response.text)

        if not response.content:
            return {"ok": True}

        return response.json()

    async def list_tickets(
        self,
        page: int,
        items_in_page: int,
        customer_id: Optional[int],
        ticket_status: Optional[str],
        include_relations: bool,
    ) -> Any:
        params: Dict[str, Any] = {
            "page": page,
            "itemsInPage": items_in_page,
            "includeRelations": include_relations,
        }
        if customer_id is not None:
            params["customerId"] = customer_id
        if ticket_status:
            params["ticketStatus"] = ticket_status

        return await self._request("GET", "/api/v3/tickets", params=params)

    async def list_properties(self, page: int = 1, items_in_page: int = 500) -> Any:
        params = {"page": page, "itemsInPage": items_in_page}
        return await self._request("GET", "/api/v3/customers", params=params)

    async def list_alerts(self) -> Any:
        return await self._request("GET", "/api/v3/alerts")

    async def dismiss_alert(self, alert_id: str) -> Any:
        encoded_alert_id = quote(str(alert_id).strip(), safe="")
        attempts = [
            ("POST", f"/api/v3/alerts/{encoded_alert_id}/dismiss", None),
            ("POST", f"/api/v3/alerts/{encoded_alert_id}/resolve", None),
            ("PUT", f"/api/v3/alerts/{encoded_alert_id}", {"AlertStatus": "Dismissed"}),
            ("DELETE", f"/api/v3/alerts/{encoded_alert_id}", None),
        ]

        last_exc: Optional[AteraApiError] = None
        for method, path, payload in attempts:
            try:
                return await self._request(method, path, json=payload)
            except AteraApiError as exc:
                last_exc = exc
                if exc.status_code in {400, 404, 405, 422}:
                    continue
                raise

        if last_exc:
            raise last_exc
        raise AteraApiError(500, "Unable to dismiss alert")

    async def create_ticket(self, payload: Dict[str, Any]) -> Any:
        return await self._request("POST", "/api/v3/tickets", json=payload)

    async def get_ticket(self, ticket_id: int) -> Any:
        return await self._request("GET", f"/api/v3/tickets/{ticket_id}")

    async def update_ticket(self, ticket_id: int, payload: Dict[str, Any]) -> Any:
        return await self._request("PUT", f"/api/v3/tickets/{ticket_id}", json=payload)

    async def add_comment(self, ticket_id: int, payload: Dict[str, Any]) -> Any:
        return await self._request("POST", f"/api/v3/tickets/{ticket_id}/comments", json=payload)

    async def list_ticket_comments(self, ticket_id: int, page: int = 1, items_in_page: int = 50) -> Any:
        params = {"page": page, "itemsInPage": items_in_page}
        return await self._request("GET", f"/api/v3/tickets/{ticket_id}/comments", params=params)
