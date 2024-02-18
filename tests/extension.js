import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import NM from 'gi://NM';
import * as Rfkill from 'resource:///org/gnome/shell/ui/status/rfkill.js';
import {Extension} from 'resource:////org/gnome/shell/extensions/extension.js';

import * as Constants from './constants.js';

const Fields = {
    PRINT_FILE:                 'print-file',
    RADIO_APPLY_DELAY:          'radio-apply-delay',
    START_TESTS:                'start-tests',
    TEST_DISABLE_AIRPLANE_MODE: 'test-disable-airplane-mode',
};

let RADIO_APPLY_DELAY = 1000;
let PRINT_FILE = '/tmp/sam-tests/test.log';


// Execute func once after millis milliseconds
const addTimeout = (func, millis) => {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, millis, () => {
        func();

        return false; // Don't repeat
    });
};


export default class SaneAirplaneMode extends Extension {
    // For each combination of initial states of the Wi-Fi and Bluetooth radios enable airplane mode.
    // Then disable it again and check if the settings got applied correctly.
    // Do this for every possible combination of Sane Airplane Mode settings.
    async _testDisableAirplaneMode() {
        this._println('  WiFi  |   BT   | EnableWifi | EnableBT | WiFiLastRadio | Result')
        this._println('--------+--------+------------+----------+---------------+-------')
        //this._print('  false |  false |      false |    false |         false | FAIL (Example message)')

        const settings = [true, false];
        const sam_settings = Extension.lookupByUUID(Constants.UUID).getSettings();
        let index = undefined; // Used later in the nested loop
        
        for (const wifiSetting of settings) {
            for (const bluetoothSetting of settings) {
                for (const enableWifiSetting of settings) {
                    sam_settings.set_boolean(Constants.Fields.ENABLE_WIFI, enableWifiSetting);
                    for (const enableBtSetting of settings) {
                        sam_settings.set_boolean(Constants.Fields.ENABLE_BLUETOOTH, enableBtSetting);
                        for (const wifiLastRadioSetting of settings) {
                            sam_settings.set_boolean(Constants.Fields.ENABLE_AIRPLANE_MODE, wifiLastRadioSetting);

                            // Print a table line (without result) as shown above
                            this._print(`${wifiSetting} |`.padStart(9, ' ') +
                                        `${bluetoothSetting} |`.padStart(9, ' ') +
                                        `${enableWifiSetting} |`.padStart(13, ' ') +
                                        `${enableBtSetting} |`.padStart(11, ' ') +
                                        `${wifiLastRadioSetting} |`.padStart(16, ' '));

                            // Initialize wifi appropriately and wait for it to get applied
                            this._radioSettings.setWifiEnabled(wifiSetting);
                            index = await this._sleep(RADIO_APPLY_DELAY);
                            this._timeouts.splice(index, 1);
                            
                            // Initialize bluetooth appropriately and wait for it to get applied
                            this._radioSettings.setBluetoothEnabled(bluetoothSetting);
                            index = await this._sleep(RADIO_APPLY_DELAY);
                            this._timeouts.splice(index, 1);

                            if (this._radioSettings.getWifiEnabled() != wifiSetting || this._radioSettings.getBluetoothEnabled() != bluetoothSetting) {
                                this._println('FAIL (Could not apply radio settings, ' +
                                              `WiFi=${this._radioSettings.getWifiEnabled()}, BT=${this._radioSettings.getBluetoothEnabled()})`);
                                continue;
                            }
                            
                            // Enable airplane mode and wait for it to get applied
                            this._radioSettings.setAirplaneModeEnabled(true);
                            index = await this._sleep(RADIO_APPLY_DELAY);
                            this._timeouts.splice(index, 1);
                            
                            // Disable airplane mode again and wait for it to get applied
                            this._radioSettings.setAirplaneModeEnabled(false);
                            index = await this._sleep(RADIO_APPLY_DELAY);
                            this._timeouts.splice(index, 1);

                            // Check if the Sane Airplane Mode settings were applied successfully
                            if (this._radioSettings.getBluetoothEnabled() == enableBtSetting && this._radioSettings.getWifiEnabled() == enableWifiSetting) {
                                this._println('SUCCESS');
                            } else {
                                this._println(`FAIL (WiFi: ${this._radioSettings.getWifiEnabled()}, BT: ${this._radioSettings.getBluetoothEnabled()})`);
                            }
                        }
                    }
                }
            }
        }
    }

    enable() {
        this._timeouts = [];

        // Defines if the test suite is currently running
        this._running = false;

        // _fetchSettings is unhappy if this does not exist
        this._tests = {};

        this._loadSettings();

        // Create a NetworkManager client
        this._client = NM.Client.new(null);

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

        // Must be defined after this._radioSettings otherwise the radioSettings can't be found in the test methods
        this._tests[Fields.TEST_DISABLE_AIRPLANE_MODE] = {
            enabled: true,
            name: 'disable-airplane-mode',
            run: this._testDisableAirplaneMode.bind(this),
        };
    }

    async runTests() {
        // Prevent the suite from being started twice simultaneously
        if(!this._running) {
            this._running = true;

            this._println(`Running test suite at ${(new Date()).toISOString()}`);
            for (const testIndex in this._tests) {
                const test = this._tests[testIndex];
                if (test.enabled) {
                    this._println(`Running test ${test.name}`);
                    await test.run();
                } else {
                    this._println(`Skipping test ${test.name}`);
                }
                // Print final newline
                this._println('');
            }
            // Print final newline
            this._println('');

            this._running = false;
        } else {
            log('Test suite is already running, not starting again!');
        }
    }

    disable() {
        this._disconnectSettings();
        this._disconnectTimeouts();
        this._client = null;
    }

    // Sleep ms milliseconds. Works only when awaited
    _sleep(ms) {
        return new Promise(resolve => { return this._timeouts.push(addTimeout(resolve, ms)); });
    };

    _print(msg) {
        // Get directory of PRINT_FILE
        const PRINT_DIR = PRINT_FILE.substring(0, PRINT_FILE.lastIndexOf('/'));

        // Make sure dir exists
        GLib.mkdir_with_parents(PRINT_DIR, 0o700);

        // Append contents to file synchronously
        let file = Gio.file_new_for_path(PRINT_FILE);
        const ostream = file.append_to(Gio.FileCreateFlags.NONE, null)
        ostream.write(msg, null);
        ostream.close(null);
    }

    _println(msg) {
        this._print(msg + '\n');
    }

    _getRadioState() {
        return {
            wifi:         this._radioSettings.getWifiEnabled(),
            bluetooth:    this._radioSettings.getBluetoothEnabled(),
            airplaneMode: this._radioSettings.getAirplaneModeEnabled(),
        };
    }

    _loadSettings() {
        this._settings = this.getSettings();
        this._settingsChangedId = this._settings.connect('changed', this._fetchSettings.bind(this));

        this._fetchSettings();
    }

    _fetchSettings() {
        RADIO_APPLY_DELAY = this._settings.get_uint(Fields.RADIO_APPLY_DELAY);
        PRINT_FILE = this._settings.get_string(Fields.PRINT_FILE);

        // Automatically load the enabled settings for the tests
        for (const testIndex in this._tests) {
            for (const fieldName in Fields) {
                const field = Fields[fieldName];
                if (testIndex === field) {
                    this._tests[testIndex].enabled = this._settings.get_boolean(field);
                }
            }
        }

        if(this._settings.get_boolean(Fields.START_TESTS)) {
            this.runTests().catch((e) => { logError(e); });
            this._settings.set_boolean(Fields.START_TESTS, false);
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
