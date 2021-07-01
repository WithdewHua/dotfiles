lua <<EOF
require'nvim-treesitter.configs'.setup {
    ensure_installed = {"html", "javascript", "css", "bash", "lua", "json", "yaml", "python"},
    highlight = {
        enable = true,              
        use_languagetree = true
    },
}
EOF

