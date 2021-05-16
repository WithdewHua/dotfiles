export PYENV_ROOT="$HOME/.pyenv"
pathprepend ${PYENV_ROOT}/bin

eval "$(pyenv init --path)"

eval "$(pyenv init -)"
