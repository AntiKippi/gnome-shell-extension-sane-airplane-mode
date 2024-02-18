# Sane Airplane Mode Tests

This extension tests the Sane Airplane Mode functionality. Testing GNOME Shell extensions is not an easy task and I figured creating a separate extension for it is the best, because extensions can easily make direct interactions with the GNOME Shell.

## Installation
The installation is the same as for any other extension, just copy the `tests` folder into your local gnome-shell extensions directory (usually `~/.local/share/gnome-shell/extensions/`) and rename it to `sane-airplane-mode-tests@kippi`:

    $ cp -r tests/ <extensions-dir>/sane-airplane-mode-tests@kippi

Then restart your GNOME Shell and enable the extension in the 'Extensions' application.

## Usage
Configuration and communication mostly takes place directly via the dconf schema of the extension, which is `org.gnome.shell.extensions.sane-airplane-mode-tests`.

The output of the test runs however, is stored in the file specified by the `print-file` key in the aforementioned schema (`/tmp/sam-tests/test.log` by default).

To change a dconf key, use the following command:

    $ gsettings --schemadir <etensions-dir>/sane-airplane-mode-tests@kippi/schemas set org.gnome.shell.extensions.sane-airplane-mode-tests <key> <value>

Or use this shorter alternative. Note however that this method did not always work for me:

    $ dconf write /org/gnome/shell/extensions/sane-airplane-mode-tests/<key> <value>

### Run the tests
To run the test suite, write `true` to the `start-tests` key in the  extensions dconf schema. It will automatically reset to `false` after the suite has been run.

### Disable individual tests
Every test has a corresponding dconf key. To disable individual tests just write `false` to the corresponding dconf key for the test you want to disable.
