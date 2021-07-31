local M = {}

M.config = function()
    vim.g.airline_theme='gruvbox'
    vim.cmd("let g:airline#extensions#branch#enabled=1")  -- show git branch info
end

return M
