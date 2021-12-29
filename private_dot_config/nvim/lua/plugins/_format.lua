local present, formatter = pcall(require, 'formatter')

if not present then
  return
end

formatter.setup({
    filetype = {
        python = {
            function()
                return {
                    exe = "black",
                    args = {
                        "--line-length 128",
                        "-",
                        stdin = true,
                    }
                }
            end
        }
    }
})
