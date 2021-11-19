const Gtk            = imports.gi.Gtk;
const Gio            = imports.gi.Gio;
const GObject        = imports.gi.GObject;
const ExtensionUtils = imports.misc.extensionUtils;

const Gettext = imports.gettext;
const _ = Gettext.domain('sane-airplane-mode').gettext;

const Constants      = ExtensionUtils.getCurrentExtension().imports.constants;
const SettingsSchema = ExtensionUtils.getSettings(Constants.SCHEMA_NAME);


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
        this.field_wifi_toggle = new Gtk.Switch();
        this.field_bluetooth_toggle = new Gtk.Switch();

        let titleLabel = new Gtk.Label({
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

        const addRow = (main => {
            let row = 0;
            return (label, input) => {
                function attachWidget(widget, column, width, height) {
                    if (widget) {
                        main.attach(widget, column, row, width, height);
                    }
                }

                let inputWidget = input;

                if (input instanceof Gtk.Switch) {
                    inputWidget = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
                    inputWidget.append(input);
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

        addRow(titleLabel,     undefined);
        addRow(wifiLabel,      this.field_wifi_toggle);
        addRow(bluetoothLabel, this.field_bluetooth_toggle);

        SettingsSchema.bind(Constants.Fields.ENABLE_WIFI,      this.field_wifi_toggle,      'active', Gio.SettingsBindFlags.DEFAULT);
        SettingsSchema.bind(Constants.Fields.ENABLE_BLUETOOTH, this.field_bluetooth_toggle, 'active', Gio.SettingsBindFlags.DEFAULT);
    }
});

function buildPrefsWidget() {
    let widget = new App();
    return widget.main;
}
