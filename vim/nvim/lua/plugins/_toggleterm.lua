local toggleterm

if
    not pcall(function ()
        toggleterm = require('toggleterm')
    end)
then
    return
end

toggleterm.setup{
    open_mapping = [[<C-t>]],
    hide_number = true,
    shade_filetypes = {},
    shade_terminals = true,
    start_in_insert = true,
    insert_mappings = true,
    persist_size = true,
    close_on_exit = true,
}
