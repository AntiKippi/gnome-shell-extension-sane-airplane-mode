import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {Extension} from 'resource:////org/gnome/shell/extensions/extension.js';

import * as Constants from './constants.js';


// Execute func once after millis milliseconds
const addTimeout = (func, millis) => {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, millis, () => {
        func();

        return false; // Don't repeat
    });
};

// Sleep ms milliseconds. Works only when awaited
const sleep = (ms) => {
    return new Promise(resolve => {
        let index = mainInterface.timeouts.push(addTimeout(() => {
            mainInterface.timeouts.splice(index, 1);
            resolve();
        }, ms));
    });
};

const print = (msg) => {
    // Get directory of PRINT_FILE
    const PRINT_DIR = mainInterface.PRINT_FILE.substring(0, mainInterface.PRINT_FILE.lastIndexOf('/'));

    // Make sure dir exists
    GLib.mkdir_with_parents(PRINT_DIR, 0o700);

    // Append contents to file synchronously
    let file = Gio.file_new_for_path(mainInterface.PRINT_FILE);
    const ostream = file.append_to(Gio.FileCreateFlags.NONE, null)
    ostream.write(msg, null);
    ostream.close(null);
}

const println = (msg) => print(msg + '\n');

// Get the Sane Airplane Mode Settings and cache them
let _samSettings = undefined;
const SAM_UUID = 'sane-airplane-mode@kippi';
const samSettings = () => _samSettings ??= Extension.lookupByUUID(SAM_UUID).getSettings();

// Define if the test suite is currently running
let running = false;


// To be filled by the enable method of the extension
export const mainInterface = {
    radioSettings: undefined,
    timeouts: undefined,
    RADIO_APPLY_DELAY: 1000,
    PRINT_FILE: '/tmp/sam-tests/test.log',
};

export const runTests = async () => {
    // Prevent the suite from being started twice simultaneously
    if(!running) {
        running = true;

        println(`Running test suite at ${(new Date()).toISOString()}`);
        for (const testIndex in tests) {
            const test = tests[testIndex];
            if (test.enabled) {
                println(`Running test ${test.name}`);
                await test.run();
            } else {
                println(`Skipping test ${test.name}`);
            }
            // Print final newline
            println('');
        }
        // Print final newline
        println('');

        running = false;
    } else {
        log('Test suite is already running, not starting again!');
    }
}


