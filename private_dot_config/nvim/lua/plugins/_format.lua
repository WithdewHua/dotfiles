local present, formatter = pcall(require, 'formatter')

if not present then
  return
end

formatter.setup({
    filetype = {
        python = {
            function()
                retrun {
                    exe = "black",
                    args = {
                        "--line-length 120",
                        "-",
                        stdin = true,
                    }
                }
            end
        }
    }
})
