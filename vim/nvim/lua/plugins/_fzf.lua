local M = {}

M.config = function()
    vim.cmd("let g:fzf_command_prefix = 'FZF'")  -- add command prefix
end

return M
