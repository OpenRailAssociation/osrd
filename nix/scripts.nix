{stdenv}:
stdenv.mkDerivation {
  name = "osrd-dev-scripts";
  src = ../scripts;
  installPhase = ''
    mkdir -p $out/bin
    cp -rv * $out/bin
    # Create symlinks for scripts without the extension (.py, .sh, etc...) for ease of use
    for script in $out/bin/*; do
      ln -s $script $out/bin/$(basename $script | cut -d. -f1)
    done
    chmod +x $out/bin/*
  '';
}
