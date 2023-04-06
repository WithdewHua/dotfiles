return {
    {
        "ibhagwan/fzf-lua",
        event = "VimEnter",
        dependencies = {
            "nvim-tree/nvim-web-devicons",
            { "junegunn/fzf", build = "./install --bin", }
        },
        config = function()
            require("fzf-lua").setup {
                -- providers
                files = {
                    prompt = 'Files❯ ',
                    rg_opts = "--color=never --files --hidden --no-ignore --follow -g '!.git'",
                    fd_opts = "--color=never --type f --hidden --no-ignore --follow --exclude .git",
                }
            }
        end,
    },

}
