" leader settings
let mapleader = ","
let g:mapleader = ","

set nocompatible

" read settings
set autoread    " detect when a file is changed
au CursorHold * checktime | call feedkeys("lh")

" write settings
set autowriteall

set number  " Set the line number

" indent settings
set autoindent  " automatically set indent of new line
set smartindent

set encoding=UTF-8
set updatetime=300

" case settings
set ignorecase  " case insensitive
set smartcase   " case sensitive when uc present

set history=8000

" wrap settings
" set nowrap  " not wrap long line
" set textwidth=0
set wrap
set linebreak
set breakat-=_
set showbreak=->

" search highlight settings
autocmd cursorhold * set nohlsearch
noremap n :set hlsearch<cr>n
noremap N :set hlsearch<cr>N
noremap / :set hlsearch<cr>/
noremap ? :set hlsearch<cr>?
noremap * *:set hlsearch<cr>

nnoremap <silent><nowait> <space>h :call DisableHighlight()<cr>
function! DisableHighlight()
    set nohlsearch
endfunc

" backup settings
set nobackup
set nowb
set noswapfile

" Tab settings
set ts=4
set softtabstop=4
set shiftwidth=4
set expandtab   " Always use spaces instead of tabs

" mouse settings
if has('mouse')
    set mouse=a
endif

syntax on  " Syntax highlighting
filetype plugin indent on

" enable 24 bit color support if supported
if (has("termguicolors"))
    if (!(has("nvim")))
        let &t_8f = "\<Esc>[38;2;%lu;%lu;%lum"
        let &t_8b = "\<Esc>[48;2;%lu;%lu;%lum"
    endif
    set termguicolors
endif

