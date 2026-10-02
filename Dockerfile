# Builds the UI and serves it from the Flask API in a single container (for Cloud Run).
FROM node:22 AS ui
WORKDIR /ui
COPY ui/package*.json ./
RUN npm ci
COPY ui/ .
RUN npm run build

FROM python:3.13-slim
ENV PYTHONUNBUFFERED=True
WORKDIR /app
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY api/ .
COPY --from=ui /ui/dist ./static
ENV PORT=8081
CMD exec gunicorn run:app --bind 0.0.0.0:$PORT --timeout 60 --workers 2
