#!/bin/bash

POETRY_HOME=$HOME/.poetry

if [ -d ${POETRY_HOME} ]; then
    echo "[INFO] poetry is already installed."
    exit 1
else
    curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | python3 -
fi