FROM python:3.9.7-buster

RUN useradd --create-home service

RUN apt-get update -yqq
RUN apt-get install -yqq --no-install-recommends binutils libproj-dev gdal-bin curl
RUN apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false \
  && rm -rf /var/lib/apt/lists/*


WORKDIR /home/service

RUN pip install --no-cache-dir poetry==1.1.8

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=off

COPY poetry.lock pyproject.toml /home/service/

ARG environment=prod

RUN poetry config virtualenvs.create false && \
    if [ "${environment}" = prod ]; then \
        poetry install --no-dev --no-interaction --no-ansi --no-root -E production; \
    else \
        poetry install --no-interaction --no-ansi --no-root; \
    fi

USER service

COPY . /home/service

EXPOSE 8000

CMD ["gunicorn", "config.asgi", \
     "--bind", ":8000", \
     "--worker-class", "config.workers.UvicornWorker", \
     "--workers", "6", \
     "--keep-alive", "10", \
     "--capture-output", \
     "--log-level=info", \
     "--log-file", "-", \
     "--error-logfile", "-", \
     "--max-requests", "500", \
     "--max-requests-jitter", "150", \
     "--access-logfile", "-"]
