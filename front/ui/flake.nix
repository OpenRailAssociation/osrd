{
  description = "A Nix flake for OSRD icons dev shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    alejandra = {
      url = "github:kamadorueda/alejandra/3.0.0";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
    alejandra,
    ...
  } @ inputs:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [];
        };
        fixedNode = pkgs.nodejs_20;
        fixedNodePackages = pkgs.nodePackages.override {
          nodejs = fixedNode;
        };
      in {
        devShell = pkgs.mkShell {
          buildInputs = with pkgs;
            [
              # Nix formatter
              alejandra.defaultPackage.${system}

              # Node version
              fixedNode
              fixedNodePackages.npm
              fixedNodePackages.yarn
            ]
            ++ lib.optionals stdenv.isDarwin (with pkgs.darwin.apple_sdk.frameworks; [
              CoreFoundation
              SystemConfiguration
            ]);
        };
      }
    );
}
