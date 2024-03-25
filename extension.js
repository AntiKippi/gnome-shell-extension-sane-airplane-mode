import GLib from 'gi://GLib';
import NM from 'gi://NM';
import * as Rfkill from 'resource:///org/gnome/shell/ui/status/rfkill.js';
import {Extension, gettext as _} from 'resource:////org/gnome/shell/extensions/extension.js';

import * as Constants from './constants.js';

let ENABLE_WIFI            = false;
let ENABLE_BLUETOOTH       = true;
let ENABLE_AIRPLANE_MODE   = true;
let ENABLE_DEBUG_LOG       = false;
let DISABLE_RADIO_INTERVAL = 25;
let MAX_INTERVAL_COUNT     = 10;


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


export default class SaneAirplaneMode extends Extension {
    async _init() {
        this._loadSettings();

        this._timeouts = [];

        // Create a NetworkManager client
        // This must be async, if we make this call syncronously wireless_enabled isn't true when airplane mode is enabled by disabling Wi-Fi
        this._client = await NM.Client.new_async(null);

        // Get a RfkillManager instance
        this._rfkillManager = Rfkill.getRfkillManager();

        // Initialize management object for WiFi, Bluetooth and airplane mode settings
        this._radioSettings = {
            getBluetoothEnabled: (function() {
                return !this._rfkillManager._proxy.BluetoothAirplaneMode;
            }).bind(this),
            setBluetoothEnabled: (function(arg) {
                this._rfkillManager._proxy.BluetoothAirplaneMode = !arg;
            }).bind(this),

            getWifiEnabled: (function() {
                return this._client.wireless_enabled;
            }).bind(this),
            setWifiEnabled: (function(arg) {
                this._client.wireless_enabled = arg;
            }).bind(this),

            getAirplaneModeEnabled: (function() {
                return this._rfkillManager.airplaneMode;
            }).bind(this),
            setAirplaneModeEnabled: (function(arg) {
                this._rfkillManager.airplaneMode = arg;
            }).bind(this),
        };

        // Initialize oldAirplaneMode
        this._oldAirplaneMode = this._radioSettings.getAirplaneModeEnabled();

        // Initialize skipOnce and runOnce
        this._skipOnce = false;
        this._runOnce = false;

        // Initialize running dictionary
        this._running = {};

        // Connect to the "airplane mode changed" signal
        const signalName = 'notify::airplane-mode';
        this._airplaneHandlerId = this._rfkillManager.connect(signalName, this._handleAirplaneModeChange.bind(this));
    }

    enable() {
        this._init().catch((e) => { logError(e); });
    }

    disable() {
        this._disconnectSettings();
        this._disconnectAirplaneHandler();
        this._disconnectTimeouts();
        this._client = null;
    }

    _logDebug(msg) {
        if (ENABLE_DEBUG_LOG) {
            log(Constants.LOG_PREFIX + msg);
        }
    }

    _getRadioState() {
        return {
            wifi:            this._radioSettings.getWifiEnabled(),
            bluetooth:       this._radioSettings.getBluetoothEnabled(),
            airplaneMode:    this._radioSettings.getAirplaneModeEnabled(),
            oldAirplaneMode: this._oldAirplaneMode,
        };
    }

