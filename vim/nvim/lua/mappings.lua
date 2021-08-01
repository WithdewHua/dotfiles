-- map function
local function map(mode, lhs, rhs, opts)
    local options = {noremap = true, silent = true}
    if opts then
        options = vim.tbl_extend("force", options, opts)
    end
    vim.api.nvim_set_keymap(mode, lhs, rhs, options)
end

local opt = {}

-- set hlsearch
map('n', 'n', ':set hlsearch<cr>n', opt)
map('n', 'N', ':set hlsearch<cr>N', opt)
map('n', '/', ':set hlsearch<cr>/', opt)
map('n', '?', ':set hlsearch<cr>?', opt)
map('n', '* *', ':set hlsearch<cr>', opt)

-- copy whole file content
map("n", "<leader>ca", [[ <Cmd> %y+<CR>]], opt)

-- Commenter Keybinding
map("n", "<leader>/", ":CommentToggle<CR>", opt)
map("v", "<leader>/", ":CommentToggle<CR>", opt)

-- compe stuff
local t = function(str)
    return vim.api.nvim_replace_termcodes(str, true, true, true)
end

local check_back_space = function()
    local col = vim.fn.col(".") - 1
    if col == 0 or vim.fn.getline("."):sub(col, col):match("%s") then
        return true
    else
        return false
    end
end

_G.tab_complete = function()
    if vim.fn.pumvisible() == 1 then
        return t "<C-n>"
    elseif check_back_space() then
        return t "<Tab>"
    else
        return vim.fn["compe#complete"]()
    end
end

_G.s_tab_complete = function()
    if vim.fn.pumvisible() == 1 then
        return t "<C-p>"
    elseif vim.fn.call("vsnip#jumpable", {-1}) == 1 then
        return t "<Plug>(vsnip-jump-prev)"
    else
        return t "<S-Tab>"
    end
end

function _G.completions()
    local npairs
    if
        not pcall(
            function()
                npairs = require "nvim-autopairs"
            end
        )
     then
        return
    end

    if vim.fn.pumvisible() == 1 then
        if vim.fn.complete_info()["selected"] ~= -1 then
            return vim.fn["compe#confirm"]("<CR>")
        end
    end
    return npairs.check_break_line_char()
end

--  compe mappings
map("i", "<Tab>", "v:lua.tab_complete()", {expr = true})
map("s", "<Tab>", "v:lua.tab_complete()", {expr = true})
map("i", "<S-Tab>", "v:lua.s_tab_complete()", {expr = true})
map("s", "<S-Tab>", "v:lua.s_tab_complete()", {expr = true})
map("i", "<CR>", "v:lua.completions()", {expr = true})

-- Telescope
-- git pickers
map("n", "<space>gs", [[<Cmd> Telescope git_status <CR>]], opt)
map("n", "<space>gc", [[<Cmd> Telescope git_commits <CR>]], opt)
-- file pickers
map("n", "<space>ff", [[<Cmd> Telescope find_files <CR>]], opt)
-- vim pickers
map("n", "<space>bb", [[<Cmd>Telescope buffers<CR>]], opt)
map("n", "<space>ht", [[<Cmd>Telescope help_tags<CR>]], opt)
map("n", "<space>fo", [[<Cmd>Telescope oldfiles<CR>]], opt)
map("n", "<space>cm", [[<Cmd>Telescope commands<CR>]], opt)
map("n", "<space>qf", [[<Cmd>Telescope quickfix<CR>]], opt)
map("n", "<space>mm", [[<Cmd>Telescope marks<CR>]], opt)
map("n", "<space>mp", [[<Cmd>Telescope keymaps<CR>]], opt)
-- native lsp pickers
map("n", "<space>lr", [[<Cmd>Telescope lsp_references<CR>]], opt)
map("n", "<space>ld", [[<Cmd>Telescope lsp_definitions<CR>]], opt)
map("n", "<space>li", [[<Cmd>Telescope lsp_implementations<CR>]], opt)
map("n", "<space>lsd", [[<Cmd>Telescope lsp_documents_symbols<CR>]], opt)
map("n", "<space>lsw", [[<Cmd>Telescope lsp_workspace_symbols<CR>]], opt)
map("n", "<space>lad", [[<Cmd>Telescope lsp_document_diagnostics<CR>]], opt)
map("n", "<space>law", [[<Cmd>Telescope lsp_workspace_diagnostics<CR>]], opt)
-- extensions
map("n", "<space>fp", [[<Cmd>lua require('telescope').extensions.media_files.media_files()<CR>]], opt)
map("n", "<space>ss", [[<Cmd>SaveSession<CR><CR>]], opt)

-- format code
map("n", "<leader>fm", ":Neoformat<CR>", opt)

-- Packer commands till because we are not loading it at startup
vim.cmd("silent! command PackerCompile lua require 'pack' require('packer').compile()")
vim.cmd("silent! command PackerInstall lua require 'pack' require('packer').install()")
vim.cmd("silent! command PackerStatus lua require 'pack' require('packer').status()")
vim.cmd("silent! command PackerSync lua require 'pack' require('packer').sync()")
vim.cmd("silent! command PackerUpdate lua require 'pack' require('packer').update()")

-- get out of terminal with jk
map("t", "jk", "<C-\\><C-n>", opt)

-- Allow moving the cursor through wrapped lines with j, k, <Up> and <Down>
-- http://www.reddit.com/r/vim/comments/2k4cbr/problem_with_gj_and_gk/
-- empty mode is same as using :map
map("", "j", 'v:count ? "j" : "gj"', {expr = true})
map("", "k", 'v:count ? "k" : "gk"', {expr = true})
map("", "<Down>", 'v:count ? "j" : "gj"', {expr = true})
map("", "<Up>", 'v:count ? "k" : "gk"', {expr = true})

-- trouble
map("n", "<leader>xx", "<cmd>Trouble<cr>", opt)
map("n", "<leader>xw", "<cmd>Trouble lsp_workspace_diagnostics<cr>", opt)
map("n", "<leader>xd", "<cmd>Trouble lsp_document_diagnostics<cr>", opt)
map("n", "<leader>xl", "<cmd>Trouble loclist<cr>", opt)
map("n", "<leader>xq", "<cmd>Trouble quickfix<cr>", opt)
map("n", "<leader>xr", "<cmd>Trouble lsp_references<cr>", opt)

