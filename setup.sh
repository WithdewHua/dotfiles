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

OH_MY_ZSH=$HOME"/.oh-my-zsh"
ZSH_CUSTOM=$OH_MY_ZSH"/custom"
POETRY_PLUGIN=$ZSH_CUSTOM"/plugins/poetry"

IS_BASH=0
IS_ZSH=0
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

# Choose shell
choose_shell() {
    ask "Choose shell, yes for zsh and no for bash:"
    if [ $? -eq 0 ]; then
        IS_BASH=1
    elif [ $? -eq 1 ]; then
        IS_ZSH=1
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
    fi
}

# -----------------
# Install Functions
# -----------------

install_bundle() {
    ask "Install bundle (including some useful applications)?"
    [ $? -eq 1 ] && {
        local os=$uname
        if [ $os == "Darwin" ]; then
            ./install/install_brew.sh && brew bundle install --file=./install/bundle/Brewfile
        elif [ $os == "Linux" ]; then
            get_package_manager
            cat ./install/bundle/Linuxbundle | xargs -n1 $PKG $INSTALL_PARAM
        fi
        check_single_installed pip3
        [ $? -eq 1 ] && pip3 install -r ./install/bundle/pipbundle
    }
}

install_oh_my_zsh() {
    # oh-my-zsh
    if [ -d "${OH_MY_ZSH}" ]; then
        echo -e "[${green}INFO${plain}] ${OH_MY_ZSH} exists. Update..."
        git -C ${OH_MY_ZSH} pull
    else
        echo -e "[${green}INFO${plain}] ${OH_MY_ZSH} does not exist. Install..."
        sh -c "$(wget https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh -O -)"
    fi

    # oh-my-zsh theme
    if [ -d ${ZSH_CUSTOM}/themes/powerlevel10k ]; then
        echo -e "[${green}INFO${plain}] powerlevel10k is already installed. Git pull to update..."
        git -C ${ZSH_CUSTOM}/themes/powerlevel10k pull
    else
        echo -e "[${green}INFO${plain}] Installing theme p10k"
        git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM}/themes/powerlevel10k
    fi

    # oh-my-zsh plugin
    # > zsh-syntax-highlighting
    if [ -d ${ZSH_CUSTOM}/plugins/zsh-syntax-highlighting ]; then
        echo -e "[${green}INFO${plain}] zsh-syntax-highlighting is already installed. Git pull to update..."
        git -C ${ZSH_CUSTOM}/plugins/zsh-syntax-highlighting pull
    else
        echo -e "[${green}INFO${plain}] Installing plugin zsh-syntax-highlighting"
        git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM}/plugins/zsh-syntax-highlighting
    fi
    # > zsh-autosuggestions
    if [ -d ${ZSH_CUSTOM}/plugins/zsh-autosuggestions ]; then
        echo -e "[${green}INFO${plain}] zsh-autosuggestions is already installed. Git pull to update..."
        git -C ${ZSH_CUSTOM}/plugins/zsh-autosuggestions pull
    else
        echo -e "[${green}INFO${plain}] Installing plugin zsh-autosuggestions"
        git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM}/plugins/zsh-autosuggestions
    fi
    # > poetry completions
    if [ $IS_POETRY -eq 1 ]; then
        if [ -d "${POETRY_PLUGIN}" ]; then
            echo -e "[${green}INFO${plain}] zsh-poetry is already installed"
        else
            echo -e "[${green}INFO${plain}] Installing plugin poetry"
            mkdir ${POETRY_PLUGIN}
            poetry completions zsh >${POETRY_PLUGIN}/_poetry
        fi
    fi
}

install_fzf() {
    install fzf git clone --depth 1 https://github.com/junegunn/fzf.git ~/.fzf && ~/.fzf/install --key-bindings --completion --no-update-rc
}

install_pyenv() {
    install pyenv git clone https://github.com/pyenv/pyenv.git ~/.pyenv
}

install_poetry() {
    install poetry curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | python - --no-modify-path
}

# ----------------
# Config Functions
# ----------------

_config_shell() {
    create_symlinks "shell_config" ".shell_config"
    create_symlinks "tools" ".tools"
}

# VIM
config_vim() {
    ask "Use vim/nvim with plug?"
    [ $? -eq 1 ] && {
        create_symlinks "vim/vimrc" ".vimrc"
    	mkdir -p $HOME/.vim && create_symlinks "vim/rc" ".vim/rc"
        type nvim > /dev/null 2>&1 && mkdir -p $HOME/.config/nvim && {
            create_symlinks "vim/vimrc" ".config/nvim/init.vim"
	    create_symlinks "vim/rc" ".config/nvim/rc"
            create_symlinks "vim/coc-settings.json" ".config/nvim/coc-settings.json"
        }     
    } || {
        create_symlinks "vim/vimrc-basic" ".vimrc"
        type nvim > /dev/null 2>&1 && mkdir -p $HOME/.config/nvim && create_symlinks "vim/vimrc-basic" ".config/nvim/init.vim"
    }
}

# GIT
config_git() {
    create_symlinks "git/gitconfig" ".gitconfig"
    create_symlinks "git/gitignore" ".gitignore_global"
}

# BASH
config_bash() {
    create_symlinks "bash/bashrc" ".bashrc"
    _config_shell
}

# ZSH
config_zsh() {
    install_oh_my_zsh
    ask "Config p10k theme with fonts?"
    if [ $? -eq 1 ]; then
        create_symlinks "zsh/p10k_with_font.zsh" ".p10k.zsh"
    elif [ $? -eq 0 ]; then
        create_symlinks "zsh/p10k_non_font.zsh" ".p10k.zsh"
    fi
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

# -----
# MAIN
# -----

echo -e "[SETUP START]"

choose_shell
install_bundle
check_installed
[ $IS_VIM -eq 1 ] && config_vim
[ $IS_GIT -eq 1 ] && config_git
[ $IS_PIP3 -eq 1 ] && config_pip
[ $IS_TMUX -eq 1 ] && config_tmux
[ $IS_PYENV -eq 0 ] && install_pyenv
[ $IS_POETRY -eq 0 ] && install_poetry
[ $IS_FZF -eq 0 ] && install_fzf
[ $IS_BASH -eq 1 ] && config_bash && exec bash
[ $IS_ZSH -eq 1 ] && config_zsh && exec zsh

echo -e "[SETUP END]"
