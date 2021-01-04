#!/usr/bin/env bash

PYENV_HOME=$HOME/.pyenv

if [ -d $PYENV_HOME ]; then
    echo "[INFO] pyenv is already installed. Git pull to update"
    cd $PYENV_HOME
    git pull
    cd - >/dev/null 2>&1
    exit 0
else
    git clone https://github.com/pyenv/pyenv.git ~/.pyenv
fi