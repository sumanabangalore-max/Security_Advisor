FROM python:3.10-slim

WORKDIR /app

# Install system dependencies needed for compiling certain libraries
RUN apt-get update -o Acquire::Retries=3 \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        gcc \
        g++ \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Create directory for inventory mounting
RUN mkdir -p /app/inventory

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
