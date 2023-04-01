return {
    {
        "akinsho/toggleterm.nvim",
        event = "BufRead",
        config = function()
            require("toggleterm").setup {
                open_mapping = [[<C-t>]],
                hide_number = true,
                shade_filetypes = {},
                shade_terminals = true,
                start_in_insert = true,
                insert_mappings = true,
                persist_size = true,
                close_on_exit = true,
            }
        end
    },
}
