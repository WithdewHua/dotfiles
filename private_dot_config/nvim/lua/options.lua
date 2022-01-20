local o = vim.o
local g = vim.g
local cmd = vim.cmd
local fn = vim.fn

o.compatible = false
o.encoding = "UTF-8"
o.updatetime = 300
o.history = 8000
o.hidden = true

-- leader settings
g.mapleader = ','

-- read settings
o.autoread = true
cmd('au CursorHold * checktime | call feedkeys("lh")')

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
cmd("autocmd cursorhold * set nohlsearch")

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
if fn.has("mouse") == 1 then
    o.mouse = 'a'
end

-- grep
if fn.executable "rg" == 1 then
    o.grepprg = "rg --vimgrep --no-heading --smart-case"
end

-- truecolor
o.termguicolors = true

-- python env
if fn.exists("$VIRTUAL_ENV") == 1 then
    g.python3_host_prog = fn.substitute(fn.system("which -a python3 | head -n3 | tail -n1"), "\n", '', 'g')
else
    g.python3_host_prog = fn.substitute(fn.system("which -a python3 | head -n2 | tail -n1"), "\n", '', 'g')
end

-- disable builtin vim plugins
local disabled_built_ins = {
	    "netrw",
	    "netrwPlugin",
	    "netrwSettings",
	    "netrwFileHandlers",
	    "gzip",
	    "zip",
	    "zipPlugin",
	    "tar",
	    "tarPlugin",
	    "getscript",
	    "getscriptPlugin",
	    "vimball",
	    "vimballPlugin",
	    "2html_plugin",
	    "logipat",
	    "rrhelper",
	    "spellfile_plugin",
	    "matchit"
	}

for _, plugin in pairs(disabled_built_ins) do
    g["loaded_" .. plugin] = 0
end

-- clipboard settings
o.clipboard = "unnamedplus"

-- session options
o.sessionoptions="blank,buffers,curdir,folds,help,tabpages,winsize,winpos,terminal"

-- highlight
cmd("syntax on")

-- filetype settings
cmd("filetype plugin indent on")

