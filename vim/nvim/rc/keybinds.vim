" leader settings
let mapleader = ","
let g:mapleader = ","

" delete settings
nnoremap x "_x
nnoremap X "_X
nnoremap d "_d
nnoremap dd "_dd
nnoremap D "_D
vnoremap d "_d

if has('unnamedplus')
  set clipboard=unnamed,unnamedplus
  nnoremap <leader>d "+d
  nnoremap <leader>dd "+dd
  nnoremap <leader>D "+D
  vnoremap <leader>d "+d
else
  set clipboard=unnamed
  nnoremap <leader>d "*d
  nnoremap <leader>dd "*dd
  nnoremap <leader>D "*D
  vnoremap <leader>d "*d
endif

" coc {{{
    " Use tab for trigger completion with characters ahead and navigate.
    " NOTE: Use command ':verbose imap <tab>' to make sure tab is not mapped by
    " other plugin before putting this into your config.
    inoremap <silent><expr> <TAB>
        \ pumvisible() ? "\<C-n>" :
        \ <SID>check_back_space() ? "\<TAB>" :
        \ coc#refresh()
    inoremap <expr><S-TAB> pumvisible() ? "\<C-p>" : "\<C-h>"

    function! s:check_back_space() abort
    let col = col('.') - 1
    return !col || getline('.')[col - 1]  =~# '\s'
    endfunction

    " Make <CR> auto-select the first completion item and notify coc.nvim to
    " format on enter, <cr> could be remapped by other vim plugin
    inoremap <silent><expr> <cr> pumvisible() ? coc#_select_confirm()
                                \: "\<C-g>u\<CR>\<c-r>=coc#on_enter()\<CR>"

    " Use `[g` and `]g` to navigate diagnostics
    " Use `:CocDiagnostics` to get all diagnostics of current buffer in location list.
    nmap <silent> [g <Plug>(coc-diagnostic-prev)
    nmap <silent> ]g <Plug>(coc-diagnostic-next)

    " GoTo code navigation.
    nmap <silent> gd <Plug>(coc-definition)
    nmap <silent> gy <Plug>(coc-type-definition)
    nmap <silent> gi <Plug>(coc-implementation)
    nmap <silent> gr <Plug>(coc-references)

    " Use K to show documentation in preview window.
    nnoremap <silent> K :call <SID>show_documentation()<CR>

    function! s:show_documentation()
    if (index(['vim','help'], &filetype) >= 0)
        execute 'h '.expand('<cword>')
    elseif (coc#rpc#ready())
        call CocActionAsync('doHover')
    else
        execute '!' . &keywordprg . " " . expand('<cword>')
    endif
    endfunction
    
    " Symbol renaming.
    nmap <leader>rn <Plug>(coc-rename)

    " coc-list {{{
        " Mappings for CoCList
        " Show all diagnostics.
        nnoremap <silent><nowait> <space>A  :<C-u>CocList diagnostics<cr>
        " Manage extensions.
        nnoremap <silent><nowait> <space>E  :<C-u>CocList extensions<cr>
        " Show commands.
        nnoremap <silent><nowait> <space>C  :<C-u>CocList commands<cr>
        " Find symbol of current document.
        nnoremap <silent><nowait> <space>O  :<C-u>CocList outline<cr>
        " Search workspace symbols.
        nnoremap <silent><nowait> <space>S  :<C-u>CocList -I symbols<cr>
        " Do default action for next item.
        nnoremap <silent><nowait> <space>j  :<C-u>CocNext<CR>
        " Do default action for previous item.
        nnoremap <silent><nowait> <space>k  :<C-u>CocPrev<CR>
        " Resume latest coc list.
        nnoremap <silent><nowait> <space>p  :<C-u>CocListResume<CR>
    " }}}

    " coc-git {{{
        " key map
        " navigate chunks of current buffer
        nmap [g <Plug>(coc-git-prevchunk)
        nmap ]g <Plug>(coc-git-nextchunk)
        " navigate conflicts of current buffer
        nmap [c <Plug>(coc-git-prevconflict)
        nmap ]c <Plug>(coc-git-nextconflict)
        " show chunk diff at current position
        nmap gs <Plug>(coc-git-chunkinfo)
        " show commit contains current position
        nmap gc <Plug>(coc-git-commit)
        " create text object for git chunks
        omap ig <Plug>(coc-git-chunk-inner)
        xmap ig <Plug>(coc-git-chunk-inner)
        omap ag <Plug>(coc-git-chunk-outer)
        xmap ag <Plug>(coc-git-chunk-outer)
    " }}}
" }}}

" vim-airline {{{
    " tabs map
    nmap <leader>1 <Plug>AirlineSelectTab1
    nmap <leader>2 <Plug>AirlineSelectTab2
    nmap <leader>3 <Plug>AirlineSelectTab3
    nmap <leader>4 <Plug>AirlineSelectTab4
    nmap <leader>5 <Plug>AirlineSelectTab5
    nmap <leader>6 <Plug>AirlineSelectTab6
    nmap <leader>7 <Plug>AirlineSelectTab7
    nmap <leader>8 <Plug>AirlineSelectTab8
    nmap <leader>9 <Plug>AirlineSelectTab9
    nmap <leader>0 <Plug>AirlineSelectTab0
    nmap <leader>- <Plug>AirlineSelectPrevTab
    nmap <leader>+ <Plug>AirlineSelectNextTab
" }}}
" NERDTree {{{
    " map a specific key or shortcut to open NERDTree
    map <C-n> :NERDTreeToggle<CR>
" }}}
" vim-doge {{{
    let g:doge_mapping = '<space>d'
" }}}
" fzf {{{
    nnoremap <silent> <expr> <space>f (expand('%') =~ 'NERD_tree' ? "\<c-w>\<c-w>" : '').":Files\<cr>"
	nnoremap <silent> <space>c    :Commands<CR>
	nnoremap <silent> <space>bb    :Buffers<CR>
	nnoremap <silent> <space>bl    :BLines<CR>
	nnoremap <silent> <space>l    :Lines<CR>
	nnoremap <silent> <space>rg   :Rg<C-R><C-W><CR>
	nnoremap <silent> <space>mk    :Marks<CR>
	nnoremap <silent> <space>mp    :Maps<CR>
    nnoremap <silent> <space>hh    :History<CR>
    nnoremap <silent> <space>h:   :History:<CR>
    nnoremap <silent> <space>h/   :History/<CR>
    nnoremap <silent> <space>gc   :Commits<CR>
    nnoremap <silent> <space>gbc  :BCommits<CR>
	nnoremap <silent> <space>gf   :GFiles<CR>
	nnoremap <silent> <space>gs   :GFiles?<CR>
" }}}
