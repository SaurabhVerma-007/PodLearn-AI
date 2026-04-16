FROM python:3.11-slim

WORKDIR /app

COPY tts-server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY tts-server/ ./

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5001} --workers 2 --timeout 180 server:app"]
