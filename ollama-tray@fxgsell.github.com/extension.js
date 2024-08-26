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

import Soup from 'gi://Soup';
import St from 'gi://St';
import Gio from 'gi://Gio';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/* TODO
Low:
- Change Icon based on ollama status
- Background refresh status
- Run service
- Dynamic refresh model list

*/

export default class OllamaTrayExtension extends Extension {
    enable() {
        this._settings = this.getSettings('org.gnome.shell.extensions.ollama-tray');

        this._settings = this.getSettings();

        const list_models_url = `http://${  this._settings.get_string('url') }/api/tags`
       
        let httpSession = new Soup.Session();
        let message = Soup.Message.new('GET', list_models_url);
        let res;

        this._active_indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        Main.panel.addToStatusArea(this.uuid, this._active_indicator);
        let icon = new St.Icon({ 
            style_class: 'ollama-tray-llama-idle', 
        });
        this._active_indicator.add_child(icon);
        
        try {
            res = httpSession.send_and_read(message, null);

            let raw_data = res.get_data()
            let models = JSON.parse(imports.byteArray.toString(raw_data))['models'];


            
            for (let i in models) {
                let m = models[i];
                console.log("Found model: " + m.name);

                let item = new PopupMenu.PopupMenuItem(_(m.name));
                item.connect('activate', () => {
                    try {
                        let ollama_cmd = this._settings.get_string('command').split(" ");
                        ollama_cmd.push('run');
                        ollama_cmd.push(m.name);

                        let cmd = [
                            'gnome-terminal',
                            '--',
                            'bash',
                            '-c',
                            ollama_cmd.join(' ')
                        ]
                        console.log("Running process: " + cmd);
                        const proc = Gio.Subprocess.new(
                            cmd,
                            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                        );
                        console.log("Ran process: " + proc);
                    } catch (e) {
                        console.log(e);
                    }

                });

                this._active_indicator.menu.addMenuItem(item);
            }
        } catch(err) {
            console.log("Ollama serve is not accessible: " + res);

            let item = new PopupMenu.PopupMenuItem(_("Start Ollama serve"));
            item.connect('activate', () => {
                try {
                    let cmd = this._settings.get_string('command').split(" ");
                    cmd.push('serve');
                    Gio.Subprocess.new(
                        cmd,
                        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                    );
                } catch (e) {
                    console.log(e);
                }
            });
            this._active_indicator.menu.addMenuItem(item);
    
        }

    }

    _destroy_inactive_indicator() {
        if (this._inactive_indicator) {
            this._inactive_indicator.destroy();
            this._inactive_indicator = null;
        }
    }
    _destroy_active_indicator() {
        if (this._active_indicator) {
            this._active_indicator.destroy();
            this._active_indicator = null;
        }
    }

    disable() {
        this._destroy_active_indicator();

        this._settings = null;
    }
}
