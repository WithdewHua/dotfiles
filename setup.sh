#!/usr/bin/env bash
#
# withdewhua
# usage: ./setup.sh
#

echo -e "# =============================================================================================== #"
echo -e "#                                                                                                 #"
echo -e "#  __      __.__  __  .__         .___              ___ ___              ___________              #"
echo -e "# /  \    /  \__|/  |_|  |__    __| _/______  _  __/   |   \ __ _______  \_   _____/ _______  __  #"
echo -e "# \   \/\/   /  \   __\  |  \  / __ |/ __ \ \/ \/ /    ~    \  |  \__  \  |    __)_ /    \  \/ /  #"
echo -e "#  \        /|  ||  | |   Y  \/ /_/ \  ___/\     /\    Y    /  |  // __ \_|        \   |  \   /   #"
echo -e "#   \__/\  / |__||__| |___|  /\____ |\___  >\/\_/  \___|_  /|____/(____  /_______  /___|  /\_/    #"
echo -e "#        \/                \/      \/    \/              \/            \/        \/     \/        #"
echo -e "#                                                                                                 #"
echo -e "# =============================================================================================== #"

# --------------
# ENV PARAMETERS
# --------------

red='\033[0;31m'
green='\033[0;32m'
yellow='\033[0;33m'
plain='\033[0m'

IS_PIP3=0
IS_VIM=0
IS_GIT=0
IS_POETRY=0
IS_TMUX=0
IS_FZF=0
IS_PYENV=0

softwares=("pip3" "git" "vim" "poetry" "tmux" "fzf" "pyenv")

# ----------------
# Common Functions
# ----------------

ask() {
    while true; do
        read -p "$1 ([y]/n) " -r
        REPLY=${REPLY:-"y"}
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            return 1
        elif [[ $REPLY =~ ^[Nn]$ ]]; then
            return 0
        fi
    done
}

check_installed() {
    # bash >= 4.2
    for sw in "${softwares[@]}"; do
        flag="IS_${sw^^}" # bash >= 4.0
        # Notice the semicolon
        # Dynamic naming:
        # - https://stackoverflow.com/a/13717788/1276501
        # - https://stackoverflow.com/a/18124325/1276501
        check_single_installed ${sw}
        [ $? -eq 1 ] && { printf -v "${flag}" 1; }
        # type ${sw} >/dev/null 2>&1 && { printf -v "${flag}" 1; }
    done
}

check_single_installed() {
    type $1 > /dev/null 2>&1 && return 1 || return 0
}

