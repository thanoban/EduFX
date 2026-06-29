from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote

import httpx


@dataclass
class SimpleSupabaseResponse:
    data: Any


@dataclass
class SimpleSupabaseQuery:
    base_url: str
    headers: dict[str, str]
    table_name: str
    operation: str = "select"
    payload: Any = None
    params: dict[str, str] = field(default_factory=dict)
    prefer_headers: list[str] = field(default_factory=list)

    def select(self, columns: str) -> SimpleSupabaseQuery:
        self.operation = "select"
        self.params["select"] = columns
        return self

    def insert(self, payload: Any) -> SimpleSupabaseQuery:
        self.operation = "insert"
        self.payload = payload
        self.prefer_headers = ["return=representation"]
        return self

    def upsert(self, payload: Any, on_conflict: str | None = None) -> SimpleSupabaseQuery:
        self.operation = "upsert"
        self.payload = payload
        self.prefer_headers = ["resolution=merge-duplicates", "return=representation"]
        if on_conflict:
            self.params["on_conflict"] = on_conflict
        return self

    def update(self, payload: Any) -> SimpleSupabaseQuery:
        self.operation = "update"
        self.payload = payload
        self.prefer_headers = ["return=representation"]
        return self

    def eq(self, column: str, value: Any) -> SimpleSupabaseQuery:
        self.params[column] = f"eq.{value}"
        return self

    def in_(self, column: str, values: list[Any]) -> SimpleSupabaseQuery:
        encoded_values = ",".join(str(value) for value in values)
        self.params[column] = f"in.({encoded_values})"
        return self

    def limit(self, value: int) -> SimpleSupabaseQuery:
        self.params["limit"] = str(value)
        return self

    def order(self, column: str, desc: bool = False) -> SimpleSupabaseQuery:
        direction = "desc" if desc else "asc"
        self.params["order"] = f"{column}.{direction}"
        return self

    def execute(self) -> SimpleSupabaseResponse:
        url = f"{self.base_url}/rest/v1/{quote(self.table_name)}"
        headers = dict(self.headers)
        if self.prefer_headers:
            headers["Prefer"] = ",".join(self.prefer_headers)

        with httpx.Client(timeout=30) as client:
            if self.operation == "select":
                response = client.get(url, headers=headers, params=self.params)
            elif self.operation == "insert":
                response = client.post(url, headers=headers, params=self.params, json=self.payload)
            elif self.operation == "upsert":
                response = client.post(url, headers=headers, params=self.params, json=self.payload)
            elif self.operation == "update":
                response = client.patch(url, headers=headers, params=self.params, json=self.payload)
            else:
                raise ValueError(f"Unsupported Supabase operation: {self.operation}")

        response.raise_for_status()
        if not response.content:
            return SimpleSupabaseResponse(data=[])
        return SimpleSupabaseResponse(data=response.json())


@dataclass
class SimpleSupabaseRpcCall:
    base_url: str
    headers: dict[str, str]
    function_name: str
    payload: dict[str, Any]

    def execute(self) -> SimpleSupabaseResponse:
        url = f"{self.base_url}/rest/v1/rpc/{quote(self.function_name)}"
        with httpx.Client(timeout=45) as client:
            response = client.post(url, headers=self.headers, json=self.payload)
        response.raise_for_status()
        if not response.content:
            return SimpleSupabaseResponse(data=[])
        return SimpleSupabaseResponse(data=response.json())


@dataclass
class SimpleSupabaseClient:
    base_url: str
    api_key: str

    @property
    def headers(self) -> dict[str, str]:
        return {
            "apikey": self.api_key,
            "Content-Type": "application/json",
        }

    def table(self, table_name: str) -> SimpleSupabaseQuery:
        return SimpleSupabaseQuery(base_url=self.base_url, headers=self.headers, table_name=table_name)

    def rpc(self, function_name: str, payload: dict[str, Any]) -> SimpleSupabaseRpcCall:
        return SimpleSupabaseRpcCall(
            base_url=self.base_url,
            headers=self.headers,
            function_name=function_name,
            payload=payload,
        )
