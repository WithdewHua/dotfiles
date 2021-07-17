local autosession

if 
    not pcall(
        function()
            autosession = require("auto-session")
        end
    )
then
    return
end

autosession.setup{
    log_level = 'info',
    auto_session_enable_laste_session = false,
    auto_session_root_dir = vim.fn.stdpath('config').."/sessions/",
    auto_session_enabled = true,
    auto_save_enabled = false,
    auto_restore_enabled = nil,
    auto_session_suppress_dirs = nil
}
