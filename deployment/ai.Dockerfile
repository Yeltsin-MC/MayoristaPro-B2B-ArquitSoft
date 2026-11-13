FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 AI_HOST=0.0.0.0 AI_PORT=5000
COPY apps/ai-service/requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt
COPY apps/ai-service/main.py ./
RUN useradd --create-home --uid 10001 app
USER app
CMD ["python", "main.py"]
