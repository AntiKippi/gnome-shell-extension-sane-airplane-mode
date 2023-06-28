# Sane Airplane Mode

Make airplane mode sane again! This extension gives you better control over the airplane mode. Or at least it is my attempt to make a utterly broken airplane mode implementation somewhat sane to handle.  
With this extension you can turn off the annoying "Bluetooth gets turned on when I disable airplane mode" behaviour.

## Known limitations

 - When in airplane mode, I found no way to distinguish turning on Bluetooth from turning off airplane mode (Any help is welcome here).  
   This means when you turn on Bluetooth when in airplane mode the following happens:
   - When "Enable Wi-Fi" is enabled Wi-Fi gets enabled even tough you only wanted to toggle Bluetooth.
   - When "Enable Bluetooth" is disabled Bluetooth won't turn on. 
 - When choosing not to enable both Bluetooth and Wi-Fi airplane mode might get reactivated. Altough this behaviour (at least on my machine) is only observed the first time disabling airplane mode, since then it works perfectly well.
 - This extension has no support for mobile broadband networking since I don't need this feature. If support for this is needed please let me know by opening a issue or if you are a developer you might as well create a pull request.


 ## GNOME Version Support
All GNOME Shell versions back to GNOME Shell 3.36 are supported.

If your GNOME Shell version is smaller than 3.36 (e.g. 3.34, 3.32, etc), this extension _may_ work fine as well but I can't guarantee for anything. Please don't report issues if your GNOME Shell version is < 3.36.
 

## Installation

### GNOME Extensions

[!["Install from extensions.gnome.org"](ego.svg)](https://extensions.gnome.org/extension/4604/)

### Git

Installation via git is performed by cloning the repo into your local gnome-shell extensions directory (usually ~/.local/share/gnome-shell/extensions/):

    $ git clone https://github.com/AntiKippi/gnome-shell-extension-sane-airplane-mode.git <extensions-dir>/sane-airplane-mode@kippi

After cloning the repo, the extension is practically installed yet disabled. In order to enable it, find the extension titled 'Sane Airplane Mode', in the 'Extensions' application and turn it 'On'.
You may need to restart the GNOME shell (<kbd>Alt</kbd>+<kbd>F2</kbd> and insert 'r' in the prompt) for the extension to be listed there.
