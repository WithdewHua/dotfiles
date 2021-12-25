pathappend $HOME/.poetry/bin

mkdir -p ~/.zsh/completions
poetry completions zsh > ~/.zsh/completions/_poetry

