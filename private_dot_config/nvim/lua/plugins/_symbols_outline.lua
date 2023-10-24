return {
    {
        'simrat39/symbols-outline.nvim',
        event = {"BufRead"},
        config = function ()
            require("symbols-outline").setup()
        end
    }
}