// For each combination of initial states of the Wi-Fi and Bluetooth radios enable airplane mode.
// Then disable it again and check if the settings got applied correctly.
// Do this for every possible combination of Sane Airplane Mode settings.
export const disableAirplaneMode = {
    enabled: true,
    name: 'disable-airplane-mode',
    run: async () => {
        println('  WiFi  |   BT   | EnableWifi | EnableBT | WiFiLastRadio | Result')
        println('--------+--------+------------+----------+---------------+-------')
        //print('  false |  false |      false |    false |         false | FAIL (Example message)')
    
        const settings = [true, false];
        for (const wifiSetting of settings) {
            for (const bluetoothSetting of settings) {
                for (const enableWifiSetting of settings) {
                    samSettings().set_boolean(Constants.Fields.ENABLE_WIFI, enableWifiSetting);
                    for (const enableBtSetting of settings) {
                        samSettings().set_boolean(Constants.Fields.ENABLE_BLUETOOTH, enableBtSetting);
                        for (const wifiLastRadioSetting of settings) {
                            samSettings().set_boolean(Constants.Fields.ENABLE_AIRPLANE_MODE, wifiLastRadioSetting);
    
                            // Print a table line (without result) as shown above
                            print(`${wifiSetting} |`.padStart(9, ' ') +
                                        `${bluetoothSetting} |`.padStart(9, ' ') +
                                        `${enableWifiSetting} |`.padStart(13, ' ') +
                                        `${enableBtSetting} |`.padStart(11, ' ') +
                                        `${wifiLastRadioSetting} |`.padStart(16, ' '));
    
                            // Initialize wifi appropriately and wait for it to get applied
                            mainInterface.radioSettings.setWifiEnabled(wifiSetting);
                            await sleep(mainInterface.RADIO_APPLY_DELAY);
                            
                            
                            // Initialize bluetooth appropriately and wait for it to get applied
                            mainInterface.radioSettings.setBluetoothEnabled(bluetoothSetting);
                            await sleep(mainInterface.RADIO_APPLY_DELAY);
    
                            if (mainInterface.radioSettings.getWifiEnabled() != wifiSetting || mainInterface.radioSettings.getBluetoothEnabled() != bluetoothSetting) {
                                println('FAIL (Could not apply radio settings, ' +
                                              `WiFi=${mainInterface.radioSettings.getWifiEnabled()}, BT=${mainInterface.radioSettings.getBluetoothEnabled()})`);
                                continue;
                            }
                            
                            // Enable airplane mode and wait for it to get applied
                            mainInterface.radioSettings.setAirplaneModeEnabled(true);
                            await sleep(mainInterface.RADIO_APPLY_DELAY);
                            
                            // Disable airplane mode again and wait for it to get applied
                            mainInterface.radioSettings.setAirplaneModeEnabled(false);
                            await sleep(mainInterface.RADIO_APPLY_DELAY);
    
                            // Check if the Sane Airplane Mode settings were applied successfully
                            if (mainInterface.radioSettings.getBluetoothEnabled() == enableBtSetting && mainInterface.radioSettings.getWifiEnabled() == enableWifiSetting) {
                                println('SUCCESS');
                            } else {
                                println(`FAIL (WiFi: ${mainInterface.radioSettings.getWifiEnabled()}, BT: ${mainInterface.radioSettings.getBluetoothEnabled()})`);
                            }
                        }
                    }
                }
            }
        }
    }
};

// Test if after disabling WiFi as the last airplane mode does not get activated 
// (if the ENABLE_AIRPLANE_MODE setting false) or gets activate (if the ENABLE_AIRPLANE_MODE) setting is true)
// Ensure that this works for all combinations of ENABLE_WIFI and ENABLE_BLUETOOTH
export const disableWifiLastRadio = {
    enabled: true,
    name: 'disable-wifi-last-radio',
    run: async () => {
        println(' EnableWifi | EnableBT | WiFiLastRadio | Result')
        println('------------+----------+---------------+-------')
        //print('      false |    false |         false | FAIL (Example message)')
    
        const settings = [true, false];
        for (const wifiLastRadioSetting of settings) {
            samSettings().set_boolean(Constants.Fields.ENABLE_AIRPLANE_MODE, wifiLastRadioSetting);
            for (const enableWifiSetting of settings) {
                samSettings().set_boolean(Constants.Fields.ENABLE_WIFI, enableWifiSetting);
                for (const enableBtSetting of settings) {
                    samSettings().set_boolean(Constants.Fields.ENABLE_BLUETOOTH, enableBtSetting);
    
                    // Print a table line (without result) as shown above
                    print(`${enableWifiSetting} |`.padStart(13, ' ') +
                    `${enableBtSetting} |`.padStart(11, ' ') +
                    `${wifiLastRadioSetting} |`.padStart(16, ' '));
    
                    // Enable the radios, wait for the settings to get applied
                    mainInterface.radioSettings.setWifiEnabled(true);
                    await sleep(mainInterface.RADIO_APPLY_DELAY);
    
                    mainInterface.radioSettings.setBluetoothEnabled(true);
                    await sleep(mainInterface.RADIO_APPLY_DELAY);
    
                    if (!mainInterface.radioSettings.getWifiEnabled() || !mainInterface.radioSettings.getBluetoothEnabled()) {
                        println('FAIL (Could not activate all radios, ' +
                                        `WiFi=${mainInterface.radioSettings.getWifiEnabled()}, BT=${mainInterface.radioSettings.getBluetoothEnabled()})`);
                        continue;
                    }
    
                    // Disable bluetooth and wait for application
                    mainInterface.radioSettings.setBluetoothEnabled(false);
                    await sleep(mainInterface.RADIO_APPLY_DELAY);
    
                    if(mainInterface.radioSettings.getBluetoothEnabled()) {
                        println('FAIL (Could not disable BT)');
                        continue;
                    }
    
                    // Disable WiFi and wait for application
                    mainInterface.radioSettings.setWifiEnabled(false);
                    await sleep(mainInterface.RADIO_APPLY_DELAY);
    
                    if(mainInterface.radioSettings.getWifiEnabled()) {
                        println('FAIL (Could not disable WiFi)');
                    } else if (mainInterface.radioSettings.getAirplaneModeEnabled() != wifiLastRadioSetting) {
                        println(`FAIL (Airplane mode: ${mainInterface.radioSettings.getAirplaneModeEnabled()})`);
                    } else {
                        println('SUCCESS');
                    }
                }
            }
        }
    } 
};

