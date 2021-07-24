# brew
if [ "$(uname)" = "Darwin" ]; then
    # arm mac
    [ -d "/opt/homebrew" ] && pathprepend_f "/opt/homebrew/bin"
fi

if type brew &> /dev/null; then
    FPATH=$(brew --prefix)/share/zsh/site-functions:$FPATH
    # > python-build
    BREW_PREFIX=$(brew --prefix)
    export HOMEBREW_NO_AUTO_UPDATE=true
    export CFLAGS="-I${BREW_PREFIX}/opt/zlib/include -I${BREW_PREFIX}/opt/sqlite/include -I${BREW_PREFIX}/opt/bzip2/include -I${BREW_PREFIX}/opt/openssl/include -I${BREW_PREFIX}/opt/readline/include -I$(xcrun --show-sdk-path)/usr/include"
    export LDFLAGS="-L${BREW_PREFIX}/opt/openssl/lib -L${BREW_PREFIX}/opt/readline/lib -L${BREW_PREFIX}/opt/bzip2/lib -L${BREW_PREFIX}/opt/zlib/lib -L${BREW_PREFIX}/opt/sqlite/lib"
fi
