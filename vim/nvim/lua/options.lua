local o = vim.o
local g = vim.g

o.compatible = false
o.encoding = "UTF-8"
o.updatetime = 300
o.history = 8000

-- read settings
o.autoread = true
vim.cmd('au CursorHold * checktime | call feedkeys("lh")')

-- write settings
o.autowriteall = true

-- line number settings
o.number = true
o.relativenumber = true
o.cursorline = true

-- indent settings
o.autoindent = true
o.smartindent = true

-- case settings
o.ignorecase = true
o.smartcase = true

-- wrap settings
-- set nowrap for long line
o.wrap = true
o.linebreak = true
o.showbreak = '->'

-- search highlight settings
vim.cmd("autocmd cursorhold * set nohlsearch")

-- backup settings
o.backup = false
o.wb = false
o.swapfile = false

-- Tab settings
o.ts = 4
o.softtabstop = 4
o.shiftwidth = 4
o.expandtab = true

-- mouse settings
if vim.fn.has("mouse") == 1 then
    o.mouse = 'a'
end

-- grep
if vim.fn.executable "rg" == 1 then
    o.grepprg = "rg --vimgrep --no-heading --smart-case"
end

-- truecolor
o.termguicolors = true

-- python env
if vim.fn.exists("$VIRTUAL_ENV") == 1 then
    g.python3_host_prog = vim.fn.substitute(vim.fn.system("which -a python3 | head -n3 | tail -n1"), "\n", '', 'g')
else
    g.python3_host_prog = vim.fn.substitute(vim.fn.system("which -a python3 | head -n2 | tail -n1"), "\n", '', 'g')
end

-- disable builtin vim plugins
g.loaded_gzip = 0
g.loaded_tar = 0
g.loaded_tarPlugin = 0
g.loaded_zipPlugin = 0
g.loaded_2html_plugin = 0
g.loaded_netrw = 0
g.loaded_netrwPlugin = 0
g.loaded_matchit = 0
g.loaded_matchparen = 0
g.loaded_spec = 0

-- clipboard settings
o.clipboard = "unnamedplus"

-- highlight
vim.cmd("syntax on")

-- filetype settings
vim.cmd("filetype plugin indent on")

