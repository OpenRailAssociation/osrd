{
  lib,
  buildPythonPackage,
}:
buildPythonPackage rec {
  pname = "osrd-schemas";
  version = "0.8.11";

  src = ../python/osrd_schemas;

  doCheck = false;

  meta = with lib; {
    description = "OSRD schemas";
  };
}
