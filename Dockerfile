FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    LEONARDO_CONFIG=/app/config.yml \
    LEONARDO_OUT=/data

RUN useradd --create-home --uid 1000 leonardo && mkdir -p /data && chown leonardo /data
WORKDIR /app

COPY pyproject.toml README.md LICENSE ./
COPY leonardo ./leonardo
COPY config.yml ./
# Wheels only: no compiler in the image, and a missing arm64 wheel fails the build loudly.
RUN pip install --only-binary=:all: --no-compile . && pip check

USER leonardo
VOLUME ["/data"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/').status==200 else 1)"

CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:8000", "--timeout", "120", "leonardo.web.app:server"]
