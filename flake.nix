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

        scriptFiles = builtins.attrNames (builtins.readDir ./scripts);
        scriptBins =
          map (
            scriptFile:
              pkgs.writeShellScriptBin
              (pkgs.lib.strings.removeSuffix ".sh" scriptFile)
              (pkgs.lib.strings.replaceStrings
                ["#!/bin/sh"] [""]
                (builtins.readFile ./scripts/${scriptFile}))
          )
          scriptFiles;
      in
        with pkgs; {
          devShells.default = mkShell {
            buildInputs =
              [
                # API
                (python310.withPackages pythonPackages)
                poetry

                # EDITOAST
                osmium-tool
                geos
                postgresql
                openssl
                pkg-config
                rustPackages.clippy
                cargo-watch
                cargo-tarpaulin
                rust-analyzer
                rust-bin.stable.latest.default

                # CORE
                jdk17

                # FRONT
                fixedNodePackages.create-react-app
                fixedNodePackages.eslint
                fixedNodePackages.yarn
                fixedNode

                # Nix formatter
                alejandra.defaultPackage.${system}
              ]
              ++ scriptBins;

            RUST_SRC_PATH = "${rustPlatform.rustLibSrc}";
            OSRD_DEV = "True";
            OSRD_BACKEND_URL = "http://localhost:8080";
          };
        }
    );
}
