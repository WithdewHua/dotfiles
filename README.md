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

## Windows

Windows is a partial target: Neovim, Pi, GnuPG, Git, and the Python formatting configs
are managed there. The zsh, tmux, terminal emulator, and vim files are skipped by
`chezmoi apply` — see `.chezmoiignore`.

### Prerequisites

1. Install GnuPG and import the private key. It has to exist before the first apply,
   because the encrypted files are decrypted during that same run:

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

3. Install chezmoi, then init and answer:

   - `y` to "Decrypt encrypted data" — needed for the Pi provider keys;
   - `n` to "Manage SSH/Claude/opencode settings" unless this machine really should
     use the SSH keys and agent settings from the repo. Answering `y` overwrites
     `%USERPROFILE%\.ssh\config`, `.claude\settings.json`, and
     `.config\opencode\opencode.json` on this machine.

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

### Encrypted files

Two separate answers, because they serve different needs:

- "Decrypt encrypted data" (`personal_secrets`) unlocks the GPG-encrypted files and
  manages `~/.pi/agent/models.json` — the gateway API keys Pi needs to reach a
  provider — plus `gpg-agent.conf`. Without it Pi has no configured provider.
- "Manage SSH/Claude/opencode settings" (`personal_keys`) additionally manages
  `~/.ssh`, `~/.claude`, and `~/.config/opencode`. These are machine-local: applying
  them overwrites what the machine already has, so on a second machine keep this off.
  It fails safe — a config without `personal_keys` leaves them unmanaged.

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


