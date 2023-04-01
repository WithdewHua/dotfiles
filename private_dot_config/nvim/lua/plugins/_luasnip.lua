return {
    {
        "rafamadriz/friendly-snippets",
        dependencies = "hrsh7th/nvim-cmp",
        event = "InsertCharPre"
    },
    {
       "L3MON4D3/LuaSnip",
        dependencies = "friendly-snippets",
        event = "InsertCharPre",
        config = function()
            require("luasnip").config.set_config(
            {
                history = true,
                updateevents = "TextChanged,TextChangedI"
            }
            )

            require("luasnip/loaders/from_vscode").load()
        end
    },

}
