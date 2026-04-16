FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

COPY tts-server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY tts-server/ ./

ENV PYTHONUNBUFFERED=1
EXPOSE 5001

CMD ["python", "server.py"]
