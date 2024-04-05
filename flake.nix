{
  description = "A Nix flake for OSRD dev shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    flake-compat.url = "https://flakehub.com/f/edolstra/flake-compat/1.tar.gz";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    alejandra = {
      url = "github:kamadorueda/alejandra/3.0.0";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    self,
    nixpkgs,
    rust-overlay,
    flake-utils,
    alejandra,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [rust-overlay.overlays.default];
        };
        pythonPackages = ps: [
          ps.black
          ps.flake8
          ps.intervaltree
          ps.isort
          ps.mock
          ps.numpy
          ps.pillow
          ps.psycopg
          ps.psycopg2
          ps.pyyaml
          ps.requests
          ps.websockets
          (ps.callPackage (import ./nix/kdtree.nix) {})
          (ps.callPackage (import ./nix/geojson-pydantic.nix) {inherit (ps) pydantic;})

          # DATA SCIENCE
          ps.ipykernel
          ps.jupyterlab
          ps.shapely
          ps.pyproj
          ps.ipympl
          ps.matplotlib
          ps.networkx

          ps.progress
          ps.tqdm
          ps.ipywidgets
        ];

        fixedNode = pkgs.nodejs-18_x;
        fixedNodePackages = pkgs.nodePackages.override {
          nodejs = fixedNode;
        };

        rustChan = pkgs.rust-bin.stable."1.77.1".default.override {
          targets = [];
          extensions = [
            "clippy"
            "rust-src"
            "rustc-dev"
            "rustfmt"
            "rust-analyzer"
          ];
        };

        osrd-dev-scripts = pkgs.stdenv.mkDerivation {
          name = "osrd-dev-scripts";
          src = ./scripts;
          installPhase = ''
            mkdir -p $out/bin
            cp -rv * $out/bin
            # Create symlinks for scripts without the extension (.py, .sh, etc...) for ease of use
            for script in $out/bin/*; do
              ln -s $script $out/bin/$(basename $script | cut -d. -f1)
            done
            chmod +x $out/bin/*
          '';
        };
      in
        with pkgs; {
          devShells.default = mkShell {
            nativeBuildInputs = [rustChan];
            buildInputs =
              [
                # Tools & Libs
                diesel-cli
                cargo-watch
                osmium-tool
                geos
                openssl
                pkg-config
                postgresql
                taplo

                # API
                (python311.withPackages pythonPackages)

                # Core
                gradle
                jdk17

                # Front
                fixedNodePackages.create-react-app
                fixedNodePackages.eslint
                fixedNodePackages.yarn
                fixedNode

                # Nix formatter
                alejandra.defaultPackage.${system}

                # OSRD dev scripts
                osrd-dev-scripts
              ]
              ++ lib.optionals stdenv.isDarwin (with pkgs.darwin.apple_sdk.frameworks; [
                CoreFoundation
                SystemConfiguration
              ]);

            RUST_SRC_PATH = "${rustPlatform.rustLibSrc}";
          };
        }
    );
}
