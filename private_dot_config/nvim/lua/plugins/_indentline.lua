return {
    -- indent line
    {
        "lukas-reineke/indent-blankline.nvim",
        event = "BufRead",
        main = "ibl",
        config = function()
            require("ibl").setup()
        end
    },
}
