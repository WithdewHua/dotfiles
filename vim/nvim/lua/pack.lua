local packer

if
    pcall(
        function()
            require "packerinit"
        end
    )
then
    packer = require "packer"
else
    return false
end


local use = packer.use

-- plugin list
return packer.startup(
    function()
        use { "wbthomason/packer.nvim", event = "VimEnter" }
        -- use { "dstein64/vim-startuptime", cmd = "StartupTime" }

        ------------------------------------------------\\
        -- Dependencies
        ------------------------------------------------\\
        use { "ryanoasis/vim-devicons" }
        --use {
            --"kyazdani42/nvim-web-devicons",
            --module = "nvim-web-devicons",
            --config = function()
                --require("nvim-web-devicons").setup { default = true }
            --end,
        --}

        use {
            "nvim-lua/plenary.nvim",
            event = "BufRead"
        }
        use {
            "nvim-lua/popup.nvim",
            after = "plenary.nvim"
        }

        ------------------------------------------------\\
        -- LSP, Autocomplete code related stuff
        ------------------------------------------------\\
        -- lsp stuff
        use {
            "kabouzeid/nvim-lspinstall",
            event = "BufRead"
        }

        use {
            "neovim/nvim-lspconfig",
            after = "nvim-lspinstall",
            config = function()
                require "plugins._lspconfig"
            end
        }

        use {
            "onsails/lspkind-nvim",
            event = "BufRead",
            config = function()
                require("lspkind").init()
            end
        }

        -- autocomplete
        use {
            "rafamadriz/friendly-snippets",
            event = "InsertCharPre"
        }

        use {
            "hrsh7th/nvim-cmp",
            event = "InsertEnter",
            config = function()
                require "plugins._cmp"
            end,
            after = "friendly-snippets"
        }

        use {
            "L3MON4D3/LuaSnip",
            wants = "friendly-snippets",
            after = "nvim-cmp",
            event = "InsertCharPre",
            config = function()
                require "plugins._luasnip"
            end
        }
        -- cmp plugins
        use {
            "saadparwaiz1/cmp_luasnip",
            after = "LuaSnip"
        }
        use {
            "hrsh7th/cmp-nvim-lua",
            after = "cmp_luasnip"
        }
        use {
            "hrsh7th/cmp-nvim-lsp",
            after = "cmp-nvim-lua"
        }
        use {
            "hrsh7th/cmp-buffer",
            after = "cmp-nvim-lsp"
        }
        use {
            "hrsh7th/cmp-path",
            after = "cmp-buffer"
        }

        -- autopairs
        use {
            "windwp/nvim-autopairs",
            after = "nvim-cmp",
            config = function()
                require "plugins._autopairs"
            end
        }

        -- commenter
        use {
            "terrortylor/nvim-comment",
            cmd = "CommentToggle",
            config = function()
                require("nvim_comment").setup()
            end
        }

        -- formatting
        use {
            "sbdchd/neoformat",
            cmd = "Neoformat",
            config = function()
                require("plugins._neoformat").config()
            end
       }

        use {
            "folke/trouble.nvim",
            event = "BufRead",
            requires = "kyazdani42/nvim-web-devicons",
            config = function()
                require "plugins._trouble"
            end
        }

        -- use {
        --     "github/copilot.vim"
        -- }

        ------------------------------------------------\\
        -- Telescope related stuff
        ------------------------------------------------\\
        -- use {
        --     "nvim-telescope/telescope.nvim",
        --     requires = { "plenary.nvim", "popup.nvim" },
        --     cmd = "Telescope",
        --     config = function()
        --         require "plugins._telescope"
        --     end
        -- }

        -- use {
        --     "nvim-telescope/telescope-media-files.nvim",
        --     cmd = "Telescope"
        -- }

        -- use {'nvim-telescope/telescope-fzf-native.nvim', run = 'make', cmd = "Telescope" }

        ------------------------------------------------\\
        -- Treesitter
        ------------------------------------------------\\
        use {
            "nvim-treesitter/nvim-treesitter",
            run = ':TSUpdate',
            event = "BufRead",
            config = function()
                require("plugins._treesitter").config()
            end
        }


        ------------------------------------------------\\
        -- Bufferline, Statusline and theme related stuff
        ------------------------------------------------\\
        -- use {"npxbr/gruvbox.nvim", requires = {"rktjmp/lush.nvim"}}
        use {
            "gruvbox-community/gruvbox",
            config = function()
                require("theme")
            end
        }
        use {
            "vim-airline/vim-airline",
            after = {"gruvbox"},
            config = function()
                require("plugins._airline").config()
            end
        }

        use {
            'akinsho/nvim-bufferline.lua',
            requires = 'kyazdani42/nvim-web-devicons',
            config = function()
                require "plugins._bufferline"
            end
        }


        ------------------------------------------------\\
        -- Git related stuff
        ------------------------------------------------\\
        use {
            "lewis6991/gitsigns.nvim",
            event = "BufRead",
            config = function()
                require "plugins._gitsigns"
            end
        }

        use {
            "tpope/vim-fugitive",
            cmd = {
                "Git"
            }
        }

        ------------------------------------------------\\
        -- Utils
        ------------------------------------------------\\
        -- fzf 
        use {
            "junegunn/fzf.vim",
            requires = "junegunn/fzf",
            config = function()
                require("plugins._fzf").config()
            end
        }

        -- smooth scroll
        use {
            "karb94/neoscroll.nvim",
            event = "WinScrolled",
            config = function()
                require("neoscroll").setup()
            end
        }

        -- indent line
        use {
            "lukas-reineke/indent-blankline.nvim",
            event = "BufRead",
            setup = function()
                require("plugins._misc").indentline()
            end
        }

        -- session management
        use {
            "rmagatti/auto-session",
            config = function()
                require "plugins._autosession"
            end
        }
        -- use {
        --     "rmagatti/session-lens",
        --     after = { "auto-session" },
        --     cmd = { "Telescope" },
        --     config = function()
        --         require('session-lens').setup{
        --             previewer = false,
        --             shorten_path = false
        --         }
        --     end
        -- }

        -- rainbow parentheses
        use {
            'p00f/nvim-ts-rainbow',
            after = 'nvim-treesitter',
            config = function()
                require("plugins._treesitter").config_ts_rainbow()
            end
        }

        -- escape insert mode
        use {
            "jdhao/better-escape.vim",
            event = "InsertEnter",
            config = function ()
                require "plugins._misc".escape()
            end
        }

    -- plugins end
    end
)
