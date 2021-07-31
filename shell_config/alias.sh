alias l='ls -lahF'
type exa > /dev/null 2>&1 && {
    alias ls='exa'
    alias tree='exa -T'
}


# vim/nvim
type nvim > /dev/null 2>&1 && alias vim='nvim'

# trash-cli
type trash > /dev/null 2>&1 && alias rm='trash'
