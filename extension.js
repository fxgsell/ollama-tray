/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

// import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import System from 'system';

/* TODO


Low:
- Change Icon based on ollama status
- Background refresh status
- Run service
- Dynamic refresh model list

*/

export default class IndicatorExtension extends Extension {
    enable() {
        this._settings = this.getSettings('org.gnome.shell.extensions.ollama-tray');
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._indicator.menu.addAction(_('Preferences'),
        () => this.openPreferences());

        // Create a new GSettings object, and bind the "show-indicator"
        // setting to the "visible" property.
        this._settings = this.getSettings();
        // this._settings.bind('url', this._indicator, 'visible', Gio.SettingsBindFlags.DEFAULT);

        // Watch for changes to a specific setting
        //this._settings.connect('changed::show-indicator', (settings, key) => {
        //    console.debug(`${key} = ${settings.get_value(key).print(true)}`);
        //});

        let icon = new St.Icon({
            icon_name: 'face-smile-symbolic',
            style_class: 'system-status-icon',
        });
        this._indicator.add_child(icon);

        // let item = new PopupMenu.PopupMenuItem(_('Show Notification'));
        // item.connect('activate', () => {
        //     Main.notify(_('Whatʼs up, folks?'));
        // });
        // this.menu.addMenuItem(item);

        const list_models_url = `http://${  this._settings.get_string('url') }/api/tags`

        let httpSession = new Soup.Session();
        let message = Soup.Message.new('GET', list_models_url);
        let res;
        try {
            res = httpSession.send_and_read(message, null);

            let raw_data = res.get_data()
            let models = JSON.parse(imports.byteArray.toString(raw_data))['models'];

            for (let i in models) {
                let m = models[i];
                log("Found model: " + m.name);

                let item = new PopupMenu.PopupMenuItem(_(m.name));
                item.connect('activate', () => {
                    try {
                        let cmd = this._settings.get_string('command').split(" ");
                        cmd.push('run');
                        cmd.push(m.name);
                        const proc = Gio.Subprocess.new(
                            cmd,
                            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                        );
                    } catch (e) {
                        logError(e);
                    }

                });
                this._indicator.menu.addMenuItem(item);
            }
        } catch(err) {
            this._indicator.add_child(new St.Icon({
                icon_name: 'dialog-warning',
                style_class: 'system-status-icon',
            }));
            log("************************** OLLAMA NOT RUNNING: " + res);

            let item = new PopupMenu.PopupMenuItem(_("Start Ollama serve"));
            item.connect('activate', () => {
                try {
                    let cmd = this._settings.get_string('command').split(" ");
                    cmd.push('serve');
                    const proc = Gio.Subprocess.new(
                        cmd,
                        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                    );
                } catch (e) {
                    logError(e);
                }
            });
            this._indicator.menu.addMenuItem(item);
        }

    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
        this._settings = null;
    }
}