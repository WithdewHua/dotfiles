## WithdewHua's Dotfiles

## Intro

- Personal dotfiles for macOS/Linux, with partial Windows support;
- Managed by [chezmoi](https://github.com/twpayne/chezmoi)

## Usage

### Installation

macOS/Linux:

```bash
bash <(curl -fsLS chezmoi.io/get) -b /usr/local/bin -- init --apply --verbose WithdewHua
```

Windows (see [Windows](#windows) for the prerequisites):

```powershell
winget install --id twpayne.chezmoi --exact
chezmoi init --apply --verbose WithdewHua
```

### Update

```bash
chezmoi update
```

## What a machine manages

One answer during `chezmoi init` decides which of the personal, GPG-encrypted files
this machine takes. It is stored as `profile` in the `data` section of
`~/.config/chezmoi/chezmoi.yaml`; change it there and run `chezmoi apply` to move a
machine to another level.

| `profile` | Manages | Needs GPG |
| --- | --- | --- |
| `tools` | Neovim, Pi (without provider keys), Git, Python formatting | no |
| `providers` | + `~/.pi/agent/models.json` (the gateway API keys Pi needs) and `gpg-agent.conf` | yes |
| `all` | + `~/.ssh`, `~/.claude`, `~/.config/opencode` | yes |

`all` overwrites what the machine already has there, so it only fits the machine the
files come from. Everything else stops at `providers`. A config without `profile` is
treated as `tools`, which manages the fewest files.

## Windows

Windows is a partial target: Neovim, Pi, GnuPG, Git, and the Python formatting configs
are managed there (per the [profile](#what-a-machine-manages)). The zsh, tmux,
terminal emulator, and vim files are skipped by `chezmoi apply` — see `.chezmoiignore`.

### Prerequisites

1. From `providers` up, install GnuPG and import the private key. It has to exist
   before the first apply, because the encrypted files are decrypted during that same
   run:

   ```powershell
   winget install --id GnuPG.GnuPG --exact
   gpg --import private-key.asc
   ```

   If `gpg --version` still fails afterwards, add `C:\Program Files (x86)\GnuPG\bin`
   to PATH. chezmoi falls back to that directory on its own, but nothing else does.

2. Install Pi, so its config directory exists and can be managed:

   ```powershell
   powershell -c "irm https://pi.dev/install.ps1 | iex"
   ```

3. Install chezmoi, then init and answer `providers` to "This machine manages
   (tools / providers / all)" — that is the only secrets question, and it keeps the
   machine's own SSH keys and agent settings alone (see
   [What a machine manages](#what-a-machine-manages)).

   ```powershell
   winget install --id twpayne.chezmoi --exact
   chezmoi init --apply --verbose WithdewHua
   ```

4. Open a new terminal so `XDG_CONFIG_HOME` takes effect, then start `nvim` and let
   lazy.nvim install the plugins.

### What the Windows apply does

- `run_once_before_10-install-packages-windows.ps1` installs Git, Neovim, GnuPG,
  ripgrep, and fd through winget, plus node, uv, jq, bat, fzf, and zoxide when
  `install_more_packages` is enabled. Already installed packages are skipped.
- `run_once_before_00-configure-windows-env.ps1` sets `XDG_CONFIG_HOME` to `~/.config`,
  because Neovim on Windows otherwise reads `%LOCALAPPDATA%\nvim`.
- `run_onchange_after_90-install-pi-packages.ps1` installs and patches the Pi packages
  from `~/.pi/agent/settings.json`, the same pipeline the macOS/Linux apply runs.

## Managed

### ZSH

### Git

### Vim/Neovim

- `~/.config/nvim` (LazyVim)

### Pi

- `~/.pi/agent` settings, extensions, and patch scripts
- Package install/patch pipeline: `90-install-pi-packages.{sh,ps1}`

### Tmux

### Terminal emulators

- `Alacritty`
- `WezTerm`

### Python related

- `pip`
- `black`
- `isort`
- `flake8`

### SSH

- `~/.ssh/config` and keys (encrypted)

### GnuPG

- `gpg-agent.conf` — `~/.gnupg` on macOS/Linux, `%APPDATA%\gnupg` on Windows


