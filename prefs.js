import Gio from 'gi://Gio';
import Adw from 'gi://Adw';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class OllamaPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings('org.gnome.shell.extensions.ollama-tray');

        // Create a preferences page, with a single group
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: _('Connection'),
            description: _('Configure the connections to Ollama'),
        });
        page.add(group);

        // Create a new preferences row
        const url_row = new Adw.EntryRow({
            title: _('ollama url'),
            text: window._settings.get_string('url'),
            
            // subtitle: _('Whether to show the panel indicator'),
        });
        group.add(url_row);
        window._settings.bind('url', url_row, 'active',  Gio.SettingsBindFlags.DEFAULT);


        // Create a new preferences row
        const bin_row = new Adw.EntryRow({
            title: _('ollama command'),
            text: window._settings.get_string('command'),
            // subtitle: _('Whether to show the panel indicator'),
        });
        group.add(bin_row);
        window._settings.bind('command', bin_row, 'active',  Gio.SettingsBindFlags.DEFAULT);

        // Create a settings object and bind the row to the `show-indicator` key
        // window._settings = this.getSettings();
    }
}