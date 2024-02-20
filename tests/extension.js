import GLib from 'gi://GLib';
import NM from 'gi://NM';
import * as Rfkill from 'resource:///org/gnome/shell/ui/status/rfkill.js';
import {Extension} from 'resource:////org/gnome/shell/extensions/extension.js';

import * as Tests from './tests.js';

const Fields = {
    PRINT_FILE:                   'print-file',
    RADIO_APPLY_DELAY:            'radio-apply-delay',
    START_TESTS:                  'start-tests',
    TEST_DISABLE_AIRPLANE_MODE:   '',
    TEST_DISABLE_WIFI_LAST_RADIO: 'test-disable-wifi-last-radio',
    TEST_DISABLE_BT_LAST_RADIO:   'test-disable-bt-last-radio', 
};


// Removes a timeout or an interval
const removeTimeout = (timeoutId) => {
    GLib.Source.remove(timeoutId);
};

export default class SaneAirplaneMode extends Extension {
    enable() {
        this._loadSettings();

        // Create a NetworkManager client
        this._client = NM.Client.new(null);

        // Get a RfkillManager instance
        this._rfkillManager = Rfkill.getRfkillManager();

        Tests.mainInterface.timeouts = [];

        // Initialize management object for WiFi, Bluetooth and airplane mode settings
        Tests.mainInterface.radioSettings = {
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
    }

    disable() {
        this._disconnectSettings();
        this._disconnectTimeouts();
        this._client = null;
    }

    /*_getRadioState() {
        return {
            wifi:         this._radioSettings.getWifiEnabled(),
            bluetooth:    this._radioSettings.getBluetoothEnabled(),
            airplaneMode: this._radioSettings.getAirplaneModeEnabled(),
        };
    }*/

    _loadSettings() {
        this._settings = this.getSettings();

        // Don't run the test suite on extension startup
        this._settings.set_boolean(Fields.START_TESTS, false);

        this._settingsChangedId = this._settings.connect('changed', this._fetchSettings.bind(this));

        this._fetchSettings();
    }

    _fetchSettings() {
        Tests.mainInterface.RADIO_APPLY_DELAY = this._settings.get_uint(Fields.RADIO_APPLY_DELAY);
        Tests.mainInterface.PRINT_FILE = this._settings.get_string(Fields.PRINT_FILE);

        // Automatically load the enabled settings for the tests
        for (const testIndex in Tests.tests) {
            Tests.tests[testIndex].enabled = this._settings.get_boolean(testIndex);
        }

        if(this._settings.get_boolean(Fields.START_TESTS)) {
            Tests.runTests()
                .then(() => this._settings.set_boolean(Fields.START_TESTS, false))
                .catch((e) => { logError(e); });
        }
    }

    _disconnectSettings() {
        if (!this._settingsChangedId) {
            return;
        }

        this._settings.disconnect(this._settingsChangedId);
        this._settingsChangedId = null;
        this._settings = null;
    }

    _disconnectTimeouts() {
        // Remove all active timeouts
        if (!Tests.mainInterface.timeouts) {
            return;
        }

        for (let i = 0; i < Tests.mainInterface.timeouts.length; i++) {
            try {
                if (Tests.mainInterface.timeouts[i]) {
                    removeTimeout(Test.mainInterface.timeouts[i]);
                }
            } catch (e) {
                logError(e, 'Couldn\'t remove timeout');
            }
        }

        Tests.mainInterface.timeouts = null;
    }
};
