return {
    {
        "neovim/nvim-lspconfig",
        event = "BufRead",
        dependencies = {
            "mason.nvim",
            "williamboman/mason-lspconfig.nvim",
        },
        config = function()
            local lspconfig, lsp_installer = require("lspconfig"), require("mason-lspconfig")

            local capabilities = vim.lsp.protocol.make_client_capabilities()
            capabilities.textDocument.completion.completionItem.documentationFormat = { "markdown", "plaintext" }
            capabilities.textDocument.completion.completionItem.snippetSupport = true
            capabilities.textDocument.completion.completionItem.preselectSupport = true
            capabilities.textDocument.completion.completionItem.insertReplaceSupport = true
            capabilities.textDocument.completion.completionItem.labelDetailsSupport = true
            capabilities.textDocument.completion.completionItem.deprecatedSupport = true
            capabilities.textDocument.completion.completionItem.commitCharactersSupport = true
            capabilities.textDocument.completion.completionItem.tagSupport = { valueSet = { 1 } }
            capabilities.textDocument.completion.completionItem.resolveSupport = {
               properties = {
                  "documentation",
                  "detail",
                  "additionalTextEdits",
               },
            }
            capabilities.textDocument.foldingRange = {
                dynamicRegistration = false,
                lineFoldingOnly = true
            }

            -- replace the default lsp diagnostic symbols
            local function lspSymbol(name, icon)
               vim.fn.sign_define("LspDiagnosticsSign" .. name, { text = icon, numhl = "LspDiagnosticsDefault" .. name })
            end

            lspSymbol("Error", "")
            lspSymbol("Information", "")
            lspSymbol("Hint", "")
            lspSymbol("Warning", "")

            local lsp_publish_diagnostics_options = {
               virtual_text = {
                  prefix = "",
                  spacing = 0,
               },
               signs = true,
               underline = true,
               update_in_insert = false, -- update diagnostics insert mode
            }
            vim.lsp.handlers["textDocument/publishDiagnostics"] = vim.lsp.with(
               vim.lsp.diagnostic.on_publish_diagnostics,
               lsp_publish_diagnostics_options
            )
            vim.lsp.handlers["textDocument/hover"] = vim.lsp.with(vim.lsp.handlers.hover, {
               border = "single",
            })
            vim.lsp.handlers["textDocument/signatureHelp"] = vim.lsp.with(vim.lsp.handlers.signature_help, {
               border = "single",
            })

            -- suppress error messages from lang servers
            vim.notify = function(msg, log_level, _opts)
               if msg:match "exit code" then
                  return
               end
               if log_level == vim.log.levels.ERROR then
                  vim.api.nvim_err_writeln(msg)
               else
                  vim.api.nvim_echo({ { msg } }, true, {})
               end
            end

            -- lsp_installer
            -- Include the servers you want to have installed by default below
            lsp_installer.setup {
                ensure_installed = {
                    "pyright",
                    "ruff",
                    -- "ruff_lsp",
                    "yamlls",
                    "jsonls",
                    -- "sumneko_lua",
                    "bashls",
                    "lua_ls",
                }
            }

            -- Register a handler that will be called for all installed servers.
            local function on_attach(client, bufnr)
                -- Disable hover in favor of Pyright
                client.server_capabilities.hover = false

                -- Set up buffer-local keymaps
                local function buf_set_keymap(...) vim.api.nvim_buf_set_keymap(bufnr, ...) end
                local function buf_set_option(...) vim.api.nvim_buf_set_option(bufnr, ...) end

                -- Enable completion triggered by <c-x><c-o>
                buf_set_option('omnifunc', 'v:lua.vim.lsp.omnifunc')

                -- Mappings.
                local opts = { noremap=true, silent=true }

                -- see `:help vim.diagnostic.*` for documentation on any of the below functions
                buf_set_keymap('n', '<space>e', '<cmd>lua vim.diagnostic.open_float()<CR>', opts)
                buf_set_keymap('n', '[d', '<cmd>lua vim.diagnostic.goto_prev()<CR>', opts)
                buf_set_keymap('n', ']d', '<cmd>lua vim.diagnostic.goto_next()<CR>', opts)
                buf_set_keymap('n', '<space>q', '<cmd>lua vim.diagnostic.setloclist()<CR>', opts)

                -- See `:help vim.lsp.*` for documentation on any of the below functions
                buf_set_keymap('n', 'gD', '<cmd>lua vim.lsp.buf.declaration()<CR>', opts)
                buf_set_keymap('n', 'gd', '<cmd>lua vim.lsp.buf.definition()<CR>', opts)
                buf_set_keymap('n', 'K', '<cmd>lua vim.lsp.buf.hover()<CR>', opts)
                buf_set_keymap('n', 'gi', '<cmd>lua vim.lsp.buf.implementation()<CR>', opts)
                buf_set_keymap('n', '<C-k>', '<cmd>lua vim.lsp.buf.signature_help()<CR>', opts)
                buf_set_keymap('n', '<space>wa', '<cmd>lua vim.lsp.buf.add_workspace_folder()<CR>', opts)
                buf_set_keymap('n', '<space>wr', '<cmd>lua vim.lsp.buf.remove_workspace_folder()<CR>', opts)
                buf_set_keymap('n', '<space>wl', '<cmd>lua print(vim.inspect(vim.lsp.buf.list_workspace_folders()))<CR>', opts)
                buf_set_keymap('n', '<space>D', '<cmd>lua vim.lsp.buf.type_definition()<CR>', opts)
                buf_set_keymap('n', '<space>rn', '<cmd>lua vim.lsp.buf.rename()<CR>', opts)
                buf_set_keymap('n', '<space>ca', '<cmd>lua vim.lsp.buf.code_action()<CR>', opts)
                buf_set_keymap('n', 'gr', '<cmd>lua vim.lsp.buf.references()<CR>', opts)
                buf_set_keymap('n', '<space>fm', '<cmd>lua vim.lsp.buf.formatting()<CR>', opts)
            end


            local enhance_server_opts = {
                -- (optional) Customize the options passed to the server
                ["pyright"] = function(opts)
                    opts.settings = {
                        python = {
                            analysis = {
                                autoImportCompletions = false,
                            }
                        }
                    }
                end,
                ["ruff"] = function (opts)
                    opts.init_options = {
                        settings = {
                            args = {
                                "--config=" .. vim.loop.os_homedir() .. "/.ruff.toml"
                            }
                        }
                    }
                end

            }
            lsp_installer.setup_handlers {
                function (server_name)
                    -- Specify the default options which we'll use to setup all servers
                    local opts = {
                        on_attach = on_attach,
                        capabilities = capabilities,
                        autostart = true,
                    }

                    if enhance_server_opts[server_name] then
                        -- Enhance the default opts with the server-specific ones
                        enhance_server_opts[server_name](opts)
                    end

                    -- This setup() function is exactly the same as lspconfig's setup function.
                    -- Refer to https://github.com/neovim/nvim-lspconfig/blob/master/doc/server_configurations.md
                    lspconfig[server_name].setup(opts)
                end
            }
        end,
    },
}