create_symlinks() {
    # dotfile_src format such as zsh/zshrc or vim/vimrc
    dotfile_src=$1
    dotfile_dst=$2
    if [[ "$dotfile_dst" != /* ]]; then
        # relative path
        dotfile_dst=$HOME/$dotfile_dst
    fi
    if [ -e $dotfile_dst ]; then
        if [ -h $dotfile_dst ]; then
            rm $dotfile_dst
            ln -sf $PWD/$dotfile_src $dotfile_dst
            echo -e "[${green}INFO${plain}] Update existed symlink $dotfile_dst"
        else
            read -p "Delete existent ${dotfile_dst}? [Y/n]" _del
            if [ "$_del" = "Y" || "$_del" = "y" ]; then
                rm $dotfile_dst
                ln -sf $PWD/$dotfile_src $dotfile_dst
                echo -e "[${green}INFO${plain}] Create symlink $dotfile_dst"
            else
                echo -e "[${yellow}WARNING${plain}] Ignore due to $dotfile_dst exists and is not a symlink"
            fi
        fi
    else
        ln -sf $PWD/$dotfile_src $dotfile_dst
        echo -e "[${green}INFO${plain}] Create symlink $dotfile_dst"
    fi
}

install() {
    ask "Install ${1}?"
    [ $? -eq 1 ] && {
        "${@:2}"
        echo -e "[${green}INFO${plain}] Installed $1 successfully"
        sw="IS_${1^^}"
        { printf -v "${sw}" 1; }
    }
}

get_package_manager() {
    if grep -Eqi "debian|raspbian" /proc/version; then
        PKG="apt"
        INSTALL_PARAM='install -y'
    elif grep -Eqi "archlinux" /proc/version; then
        PKG="pacman"
        INSTALL_PARAM="-Sy --noconfirm"
    fi
}

get_current_user() {
    if [ `whoami` == "root" ]; then
        return 1
    else
        return 0
    fi
}

# -----------------
# Install Functions
# -----------------

install_bundle() {
    ask "Install bundle (including some useful applications)?"
    [ $? -eq 1 ] && {
        local os=$(uname)
        if [ $os == "Darwin" ]; then
            ./install/install_brew.sh && brew bundle install --file=./install/bundle/Brewfile
        elif [ $os == "Linux" ]; then
            get_package_manager
            get_current_user
            [ $? -eq 1 ] && cat ./install/bundle/Linuxbundle | xargs -n1 $PKG $INSTALL_PARAM || cat ./install/bundle/Linuxbundle | xargs -n1 sudo $PKG $INSTALL_PARAM
        fi
        check_single_installed pip3
        [ $? -eq 1 ] && pip3 install -r ./install/bundle/pipbundle
    }
}

install_fzf() {
    install fzf git clone --depth 1 https://github.com/junegunn/fzf.git ~/.fzf && ~/.fzf/install --key-bindings --completion --no-update-rc
}

install_pyenv() {
    install pyenv git clone https://github.com/pyenv/pyenv.git ~/.pyenv
}

install_poetry() {
    install poetry export POETRY_HOME=$HOME/.poetry && curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/install-poetry.py | python3 - 
}

# ----------------
# Config Functions
# ----------------

_config_shell() {
    mkdir -p $HOME/.zsh/tools $HOME/.zsh/completions
    create_symlinks "shell_config" ".zsh/shell_config"
    [ -d "$HOME/.pyenv" ] && create_symlinks "tools/pyenv.zsh" ".zsh/tools/pyenv.zsh"
    [ -d "$HOME/.poetry/bin" ] && create_symlinks "tools/poetry.zsh" ".zsh/tools/poetry.zsh"
    create_symlinks "tools/brew.zsh" ".zsh/tools/brew.zsh"
}

# VIM
config_vim() {
    create_symlinks "vim/vimrc" ".vimrc"
    type nvim > /dev/null 2>&1 && {
        ask "Use nvim with plugins?"
        [ $? -eq 1 ] && {
            mkdir -p $HOME/.config/nvim
            create_symlinks "vim/nvim/init.lua" ".config/nvim/init.lua"
            create_symlinks "vim/nvim/lua" ".config/nvim/lua"
            create_symlinks "vim/nvim/coc-settings.json" ".config/nvim/coc-settings.json"
        } || {
            mkdir -p $HOME/.config/nvim
            create_symlinks "vim/vimrc" ".config/nvim/init.vim"
        }
    }
}

# GIT
config_git() {
    create_symlinks "git/gitconfig" ".gitconfig"
    create_symlinks "git/gitignore" ".gitignore_global"
}

# ZSH
config_zsh() {
    # ask "Config p10k theme with fonts?"
    # if [ $? -eq 1 ]; then
    #     create_symlinks "zsh/p10k_with_font.zsh" ".p10k.zsh"
    # elif [ $? -eq 0 ]; then
    #     create_symlinks "zsh/p10k_non_font.zsh" ".p10k.zsh"
    # fi

    # install starship
    sh -c "$(curl -fsSL https://starship.rs/install.sh)" -- -y
    create_symlinks "zsh/zshrc" ".zshrc"
    # create_symlinks "zsh/zshenv" ".zshenv"
    _config_shell
}

# PIP
config_pip() {
    [ -d ${HOME}/.pip ] || {
        mkdir $HOME/.pip
        echo -e "[${green}INFO${plain}] mkdir $HOME/.pip"
    }
    create_symlinks "pip/pip.conf" ".pip/pip.conf"
    ask "Symlink python code formatter?"
    [ $? -eq 1 ] && {
        create_symlinks "pip/flake8" ".config/flake8"
        create_symlinks "pip/black" ".config/black"
        create_symlinks "pip/isort.cfg" ".isort.cfg"
    }
}

# Tmux
config_tmux() {
    if [ -d ~/.tmux/plugins/tpm ]; then
        echo -e "[${green}INFO${plain}] tmux plugin manager is already installed. Git pull to update..."
        git -C ~/.tmux/plugins/tpm pull
    else
        echo -e "[${green}INFO${plain}] Installing tmux plugin tmp"
        git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
    fi
    create_symlinks "tmux/tmux.conf" ".tmux.conf"
}

# Alacritty
config_alacritty() {
    ask "Config alacritty?"
    [ $? -eq 1 ] && mkdir -p $HOME/.config/alacritty && create_symlinks "alacritty/alacritty.yml" ".config/alacritty/alacritty.yml"
}

# -----
# MAIN
# -----

echo -e "[SETUP START]"

install_bundle
check_installed
[ $IS_VIM -eq 1 ] && config_vim
[ $IS_GIT -eq 1 ] && config_git
[ $IS_PIP3 -eq 1 ] && config_pip
[ $IS_TMUX -eq 1 ] && config_tmux
[ $IS_PYENV -eq 0 ] && install_pyenv
[ $IS_POETRY -eq 0 ] && install_poetry
[ $IS_FZF -eq 0 ] && install_fzf
config_alacritty
config_zsh && exec zsh

echo -e "[SETUP END]"
