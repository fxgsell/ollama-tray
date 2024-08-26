BUNDLE_PATH = "ollama-tray@fxgsell.github.com.zip"
EXTENSION_DIR = "ollama-tray@fxgsell.github.com"

all: build install

.PHONY: build install clean

build:
	rm -f $(BUNDLE_PATH) ; \
	cd $(EXTENSION_DIR) ; \
	rm -f $(EXTENSION_DIR)/schemas/*.compiled ;\
	glib-compile-schemas schemas/ ;\
	gnome-extensions pack --force \
	                      --extra-source=icons/ \
	                      --extra-source=extension.js \
	                      --extra-source=perfs.js ; \
	mv $(EXTENSION_DIR).shell-extension.zip ../$(BUNDLE_PATH)

install:
	gnome-extensions install $(BUNDLE_PATH) --force

enable:
	dbus-run-session -- gnome-extensions enable tailscale@joaophi.github.com

run:
	dbus-run-session -- gnome-shell --nested --wayland

clean:
	@rm -fv $(BUNDLE_PATH)