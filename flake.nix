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
  };

  outputs =
    {
      nixpkgs,
      fenix,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

        fixedNode = pkgs.nodejs_24;

        rustVer = fenix.packages.${system}.stable;
        rustChan = rustVer.withComponents [
          "cargo"
          "clippy"
          "rust-src"
          "rustc"
          "rustfmt"
          "rust-analyzer"
        ];

        osrd-dev-scripts = pkgs.callPackage ./nix/scripts.nix { };
      in
      with pkgs;
      {
        devShells.default = mkShell {
          buildInputs = [
            # Rust
            rustChan

            # Libs
            geos
            openssl
            pkg-config
            postgresql
            # libs for playwright (see https://wiki.nixos.org/wiki/Playwright)
            playwright-driver.browsers

            # Tools & Libs
            diesel-cli
            cargo-watch
            taplo
            uv
            openfga-cli
            process-compose

            # Core
            gradle
            jdk21

            # Front
            fixedNode

            # Nix formatter
            nixfmt
            nixd

            # OSRD dev scripts
            osrd-dev-scripts
            jq
          ]
          # Section added only on Linux systems
          ++ lib.optionals (!stdenv.isDarwin) [
            # Linker
            mold
          ]
          # Section added only on Darwin (macOS) systems
          ++ lib.optionals stdenv.isDarwin [
            libiconv
          ];

          RUSTFLAGS = if stdenv.isDarwin then "" else "-C link-arg=-fuse-ld=mold";

          # https://wiki.nixos.org/wiki/Playwright
          shellHook = ''
            export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
          '';

        };
      }
    );
}
