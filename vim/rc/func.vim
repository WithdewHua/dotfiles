" ---------------
" AutoSave
" ---------------
function! s:autosave(enable)
  augroup autosave
    autocmd!
    if a:enable
	  autocmd TextChanged,InsertLeave <buffer>
	        \  if empty(&buftype) && !empty(bufname(''))
	        \|   silent! update
	        \| endif
	  endif
	augroup END
endfunction
	
command! -bang AutoSave call s:autosave(<bang>1)
