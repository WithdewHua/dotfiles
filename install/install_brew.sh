#!/usr/bin/env bash

red='\033[0;31m'
green='\033[0;32m'
yellow='\033[0;33m'
plain='\033[0m'

if type brew > /dev/null 2>&1; then
    echo -e "[${green}INFO${plain}] brew is installed already."
    exit 0
else
    echo -e "[${green}INFO${plain}] Installing Homebrew/Linuxbrew"

    OS=$uname

    cd /tmp
    wget https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh -O install.sh
    sed 's/BREW_REPO=https:\/\/github.com\/Homebrew\/brew/BREW_REPO=https:\/\/mirrors.tuna.tsinghua.edu.cn\/git\/homebrew\/brew.git/g' install.sh > install.sh.bak
    rm install.sh && mv install.sh.bak install.sh
    HOMEBREW_CORE_GIT_REMOTE=https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-core.git bash install.sh
    rm install.sh
    cd - >/dev/null 2>&1

    # Homebrew/Linuxbrew
    git -C "$(brew --repo)" remote set-url origin https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew.git
    git -C "$(brew --repo homebrew/core)" remote set-url origin https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-core.git

    # macOS only
    if [ "$OS" = "Darwin" ]; then
        git -C "$(brew --repo homebrew/cask)" remote set-url origin https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-cask.git
        git -C "$(brew --repo homebrew/cask-fonts)" remote set-url origin https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-cask-fonts.git
        git -C "$(brew --repo homebrew/cask-drivers)" remote set-url origin https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-cask-drivers.git
    fi
fi