return {
    -- portable package manager
    {
        "williamboman/mason.nvim",
        cmd = "Mason",
        config = function ()
            require("mason").setup()
        end
    }
}
