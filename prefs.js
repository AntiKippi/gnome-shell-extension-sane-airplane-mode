import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as Constants from './constants.js';

export default class SaneAirplaneModePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const SettingsSchema = this.getSettings();

        const page = new Adw.PreferencesPage();

        const airplaneGroup = new Adw.PreferencesGroup({
            title: _('When disabling airplane mode'),
        });
        const wifiRow  = new Adw.SwitchRow({
            title: _('Enable Wi-Fi'),
        });
        const bluetoothRow = new Adw.SwitchRow({
            title: _('Enable Bluetooth'),
        });
        airplaneGroup.add(wifiRow);
        airplaneGroup.add(bluetoothRow);
        page.add(airplaneGroup);

        const wifiGroup = new Adw.PreferencesGroup({
            title: _('When disabling Wi-Fi (as the last active radio)'),
        });
        const enableAirplaneRow  = new Adw.SwitchRow({
            title: _('Enable airplane mode'),
        });
        wifiGroup.add(enableAirplaneRow);
        page.add(wifiGroup);

        const advancedGroup = new Adw.PreferencesGroup({
            title: _('Advanced'),
        });
        const advancedExpander = new Adw.ExpanderRow({
            title: _('Advanded'),
        });
        const enableDebugLogRow = new Adw.SwitchRow({
            title: _('Enable debug log'),
        });
        const disableRadioIntervalRow = Adw.SpinRow.new_with_range(1, 60000, 1);
        disableRadioIntervalRow.set_title(_('Disable radio interval (in ms)'));
        const maxIntervalCountRow = Adw.SpinRow.new_with_range(1, 1000, 1);
        maxIntervalCountRow.set_title(_('Maximum disable radio count'));
        advancedExpander.add_row(enableDebugLogRow);
        advancedExpander.add_row(disableRadioIntervalRow);
        advancedExpander.add_row(maxIntervalCountRow);
        advancedGroup.add(advancedExpander);
        page.add(advancedGroup);

        SettingsSchema.bind(Constants.Fields.ENABLE_WIFI,            wifiRow,                 'active', Gio.SettingsBindFlags.DEFAULT);
        SettingsSchema.bind(Constants.Fields.ENABLE_BLUETOOTH,       bluetoothRow,            'active', Gio.SettingsBindFlags.DEFAULT);
        SettingsSchema.bind(Constants.Fields.ENABLE_AIRPLANE_MODE,   enableAirplaneRow,       'active', Gio.SettingsBindFlags.DEFAULT);
        SettingsSchema.bind(Constants.Fields.ENABLE_DEBUG_LOG,       enableDebugLogRow,       'active', Gio.SettingsBindFlags.DEFAULT);
        SettingsSchema.bind(Constants.Fields.DISABLE_RADIO_INTERVAL, disableRadioIntervalRow, 'value',  Gio.SettingsBindFlags.DEFAULT);
        SettingsSchema.bind(Constants.Fields.MAX_INTERVAL_COUNT,     maxIntervalCountRow,     'value',  Gio.SettingsBindFlags.DEFAULT);

        window.add(page);
    }
};

