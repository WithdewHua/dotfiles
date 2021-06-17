" open a NERDTree automatically when vim starts up if no files were specified    
autocmd StdinReadPre * let s:std_in=1    
autocmd VimEnter * if argc() == 0 && !exists("s:std_in") | NERDTree | endif    
                            
" open NERDTree automatically when vim starts up on opening a directory    
autocmd StdinReadPre * let s:std_in=1    
autocmd VimEnter * if argc() == 1 && isdirectory(argv()[0]) && !exists("s:std_in") | exe 'NERDTree' argv()[0] | wincmd p | ene | exe 'cd '.argv()[0] | endif

" If another buffer tries to replace NERDTree, put it in the other window, and bring back NERDTree.
autocmd BufEnter * if bufname('#') =~ 'NERD_tree_\d\+' && bufname('%') !~ 'NERD_tree_\d\+' && winnr('$') > 1 |
    \ let buf=bufnr() | buffer# | execute "normal! \<C-W>w" | execute 'buffer'.buf | endif

" close vim if the only window left open is a NERDTree
autocmd bufenter * if (winnr("$") == 1 && exists("b:NERDTree") && b:NERDTree.isTabTree()) | q | endif

" show bookmarks
let NERDTreeShowBookmarks=1

" Let NERDTree igonre files
let NERDTreeIgnore = ['\.pyc$', '\.swp$', '__pycache__$']

" delete invalid buffer
let NERDTreeAutoDeleteBuffer=1
