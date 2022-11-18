const GLib           = imports.gi.GLib;
const NM             = imports.gi.NM;
const Rfkill         = imports.ui.status.rfkill;
const ExtensionUtils = imports.misc.extensionUtils;

const Gettext = imports.gettext;
const _ = Gettext.domain('sane-airplane-mode').gettext;

const Constants = ExtensionUtils.getCurrentExtension().imports.constants;

const Config = imports.misc.config;
const shellVersion = parseFloat(Config.PACKAGE_VERSION);


let ENABLE_WIFI          = false;
let ENABLE_BLUETOOTH     = true;
let ENABLE_AIRPLANE_MODE = true;

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

    _init() {
        this._loadSettings();

        this._timeouts = [];

        // Create a NetworkManager client
        this._client = NM.Client.new(null);

        // Get a RfkillManager instance
        this._rfkillManager = Rfkill.getRfkillManager();

        // Initialize oldAirplaneMode
        this._oldAirplaneMode = this._rfkillManager.airplaneMode;

        // Initialize skipOnce
        this._skipOnce = false;

        // Connect to the "airplane mode changed" signal
        let signalName = (shellVersion < 43)? 'airplane-mode-changed' : 'notify::airplane-mode';
        this._airplaneHandlerId = this._rfkillManager.connect(signalName, this._handleAirplaneModeChange.bind(this));
    }

    destroy() {
        this._disconnectSettings();
        this._disconnectAirplaneHandler();
        this._disconnectTimeouts();
    }

    _handleAirplaneModeChange() {
        const DELAY = 100;

        if (this._skipOnce) {
            this._skipOnce = false;
        } else {
            if (!this._rfkillManager.airplaneMode &&                  // Airplane mode is off and
                this._oldAirplaneMode &&                              // it was previously on, hence it must have been disabled
                !this._rfkillManager._proxy.BluetoothAirplaneMode &&  // If Bluetooth is in airplane mode it can't have been disabled
                !this._client.wireless_enabled                        // When genuinely disabling airplane mode wireless_enabled is false
            ) {
                // Both Wi-Fi and Bluetooth are disabled immediately after airplane mode is disabled
                // and Bluetooth gets activated shortly afterwards without raising any event
                // thus we need a little time delay to apply our settings.
                // (I am not very happy with this but this is the only solution I can think of)
                let index = this._timeouts.push(setTimeout(() => {
                    // Remove our timeout
                    this._timeouts.splice(index, 1);

                    // If Wi-Fi is enabled but Bluetooth isn't, airplane mode has been disabled
                    // as a side effect of Wi-Fi activation thus we don't apply our settings.
                    if (this._client.wireless_enabled && this._rfkillManager._proxy.BluetoothAirplaneMode) {
                        return;
                    }

                    this._client.wireless_enabled                    = ENABLE_WIFI;
                    this._rfkillManager._proxy.BluetoothAirplaneMode = !ENABLE_BLUETOOTH;
                }, DELAY)) - 1;
            }
        }

        if (!ENABLE_AIRPLANE_MODE &&             // Only do if the user disabled ENABLE_AIRPLANE_MODE in the settings
            this._rfkillManager.airplaneMode &&  // Airplane mode is on and
            !this._oldAirplaneMode &&            // it was previously off, hence it must have been enabled
            this._client.wireless_enabled        // Paradoxically if wireless_enabled is true, airplane mode was enabled by disabling Wi-Fi
        ) {
            this._skipOnce = true;
            this._rfkillManager.airplaneMode = false;

            // We need a timeout again here because Bluetooth gets activated shortly afterwards without any event
            let index = this._timeouts.push(setTimeout(() => {
                // Remove our timeout
                this._timeouts.splice(index, 1);

                this._rfkillManager._proxy.BluetoothAirplaneMode = true;
            }, DELAY)) - 1;
        }

        this._oldAirplaneMode = this._rfkillManager.airplaneMode;
    }

    _loadSettings() {
        this._settings = ExtensionUtils.getSettings(Constants.SCHEMA_NAME);
        this._settingsChangedId = this._settings.connect('changed', this._fetchSettings.bind(this));

        this._fetchSettings();
    }

    _fetchSettings() {
        ENABLE_WIFI          = this._settings.get_boolean(Constants.Fields.ENABLE_WIFI);
        ENABLE_BLUETOOTH     = this._settings.get_boolean(Constants.Fields.ENABLE_BLUETOOTH);
        ENABLE_AIRPLANE_MODE = this._settings.get_boolean(Constants.Fields.ENABLE_AIRPLANE_MODE);
    }

    _disconnectSettings() {
        if (!this._settingsChangedId) {
            return;
        }

        this._settings.disconnect(this._settingsChangedId);
        this._settingsChangedId = null;
    }

    _disconnectAirplaneHandler() {
        if (!this._airplaneHandlerId) {
            return;
        }

        this._rfkillManager.disconnect(this._airplaneHandlerId);
        this._airplaneHandlerId = null;
    }

    _disconnectTimeouts() {
        // Remove all active timeouts
        if (!this._timeouts) {
            return;
        }
        
        for (let i = 0; i < this._timeouts.length; i++) {
            try {
                if (this._timeouts[i]) {
                    GLib.Source.remove(this._timeouts[i]);
                }
            } catch (e) {
                log('Couldn\'t remove timeout: ' + e);
            }
        }

        this._timeouts = null;
    }
};

let saneAirplaneMode;
function enable() {
    saneAirplaneMode = new SaneAirplaneMode();
}

function disable() {
    if (saneAirplaneMode) {
        saneAirplaneMode.destroy();
        saneAirplaneMode = null;
    }
}
