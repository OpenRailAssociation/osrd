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
          ps.isort
          ps.flake8
          ps.intervaltree
          ps.numpy
          ps.mock
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
          ps.pyosmium

          ps.progress
          ps.tqdm
          ps.ipywidgets
        ];

        fixedNode = pkgs.nodejs-18_x;
        fixedNodePackages = pkgs.nodePackages.override {
          nodejs = fixedNode;
        };

        rustChan = pkgs.rust-bin.stable."1.73.0".rust.override {
          targets = [];
          extensions = [
            "clippy"
            "rust-src"
            "rustc-dev"
            "rustfmt"
            "rust-analyzer"
          ];
        };

        scriptFiles = builtins.attrNames (builtins.readDir ./scripts);
        scriptBins =
          map (
            scriptFile:
              pkgs.writeScriptBin
              (pkgs.lib.foldl (fileName: extension: pkgs.lib.strings.removeSuffix extension fileName) scriptFile [".sh" ".py"])
              (builtins.readFile ./scripts/${scriptFile})
          )
          scriptFiles;
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

                # API
                (python310.withPackages pythonPackages)
                poetry

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
              ]
              ++ lib.optionals stdenv.isDarwin (with pkgs.darwin.apple_sdk.frameworks; [
                CoreFoundation
                SystemConfiguration
              ])
              ++ scriptBins;

            RUST_SRC_PATH = "${rustPlatform.rustLibSrc}";
          };
        }
    );
}
