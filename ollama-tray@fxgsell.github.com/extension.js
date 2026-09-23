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
import GLib from 'gi://GLib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

Gio._promisify(Gio.Subprocess.prototype, 'wait_async');

const SYSTEMD_SERVICE = 'ollama.service';
const STARTUP_REFRESH_SECONDS = 2;
const STOP_POLL_MS = 250;
const STOP_POLL_ATTEMPTS = 40;

/* TODO
Low:
- Change Icon based on ollama status
- Background refresh status
- Dynamic refresh model list

*/

export default class OllamaTrayExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._timeoutIds = new Set();

        this._active_indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        Main.panel.addToStatusArea(this.uuid, this._active_indicator);
        let icon = new St.Icon({ 
            style_class: 'ollama-tray-llama-idle', 
        });
        this._active_indicator.add_child(icon);

        this._buildMenu();
    }

    _buildMenu() {
        if (!this._active_indicator)
            return;

        this._active_indicator.menu.removeAll();

        let models;
        try {
            models = this._fetchModels();
        } catch (err) {
            console.log("Ollama endpoint is not accessible: " + err);
            this._addMenuAction(_("Start Ollama serve"), () => this._start());
            return;
        }

        for (const m of models) {
            console.log("Found ollama model: " + m.name);
            this._addMenuAction(_(m.name), () => this._runModel(m.name));
        }

        this._active_indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._addMenuAction(_("Restart Ollama"), () => this._restart());
        this._addMenuAction(_("Stop Ollama"), () => this._stop());
    }

    _addMenuAction(label, action) {
        let item = new PopupMenu.PopupMenuItem(label);
        item.connect('activate', () => {
            Promise.resolve()
                .then(action)
                .catch(e => console.error(e));
        });
        this._active_indicator.menu.addMenuItem(item);
    }

    _fetchModels() {
        const list_models_url = `http://${  this._settings.get_string('url') }/api/tags`;
        let httpSession = new Soup.Session();
        let message = Soup.Message.new('GET', list_models_url);
        let res = httpSession.send_and_read(message, null);
        let raw_data = new TextDecoder().decode(res.get_data());
        return JSON.parse(raw_data)['models'];
    }

    _ollamaCommand() {
        return this._settings.get_string('command').split(" ");
    }

    _runModel(name) {
        let ollama_cmd = this._ollamaCommand();
        ollama_cmd.push('run');
        ollama_cmd.push(name);

        let cmd = [
            'gnome-terminal',
            '--',
            'bash',
            '-c',
            ollama_cmd.join(' ')
        ];
        console.log("Running process: " + cmd);
        Gio.Subprocess.new(cmd, Gio.SubprocessFlags.NONE);
    }

    _start() {
        this._spawnServe();
        this._refreshAfter(STARTUP_REFRESH_SECONDS);
    }

    async _stop() {
        let systemctl = await this._activeServiceSystemctl();
        if (systemctl)
            await this._exec([...systemctl, 'stop', SYSTEMD_SERVICE]);
        else
            await this._stopServeProcess();
        this._buildMenu();
    }

    async _restart() {
        let systemctl = await this._activeServiceSystemctl();
        if (systemctl) {
            await this._exec([...systemctl, 'restart', SYSTEMD_SERVICE]);
        } else {
            await this._stopServeProcess();
            this._spawnServe();
        }
        this._refreshAfter(STARTUP_REFRESH_SECONDS);
    }

    _spawnServe() {
        let cmd = this._ollamaCommand();
        cmd.push('serve');
        Gio.Subprocess.new(cmd, Gio.SubprocessFlags.NONE);
    }

    _servePattern() {
        let executable = GLib.path_get_basename(this._ollamaCommand().at(-1));
        return `^(\\S*/)?${GLib.Regex.escape_string(executable, -1)} serve(\\s|$)`;
    }

    async _stopServeProcess() {
        await this._exec(['pkill', '-f', this._servePattern()]);
        for (let i = 0; i < STOP_POLL_ATTEMPTS; i++) {
            if (!await this._exec(['pgrep', '-f', this._servePattern()]))
                return;
            await this._sleep(STOP_POLL_MS);
        }
        console.warn("Ollama serve did not exit in time");
    }

    async _activeServiceSystemctl() {
        if (await this._exec(['systemctl', '--user', 'is-active', '--quiet', SYSTEMD_SERVICE]))
            return ['systemctl', '--user'];
        if (await this._exec(['systemctl', 'is-active', '--quiet', SYSTEMD_SERVICE]))
            return ['pkexec', 'systemctl'];
        return null;
    }

    async _exec(argv) {
        let proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_SILENCE);
        await proc.wait_async(null);
        return proc.get_successful();
    }

    _sleep(ms) {
        if (!this._timeoutIds)
            return Promise.reject(new Error("Extension was disabled"));
        return new Promise(resolve => {
            let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
                this._timeoutIds.delete(id);
                resolve();
                return GLib.SOURCE_REMOVE;
            });
            this._timeoutIds.add(id);
        });
    }

    _refreshAfter(seconds) {
        this._sleep(seconds * 1000).then(() => this._buildMenu());
    }

    _destroy_active_indicator() {
        if (this._active_indicator) {
            this._active_indicator.destroy();
            this._active_indicator = null;
        }
    }

    disable() {
        for (const id of this._timeoutIds)
            GLib.source_remove(id);
        this._timeoutIds = null;

        this._destroy_active_indicator();

        this._settings = null;
    }
}
