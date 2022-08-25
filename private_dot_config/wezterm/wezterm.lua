local wezterm = require("wezterm")

return {
    -- font
    font = wezterm.font("CaskaydiaCove Nerd Font"),
    font_size = 12,
    -- keyboard
    use_dead_keys = false,
    -- color scheme
    color_scheme = "Gruvbox dark, medium (base16)",
    -- scrollback
    scrollback_lines = 10000,
    enable_scroll_bar = true,
    native_macos_fullscreen_mode = true,

    audible_bell = "Disabled",
}
