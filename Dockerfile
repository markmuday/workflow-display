FROM python:3.13

ENV PYTHONUNBUFFERED True

RUN mkdir /app
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8081
CMD ["gunicorn", "run:app", "--bind", "0.0.0.0:8081", "--timeout", "60"]
