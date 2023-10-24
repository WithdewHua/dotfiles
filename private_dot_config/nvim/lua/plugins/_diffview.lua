return {
    {
        "sindrets/diffview.nvim",
        cmd = {"DiffviewOpen", "DiffviewFileHistory"},
        event = {"BufRead"},
        config = function ()
            require("diffview").setup()
        end
    }
}
