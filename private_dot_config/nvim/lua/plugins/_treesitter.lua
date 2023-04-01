------------------------------------------------\\
-- Treesitter
------------------------------------------------\\

return {
    {
        "nvim-treesitter/nvim-treesitter",
        version = false,
        build = ":TSUpdate",
        event = { "BufReadPost", "BufNewFile" },
        opts = {
            ensure_installed = {
                "javascript",
                "html",
                "css",
                "bash",
                "lua",
                "json",
                "yaml",
                "python",
                "markdown",
                "markdown_inline",
                "regex",
                "vim",
            },
            highlight = {
                enable = true,
                use_languagetree = true
            },
        },
        config = function(_, opts)
            require("nvim-treesitter.configs").setup(opts)
        end,
    },
    -- rainbow parentheses
    {
        'p00f/nvim-ts-rainbow',
        dependencies = "nvim-treesitter/nvim-treesitter",
        event = { "BufReadPost", "BufNewFile" },
        opts = {
            rainbow = {
                enable = true
            }
        },
        config = function(_, opts)
            require("nvim-treesitter.configs").setup(opts)
        end,
    },
}
