local function session_status()
    if vim.g.persisting then
        return " "
    else
        return " "
    end
end

return {
    {
        'nvim-lualine/lualine.nvim',
        dependencies = {'nvim-tree/nvim-web-devicons'},
        config = function()
            require("lualine").setup {
                options = {
                    icons_enabled = true,
                    -- theme = 'gruvbox-material',
                    theme = 'catppuccin',
                    component_separators = { left = '', right = ''},
                    section_separators = { left = '', right = ''},
                    disabled_filetypes = {},
                    always_divide_middle = true,
                },
                sections = {
                    lualine_a = {'mode'},
                    lualine_b = {
                        'branch',
                        {
                            'diff',
                            sources="b:gitsigns_status_dict",
                        },
                        {
                            'diagnostics',
                            sources={'nvim_diagnostic', 'coc'}
                        }
                    },
                    lualine_c = {
                        { session_status },
                        { 'filename', newfile_status=true, path=1 },
                    },
                    lualine_x = {'encoding', 'fileformat', 'filetype'},
                    lualine_y = {'progress'},
                    lualine_z = {'location'}
                },
                inactive_sections = {
                    lualine_a = {},
                    lualine_b = {},
                    lualine_c = {'filename'},
                    lualine_x = {'location'},
                    lualine_y = {},
                    lualine_z = {}
                },
                tabline = {},
                extensions = {}
            }
        end
    },
}
