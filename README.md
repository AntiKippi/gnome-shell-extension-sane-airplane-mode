# Sane Airplane Mode

Make airplane mode sane again! This extension gives you better control over the airplane mode. Or at least it is my attempt to make a utterly broken airplane mode implementation somewhat sane to handle.

With this extension you can stop the annoying "Bluetooth gets turned on when I disable airplane mode" behavior.


## Known limitations

 - When in airplane mode, I found no way to distinguish turning on Bluetooth from turning off airplane mode (Any help is welcome here).  
   This means when you turn on Bluetooth when in airplane mode the following happens:
   - When "Enable Wi-Fi" is enabled Wi-Fi gets enabled even tough you only wanted to toggle Bluetooth.
   - When "Enable Bluetooth" is disabled Bluetooth won't turn on.
 - When choosing not to enable both Bluetooth and Wi-Fi airplane mode _might_ get reactivated. Although this behavior (at least on my machine) is only observed the first time disabling airplane mode, since then it works perfectly well.
 - If you change the radio settings too fast (within `DISABLE_RADIO_INTERVAL * MAX_INTERVAL_COUNT` milliseconds), unexpected behavior may occur.
 - This extension has no support for mobile broadband networking since I don't need this feature. If support for this is needed please let me know by opening a issue or if you are a developer you might as well create a pull request.
 - The extension also doesn't support multiple Wi-Fi/Bluetooth radios. It _might_ work but it has and will not be tested.


 ## GNOME Version Support
Since version 2 only GNOME Shell v45+ is supported, so please don't report issues if you run an older GNOME Shell.

If your GNOME Shell version is between 3.36 and 44 you can use the older v1.1.15 version of the extension. If it is smaller than 3.36 (e.g. 3.34, 3.32, etc), the v1 version _may_ work fine as well but I can't guarantee for anything.


## Installation

### GNOME Extensions

[!["Install from extensions.gnome.org"](ego.svg)](https://extensions.gnome.org/extension/4604/)

### Git

Installation via git is performed by cloning the repo into your local gnome-shell extensions directory (usually `~/.local/share/gnome-shell/extensions/`):

    $ git clone https://github.com/AntiKippi/gnome-shell-extension-sane-airplane-mode.git <extensions-dir>/sane-airplane-mode@kippi

After cloning the repo, the extension is practically installed yet disabled. In order to enable it, find the extension titled 'Sane Airplane Mode', in the 'Extensions' application and turn it 'On'.  
You may need to restart the GNOME Shell (<kbd>Alt</kbd>+<kbd>F2</kbd> and insert 'r' in the prompt or logout if you are on Wayland) for the extension to be listed there.


## Donations
I currently don't accept donations. However if you find my work useful and want to say "Thank you!" consider starring this repository ⭐
