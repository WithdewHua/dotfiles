local M = {}

M.config = function()
    -- basic
    vim.g.neoformat_try_formatprg = 1
    -- Enable tab to spaces conversion
    vim.g.neoformat_basic_format_retab = 1
    -- Enable trimmming of trailing whitespace
    vim.g.neoformat_basic_format_trim = 1
    -- python
    vim.g.neoformat_enabled_python = {'black', 'isort'}
    vim.g.neoformat_python_black = {
        exe = 'black',
        args = {'--line-length 128', '-'},
        stdin = 1
    }
    vim.g.neoformat_python_isort = {
        exe = 'isort',
        args = {'--profile black', '-'},
        stdin = 1
    }
end

return M

