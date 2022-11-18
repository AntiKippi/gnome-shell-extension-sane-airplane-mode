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
        //Polyfills for GTK3
        if (gtkVersion < 4) {
            Gtk.Box.prototype.append = function(widget) {
                return this.pack_start(widget, false, false, 0);
            }

            Gtk.Frame.prototype.set_child = function(widget) {
                return this.add(widget);
            }
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

        //Display warning when GNOME shell version is not supported
        if (shellVersion < 3.36) {
            // Apply css style to widgets
            const styleWidget = function(css, widget) {
                let css_provider = new Gtk.CssProvider();
                css_provider.load_from_data(css);
                let context = widget.get_style_context();
                context.add_provider(css_provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
            }
            
            const GITHUB_URL = 'https://github.com/xKippi/gnome-shell-extension-sane-airplane-mode'

            // We use the first three rows for the warning, so lets move the other stuff 3 rows down
            initialRow = 3;

            let warning_frame = new Gtk.Frame();
            let warning_box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
            let warning_label = new Gtk.Label({
                label: '<b>' + '  ⚠ ' + _('Warning') + ':</b> ' + 
                       _('This extension is not supported on your version of GNOME Shell') + '. ',
                halign: Gtk.Align.START,
                use_markup: true,
                visible: true,
            });
            let warning_details_label = new Gtk.Label({
                label: '(<a href="' + GITHUB_URL + '">' + _('Details') + '</a>)',
                halign: Gtk.Align.START,
                use_markup: true,
                visible: true,
            });

            styleWidget('* { background-color: #ffc107; }', warning_box); 
            styleWidget('* { color: black; }', warning_label);
            styleWidget('* { color: #0d6efd; }', warning_details_label);

            warning_box.append(warning_label);
            warning_box.append(warning_details_label);
            warning_frame.set_child(warning_box);
            
            this.main.attach(warning_frame, 0, 0, 2, 3);

            //We add two empty labels as padding
            this.main.attach(new Gtk.Label(), 0, 1, 2, 1);
            this.main.attach(new Gtk.Label(), 0, 2, 2, 1);
        }

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