// More out of curiosity, check what happens when Bluetooth is disabled as the last active radio
// This test is disabled by default
export const disableBtLastRadio = {
    enabled: false,
    name: 'disable-bt-last-radio',
    run: async () => {
        println(' EnableWifi | EnableBT | WiFiLastRadio | Result')
        println('------------+----------+---------------+-------')
        //print('      false |    false |         false | FAIL (Example message)')
    
        const settings = [true, false];        
        for (const enableWifiSetting of settings) {
            samSettings().set_boolean(Constants.Fields.ENABLE_WIFI, enableWifiSetting);
            for (const enableBtSetting of settings) {
                samSettings().set_boolean(Constants.Fields.ENABLE_BLUETOOTH, enableBtSetting);
                for (const wifiLastRadioSetting of settings) {
                    samSettings().set_boolean(Constants.Fields.ENABLE_AIRPLANE_MODE, wifiLastRadioSetting);
                    // Print a table line (without result) as shown above
                    print(`${enableWifiSetting} |`.padStart(13, ' ') +
                    `${enableBtSetting} |`.padStart(11, ' ') +
                    `${wifiLastRadioSetting} |`.padStart(16, ' '));
    
                    // Enable the radios, wait for the settings to get applied
                    mainInterface.radioSettings.setWifiEnabled(true);
                    await sleep(mainInterface.RADIO_APPLY_DELAY);
    
                    mainInterface.radioSettings.setBluetoothEnabled(true);
                    await sleep(mainInterface.RADIO_APPLY_DELAY);
    
                    if (!mainInterface.radioSettings.getWifiEnabled() || !mainInterface.radioSettings.getBluetoothEnabled()) {
                        println('FAIL (Could not activate all radios, ' +
                                        `WiFi=${mainInterface.radioSettings.getWifiEnabled()}, BT=${mainInterface.radioSettings.getBluetoothEnabled()})`);
                        continue;
                    }
    
                    // Disable WiFi and wait for application
                    mainInterface.radioSettings.setWifiEnabled(false);
                    await sleep(mainInterface.RADIO_APPLY_DELAY);
    
                    if(mainInterface.radioSettings.getWifiEnabled()) {
                        println('FAIL (Could not disable WiFi)');
                        continue;
                    }
    
                    // Disable bluetooth and wait for application
                    mainInterface.radioSettings.setBluetoothEnabled(false);
                    await sleep(mainInterface.RADIO_APPLY_DELAY);
    
                    if(mainInterface.radioSettings.getBluetoothEnabled()) {
                        println('FAIL (Could not disable Bluetooth)');
                    } else {
                        println(`AIRPLANE_MODE: ${mainInterface.radioSettings.getAirplaneModeEnabled()}`);
                    }
                }
            }
        }
    } 
};


// The index must be the dconf key name for the test enabled setting
export const tests = {
    'test-disable-airplane-mode': disableAirplaneMode,
    'test-disable-wifi-last-radio': disableWifiLastRadio,
    'test-disable-bt-last-radio': disableBtLastRadio,
}