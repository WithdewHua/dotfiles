" indentLine {{{
    let g:indent_guides_guide_size = 1  " 指定对齐线的尺寸
    let g:indent_guides_start_level = 2  " 从第二层开始可视化显示缩进
    let g:indentLine_fileTypeExclude = ['coc-explorer']
" }}}

" nerdcommenter {{{
    "add spaces after comment delimiters by default
    let g:NERDSpaceDelims = 1
    au FileType python let g:NERDSpaceDelims = 0

    " Use compact syntax for prettified multi-line comments
    let g:NERDCompactSexyComs = 1

    " Align line-wise comment delimiters flush left instead of following code indentation
    let g:NERDDefaultAlign = 'left'

    " Allow commenting and inverting empty lines (useful when commenting a region)
    let g:NERDCommentEmptyLines = 1

    " Enable trimming of trailing whitespace when uncommenting
    let g:NERDTrimTrailingWhitespace = 1

    " Enable NERDCommenterToggle to check all selected lines is commented or not
    let g:NERDToggleCheckAllLines = 1
" }}} 

" rainbow {{{
    let g:rainbow_active = 1
" }}}

" blamer {{{
    let g:blamer_enabled = 1
" }}} 
" vim-prosession {{{
    " enable tmux window name updates
    let g:prosession_tmux_title = 1
" }}}
" vim-doge {{{
    let g:doge_enable_mappings = 1
" }}} 
" vim-devicons {{{
    let g:webdevicons_enable = 1
" }}}
