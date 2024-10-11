{
  description = "A Nix flake for OSRD dev shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    flake-compat.url = "https://flakehub.com/f/edolstra/flake-compat/1.tar.gz";
    fenix = {
      url = "github:nix-community/fenix";
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
    fenix,
    flake-utils,
    alejandra,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = import nixpkgs {
          inherit system;
        };

        pythonPackages = ps: (import ./nix/python_env.nix {inherit ps;});

        playwright = import ./nix/playwright.nix;

        fixedNode = pkgs.nodejs_20;
        fixedNodePackages = pkgs.nodePackages.override {
          nodejs = fixedNode;
        };

        rustVer = fenix.packages.${system}.stable;
        rustChan = rustVer.withComponents [
          "cargo"
          "clippy"
          "rust-src"
          "rustc"
          "rustfmt"
          "rust-analyzer"
        ];

        osrd-dev-scripts = pkgs.callPackage ./nix/scripts.nix {};
      in
        with pkgs; {
          devShells.default = mkShell {
            nativeBuildInputs = [
              # Rust
              rustChan
              # Linker
              mold-wrapped
              # Libs
              geos
              openssl
              pkg-config
              postgresql
            ];
            buildInputs =
              [
                # Tools & Libs
                diesel-cli
                cargo-watch
                osmium-tool
                taplo

                # API
                (python311.withPackages pythonPackages)
                ruff-lsp

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

            RUSTFLAGS = "-C link-arg=-fuse-ld=mold";
          };
        }
    );
}
