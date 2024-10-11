{
  description = "Playwright for Nix";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = import (builtins.fetchGit {
          name = "playwright 1.40.0";
          url = "https://github.com/NixOS/nixpkgs/";
          ref = "refs/heads/nixpkgs-unstable";
          rev = "05bbf675397d5366259409139039af8077d695ce";
        });

        playwright = pkgs.playwright-driver;
      in
        with pkgs; {
          devShell = pkgs.mkShell {
            nativeBuildInputs = [];
          };

          shellHook = ''
            export PLAYWRIGHT_BROWSERS_PATH=${playwright.browsers}
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
          '';
        }
    );
}
