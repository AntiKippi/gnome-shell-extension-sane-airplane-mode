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
let ENABLE_DEBUG         = false;
let APPLY_INTERVAL       = 25;
let APPLY_COUNT          = 10;


// Execute func once after millis milliseconds
const addTimeout = (func, millis) => {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, millis, () => {
        func();

        return false; // Don't repeat
    });
};

// Execute func repeatedly until it returns false or the interval is removed with removeTimeout
const addInterval = (func, millis) => {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, millis, func);
};

// Removes a timeout or an interval
const removeTimeout = (timeoutId) => {
    GLib.Source.remove(timeoutId);
};


const SaneAirplaneMode = class SaneAirplaneMode {
    constructor() {
        this._init().catch((e) => { logError(e); });
    }

    async _init() {
        this._loadSettings();

        this._timeouts = [];

        // Create a NetworkManager client
        // This must be async, if we make this call syncronously wireless_enabled isn't true when airplane mode is enabled by disabling Wi-Fi
        if (shellVersion > 3.36) {
            this._client = await NM.Client.new_async(null);
        } else {
            this._client = NM.Client.new(null);
        }

        // Get a RfkillManager instance
        this._rfkillManager = Rfkill.getRfkillManager();

        // Initialize management object for WiFi, Bluetooth and airplane mode settings
        // We need to use this._sam, which is set to the current SaneAirplaneMode instance
        // because "this" now refers to the _radioSettings object
        this._radioSettings = {
            get bluetoothEnabled() {
                return !this._sam._rfkillManager._proxy.BluetoothAirplaneMode;
            },
            set bluetoothEnabled(arg) {
                this._sam._rfkillManager._proxy.BluetoothAirplaneMode = !arg;
            },

            get wifiEnabled() {
                return this._sam._client.wireless_enabled;
            },
            set wifiEnabled(arg) {
                this._sam._client.wireless_enabled = arg;
            },

            get airplaneModeEnabled() {
                return this._sam._rfkillManager.airplaneMode;
            },
            set airplaneModeEnabled(arg) {
                this._sam._rfkillManager.airplaneMode = arg;
            },
        };
        this._radioSettings._sam = this;

        // Initialize oldAirplaneMode
        this._oldAirplaneMode = this._radioSettings.airplaneModeEnabled;

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

    _logDebug(msg) {
        if (ENABLE_DEBUG) {
            log(Constants.LOG_PREFIX + msg);
        }
    }

    _handleAirplaneModeChange() {
        let getRadioState = () => {
            return {
                wifi:            this._radioSettings.wifiEnabled,
                bluetooth:       this._radioSettings.bluetoothEnabled,
                airplaneMode:    this._radioSettings.airplaneModeEnabled,
                oldAirplaneMode: this._oldAirplaneMode,
            };
        };

        this._logDebug('Begin executing handleAirplaneModeChange');
        this._logDebug(`Current state: ${JSON.stringify(getRadioState())}`);
        if (this._skipOnce) {
            this._logDebug('Skipping setting application once...');
            this._skipOnce = false;
        } else {
            if (!this._radioSettings.airplaneModeEnabled &&     // Airplane mode is off and
                this._oldAirplaneMode &&                        // it was previously on, hence it must have been disabled
                this._radioSettings.bluetoothEnabled &&         // If Bluetooth is in airplane mode it can't have been disabled
                !this._radioSettings.wifiEnabled                // When genuinely disabling airplane mode wireless_enabled is false
            ) {
                this._logDebug('Apply user settings logic has been triggered');

                let applySettings = () => {
                    this._logDebug('Applying settings');
                    this._radioSettings.wifiEnabled      = ENABLE_WIFI;
                    this._radioSettings.bluetoothEnabled = ENABLE_BLUETOOTH;
                    this._logDebug(`Settings are now: ${JSON.stringify(getRadioState())}`);
                };

                applySettings();

                /* Both Wi-Fi and Bluetooth are disabled immediately after airplane mode is disabled
                * and Bluetooth gets activated shortly afterwards without raising any event.
                *
                * Thus we check the settings every APPLY_INTERVAL ms and reapply them.
                * The function executes at least APPLY_COUNT times and then until the settings fit.
                *
                * We execute at least APPLY_COUNT times because even if the settings might seem to have got applied
                * they might be overridden afterwards by the Bluetooth activation.
                *
                * This also means that as a side effect for APPLY_INTERVAL * APPLY_COUNT seconds
                * the WiFi and Bluetooth settings cannot be changed.
                */
                let count = 0;
                let index = this._timeouts.push(addInterval(() => {
                    // Stop this loop when logic has been executed APPLY_COUNT times and the settings are correct
                    if (++count > APPLY_COUNT &&
                        this._radioSettings.wifiEnabled === ENABLE_WIFI &&
                        this._radioSettings.bluetoothEnabled === ENABLE_BLUETOOTH
                    ) {
                        // Remove our timeout
                        this._timeouts.splice(index, 1);

                        this._logDebug('Stopping airplaneModeDisable interval');

                        // Don't repeat any more
                        return false;
                    }

                    this._logDebug(`Executing airplaneModeDisable interval the ${count} time`);
                    this._logDebug(`Current state: ${JSON.stringify(getRadioState())}`);

                    applySettings();

                    // Repeat
                    return true;
                }, APPLY_INTERVAL)) - 1;
            }
        }

        if (!ENABLE_AIRPLANE_MODE &&                    // Only do if the user disabled ENABLE_AIRPLANE_MODE in the settings
            this._radioSettings.airplaneModeEnabled &&  // Airplane mode is on and
            !this._oldAirplaneMode &&                   // it was previously off, hence it must have been enabled
            this._radioSettings.wifiEnabled             // Paradoxically if wireless_enabled is true, airplane mode was enabled by disabling Wi-Fi
        ) {
            this._logDebug('Do not enable airplane mode when disabling WiFi logic has been triggered');
            this._logDebug('Disabling airplane mode and the bluetooth');

            this._skipOnce = true;
            this._radioSettings.airplaneModeEnabled = false;
            this._radioSettings.bluetoothEnabled = false;

            this._logDebug(`Settings are now: ${JSON.stringify(getRadioState())}`);

            // We need a timeout again here because Bluetooth gets activated shortly afterwards without any event
            // The text from the "apply settings" interval also applies with the minor difference that only the Bluetooth state is fixed
            let count = 0;
            let index = this._timeouts.push(addInterval(() => {
                if (++count > APPLY_COUNT &&
                    this._radioSettings.bluetoothEnabled === false
                ) {
                    // Remove our timeout
                    this._timeouts.splice(index, 1);

                    this._logDebug('Stopping disable bt interval');

                    // Don't repeat any more
                    return false;
                }


                this._logDebug(`Executing disable bt interval the ${count} time`);
                this._logDebug(`Current state: ${JSON.stringify(getRadioState())}`);
                this._logDebug('Disabling bluetooth');
                this._radioSettings.bluetoothEnabled = false;
                this._logDebug(`Settings are now: ${JSON.stringify(getRadioState())}`);

                // Repeat
                return true;
            }, APPLY_INTERVAL)) - 1;
        }

        this._oldAirplaneMode = this._radioSettings.airplaneModeEnabled;
        this._logDebug('End executing handleAirplaneModeChange');
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
        ENABLE_DEBUG         = this._settings.get_boolean(Constants.Fields.ENABLE_DEBUG);
        APPLY_INTERVAL       = this._settings.get_boolean(Constants.Fields.APPLY_INTERVAL);
        APPLY_COUNT          = this._settings.get_boolean(Constants.Fields.APPLY_COUNT);
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
                    removeTimeout(this._timeouts[i]);
                }
            } catch (e) {
                logError(e, 'Couldn\'t remove timeout');
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
