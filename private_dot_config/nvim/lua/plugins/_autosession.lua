return {
    -- session management
    {
        "rmagatti/auto-session",
        config = function()
            require("auto-session").setup{
                log_level = 'info',
                auto_session_enable_laste_session = false,
                auto_session_root_dir = vim.fn.stdpath('config').."/sessions/",
                auto_session_enabled = true,
                auto_save_enabled = true,
                auto_restore_enabled = nil,
                auto_session_suppress_dirs = nil
            }
        end
    },
    {
        "rmagatti/session-lens",
        dependencies = { "auto-session", "telescope.nvim" },
        config = function()
            require('session-lens').setup{
                previewer = true,
            }
        end
    },
}
