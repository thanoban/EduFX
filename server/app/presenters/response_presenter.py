from typing import Any

from app.models.dto import ApiResponse


def success_response(data: Any, message: str = "Request completed") -> ApiResponse[Any]:
    return ApiResponse(success=True, message=message, data=data)


def error_response(message: str) -> ApiResponse[None]:
    return ApiResponse(success=False, message=message, data=None)
