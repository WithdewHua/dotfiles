export PYENV_ROOT="$HOME/.pyenv"
pathprepend ${PYENV_ROOT}/bin

if command -v pyenv 1>/dev/null 2>&1; then
  eval "$(pyenv init -)"
fi
