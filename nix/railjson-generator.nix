{
  lib,
  buildPythonPackage,
}:
buildPythonPackage rec {
  pname = "railjson-generator";
  version = "0.4.7";

  src = ../python/railjson_generator;

  doCheck = false;

  meta = with lib; {
    description = "Railjson generator";
  };
}
