-- plugin list
local pack_use = function()
    local use = require("packer").use

    use "webthomason/packer.nvim"
    use { "dstein64/vim-startuptime", cmd = "StartupTime" }

    ------------------------------------------------\\
    -- Dependencies
    ------------------------------------------------\\
    use { "nvim-lua/plenary.nvim", module = "plenary" }
	use { "nvim-lua/popup.nvim", module = "popup" }
    use {
        "kyazdani42/nvim-web-devicons",
        module = "nvim-web-devicons",
        config = function()
            require("nvim-web-devicons").setup { default = true }
        end,
    }

    ------------------------------------------------\\
    -- LSP, Autocomplete code related stuff
    ------------------------------------------------\\
    use {
        "kabouzeid/nvim-lspinstall",
        event = "BufRead"
    }

    use {
        "neovim/nvim-lspconfig",
        after = "nvim-lspinstall",
        config = function()
            require("plugins.lspconfig").config()
        end
    }

    use {
        "onsails/lspkind-nvim",
        event = "BufRead",
        config = function()
            require("lspkind").init()
        end
    } 

    ------------------------------------------------\\
    -- Telescope related stuff
    ------------------------------------------------\\
    use {
        "nvim-telescope/telescope.nvim",
        wants = {
            "popup.nvim",
            "plenary.nvim"
        },
        cmd = "Telescope",
        config = function()
            require("plugins.telescope").config()
        end
    }

    use {
        "nvim-telescope/telescope-media-files.nvim",
        cmd = "Telescope"
    }


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
    use {"npxbr/gruvbox.nvim", requires = {"rktjmp/lush.nvim"}}


    ------------------------------------------------\\
    -- Git related stuff
    ------------------------------------------------\\
    use {
        "lewis6991/gitsigns.nvim",
        event = "BufRead",
        config = function()
            require("plugins.gitsigns").config()
        end
    }

    ------------------------------------------------\\
    -- Utils
    ------------------------------------------------\\

end


local execute = vim.api.nvim_command
local fn = vim.fn
local install_path = fn.stdpath('data')..'/site/pack/packer/start/packer.nvim'

-- load plugins function
local function load_plugins()
    local pack = require "packer"
    pack.init {
        git = {
            clone_timeout = 600 -- Timeout, in seconds, for git clones
        }
    }
    pack.startup {
        function()
            pack_use()
        end,
    }
end

-- packer plugin/package management
if fn.empty(fn.glob(install_path)) > 0 then
    execute("!git clone https://github.com/wbthomason/packer.nvim " .. install_path)
	load_plugins()
	require("packer").sync()
else
	load_plugins()
end

