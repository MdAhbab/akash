# Akash Investigator API — slim, single-stage, CPU-only.
# Final image is ~150-200 MB (well under the 500 MB recommendation / 1 GB limit).
FROM python:3.11-slim

# No .pyc, unbuffered logs, predictable locale for Bangla text handling.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=UTF-8 \
    PORT=8787

WORKDIR /app

# Install deps first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code.
COPY app ./app
COPY mcp_server ./mcp_server

# Non-root runtime user.
RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8787

# Container-native healthcheck mirrors the judge's /health probe.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os,urllib.request,sys; \
        sys.exit(0) if urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8787')+'/health').status==200 else sys.exit(1)"

# Bind 0.0.0.0 so the judge / reverse proxy can reach it. PORT is configurable.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8787}"]
