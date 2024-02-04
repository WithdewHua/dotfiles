-- plugin list
return {
    { "nathom/filetype.nvim" },

    ------------------------------------------------\\
    -- LSP, Autocomplete code related stuff
    ------------------------------------------------\\
    -- commenter
    {
        "terrortylor/nvim-comment",
        cmd = "CommentToggle",
        event = "BufRead",
        config = function()
            require("nvim_comment").setup()
        end
    },


    ------------------------------------------------\\
    -- Bufferline, Statusline and theme related stuff
    ------------------------------------------------\\
    {
        "sainnhe/gruvbox-material",
        config = function()
            require("theme")
        end
    },

    ------------------------------------------------\\
    -- Git related stuff
    ------------------------------------------------\\
    {
        "tpope/vim-fugitive",
        cmd = {
            "Git"
        },
    },

    ------------------------------------------------\\
    -- Utils
    ------------------------------------------------\\
    -- which-key
    {
      "folke/which-key.nvim",
      event = "BufRead",
      config = function()
        require("which-key").setup()
      end
    },

    -- smooth scroll
    {
        "karb94/neoscroll.nvim",
        event = "WinScrolled",
        config = function()
            require("neoscroll").setup()
        end
    },

    -- fold
    {
        'kevinhwang91/nvim-ufo',
        event = "BufRead",
        dependencies = 'kevinhwang91/promise-async',
        config = function ()
            require("ufo").setup()
        end
    },

    -- highlight enhanced
    {
        'kevinhwang91/nvim-hlslens',
        event = "BufRead",
        config = function()
            require("hlslens").setup()
        end
    },
}
