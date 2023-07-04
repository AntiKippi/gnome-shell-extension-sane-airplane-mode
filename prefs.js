const Gtk            = imports.gi.Gtk;
const Gio            = imports.gi.Gio;
const GObject        = imports.gi.GObject;
const ExtensionUtils = imports.misc.extensionUtils;

const Gettext = imports.gettext;
const _ = Gettext.domain('sane-airplane-mode').gettext;

const Constants      = ExtensionUtils.getCurrentExtension().imports.constants;
const SettingsSchema = ExtensionUtils.getSettings(Constants.SCHEMA_NAME);

const Config = imports.misc.config;
const shellVersion = parseFloat(Config.PACKAGE_VERSION);

const gtkVersion = Gtk.get_major_version();


function init() { }

const App = GObject.registerClass(class Settings extends GObject.Object {
    _init() {
        // Polyfills for GTK3
        if (gtkVersion < 4) {
            Gtk.Box.prototype.append = function(widget) {
                return this.pack_start(widget, false, false, 0);
            };

            Gtk.Frame.prototype.set_child = function(widget) {
                return this.add(widget);
            };
        }

        this.main = new Gtk.Grid({
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 10,
            margin_end: 10,
            row_spacing: 12,
            column_spacing: 18,
            column_homogeneous: false,
            row_homogeneous: false,
        });

        let initialRow = 0;

        // Display warning when GNOME shell version is not supported
        if (shellVersion < 3.36) {
            // Apply css style to widgets
            const styleWidget = (css, widget) => {
                let cssProvider = new Gtk.CssProvider();
                cssProvider.load_from_data(css);
                let context = widget.get_style_context();
                context.add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
            };

            // We use the first three rows for the warning, so lets move the other stuff 3 rows down
            initialRow = 3;

            let warningFrame = new Gtk.Frame();
            let warningBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
            let warningLabel = new Gtk.Label({
                label: `<b>  ⚠ ${_('Warning')}:</b> ${_('This extension is not supported on your version of GNOME Shell')}. `,
                halign: Gtk.Align.START,
                use_markup: true,
                visible: true,
            });
            let warningDetailsLabel = new Gtk.Label({
                label: `(<a href="${Constants.GITHUB_URL}">${_('Details')}</a>)`,
                halign: Gtk.Align.START,
                use_markup: true,
                visible: true,
            });

            styleWidget('* { background-color: #ffc107; }', warningBox);
            styleWidget('* { color: black; }', warningLabel);
            styleWidget('* { color: #0d6efd; }', warningDetailsLabel);

            warningBox.append(warningLabel);
            warningBox.append(warningDetailsLabel);
            warningFrame.set_child(warningBox);

            this.main.attach(warningFrame, 0, 0, 2, 3);

            // We add two empty labels as padding
            this.main.attach(new Gtk.Label(), 0, 1, 2, 1);
            this.main.attach(new Gtk.Label(), 0, 2, 2, 1);
        }

        this.field_wifi_toggle = new Gtk.Switch();
        this.field_bluetooth_toggle = new Gtk.Switch();
        this.field_airplane_toggle = new Gtk.Switch();
        this.field_debug_toggle = new Gtk.Switch({
            halign: Gtk.Align.END,
        });
        this.field_interval_input = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 1000,
                step_increment: 5,
                page_increment: 50,
            }),
        });
        this.field_count_input = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 1000,
                step_increment: 1,
                page_increment: 10,
            }),
        });

        let airplaneTitleLabel = new Gtk.Label({
            label: `<b>${_('When disabling airplane mode')}:</b>`,
            halign: Gtk.Align.START,
            use_markup: true,
            visible: true,
        });
        let wifiLabel = new Gtk.Label({
            label: _('Enable Wi-Fi'),
            hexpand: true,
            halign: Gtk.Align.START,
        });
        let bluetoothLabel = new Gtk.Label({
            label: _('Enable Bluetooth'),
            hexpand: true,
            halign: Gtk.Align.START,
        });
        let wifiTitleLabel = new Gtk.Label({
            label: `<b>${_('When disabling Wi-Fi (as the last active radio)')}:</b>`,
            halign: Gtk.Align.START,
            use_markup: true,
            visible: true,
        });
        let enableAirplaneLabel = new Gtk.Label({
            label: _('Enable airplane mode'),
            hexpand: true,
            halign: Gtk.Align.START,
        });
        let applySettingsIntervalLabel = new Gtk.Label({
            label: _('Setting application interval (in ms)'),
            hexpand: true,
            halign: Gtk.Align.START,
        });
        let applySettingsCountLabel = new Gtk.Label({
            label: _('Setting application count'),
            hexpand: true,
            halign: Gtk.Align.START,
        });
        let debugLogLabel = new Gtk.Label({
            label: _('Enable debug log'),
            hexpand: true,
            halign: Gtk.Align.START,
        });

        let advancedExpander = new Gtk.Expander({
            label: `<b>${_('Advanced')}</b>`,
            hexpand: true,
            use_markup: true,
        });

        let advancedGrid = new Gtk.Grid({
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 0,
            margin_end: 0,
            row_spacing: 12,
            column_spacing: 18,
            column_homogeneous: false,
            row_homogeneous: false,
            hexpand: true,
        });

        advancedExpander.set_child(advancedGrid);

        const addRowTemplate = (grid) => {
            let row = initialRow;
            return (label, input) => {
                function attachWidget(widget, column, width, height) {
                    if (widget) {
                        grid.attach(widget, column, row, width, height);
                    }
                }

                if (label) {
                    grid.attach(label, 0, row, 1, 1);   // We already know 'label' is defined
                    attachWidget(input, 1, 1, 1);
                } else {
                    attachWidget(input, 0, 2, 1);
                }

                row++;
            };
        };

        this.main.addRow = addRowTemplate(this.main);
        this.main.addRow(airplaneTitleLabel,  undefined);
        this.main.addRow(wifiLabel,           this.field_wifi_toggle);
        this.main.addRow(bluetoothLabel,      this.field_bluetooth_toggle);
        this.main.addRow(wifiTitleLabel,      undefined);
        this.main.addRow(enableAirplaneLabel, this.field_airplane_toggle);
        this.main.addRow(undefined,           advancedExpander);

        advancedGrid.addRow = addRowTemplate(advancedGrid);
        advancedGrid.addRow(applySettingsIntervalLabel, this.field_interval_input);
        advancedGrid.addRow(applySettingsCountLabel,    this.field_count_input);
        advancedGrid.addRow(debugLogLabel,              this.field_debug_toggle);

        SettingsSchema.bind(Constants.Fields.ENABLE_WIFI,          this.field_wifi_toggle,      'active', Gio.SettingsBindFlags.DEFAULT);
        SettingsSchema.bind(Constants.Fields.ENABLE_BLUETOOTH,     this.field_bluetooth_toggle, 'active', Gio.SettingsBindFlags.DEFAULT);
        SettingsSchema.bind(Constants.Fields.ENABLE_AIRPLANE_MODE, this.field_airplane_toggle,  'active', Gio.SettingsBindFlags.DEFAULT);
        SettingsSchema.bind(Constants.Fields.ENABLE_DEBUG_LOG,     this.field_debug_toggle,     'active', Gio.SettingsBindFlags.DEFAULT);
        SettingsSchema.bind(Constants.Fields.APPLY_INTERVAL,       this.field_interval_input,   'value',  Gio.SettingsBindFlags.DEFAULT);
        SettingsSchema.bind(Constants.Fields.APPLY_COUNT,          this.field_count_input,      'value',  Gio.SettingsBindFlags.DEFAULT);

        if (gtkVersion < 4) {
            this.main.show_all();
        }
    }
});

function buildPrefsWidget() {
    let widget = new App();
    return widget.main;
}
