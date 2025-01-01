return {
	"williamboman/mason.nvim",
	opts = {
		ensure_installed = {
			"pyright",
			"ruff",
			"yaml-language-server",
			"json-lsp",
			"bash-language-server",
		},
	},
}
