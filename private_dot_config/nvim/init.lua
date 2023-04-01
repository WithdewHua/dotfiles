local modules = {
    "options",
    "mappings",
}

for i = 1, #modules, 1 do
    pcall(require, modules[i])
end

-- lazy init
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
    vim.fn.system(
    {
        "git",
        "clone",
        "--filter=blob:none",
        "https://github.com/folke/lazy.nvim.git",
        "--branch=stable",
        lazypath,
    }
    )
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup("plugins")
