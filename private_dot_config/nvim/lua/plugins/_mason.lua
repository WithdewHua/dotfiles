return {
    -- portable package manager
    {
        "williamboman/mason.nvim",
        event = "VimEnter",
        dependencies = {
            "williamboman/mason-lspconfig.nvim",
            "neovim/nvim-lspconfig",
        },
        config = function ()
            require("mason").setup()
        end
    }
}
