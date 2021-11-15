const GLib   = imports.gi.GLib;
const NM     = imports.gi.NM;
const Rfkill = imports.ui.status.rfkill;

const Gettext = imports.gettext;
const _ = Gettext.domain('sane-airplane-mode').gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Prefs = Me.imports.prefs;

let ENABLE_WIFI      = false;
let ENABLE_BLUETOOTH = false;


const setTimeout = (func, millis) => {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, millis, () => {
        func();

        return false; // Don't repeat
    });
};


const SaneAirplaneMode = class SaneAirplaneMode {
    constructor() {
        this._init();
    }

    async _init() {
        this._loadSettings();

        // Create a NetworkManager client
        this._client = await NM.Client.new_async(null);

        // Get a RfkillManager instance
        this._rfkillManager = Rfkill.getRfkillManager();

        // Connect to the airplane-mode-changed signal
        this._airplaneHandlerId = this._rfkillManager.connect(
            'airplane-mode-changed',
            this._handleAirplaneModeChange.bind(this)
        );
    }

    destroy() {
        this._disconnectSettings();
        this._disconnectAirplaneHandler();
    }

    _handleAirplaneModeChange() {
        if (!this._rfkillManager.airplaneMode &&                  // We have a change and airplane mode is off, hence it must have been disabled
            !this._rfkillManager._proxy.BluetoothAirplaneMode &&  // If Bluetooth is in airplane mode it can't have been disabled
            !this._client.wireless_enabled                        // When genuinely disabling airplane mode wireless_enabled is false
        ) {
            // Both Wi-Fi and Bluetooth are disabled immediately after airplane mode is disabled
            // and Bluetooth gets activated shortly afterwards without raising any event
            // thus we need a little time delay to apply our settings.
            // (I am not very happy with this but this is the only solution I can think of)
            setTimeout(() => {
                // If Wi-Fi is enabled but Bluetooth isn't airplane mode has been disabled
                // as a side effect of Wi-Fi activation, thus we don't apply our settings.
                if (this._client.wireless_enabled && this._rfkillManager._proxy.BluetoothAirplaneMode) {
                    return;
                }

                this._client.wireless_enabled                    = ENABLE_WIFI;
                this._rfkillManager._proxy.BluetoothAirplaneMode = !ENABLE_BLUETOOTH;
            }, 100);
        }
    }

    _loadSettings() {
        this._settings = Prefs.SettingsSchema;
        this._settingsChangedId = this._settings.connect('changed', this._onSettingsChange.bind(this));

        this._fetchSettings();
    }

    _fetchSettings() {
        ENABLE_WIFI       = this._settings.get_boolean(Prefs.Fields.ENABLE_WIFI);
        ENABLE_BLUETOOTH  = this._settings.get_boolean(Prefs.Fields.ENABLE_BLUETOOTH);
    }

    _onSettingsChange() {
        // Load the settings into variables
        this._fetchSettings();
    }

    _disconnectSettings() {
        if (!this._settingsChangedId)
            return;

        this._settings.disconnect(this._settingsChangedId);
        this._settingsChangedId = null;
    }

    _disconnectAirplaneHandler() {
        if (!this._airplaneHandlerId)
            return;

        this._rfkillManager.disconnect(this._airplaneHandlerId);
        this._airplaneHandlerId = null;
    }
};

let saneAirplaneMode;
function enable() {
    saneAirplaneMode = new SaneAirplaneMode();
}

function disable() {
    saneAirplaneMode.destroy();
}
