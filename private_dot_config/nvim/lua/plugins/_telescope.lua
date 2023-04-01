return {
    {
        "nvim-telescope/telescope.nvim",
        dependencies = {
            "plenary.nvim",
            "popup.nvim",
            -- telescope plugin
            "nvim-telescope/telescope-media-files.nvim",
            'nvim-telescope/telescope-fzf-native.nvim',
            "session-lens",
        },
        config = function()
            require("telescope").setup {
                defaults = {
                    mappings = {
                        i = {
                            ["<esc>"] = require("telescope.actions").close
                        }
                    },
                    vimgrep_arguments = {
                        'rg',
                        '--color=never',
                        '--no-heading',
                        '--with-filename',
                        '--line-number',
                        '--column',
                        '--smart-case'
                    },
                    prompt_prefix = "> ",
                    selection_caret = "> ",
                    entry_prefix = "  ",
                    initial_mode = "insert",
                    selection_strategy = "reset",
                    sorting_strategy = "descending",
                    layout_strategy = "horizontal",
                    layout_config = {
                        horizontal = {
                            mirror = false,
                        },
                        vertical = {
                            mirror = false,
                        },
                    },
                    file_sorter =  require'telescope.sorters'.get_fuzzy_file,
                    file_ignore_patterns = {},
                    generic_sorter =  require'telescope.sorters'.get_generic_fuzzy_sorter,
                    winblend = 0,
                    border = {},
                    borderchars = { '─', '│', '─', '│', '╭', '╮', '╯', '╰' },
                    color_devicons = true,
                    use_less = true,
                    path_display = {},
                    set_env = { ['COLORTERM'] = 'truecolor' }, -- default = nil,
                    file_previewer = require'telescope.previewers'.vim_buffer_cat.new,
                    grep_previewer = require'telescope.previewers'.vim_buffer_vimgrep.new,
                    qflist_previewer = require'telescope.previewers'.vim_buffer_qflist.new,

                    -- Developer configurations: Not meant for general override
                    buffer_previewer_maker = require'telescope.previewers'.buffer_previewer_maker
                },
                extensions = {
                    fzf = {
                        fuzzy = true,
                        override_generic_sorter = false,
                        override_file_sorter = true,
                        case_mode = "smart_case"
                    },
                    media_files = {
                        filetypes = {"png", "webp", "jpg", "jpeg"},
                        find_cmd = "rg"
                    }
                }
            }
        end
    }
}
