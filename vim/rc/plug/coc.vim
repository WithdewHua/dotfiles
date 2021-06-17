" coc-extensions
let g:coc_global_extensions = ['coc-json', 'coc-yaml', 'coc-git', 'coc-markdownlint', 'coc-pyright', 'coc-pairs', 'coc-lists'] 

" Highlight the symbol and its references when holding the cursor.
autocmd CursorHold * silent call CocActionAsync('highlight')

" Add `:Format` command to format current buffer.
command! -nargs=0 Format :call CocAction('format')

" Add `:Fold` command to fold current buffer.
command! -nargs=? Fold :call CocAction('fold', <f-args>)

" Add `:OR` command for organize imports of the current buffer.
command! -nargs=0 OR   :call CocAction('runCommand', 'editor.action.organizeImport')

" coc-git {{{
    " statusline
    set statusline^=%{get(g:,'coc_git_status','')}%{get(b:,'coc_git_status','')}%{get(b:,'coc_git_blame','')}
    " update statusline
    autocmd User CocGitStatusChange {command}
 " }}}
