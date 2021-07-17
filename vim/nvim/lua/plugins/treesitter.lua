local M = {}

M.config = function()
    local ts_config = require("nvim-treesitter.configs")

    ts_config.setup {
        ensure_installed = {
            "javascript",
            "html",
            "css",
            "bash",
            "lua",
            "json",
            "yaml",
            "python"
        },
        highlight = {
            enable = true,
            use_languagetree = true
        },
    }

    vim.o.foldmethod = "expr"
    vim.cmd("set foldexpr=nvim_treesitter#foldexpr()")
end

M.config_ts_rainbow = function()
    local ts_config = require("nvim-treesitter.configs")

    ts_config.setup{
        rainbow = {
            enable = true
        }
    }
end

return M
