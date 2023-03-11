local mason

if
    not pcall(function()
        mason = require('mason')
    end)
then
    return
end

mason.setup()
