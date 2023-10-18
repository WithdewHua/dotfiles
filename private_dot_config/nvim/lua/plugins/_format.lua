return {
    {
        "mhartington/formatter.nvim",
        cmd = "Format",
        event = "BufRead",
        config = function()
            require("formatter").setup({
                -- Enable or disable logging
                logging = true,
                -- Set the log level
                log_level = vim.log.levels.WARN,
                filetype = {
                    python = {
                        function()
                            return {
                                exe = "black",
                                args = {
                                    "--line-length 88",
                                    "-",
                                },
                                stdin = true,
                            }
                        end
                    },
                    -- Use the special "*" filetype for defining formatter configurations on
                    -- any filetype
                    ["*"] = {
                      -- "formatter.filetypes.any" defines default configurations for any
                      -- filetype
                      require("formatter.filetypes.any").remove_trailing_whitespace
                    }
                }
            })
        end
    },
}
