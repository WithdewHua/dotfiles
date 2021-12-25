local autopairs, autopairs_completion
if
    not pcall(
        function()
            autopairs = require "nvim-autopairs"
            autopairs_completion = require "nvim-autopairs.completion.cmp"
        end
    )
 then
    return
end

autopairs.setup()

local cmp = require "cmp"
cmp.event:on("confirm_done", autopairs_completion.on_confirm_done())
