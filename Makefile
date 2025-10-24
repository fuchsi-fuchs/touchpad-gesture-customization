NAME=touchpad-gesture-customization
DOMAIN=coooolapps.com
UUID=${NAME}@${DOMAIN}
BUILDDIR=build
ZIPPATH=${BUILDDIR}/${UUID}.zip

.PHONY: pack update

${SCHEMAS_DIR}/gschemas.compiled: ${SCHEMAS_DIR}/org.gnome.shell.extensions.$(NAME).gschema.xml
		

pack:
	mkdir -p ${BUILDDIR}
	cp -r extension/assets extension/stylesheet.css extension/ui extension/schemas metadata.json $(BUILDDIR)
	glib-compile-schemas --strict ${BUILDDIR}/schemas
	rm -f ${ZIPPATH}
	(cd ${BUILDDIR} && zip -r ${UUID}.zip .)

update:
	gnome-extensions install -f ${ZIPPATH}