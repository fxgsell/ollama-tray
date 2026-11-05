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

        // URL row
        const url_row = new Adw.EntryRow({
            title: _('ollama url'),
            text: window._settings.get_string('url'),
        });
        group.add(url_row);
        window._settings.bind('url', url_row, 'text', Gio.SettingsBindFlags.DEFAULT);

        // Base command row
        const bin_row = new Adw.EntryRow({
            title: _('ollama command'),
            text: window._settings.get_string('command'),
        });
        group.add(bin_row);
        window._settings.bind('command', bin_row, 'text', Gio.SettingsBindFlags.DEFAULT);

        // Run command template row
        const run_cmd_row = new Adw.EntryRow({
            title: _('run command template'),
            text: window._settings.get_string('run-command'),
        });
        run_cmd_row.subtitle = _('Use OLLAMA_CMD as a placeholder. Example: kgx -- OLLAMA_CMD');
        group.add(run_cmd_row);
        window._settings.bind('run-command', run_cmd_row, 'text', Gio.SettingsBindFlags.DEFAULT);
    }
}
