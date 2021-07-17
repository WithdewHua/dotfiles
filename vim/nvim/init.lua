-- load general options
require "options"

-- load plugins
require "pack"

-- load keybindings 
require "mappings"

-- load theme
require "theme"

if require "theme" then
    local async
    async = 
        vim.loop.new_async(
            vim.schedule_wrap(
                function()
                    require "pack"
                    require "mappings"

                    async:close()
                end
            )
        )
    async:send()
else
    require "pack"
    print("Now PackerSync will be executed, after completion, restart nvim.\n")
    vim.cmd("PackerSync")
end
