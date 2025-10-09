# Train simulation module

This is the module that integrates [libtsim] into core.

Just a note that this directory changes the cargo configuration to put the
target directory in `build/rust`, to match gradle build conventions (and to
ensure gradle builds this correctly if your cargo is configured with a custom
target directory).

Have a good day!

[libtsim]: ./libtsim
