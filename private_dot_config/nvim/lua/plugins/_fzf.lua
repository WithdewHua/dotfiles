return {
    {
        "ibhagwan/fzf-lua",
        event = "VimEnter",
        dependencies = {
            "nvim-tree/nvim-web-devicons",
            { "junegunn/fzf", build = "./install --bin", }
        },
    },

}
