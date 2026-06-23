from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.presenters.response_presenter import error_response


class EduFXError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(EduFXError)
    async def handle_edufx_error(_: Request, exc: EduFXError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(exc.message).model_dump(),
        )

    @app.exception_handler(Exception)
    async def handle_generic_error(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content=error_response(f"Unexpected error: {exc}").model_dump(),
        )

