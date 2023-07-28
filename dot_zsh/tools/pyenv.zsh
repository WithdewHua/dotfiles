export PYENV_ROOT="$HOME/.pyenv"
pathprepend ${PYENV_ROOT}/bin

eval "$(pyenv init -)"

eval "$(pyenv virtualenv-init -)"

source $(pyenv root)/completions/pyenv.zsh
