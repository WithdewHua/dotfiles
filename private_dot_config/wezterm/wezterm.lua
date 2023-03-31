local wezterm = require "wezterm"

local config = {}

-- In newer versions of wezterm, use the config_builder which will
-- help provide clearer error messages
if wezterm.config_builder then
  config = wezterm.config_builder()
end

-- font
config.font = wezterm.font("CaskaydiaCove Nerd Font")
config.font_size = 12
-- keyboard
config.use_dead_keys = false
-- color scheme
config.color_scheme = "Gruvbox dark, medium (base16)"
-- scrollback
config.scrollback_lines = 10000
config.enable_scroll_bar = true
config.native_macos_fullscreen_mode = true

config.audible_bell = "Disabled"

return config
