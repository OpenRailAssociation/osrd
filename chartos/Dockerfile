FROM python:3.10-alpine

RUN apk add --no-cache libffi-dev build-base cargo

RUN pip install poetry

# Copy only requirements to cache them in docker layer
WORKDIR /code

COPY poetry.lock pyproject.toml /code/

RUN poetry config virtualenvs.create false \
  && poetry install --without dev --no-interaction --no-ansi

# Creating folders, and files for a project:
COPY . /code

ARG OSRD_GIT_DESCRIBE
ENV OSRD_GIT_DESCRIBE=${OSRD_GIT_DESCRIBE}
ENV CONFIG_PATH=/code/chartos.yml

CMD ["uvicorn", "--factory", "chartos:make_app", "--host", "0.0.0.0"]
