const Gtk            = imports.gi.Gtk;
const Gio            = imports.gi.Gio;
const GObject        = imports.gi.GObject;
const ExtensionUtils = imports.misc.extensionUtils;

const Gettext = imports.gettext;
const _ = Gettext.domain('sane-airplane-mode').gettext;

const Constants      = ExtensionUtils.getCurrentExtension().imports.constants;
const SettingsSchema = ExtensionUtils.getSettings(Constants.SCHEMA_NAME);

const gtkVersion = Gtk.get_major_version();

const Config = imports.misc.config;
const shellVersion = parseFloat(Config.PACKAGE_VERSION);


function init() { }

const App = GObject.registerClass(class Settings extends GObject.Object {
    _init() {
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

        this.field_wifi_toggle = new Gtk.Switch();
        this.field_bluetooth_toggle = new Gtk.Switch();
        this.field_airplane_toogle = new Gtk.Switch();

        let airplaneTitleLabel = new Gtk.Label({
            label: '<b>' + _('When disabling airplane mode') + ':</b>',
            halign: Gtk.Align.START,
            use_markup: true,
            visible: true,
        });
        let wifiLabel  = new Gtk.Label({
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
            label: '<b>' + _('When disabling Wi-Fi (as the last active radio)') + ':</b>',
            halign: Gtk.Align.START,
            use_markup: true,
            visible: true,
        });
        let enableAirplaneLabel  = new Gtk.Label({
            label: _('Enable airplane mode'),
            hexpand: true,
            halign: Gtk.Align.START,
        });

        const addRow = (main => {
            let row = initialRow;
            return (label, input) => {
                function attachWidget(widget, column, width, height) {
                    if (widget) {
                        main.attach(widget, column, row, width, height);
                    }
                }

                let inputWidget = input;

                if (input instanceof Gtk.Switch) {
                    inputWidget = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });

                    if (gtkVersion >= 4) {
                        inputWidget.append(input);
                    } else {
                        inputWidget.pack_end(input, false, false, 0);
                    }
                }

                if (label) {
                    main.attach(label, 0, row, 1, 1);
                    attachWidget(inputWidget, 1, 1, 1);
                } else {
                    attachWidget(inputWidget, 0, 2, 1);
                }

                row++;
            };
        })(this.main);

        addRow(airplaneTitleLabel,  undefined);
        addRow(wifiLabel,           this.field_wifi_toggle);
        addRow(bluetoothLabel,      this.field_bluetooth_toggle);
        addRow(wifiTitleLabel,      undefined);
        addRow(enableAirplaneLabel, this.field_airplane_toogle);

        SettingsSchema.bind(Constants.Fields.ENABLE_WIFI,          this.field_wifi_toggle,      'active', Gio.SettingsBindFlags.DEFAULT);
        SettingsSchema.bind(Constants.Fields.ENABLE_BLUETOOTH,     this.field_bluetooth_toggle, 'active', Gio.SettingsBindFlags.DEFAULT);
        SettingsSchema.bind(Constants.Fields.ENABLE_AIRPLANE_MODE, this.field_airplane_toogle,  'active', Gio.SettingsBindFlags.DEFAULT);

        if (gtkVersion < 4) {
            this.main.show_all();
        }
    }
});

function buildPrefsWidget() {
    let widget = new App();
    return widget.main;
}
