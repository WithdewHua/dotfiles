return {
    {
        "windwp/nvim-autopairs",
        dependencies = "hrsh7th/nvim-cmp",
        event = "InsertEnter",
        config = function()
            local autopairs, autopairs_completion = require("nvim-autopairs"), require("nvim-autopairs.completion.cmp")
            autopairs.setup()
            require("cmp").event:on("confirm_done", autopairs_completion.on_confirm_done())
        end
    },
}