    _handleAirplaneModeChange() {
        /* Both Wi-Fi and Bluetooth are disabled immediately after airplane mode is disabled
         * and Bluetooth gets activated shortly afterwards without raising any event.
         *
         * Thus, if user doesn't want to enable a radio (ENABLE_<RADIO> is false)
         * we wait until it gets activated and then disable it.
         *
         * This means that if the system doesn't enable the radio it might be erroneously disabled
         * the first time the user activates it in MAX_INTERVAL_COUNT * DISABLE_RADIO_INTERVAL ms if ENABLE_<RADIO> is false
         */
        const createDisableRadioInterval = (radioName, getRadio, setRadio) => {
            // This assumes radioName is unique
            this._running[radioName] ??= false;
            return () => {
                if (this._running[radioName]) {
                    this._logDebug(`Disable ${radioName} already running, not starting again.`);
                } else {
                    this._logDebug(`Registering disable ${radioName} interval`);
                    this._running[radioName] = true;
                    let count = 0;
                    const index = this._timeouts.push(addInterval(() => {
                        if (++count > MAX_INTERVAL_COUNT) {
                            // Remove our timeout
                            this._timeouts.splice(index, 1);

                            this._running[radioName] = false;

                            this._logDebug(`Stopping disable ${radioName} interval`);

                            // Don't repeat any more
                            return false;
                        }

                        this._logDebug(`Executing disable ${radioName} interval the ${count} time`);

                        // Disable Bluetooth as soon as we recognize it has been enabled (by the system)
                        if (getRadio()) {
                            this._logDebug(`${radioName} has been enabled, disabling...`);

                            setRadio(false);

                            // Stop interval
                            count = MAX_INTERVAL_COUNT;
                        }

                        // Repeat
                        return true;
                    }, DISABLE_RADIO_INTERVAL)) - 1;
                }
            };
        };

        const executeDisableWifiInterval = createDisableRadioInterval('WiFi', this._radioSettings.getWifiEnabled, this._radioSettings.setWifiEnabled);
        const executeDisableBtInterval = createDisableRadioInterval('Bluetooth', this._radioSettings.getBluetoothEnabled, this._radioSettings.setBluetoothEnabled);

        this._logDebug('Begin executing handleAirplaneModeChange');
        this._logDebug(`Current state: ${JSON.stringify(this._getRadioState())}`);
        if (this._skipOnce) {
            this._logDebug('Skipping setting application once...');
            this._skipOnce = false;
        } else {
            if (!this._radioSettings.getAirplaneModeEnabled() && // Airplane mode is off and
                this._oldAirplaneMode &&                         // it was previously on, hence it must have been disabled
                this._radioSettings.getBluetoothEnabled() &&     // If Bluetooth is in airplane mode it can't have been disabled
                !this._radioSettings.getWifiEnabled()            // When genuinely disabling airplane mode wireless_enabled is false
            ) {
                this._logDebug('Apply user settings logic has been triggered');

                this._logDebug('Applying user settings');
                this._radioSettings.setWifiEnabled(ENABLE_WIFI);
                this._radioSettings.setBluetoothEnabled(ENABLE_BLUETOOTH);
                this._logDebug(`Settings are now: ${JSON.stringify(this._getRadioState())}`);

                // If WiFi was on before airplane mode was activated, it might also get activated with a slight delay
                if (!ENABLE_WIFI) {
                    /* If WiFi wasn't activated before enabling airplane mode the disable WiFi interval will never end
                     * which can lead to unintended side effects.
                     *
                     * To avoid this we just enable WiFi and then let it be disabled by the interval.
                     * Silly, but it works and is easier than monitoring WiFi state before airplane mode activation.
                     */
                    this._radioSettings.setWifiEnabled(true);

                    executeDisableWifiInterval();
                }
                if (!ENABLE_BLUETOOTH) {
                    executeDisableBtInterval();
                }

                // Run the "Do not enable airplane mode when disabling WiFi" logic once to avoid dropping back into airplane mode
                this._runOnce = !ENABLE_WIFI && !ENABLE_BLUETOOTH;
            }
        }

        if ((!ENABLE_AIRPLANE_MODE || this._runOnce) &&     // Only do if the user disabled ENABLE_AIRPLANE_MODE in the settings or runOnce is set
            this._radioSettings.getAirplaneModeEnabled() && // Airplane mode is on and
            !this._oldAirplaneMode &&                       // it was previously off, hence it must have been enabled
            this._radioSettings.getWifiEnabled()            // Paradoxically if wireless_enabled is true, airplane mode was enabled by disabling Wi-Fi
        ) {
            this._logDebug(`Do not enable airplane mode when disabling WiFi logic has been triggered (runOnce: ${this._runOnce}`);
            this._logDebug('Disabling airplane mode');

            this._runOnce = false;
            this._skipOnce = true;
            this._radioSettings.setAirplaneModeEnabled(false);

            this._logDebug(`Settings are now: ${JSON.stringify(this._getRadioState())}`);

            // We need a timeout again here because Bluetooth gets activated shortly afterwards without any event
            executeDisableBtInterval();
        }

        this._oldAirplaneMode = this._radioSettings.getAirplaneModeEnabled();
        this._logDebug('End executing handleAirplaneModeChange');
    }

    _loadSettings() {
        this._settings = this.getSettings();
        this._settingsChangedId = this._settings.connect('changed', this._fetchSettings.bind(this));

        this._fetchSettings();
    }

    _fetchSettings() {
        ENABLE_WIFI            = this._settings.get_boolean(Constants.Fields.ENABLE_WIFI);
        ENABLE_BLUETOOTH       = this._settings.get_boolean(Constants.Fields.ENABLE_BLUETOOTH);
        ENABLE_AIRPLANE_MODE   = this._settings.get_boolean(Constants.Fields.ENABLE_AIRPLANE_MODE);
        ENABLE_DEBUG_LOG       = this._settings.get_boolean(Constants.Fields.ENABLE_DEBUG_LOG);
        DISABLE_RADIO_INTERVAL = this._settings.get_uint(Constants.Fields.DISABLE_RADIO_INTERVAL);
        MAX_INTERVAL_COUNT     = this._settings.get_uint(Constants.Fields.MAX_INTERVAL_COUNT);
    }

    _disconnectSettings() {
        if (!this._settingsChangedId) {
            return;
        }

        this._settings.disconnect(this._settingsChangedId);
        this._settingsChangedId = null;
        this._settings = null;
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
