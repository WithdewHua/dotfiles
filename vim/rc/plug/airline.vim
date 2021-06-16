let g:airline_theme='gruvbox'
" enable tabline
let g:airline#extensions#tabline#enabled = 1
let g:airline#extensions#tabline#buffer_nr_show = 1 
let g:airline#extensions#tabline#show_tab_nr = 1
" index mode
let g:airline#extensions#tabline#buffer_idx_mode = 1

" minimum of tabs needed to display the tabline
let g:airline#extensions#tabline#tab_min_count = 0 
" show git branch info
let g:airline#extensions#branch#enabled=1
" enable vim-obsession intergration
let g:airline#extensions#obsession#enabled = 1
let g:airline#extensions#obsession#indicator_text = '$'
