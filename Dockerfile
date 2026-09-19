FROM python:3.12-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:0.5.30 /uv /bin/uv

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH=/app/.venv/bin:$PATH \
    LEONARDO_CONFIG=/app/config.yml \
    LEONARDO_OUT=/data

RUN useradd --create-home --uid 1000 leonardo && mkdir -p /data && chown leonardo /data
WORKDIR /app

# Dependencies first (cached layer). Wheels only: no compiler in the image, and a
# missing arm64 wheel fails the build loudly.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project --no-build

COPY README.md LICENSE config.yml ./
COPY leonardo ./leonardo
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-editable && uv pip check

USER leonardo
VOLUME ["/data"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/').status==200 else 1)"

CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:8000", "--timeout", "120", "leonardo.web.app:server"]
