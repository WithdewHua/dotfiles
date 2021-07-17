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


local use = require("packer").use

-- plugin list
return packer.startup(
    function()
        use { "wbthomason/packer.nvim" }
        use { "dstein64/vim-startuptime", cmd = "StartupTime" }

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
                require "plugins.lspconfig"
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
            "hrsh7th/nvim-compe",
            event = "InsertEnter",
            config = function()
                require "plugins.compe"
            end,
            wants = {"LuaSnip"},
            requires = {
                {
                    "L3MON4D3/LuaSnip",
                    wants = "friendly-snippets",
                    event = "InsertCharPre",
                    config = function()
                        require "plugins.luasnip"
                    end
                },
                {
                    "rafamadriz/friendly-snippets",
                    event = "InsertCharPre"
                }
            }
        }

        use {
            "windwp/nvim-autopairs",
            after = "nvim-compe",
            config = function()
                require "plugins.autopairs"
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
                require("plugins.neoformat").config()
            end
       }

        ------------------------------------------------\\
        -- Telescope related stuff
        ------------------------------------------------\\
        use {
            "nvim-telescope/telescope.nvim",
            requires = {
                {"nvim-lua/popup.nvim"},
                {"nvim-lua/plenary.nvim"}
            },
            cmd = "Telescope",
            config = function()
                require "plugins.telescope"
            end
        }

        use {
            "nvim-telescope/telescope-media-files.nvim",
            cmd = "Telescope"
        }

        use {'nvim-telescope/telescope-fzf-native.nvim', run = 'make', cmd = "Telescope" }

        ------------------------------------------------\\
        -- Treesitter 
        ------------------------------------------------\\
        use {
            "nvim-treesitter/nvim-treesitter",
            event = "BufRead",
            config = function()
                require("plugins.treesitter").config()
            end
        }


        ------------------------------------------------\\
        -- Bufferline, Statusline and theme related stuff
        ------------------------------------------------\\
        -- use {"npxbr/gruvbox.nvim", requires = {"rktjmp/lush.nvim"}}
        use "gruvbox-community/gruvbox"
        use {
            "vim-airline/vim-airline",
            config = function()
                require("plugins.airline").config()
            end
        }
        
        use {
            'akinsho/nvim-bufferline.lua', 
            requires = 'kyazdani42/nvim-web-devicons',
            config = function()
                require "plugins.bufferline"
            end
        }


        ------------------------------------------------\\
        -- Git related stuff
        ------------------------------------------------\\
        use {
            "lewis6991/gitsigns.nvim",
            event = "BufRead",
            config = function()
                require "plugins.gitsigns"
            end
        }

        ------------------------------------------------\\
        -- Utils
        ------------------------------------------------\\
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
                require("plugins.misc-plugins").indentline()
            end
        }

        -- session management
        use {
            "rmagatti/auto-session",
            config = function()
                require "plugins.autosession"
            end
        }
        -- use {
        --     "rmagatti/session-lens", 
        --     after = {'auto-session', 'telescope.nvim'},
        --     config = function()
        --         require('session-lens').setup{
        --             previewer = false,
        --             shorten_path = false
        --         }
        --     end
        -- }

    end  -- plugins end
)
