-- map function
local function map(mode, lhs, rhs, opts)
    local options = {noremap = true, silent = true}
    if opts then
        options = vim.tbl_extend("force", options, opts)
    end
    vim.api.nvim_set_keymap(mode, lhs, rhs, options)
end

local opt = {}

-- leader settings
vim.g.mapleader = ','

-- set hlsearch
map('n', 'n', ':set hlsearch<cr>n', opt)
map('n', 'N', ':set hlsearch<cr>N', opt)
map('n', '/', ':set hlsearch<cr>/', opt)
map('n', '?', ':set hlsearch<cr>?', opt)
map('n', '* *', ':set hlsearch<cr>', opt)

-- delete settings
map('n', 'x', [[ "_x ]], opt)
map('n', 'X', [[ "_X ]], opt)
map('n', 'd', [[ "_d ]], opt)
map('n', 'dd', [[ "_dd ]], opt)
map('n', 'D', [[ "_D ]], opt)
map('v', 'd', [[ "_d ]], opt)

if vim.fn.has('unnamedplus') == 1 then
    vim.o.clipboard = 'unnamedplus'
    map('n', '<leader>d', [["+d]], opt)
    map('n', '<leader>dd', [["+dd]], opt)
    map('n', '<leader>D', [["+D]], opt)
    map('v', '<leader>d', [["+d]], opt)
else
    vim.o.clipboard = 'unnamed'
    map('n', '<leader>d', [["+d]], opt)
    map('n', '<leader>dd', [["+dd]], opt)
    map('n', '<leader>D', [["+D]], opt)
    map('v', '<leader>d', [["+d]], opt)
end

