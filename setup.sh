#!/usr/bin/env bash
#
# withdewhua
# usage: ./setup.sh
#

echo "# =============================================================================================== #"
echo "#                                                                                                 #"
echo "#  __      __.__  __  .__         .___              ___ ___              ___________              #"
echo "# /  \    /  \__|/  |_|  |__    __| _/______  _  __/   |   \ __ _______  \_   _____/ _______  __  #"
echo "# \   \/\/   /  \   __\  |  \  / __ |/ __ \ \/ \/ /    ~    \  |  \__  \  |    __)_ /    \  \/ /  #"
echo "#  \        /|  ||  | |   Y  \/ /_/ \  ___/\     /\    Y    /  |  // __ \_|        \   |  \   /   #"
echo "#   \__/\  / |__||__| |___|  /\____ |\___  >\/\_/  \___|_  /|____/(____  /_______  /___|  /\_/    #"
echo "#        \/                \/      \/    \/              \/            \/        \/     \/        #"
echo "#                                                                                                 #"
echo "# =============================================================================================== #"


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

# Choose shell
read -p "CHOOSE SHELL (bash or zsh): " _shell

echo "[SETUP START]"

if [ "$_shell" = "bash" ]; then
    unset IS_ZSH
elif [ "$_shell" = "zsh" ]; then
    unset IS_BASH
else
    echo "[ERROR] Invalid shell type, exit."
    exit 1
fi

# Pre check
check_installed() {
    softwares=("pip3" "git" "vim" "poetry" "tmux")
    # bash >= 4.2
    if [ -v IS_BASH ]; then
        softwares+=("bash")
    else
        softwares+=("zsh")
    fi
    for sw in "${softwares[@]}"; do
        flag="IS_${sw^^}" # bash >= 4.0
        # Notice the semicolon
        # Dynamic naming:
        # - https://stackoverflow.com/a/13717788/1276501
        # - https://stackoverflow.com/a/18124325/1276501
        type ${sw} >/dev/null 2>&1 &&
            { printf -v "${flag}" 1; } ||
            { echo >&2 "[WARNING] \`${sw}' is not installed, ignore it."; }
    done
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
            echo "[INFO] Update existed symlink $dotfile_dst"
        else
            echo "[WARNING] Ignore due to $dotfile_dst exists and is not a symlink"
        fi
    else
        ln -sf $PWD/$dotfile_src $dotfile_dst
        echo "[INFO] Create symlink $dotfile_dst"
    fi
}

# VIM
config_vim() {
    create_symlinks "vim/vimrc" ".vimrc"
}

# GIT
config_git() {
    create_symlinks "git/gitconfig" ".gitconfig"
    create_symlinks "git/gitignore" ".gitignore_global"
}

_config_shell() {
    create_symlinks "shell_config" ".shell_config"
    create_symlinks "tools" ".tools"
}

# BASH
config_bash() {
    create_symlinks "bash/bashrc" ".bashrc"
    _config_shell
}

# ZSH
_install_oh_my_zsh() {
    # oh-my-zsh
    if [ -d "${OH_MY_ZSH}" ]; then
        cd "${OH_MY_ZSH}"
        echo "[INFO] Change directory to $(pwd)"
        echo "[INFO] ${OH_MY_ZSH} exists. Git pull to update..."
        git pull
        cd - >/dev/null 2>&1
        echo "[INFO] Change directory back to $(pwd)"
    else
        echo "[INFO] ${OH_MY_ZSH} not exists. Install..."
        sh -c "$(wget https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh -O -)"
    fi

    # oh-my-zsh theme
    if [ -d ${ZSH_CUSTOM}/themes/powerlevel10k ]; then
        echo "[INFO] powerlevel10k is already installed. Git pull to update..."
        git -C ${ZSH_CUSTOM}/themes/powerlevel10k pull
    else
        echo "[INFO] Installing theme p10k"
        git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM}/themes/powerlevel10k
    fi

    # oh-my-zsh plugin
    # > zsh-syntax-highlighting
    if [ -d ${ZSH_CUSTOM}/plugins/zsh-syntax-highlighting ]; then
        echo "[INFO] zsh-syntax-highlighting is already installed. Git pull to update..."
        git -C ${ZSH_CUSTOM}/plugins/zsh-syntax-highlighting pull
    else
        echo "[INFO] Installing plugin zsh-syntax-highlighting"
        git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM}/plugins/zsh-syntax-highlighting
    fi
    # > zsh-autosuggestions
    if [ -d ${ZSH_CUSTOM}/plugins/zsh-autosuggestions ]; then
        echo "[INFO] zsh-autosuggestions is already installed. Git pull to update..."
        git -C ${ZSH_CUSTOM}/plugins/zsh-autosuggestions pull
    else
        echo "[INFO] Installing plugin zsh-autosuggestions"
        git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM}/plugins/zsh-autosuggestions
    fi
    # > poetry completions
    if [ $IS_POETRY -eq 1 ]; then
        if [ -d "${POETRY_PLUGIN}" ]; then
            echo "[INFO] zsh-poetry is already installed"
        else
            echo "[INFO] Installing plugin poetry"
            mkdir ${POETRY_PLUGIN}
            poetry completions zsh >${POETRY_PLUGIN}/_poetry
        fi
    fi
}

config_zsh() {
    _install_oh_my_zsh
    create_symlinks "zsh/zshrc" ".zshrc"
    read -p "Choose p10k config (1. with_font / 2. non_font)" _font
    if [ ${_font} == "1" ]; then
        create_symlinks "zsh/p10k_with_font.zsh" ".p10k.zsh"
    elif [ ${_font} == "2" ]; then
        create_symlinks "zsh/p10k_non_font.zsh" ".p10k.zsh"
    else
        echo "[ERROR] please input correct num!"
        exit 1
    fi
    _config_shell
}

# PIP
config_pip() {
    [ -d ${HOME}/.pip ] || {
        mkdir $HOME/.pip
        echo "[INFO] mkdir $HOME/.pip"
    }
    create_symlinks "pip/pip.conf" ".pip/pip.conf"
}

# tmux
config_tmux() {
    if [ -d ~/.tmux/plugins/tpm ]; then
        echo "[INFO] tmux plugin manager is already installed. Git pull to update..."
        git -C ~/.tmux/plugins/tpm pull
    else
        echo "[INFO] Installing tmux plugin tmp"
        git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
    fi
    create_symlinks "tmux/tmux.conf" ".tmux.conf"
}

check_installed
[ $IS_VIM -eq 1 ] && config_vim
[ $IS_GIT -eq 1 ] && config_git
[ -v IS_BASH ] && [ "$IS_BASH" -eq 1 ] && config_bash
[ -v IS_ZSH ] && [ "$IS_ZSH" -eq 1 ] && config_zsh
[ $IS_PIP3 -eq 1 ] && config_pip
[ $IS_TMUX -eq 1 ] && config_tmux

exec zsh

echo "[SETUP END]"
