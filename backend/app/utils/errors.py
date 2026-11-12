import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("fitai")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_exc(_: Request, exc: StarletteHTTPException):
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def validation_exc(_: Request, exc: RequestValidationError):
        errors = []
        for e in exc.errors():
            loc = ".".join(str(p) for p in e.get("loc", []) if p != "body")
            errors.append({"field": loc, "message": e.get("msg", "Invalid value")})
        msg = errors[0]["message"] if errors else "Invalid input"
        if errors and errors[0]["field"]:
            msg = f"{errors[0]['field']}: {msg}"
        return JSONResponse({"detail": msg, "errors": errors}, status_code=422)

    @app.exception_handler(ValueError)
    async def value_exc(_: Request, exc: ValueError):
        return JSONResponse({"detail": str(exc)}, status_code=400)

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception):
        log.exception("Unhandled error: %s", type(exc).__name__)
        return JSONResponse({"detail": "Something went wrong on our side. Please try again."}, status_code=500)
