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
        use { "alker0/chezmoi.vim" }
        use {
            "nathom/filetype.nvim",
            after = "chezmoi.vim"
        }

        ------------------------------------------------\\
        -- Dependencies
        ------------------------------------------------\\
        -- use { "ryanoasis/vim-devicons" }
        --use {
            --"kyazdani42/nvim-web-devicons",
            --module = "nvim-web-devicons",
            --config = function()
                --require("nvim-web-devicons").setup { default = true }
            --end,
        --}

        use {
            "nvim-lua/plenary.nvim",
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
            "williamboman/nvim-lsp-installer",
            event = "BufRead"
        }

        use {
            "neovim/nvim-lspconfig",
            after = "nvim-lsp-installer",
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
        use {
            "hrsh7th/cmp-cmdline",
            after = "cmp-path"
        }
        use {
            "hrsh7th/cmp-nvim-lsp-signature-help",
            after = "cmp-cmdline"
        }

        use {
            "hrsh7th/cmp-nvim-lsp-document-symbol",
            after = "cmp-nvim-lsp-signature-help"
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
            "mhartington/formatter.nvim",
            cmd = "Format",
            config = function()
                require("plugins._format").setup()
            end
       }

       -- quickfix / location list
        use {
            "folke/trouble.nvim",
            event = "BufRead",
            requires = "kyazdani42/nvim-web-devicons",
            config = function()
                require "plugins._trouble"
            end
        }

        -- github copilot
        use {
            "github/copilot.vim",
            event = "BufRead"
        }

        -- todo comments
        use {
            "folke/todo-comments.nvim",
            requires = "nvim-lua/plenary.nvim",
            config = function()
                require "plugins._todo"
            end

        }

        ------------------------------------------------\\
        -- Telescope related stuff
        ------------------------------------------------\\
        use {
            "nvim-telescope/telescope.nvim",
            requires = { "plenary.nvim", "popup.nvim" },
            config = function()
                require "plugins._telescope"
            end
        }

        use {
            "nvim-telescope/telescope-media-files.nvim",
        }

        use {
            'nvim-telescope/telescope-fzf-native.nvim',
            run = 'make',
        }

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
        use {
            "sainnhe/gruvbox-material",
            config = function()
                require("theme")
            end
        }

        use {
            'akinsho/nvim-bufferline.lua',
            requires = 'kyazdani42/nvim-web-devicons',
            config = function()
                require "plugins._bufferline"
            end
        }

        use {
            'nvim-lualine/lualine.nvim',
            requires = {'kyazdani42/nvim-web-devicons'},
            config = function()
                require("plugins._lualine")
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

        -- which-key
        use {
          "folke/which-key.nvim",
          event = "BufRead",
          config = function()
            require("which-key").setup{}
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
        use {
            "rmagatti/session-lens",
            requires = { "auto-session", "telescope.nvim" },
            config = function()
                require('session-lens').setup{
                    previewer = true,
                }
            end
        }

        -- rainbow parentheses
        use {
            'p00f/nvim-ts-rainbow',
            after = 'nvim-treesitter',
            config = function()
                require("plugins._treesitter").config_ts_rainbow()
            end
        }

        -- toggleterm
        use {
            "akinsho/toggleterm.nvim",
            config = function()
                require "plugins._toggleterm"
            end
        }

        -- filemanager
        use {
            'kyazdani42/nvim-tree.lua',
            requires = {
              'kyazdani42/nvim-web-devicons', -- optional, for file icon
            },
            config = function()
                require'plugins._nvimtree'
            end
        }

        -- fold
        use{
            'anuvyklack/pretty-fold.nvim',
            event = "BufRead",
            config = function()
              require 'plugins._pretty_fold'
            end
        }
        use {
            "anuvyklack/fold-preview.nvim",
            require = "anuvyklack/keymap-amend.nvim",
            after = "anuvyklack/pretty_fold.nvim"
        }

        -- highlight enhanced
        use {
            'kevinhwang91/nvim-hlslens',
            event = "BufRead",
        }

    -- plugins end
    end
)
