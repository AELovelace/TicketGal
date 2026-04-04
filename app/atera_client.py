from typing import Any, Dict, Optional

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
